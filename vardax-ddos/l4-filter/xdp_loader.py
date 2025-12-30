#!/usr/bin/env python3
"""
vardax-ddos/l4-filter/xdp_loader.py
VardaX XDP/eBPF Loader and Manager

This script loads the XDP program, manages blocklists, and exposes metrics.
Requires: bcc, pyroute2, prometheus_client
"""

import os
import sys
import time
import signal
import socket
import struct
import argparse
import threading
from typing import Dict, Set, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta

try:
    from bcc import BPF, XDPFlags
    HAS_BCC = True
except ImportError:
    HAS_BCC = False
    print("WARNING: BCC not available, using nftables fallback")

from prometheus_client import start_http_server, Counter, Gauge
import redis
import json
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('vardax-xdp')

# Prometheus metrics
PACKETS_TOTAL = Counter('vardax_xdp_packets_total', 'Total packets processed', ['action'])
BLOCKED_IPS = Gauge('vardax_xdp_blocked_ips', 'Number of blocked IPs')
RATE_LIMITED = Counter('vardax_xdp_rate_limited_total', 'Rate limited packets', ['protocol'])
DROP_EVENTS = Counter('vardax_xdp_drop_events_total', 'Drop events by reason', ['reason'])

# XDP program source (embedded for simplicity, can also load from file)
XDP_PROGRAM = """
// Simplified inline XDP program for systems without full build environment
#include <uapi/linux/bpf.h>
#include <uapi/linux/if_ether.h>
#include <uapi/linux/ip.h>
#include <uapi/linux/tcp.h>
#include <uapi/linux/udp.h>

BPF_HASH(blocklist, u32, u64, 100000);
BPF_HASH(allowlist, u32, u8, 1000);
BPF_HASH(rate_state, u32, u64, 1000000);
BPF_ARRAY(counters, u64, 8);
BPF_ARRAY(config, u32, 4);

int xdp_filter(struct xdp_md *ctx) {
    void *data_end = (void *)(long)ctx->data_end;
    void *data = (void *)(long)ctx->data;
    
    // Increment total counter
    int idx = 0;
    u64 *cnt = counters.lookup(&idx);
    if (cnt) (*cnt)++;
    
    struct ethhdr *eth = data;
    if ((void *)(eth + 1) > data_end)
        return XDP_PASS;
    
    if (eth->h_proto != htons(ETH_P_IP))
        return XDP_PASS;
    
    struct iphdr *ip = (void *)(eth + 1);
    if ((void *)(ip + 1) > data_end)
        return XDP_PASS;
    
    u32 src_ip = ip->saddr;
    
    // Check allowlist
    u8 *allowed = allowlist.lookup(&src_ip);
    if (allowed)
        return XDP_PASS;
    
    // Check blocklist
    u64 *blocked = blocklist.lookup(&src_ip);
    if (blocked) {
        u64 now = bpf_ktime_get_ns();
        if (*blocked == 0 || *blocked > now) {
            idx = 2;
            cnt = counters.lookup(&idx);
            if (cnt) (*cnt)++;
            return XDP_DROP;
        }
    }
    
    // Simple rate limiting
    u64 *rate = rate_state.lookup(&src_ip);
    u64 now = bpf_ktime_get_ns();
    u64 window = now / 1000000000;  // 1 second window
    
    if (rate) {
        u64 last_window = *rate >> 32;
        u32 count = *rate & 0xFFFFFFFF;
        
        if (last_window == window) {
            count++;
            if (count > 10000) {  // 10k pps limit
                idx = 3;
                cnt = counters.lookup(&idx);
                if (cnt) (*cnt)++;
                return XDP_DROP;
            }
        } else {
            count = 1;
        }
        
        u64 new_state = (window << 32) | count;
        rate_state.update(&src_ip, &new_state);
    } else {
        u64 new_state = (window << 32) | 1;
        rate_state.update(&src_ip, &new_state);
    }
    
    idx = 1;
    cnt = counters.lookup(&idx);
    if (cnt) (*cnt)++;
    
    return XDP_PASS;
}
"""

@dataclass
class XDPConfig:
    interface: str
    syn_rate_limit: int = 100
    udp_rate_limit: int = 1000
    icmp_rate_limit: int = 10
    total_rate_limit: int = 10000
    enabled: bool = True
    log_drops: bool = True


class XDPManager:
    """Manages XDP program lifecycle and blocklist updates"""
    
    def __init__(self, config: XDPConfig, redis_client: Optional[redis.Redis] = None):
        self.config = config
        self.redis = redis_client
        self.bpf = None
        self.running = False
        self.blocklist: Set[str] = set()
        self._lock = threading.Lock()
        
    def load(self) -> bool:
        """Load XDP program onto interface"""
        if not HAS_BCC:
            logger.warning("BCC not available, XDP filtering disabled")
            return False
            
        try:
            logger.info(f"Loading XDP program on {self.config.interface}")
            
            # Compile and load BPF program
            self.bpf = BPF(text=XDP_PROGRAM)
            fn = self.bpf.load_func("xdp_filter", BPF.XDP)
            
            # Attach to interface
            self.bpf.attach_xdp(self.config.interface, fn, XDPFlags.SKB_MODE)
            
            logger.info("XDP program loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load XDP program: {e}")
            return False
    
    def unload(self):
        """Unload XDP program from interface"""
        if self.bpf:
            try:
                self.bpf.remove_xdp(self.config.interface)
                logger.info("XDP program unloaded")
            except Exception as e:
                logger.error(f"Failed to unload XDP: {e}")
    
    def block_ip(self, ip: str, duration_seconds: int = 0):
        """Add IP to blocklist
        
        Args:
            ip: IPv4 address to block
            duration_seconds: Block duration (0 = permanent)
        """
        with self._lock:
            try:
                ip_int = struct.unpack("!I", socket.inet_aton(ip))[0]
                
                if duration_seconds > 0:
                    expiry = int(time.time_ns()) + (duration_seconds * 1_000_000_000)
                else:
                    expiry = 0
                
                if self.bpf:
                    blocklist = self.bpf["blocklist"]
                    blocklist[ip_int] = expiry
                
                self.blocklist.add(ip)
                BLOCKED_IPS.set(len(self.blocklist))
                
                # Sync to Redis for cluster coordination
                if self.redis:
                    self.redis.hset("vardax:blocklist", ip, json.dumps({
                        "blocked_at": datetime.utcnow().isoformat(),
                        "expires_at": (datetime.utcnow() + timedelta(seconds=duration_seconds)).isoformat() if duration_seconds > 0 else None,
                        "reason": "xdp_block"
                    }))
                
                logger.info(f"Blocked IP: {ip} for {duration_seconds}s")
                
            except Exception as e:
                logger.error(f"Failed to block IP {ip}: {e}")
    
    def unblock_ip(self, ip: str):
        """Remove IP from blocklist"""
        with self._lock:
            try:
                ip_int = struct.unpack("!I", socket.inet_aton(ip))[0]
                
                if self.bpf:
                    blocklist = self.bpf["blocklist"]
                    del blocklist[ip_int]
                
                self.blocklist.discard(ip)
                BLOCKED_IPS.set(len(self.blocklist))
                
                if self.redis:
                    self.redis.hdel("vardax:blocklist", ip)
                
                logger.info(f"Unblocked IP: {ip}")
                
            except Exception as e:
                logger.error(f"Failed to unblock IP {ip}: {e}")
    
    def allow_ip(self, ip: str):
        """Add IP to allowlist (bypass all filtering)"""
        try:
            ip_int = struct.unpack("!I", socket.inet_aton(ip))[0]
            
            if self.bpf:
                allowlist = self.bpf["allowlist"]
                allowlist[ip_int] = 1
            
            logger.info(f"Allowed IP: {ip}")
            
        except Exception as e:
            logger.error(f"Failed to allow IP {ip}: {e}")
    
    def get_counters(self) -> Dict[str, int]:
        """Get packet counters"""
        if not self.bpf:
            return {}
        
        try:
            counters = self.bpf["counters"]
            return {
                "total": counters[0].value,
                "passed": counters[1].value,
                "blocked_blocklist": counters[2].value,
                "blocked_rate": counters[3].value,
            }
        except Exception as e:
            logger.error(f"Failed to get counters: {e}")
            return {}
    
    def sync_blocklist_from_redis(self):
        """Sync blocklist from Redis (for cluster coordination)"""
        if not self.redis:
            return
        
        try:
            blocklist_data = self.redis.hgetall("vardax:blocklist")
            for ip_bytes, data_bytes in blocklist_data.items():
                ip = ip_bytes.decode() if isinstance(ip_bytes, bytes) else ip_bytes
                data = json.loads(data_bytes)
                
                if ip not in self.blocklist:
                    # Calculate remaining duration
                    if data.get("expires_at"):
                        expires = datetime.fromisoformat(data["expires_at"])
                        remaining = (expires - datetime.utcnow()).total_seconds()
                        if remaining > 0:
                            self.block_ip(ip, int(remaining))
                    else:
                        self.block_ip(ip, 0)
                        
        except Exception as e:
            logger.error(f"Failed to sync blocklist: {e}")
    
    def run_metrics_loop(self, interval: int = 5):
        """Background loop to update Prometheus metrics"""
        while self.running:
            counters = self.get_counters()
            
            if counters:
                PACKETS_TOTAL.labels(action='total')._value.set(counters.get('total', 0))
                PACKETS_TOTAL.labels(action='passed')._value.set(counters.get('passed', 0))
                PACKETS_TOTAL.labels(action='blocked')._value.set(
                    counters.get('blocked_blocklist', 0) + counters.get('blocked_rate', 0)
                )
            
            time.sleep(interval)


class NFTablesManager:
    """Fallback manager using nftables when XDP is not available"""
    
    def __init__(self, config: XDPConfig):
        self.config = config
        self.blocklist: Set[str] = set()
        
    def setup(self):
        """Setup nftables rules"""
        rules = f"""
#!/usr/sbin/nft -f

table inet vardax_filter {{
    set blocklist {{
        type ipv4_addr
        flags timeout
    }}
    
    set allowlist {{
        type ipv4_addr
    }}
    
    chain input {{
        type filter hook input priority -200; policy accept;
        
        # Allow established connections
        ct state established,related accept
        
        # Allow allowlisted IPs
        ip saddr @allowlist accept
        
        # Drop blocklisted IPs
        ip saddr @blocklist drop
        
        # Rate limit SYN packets
        tcp flags syn limit rate {self.config.syn_rate_limit}/second accept
        tcp flags syn drop
        
        # Rate limit UDP
        udp limit rate {self.config.udp_rate_limit}/second accept
        udp drop
        
        # Rate limit ICMP
        icmp limit rate {self.config.icmp_rate_limit}/second accept
        icmp drop
    }}
}}
"""
        logger.info("nftables rules configured (fallback mode)")
        return rules
    
    def block_ip(self, ip: str, duration_seconds: int = 0):
        """Block IP using nftables"""
        import subprocess
        
        timeout = f"timeout {duration_seconds}s" if duration_seconds > 0 else ""
        cmd = f"nft add element inet vardax_filter blocklist {{ {ip} {timeout} }}"
        
        try:
            subprocess.run(cmd, shell=True, check=True)
            self.blocklist.add(ip)
            logger.info(f"Blocked IP via nftables: {ip}")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to block IP: {e}")
    
    def unblock_ip(self, ip: str):
        """Unblock IP using nftables"""
        import subprocess
        
        cmd = f"nft delete element inet vardax_filter blocklist {{ {ip} }}"
        
        try:
            subprocess.run(cmd, shell=True, check=True)
            self.blocklist.discard(ip)
            logger.info(f"Unblocked IP via nftables: {ip}")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to unblock IP: {e}")


def main():
    parser = argparse.ArgumentParser(description='VardaX XDP/eBPF DDoS Filter')
    parser.add_argument('--interface', '-i', default='eth0', help='Network interface')
    parser.add_argument('--redis', '-r', default='localhost:6379', help='Redis address')
    parser.add_argument('--metrics-port', '-p', type=int, default=9100, help='Prometheus metrics port')
    parser.add_argument('--syn-limit', type=int, default=100, help='SYN rate limit per IP')
    parser.add_argument('--udp-limit', type=int, default=1000, help='UDP rate limit per IP')
    parser.add_argument('--fallback', action='store_true', help='Use nftables fallback')
    args = parser.parse_args()
    
    config = XDPConfig(
        interface=args.interface,
        syn_rate_limit=args.syn_limit,
        udp_rate_limit=args.udp_limit,
    )
    
    # Connect to Redis
    redis_host, redis_port = args.redis.split(':')
    try:
        redis_client = redis.Redis(host=redis_host, port=int(redis_port))
        redis_client.ping()
        logger.info(f"Connected to Redis at {args.redis}")
    except Exception as e:
        logger.warning(f"Redis not available: {e}")
        redis_client = None
    
    # Start Prometheus metrics server
    start_http_server(args.metrics_port)
    logger.info(f"Prometheus metrics available on port {args.metrics_port}")
    
    # Initialize manager
    if args.fallback or not HAS_BCC:
        manager = NFTablesManager(config)
        print(manager.setup())
    else:
        manager = XDPManager(config, redis_client)
        
        if not manager.load():
            logger.error("Failed to load XDP, falling back to nftables")
            manager = NFTablesManager(config)
            print(manager.setup())
            return
        
        manager.running = True
        
        # Start metrics loop
        metrics_thread = threading.Thread(target=manager.run_metrics_loop, daemon=True)
        metrics_thread.start()
        
        # Sync blocklist from Redis
        if redis_client:
            manager.sync_blocklist_from_redis()
        
        # Handle shutdown
        def shutdown(signum, frame):
            logger.info("Shutting down...")
            manager.running = False
            manager.unload()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, shutdown)
        signal.signal(signal.SIGTERM, shutdown)
        
        logger.info("XDP filter running. Press Ctrl+C to stop.")
        
        # Main loop - sync blocklist periodically
        while manager.running:
            if redis_client:
                manager.sync_blocklist_from_redis()
            time.sleep(10)


if __name__ == '__main__':
    main()
