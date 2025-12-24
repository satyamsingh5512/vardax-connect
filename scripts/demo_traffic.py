#!/usr/bin/env python3
"""
Advanced Attack Traffic Simulator for VARDAx.

Generates realistic traffic patterns including:
- Normal traffic baseline
- Bot attacks (high rate, scanning)
- API abuse (sequence violations, parameter tampering)
- Credential stuffing (login brute force)
- Low-and-slow attacks (distributed, stealthy)
- Zero-day style anomalies (unusual patterns)

Usage:
    python scripts/demo_traffic.py --url http://localhost:8000 --scenario mixed
"""
import argparse
import asyncio
import aiohttp
import random
import string
import time
import math
from datetime import datetime
from typing import Dict, Any, List

# ============================================================================
# TRAFFIC PROFILES
# ============================================================================

NORMAL_ENDPOINTS = [
    "/api/v1/users",
    "/api/v1/products",
    "/api/v1/orders",
    "/api/v1/cart",
    "/api/v1/search",
    "/api/v1/categories",
    "/api/v1/reviews",
]

API_SEQUENCE_NORMAL = [
    "/api/v1/auth/login",
    "/api/v1/users/me",
    "/api/v1/products",
    "/api/v1/cart",
    "/api/v1/orders",
]

NORMAL_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
]

ATTACK_USER_AGENTS = [
    "sqlmap/1.7.2#stable (https://sqlmap.org)",
    "nikto/2.1.6",
    "curl/7.88.1",
    "python-requests/2.31.0",
    "Wget/1.21.3",
    "Go-http-client/1.1",
    "masscan/1.3.2",
]

SQL_INJECTION_PAYLOADS = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "1 UNION SELECT * FROM passwords",
    "admin'--",
    "1' AND SLEEP(5)--",
    "' OR 1=1--",
    "1; SELECT * FROM information_schema.tables--",
]

PATH_TRAVERSAL_PAYLOADS = [
    "../../../etc/passwd",
    "....//....//....//etc/passwd",
    "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    "..\\..\\..\\windows\\system32\\config\\sam",
    "/etc/passwd%00.jpg",
]

XSS_PAYLOADS = [
    "<script>alert('xss')</script>",
    "<img src=x onerror=alert('xss')>",
    "javascript:alert('xss')",
    "<svg onload=alert('xss')>",
]


# ============================================================================
# REQUEST GENERATORS
# ============================================================================

def generate_request_id() -> str:
    """Generate unique request ID."""
    return f"req-{int(time.time() * 1000)}-{random.randint(1000, 9999)}"


def generate_normal_request(session_ip: str = None) -> Dict[str, Any]:
    """Generate a normal-looking request."""
    ip = session_ip or f"192.168.{random.randint(1, 254)}.{random.randint(1, 254)}"
    
    return {
        "request_id": generate_request_id(),
        "timestamp": datetime.utcnow().isoformat(),
        "client_ip": ip,
        "client_port": random.randint(30000, 65000),
        "user_agent": random.choice(NORMAL_USER_AGENTS),
        "method": random.choices(["GET", "POST", "PUT", "DELETE"], weights=[70, 20, 8, 2])[0],
        "uri": random.choice(NORMAL_ENDPOINTS),
        "query_string": f"page={random.randint(1, 10)}&limit=20" if random.random() > 0.5 else None,
        "protocol": "HTTP/1.1",
        "content_type": "application/json" if random.random() > 0.7 else None,
        "content_length": random.randint(0, 1000),
        "has_auth_header": random.random() > 0.3,
        "has_cookie": random.random() > 0.2,
        "body_length": random.randint(0, 500),
        "body_entropy": random.uniform(2.0, 4.0),
        "body_printable_ratio": random.uniform(0.95, 1.0),
        "request_time_ms": random.uniform(10, 100),
    }


def generate_bot_attack() -> Dict[str, Any]:
    """Generate bot/scanner attack traffic."""
    base = generate_normal_request()
    
    # Bot characteristics
    base["client_ip"] = f"10.0.0.{random.randint(1, 10)}"  # Small IP range
    base["user_agent"] = random.choice(ATTACK_USER_AGENTS)
    base["has_cookie"] = False
    base["has_auth_header"] = False
    
    # Scanning behavior - sequential endpoints
    base["uri"] = f"/api/v1/endpoint-{random.randint(1, 1000)}"
    base["body_entropy"] = random.uniform(1.0, 2.0)  # Low entropy
    
    return base


def generate_credential_stuffing() -> Dict[str, Any]:
    """Generate credential stuffing attack."""
    base = generate_normal_request()
    
    base["client_ip"] = f"172.16.{random.randint(1, 5)}.{random.randint(1, 254)}"
    base["method"] = "POST"
    base["uri"] = "/api/v1/auth/login"
    base["content_type"] = "application/json"
    base["body_length"] = random.randint(50, 150)
    base["body_entropy"] = random.uniform(3.5, 4.5)
    base["has_cookie"] = False
    
    return base


def generate_api_abuse() -> Dict[str, Any]:
    """Generate API abuse pattern (wrong sequence, parameter tampering)."""
    base = generate_normal_request()
    
    # Skip authentication, go directly to protected endpoints
    base["uri"] = random.choice(["/api/v1/admin/users", "/api/v1/orders/all", "/api/v1/internal/config"])
    base["has_auth_header"] = False
    base["method"] = random.choice(["GET", "POST", "DELETE"])
    
    # Parameter tampering
    base["query_string"] = f"user_id={random.randint(1, 10000)}&admin=true&debug=1"
    
    return base


def generate_sqli_attack() -> Dict[str, Any]:
    """Generate SQL injection attack."""
    base = generate_normal_request()
    
    payload = random.choice(SQL_INJECTION_PAYLOADS)
    base["uri"] = f"/api/v1/users?id={payload}"
    base["query_string"] = f"id={payload}"
    base["body_entropy"] = random.uniform(4.5, 6.0)  # High entropy from special chars
    base["user_agent"] = random.choice(ATTACK_USER_AGENTS) if random.random() > 0.5 else base["user_agent"]
    
    return base


def generate_path_traversal() -> Dict[str, Any]:
    """Generate path traversal attack."""
    base = generate_normal_request()
    
    payload = random.choice(PATH_TRAVERSAL_PAYLOADS)
    base["uri"] = f"/api/v1/files/{payload}"
    base["body_entropy"] = random.uniform(4.0, 5.5)
    
    return base


def generate_low_and_slow() -> Dict[str, Any]:
    """Generate low-and-slow attack (stealthy, distributed)."""
    base = generate_normal_request()
    
    # Distributed IPs
    base["client_ip"] = f"{random.randint(1, 223)}.{random.randint(1, 254)}.{random.randint(1, 254)}.{random.randint(1, 254)}"
    
    # Looks normal but targets sensitive endpoints
    base["uri"] = random.choice(["/api/v1/auth/login", "/api/v1/auth/reset-password", "/api/v1/auth/verify"])
    base["request_time_ms"] = random.uniform(100, 500)  # Slower requests
    
    return base


def generate_zero_day_style() -> Dict[str, Any]:
    """Generate zero-day style anomaly (unusual but not matching known patterns)."""
    base = generate_normal_request()
    
    # Unusual characteristics that don't match known attack signatures
    base["uri"] = f"/api/v1/{''.join(random.choices(string.ascii_lowercase, k=20))}"
    base["method"] = random.choice(["PATCH", "OPTIONS", "TRACE"])
    base["body_entropy"] = random.uniform(5.0, 7.0)  # Very high entropy
    base["body_printable_ratio"] = random.uniform(0.5, 0.8)  # Binary-ish content
    base["content_type"] = "application/octet-stream"
    base["body_length"] = random.randint(5000, 50000)  # Large payload
    
    return base


# ============================================================================
# ATTACK SCENARIOS
# ============================================================================

class AttackScenario:
    """Base class for attack scenarios."""
    
    def __init__(self, name: str, duration_seconds: int = 60):
        self.name = name
        self.duration = duration_seconds
        self.start_time = None
    
    def get_request(self) -> Dict[str, Any]:
        raise NotImplementedError


class MixedTrafficScenario(AttackScenario):
    """Mixed normal and attack traffic."""
    
    def __init__(self, attack_rate: float = 0.1):
        super().__init__("mixed")
        self.attack_rate = attack_rate
        self.attack_generators = [
            generate_bot_attack,
            generate_credential_stuffing,
            generate_api_abuse,
            generate_sqli_attack,
            generate_low_and_slow,
        ]
    
    def get_request(self) -> Dict[str, Any]:
        if random.random() < self.attack_rate:
            generator = random.choice(self.attack_generators)
            return generator()
        return generate_normal_request()


class BotAttackScenario(AttackScenario):
    """Concentrated bot attack."""
    
    def __init__(self):
        super().__init__("bot_attack")
        self.bot_ips = [f"10.0.0.{i}" for i in range(1, 6)]
    
    def get_request(self) -> Dict[str, Any]:
        if random.random() < 0.7:  # 70% bot traffic
            req = generate_bot_attack()
            req["client_ip"] = random.choice(self.bot_ips)
            return req
        return generate_normal_request()


class CredentialStuffingScenario(AttackScenario):
    """Credential stuffing attack wave."""
    
    def __init__(self):
        super().__init__("credential_stuffing")
        self.attacker_ips = [f"172.16.1.{i}" for i in range(1, 20)]
    
    def get_request(self) -> Dict[str, Any]:
        if random.random() < 0.6:
            req = generate_credential_stuffing()
            req["client_ip"] = random.choice(self.attacker_ips)
            return req
        return generate_normal_request()


class ZeroDayScenario(AttackScenario):
    """Zero-day style attack simulation."""
    
    def __init__(self):
        super().__init__("zero_day")
    
    def get_request(self) -> Dict[str, Any]:
        if random.random() < 0.15:
            return generate_zero_day_style()
        return generate_normal_request()


# ============================================================================
# MAIN SIMULATOR
# ============================================================================

async def send_request(session: aiohttp.ClientSession, url: str, data: Dict) -> int:
    """Send request to API."""
    try:
        async with session.post(url, json=data, timeout=5) as response:
            return response.status
    except Exception as e:
        return 0


async def run_simulation(
    base_url: str,
    scenario: AttackScenario,
    duration_seconds: int,
    requests_per_second: int = 50
):
    """Run attack simulation."""
    print(f"🚀 Starting {scenario.name} scenario")
    print(f"   Target: {base_url}")
    print(f"   Duration: {duration_seconds}s")
    print(f"   Rate: {requests_per_second} req/s")
    print("")
    
    url = f"{base_url}/api/v1/traffic/ingest"
    
    async with aiohttp.ClientSession() as session:
        start_time = time.time()
        request_count = 0
        attack_count = 0
        error_count = 0
        
        while time.time() - start_time < duration_seconds:
            batch_start = time.time()
            tasks = []
            
            # Send batch of requests
            for _ in range(requests_per_second):
                data = scenario.get_request()
                
                # Track attacks
                if data.get("user_agent") in ATTACK_USER_AGENTS or \
                   "10.0.0" in data.get("client_ip", "") or \
                   "172.16" in data.get("client_ip", ""):
                    attack_count += 1
                
                tasks.append(send_request(session, url, data))
                request_count += 1
            
            # Wait for batch
            results = await asyncio.gather(*tasks, return_exceptions=True)
            error_count += sum(1 for r in results if r == 0 or isinstance(r, Exception))
            
            # Progress
            elapsed = time.time() - start_time
            actual_rate = request_count / elapsed
            print(f"   [{elapsed:.0f}s] Sent {request_count} requests ({attack_count} attacks) - {actual_rate:.1f} req/s")
            
            # Rate limiting
            batch_duration = time.time() - batch_start
            if batch_duration < 1.0:
                await asyncio.sleep(1.0 - batch_duration)
        
        print("")
        print(f"✅ Simulation complete!")
        print(f"   Total requests: {request_count}")
        print(f"   Attack requests: {attack_count} ({attack_count/request_count*100:.1f}%)")
        print(f"   Errors: {error_count}")
        print(f"   Duration: {time.time() - start_time:.1f}s")


def main():
    parser = argparse.ArgumentParser(description="VARDAx Attack Traffic Simulator")
    parser.add_argument("--url", default="http://localhost:8000", help="Backend URL")
    parser.add_argument("--duration", type=int, default=60, help="Duration in seconds")
    parser.add_argument("--rate", type=int, default=50, help="Requests per second")
    parser.add_argument(
        "--scenario",
        choices=["mixed", "bot", "credential", "zero_day"],
        default="mixed",
        help="Attack scenario"
    )
    parser.add_argument("--attack-rate", type=float, default=0.15, help="Attack probability for mixed scenario")
    args = parser.parse_args()
    
    # Select scenario
    scenarios = {
        "mixed": MixedTrafficScenario(args.attack_rate),
        "bot": BotAttackScenario(),
        "credential": CredentialStuffingScenario(),
        "zero_day": ZeroDayScenario(),
    }
    
    scenario = scenarios[args.scenario]
    
    asyncio.run(run_simulation(
        args.url,
        scenario,
        args.duration,
        args.rate
    ))


if __name__ == "__main__":
    main()
