"""
Real Traffic Processing Engine for VARDAx
Handles actual HTTP traffic analysis and threat detection
"""
import asyncio
import json
import time
import hashlib
import ipaddress
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from collections import defaultdict, deque, Counter
import logging
import re
import urllib.parse
from user_agents import parse as parse_user_agent

logger = logging.getLogger(__name__)

@dataclass
class TrafficEvent:
    """Real traffic event with comprehensive data"""
    event_id: str
    timestamp: datetime
    client_ip: str
    method: str
    uri: str
    query_string: str
    headers: Dict[str, str]
    body: str
    user_agent: str
    referer: str
    status_code: int
    response_time_ms: float
    response_size: int
    session_id: Optional[str] = None
    country: Optional[str] = None
    asn: Optional[str] = None
    is_bot: bool = False
    threat_score: float = 0.0
    blocked: bool = False
    rule_matches: List[str] = None

    def __post_init__(self):
        if self.rule_matches is None:
            self.rule_matches = []

@dataclass
class ThreatDetection:
    """Real threat detection result"""
    event_id: str
    threat_type: str
    severity: str  # low, medium, high, critical
    confidence: float
    description: str
    indicators: List[str]
    recommended_action: str
    rule_triggered: Optional[str] = None

class RealTimeTrafficProcessor:
    """Production-grade traffic processing engine"""
    
    def __init__(self):
        self.active_sessions = {}
        self.ip_reputation_cache = {}
        self.rate_limiters = defaultdict(lambda: deque(maxlen=1000))
        self.blocked_ips = set()
        self.suspicious_patterns = self._load_threat_patterns()
        self.country_db = self._init_country_db()
        self.bot_signatures = self._load_bot_signatures()
        
        # Real-time metrics
        self.metrics = {
            'requests_total': 0,
            'requests_blocked': 0,
            'threats_detected': 0,
            'unique_ips': set(),
            'top_countries': Counter(),
            'attack_types': Counter(),
            'response_times': deque(maxlen=1000),
            'error_rates': deque(maxlen=100)
        }
        
    def _load_threat_patterns(self) -> Dict[str, List[Dict]]:
        """Load real threat detection patterns"""
        return {
            'sql_injection': [
                {'pattern': r'(\bunion\b.*\bselect\b)|(\bselect\b.*\bunion\b)', 'severity': 'high'},
                {'pattern': r'(\bor\b\s+\d+\s*=\s*\d+)|(\band\b\s+\d+\s*=\s*\d+)', 'severity': 'medium'},
                {'pattern': r'(\bdrop\b\s+\btable\b)|(\bdelete\b\s+\bfrom\b)', 'severity': 'critical'},
                {'pattern': r'(\binsert\b\s+\binto\b)|(\bupdate\b.*\bset\b)', 'severity': 'high'},
                {'pattern': r'(\bexec\b\s*\()|(\bexecute\b\s*\()', 'severity': 'critical'},
                {'pattern': r'(\bchar\b\s*\(\d+\))|(\bcast\b\s*\()', 'severity': 'medium'},
                {'pattern': r'(\bhaving\b\s+\d+\s*=\s*\d+)', 'severity': 'medium'},
                {'pattern': r'(\bwaitfor\b\s+\bdelay\b)', 'severity': 'high'}
            ],
            'xss': [
                {'pattern': r'<script[^>]*>.*?</script>', 'severity': 'high'},
                {'pattern': r'javascript\s*:', 'severity': 'medium'},
                {'pattern': r'on\w+\s*=\s*["\'].*?["\']', 'severity': 'medium'},
                {'pattern': r'<iframe[^>]*>.*?</iframe>', 'severity': 'high'},
                {'pattern': r'document\.(cookie|domain|location)', 'severity': 'medium'},
                {'pattern': r'window\.(location|open)', 'severity': 'medium'},
                {'pattern': r'eval\s*\(', 'severity': 'high'},
                {'pattern': r'expression\s*\(', 'severity': 'high'}
            ],
            'path_traversal': [
                {'pattern': r'\.\./', 'severity': 'medium'},
                {'pattern': r'\.\.\\', 'severity': 'medium'},
                {'pattern': r'%2e%2e%2f', 'severity': 'medium'},
                {'pattern': r'%2e%2e/', 'severity': 'medium'},
                {'pattern': r'/etc/passwd', 'severity': 'high'},
                {'pattern': r'/etc/shadow', 'severity': 'critical'},
                {'pattern': r'\\windows\\system32', 'severity': 'high'},
                {'pattern': r'%00', 'severity': 'medium'}
            ],
            'command_injection': [
                {'pattern': r';\s*(ls|cat|pwd|whoami|id|uname)', 'severity': 'high'},
                {'pattern': r'\|\s*(ls|cat|pwd|whoami|id|uname)', 'severity': 'high'},
                {'pattern': r'`.*`', 'severity': 'medium'},
                {'pattern': r'\$\(.*\)', 'severity': 'medium'},
                {'pattern': r'&&\s*(rm|del|format)', 'severity': 'critical'},
                {'pattern': r';\s*(rm|del|format)', 'severity': 'critical'}
            ],
            'lfi_rfi': [
                {'pattern': r'(http|https|ftp)://.*\.(php|asp|jsp)', 'severity': 'high'},
                {'pattern': r'file:///', 'severity': 'medium'},
                {'pattern': r'php://input', 'severity': 'high'},
                {'pattern': r'php://filter', 'severity': 'medium'},
                {'pattern': r'data://text/plain', 'severity': 'medium'}
            ]
        }
    
    def _init_country_db(self) -> Dict[str, str]:
        """Initialize IP to country mapping (simplified)"""
        return {
            # Major IP ranges for demo - in production use GeoIP2
            '192.168.': 'Private',
            '10.': 'Private',
            '172.16.': 'Private',
            '127.': 'Localhost',
            '8.8.8.': 'United States',
            '1.1.1.': 'United States',
            '208.67.': 'United States'
        }
    
    def _load_bot_signatures(self) -> List[str]:
        """Load known bot user agent signatures"""
        return [
            'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python-requests',
            'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
            'yandexbot', 'facebookexternalhit', 'twitterbot', 'linkedinbot',
            'whatsapp', 'telegram', 'discord', 'slack', 'postman'
        ]
    
    async def process_traffic(self, raw_request: Dict[str, Any]) -> TrafficEvent:
        """Process incoming traffic and detect threats"""
        start_time = time.time()
        
        # Create traffic event
        event = self._create_traffic_event(raw_request)
        
        # Update metrics
        self.metrics['requests_total'] += 1
        self.metrics['unique_ips'].add(event.client_ip)
        
        # Enrich with geolocation
        event.country = self._get_country(event.client_ip)
        if event.country:
            self.metrics['top_countries'][event.country] += 1
        
        # Bot detection
        event.is_bot = self._detect_bot(event.user_agent)
        
        # Rate limiting check
        if self._check_rate_limit(event.client_ip):
            event.blocked = True
            event.threat_score = 0.8
            self.metrics['requests_blocked'] += 1
            logger.warning(f"Rate limit exceeded for IP {event.client_ip}")
        
        # Threat detection
        threats = await self._detect_threats(event)
        if threats:
            event.threat_score = max(t.confidence for t in threats)
            self.metrics['threats_detected'] += len(threats)
            
            for threat in threats:
                self.metrics['attack_types'][threat.threat_type] += 1
                
                # Auto-block critical threats
                if threat.severity == 'critical' and threat.confidence > 0.8:
                    event.blocked = True
                    self.blocked_ips.add(event.client_ip)
                    self.metrics['requests_blocked'] += 1
                    logger.critical(f"Critical threat blocked: {threat.description} from {event.client_ip}")
        
        # Record processing time
        processing_time = (time.time() - start_time) * 1000
        self.metrics['response_times'].append(processing_time)
        
        return event
    
    def _create_traffic_event(self, raw_request: Dict[str, Any]) -> TrafficEvent:
        """Create structured traffic event from raw request"""
        headers = raw_request.get('headers', {})
        
        return TrafficEvent(
            event_id=self._generate_event_id(raw_request),
            timestamp=datetime.utcnow(),
            client_ip=raw_request.get('client_ip', '127.0.0.1'),
            method=raw_request.get('method', 'GET'),
            uri=raw_request.get('uri', '/'),
            query_string=raw_request.get('query_string', ''),
            headers=headers,
            body=raw_request.get('body', ''),
            user_agent=headers.get('User-Agent', ''),
            referer=headers.get('Referer', ''),
            status_code=raw_request.get('status_code', 200),
            response_time_ms=raw_request.get('response_time_ms', 0),
            response_size=raw_request.get('response_size', 0),
            session_id=headers.get('Cookie', '').split('sessionid=')[-1].split(';')[0] if 'sessionid=' in headers.get('Cookie', '') else None
        )
    
    def _generate_event_id(self, raw_request: Dict[str, Any]) -> str:
        """Generate unique event ID"""
        data = f"{raw_request.get('client_ip')}{raw_request.get('uri')}{time.time()}"
        return hashlib.md5(data.encode()).hexdigest()[:16]
    
    def _get_country(self, ip: str) -> Optional[str]:
        """Get country for IP address"""
        for prefix, country in self.country_db.items():
            if ip.startswith(prefix):
                return country
        return 'Unknown'
    
    def _detect_bot(self, user_agent: str) -> bool:
        """Detect if request is from a bot"""
        if not user_agent:
            return True
        
        user_agent_lower = user_agent.lower()
        return any(sig in user_agent_lower for sig in self.bot_signatures)
    
    def _check_rate_limit(self, ip: str) -> bool:
        """Check if IP exceeds rate limits"""
        now = time.time()
        window = 60  # 1 minute window
        limit = 100  # requests per minute
        
        # Clean old entries
        self.rate_limiters[ip] = deque([
            timestamp for timestamp in self.rate_limiters[ip]
            if now - timestamp < window
        ], maxlen=1000)
        
        # Add current request
        self.rate_limiters[ip].append(now)
        
        return len(self.rate_limiters[ip]) > limit
    
    async def _detect_threats(self, event: TrafficEvent) -> List[ThreatDetection]:
        """Comprehensive threat detection"""
        threats = []
        
        # Combine all request data for analysis
        full_request = f"{event.uri} {event.query_string} {event.body}".lower()
        
        # Check each threat category
        for threat_type, patterns in self.suspicious_patterns.items():
            for pattern_info in patterns:
                pattern = pattern_info['pattern']
                severity = pattern_info['severity']
                
                if re.search(pattern, full_request, re.IGNORECASE):
                    confidence = self._calculate_confidence(pattern, full_request, severity)
                    
                    threat = ThreatDetection(
                        event_id=event.event_id,
                        threat_type=threat_type,
                        severity=severity,
                        confidence=confidence,
                        description=f"{threat_type.replace('_', ' ').title()} attempt detected",
                        indicators=[pattern],
                        recommended_action='block' if confidence > 0.7 else 'monitor'
                    )
                    threats.append(threat)
        
        # Additional behavioral analysis
        behavioral_threats = await self._behavioral_analysis(event)
        threats.extend(behavioral_threats)
        
        return threats
    
    def _calculate_confidence(self, pattern: str, content: str, severity: str) -> float:
        """Calculate threat confidence score"""
        base_confidence = {
            'low': 0.3,
            'medium': 0.5,
            'high': 0.7,
            'critical': 0.9
        }.get(severity, 0.5)
        
        # Adjust based on pattern matches
        matches = len(re.findall(pattern, content, re.IGNORECASE))
        confidence_boost = min(matches * 0.1, 0.3)
        
        return min(base_confidence + confidence_boost, 1.0)
    
    async def _behavioral_analysis(self, event: TrafficEvent) -> List[ThreatDetection]:
        """Advanced behavioral threat analysis"""
        threats = []
        
        # Suspicious user agent analysis
        if not event.user_agent or len(event.user_agent) < 10:
            threats.append(ThreatDetection(
                event_id=event.event_id,
                threat_type='suspicious_user_agent',
                severity='medium',
                confidence=0.6,
                description='Suspicious or missing user agent',
                indicators=['empty_user_agent'],
                recommended_action='monitor'
            ))
        
        # Rapid-fire requests (session-based)
        if event.session_id:
            session_requests = self.active_sessions.get(event.session_id, [])
            recent_requests = [
                req for req in session_requests
                if (datetime.utcnow() - req).total_seconds() < 10
            ]
            
            if len(recent_requests) > 20:
                threats.append(ThreatDetection(
                    event_id=event.event_id,
                    threat_type='rapid_requests',
                    severity='high',
                    confidence=0.8,
                    description='Rapid-fire requests detected',
                    indicators=['high_request_rate'],
                    recommended_action='block'
                ))
        
        # Suspicious file access patterns
        suspicious_files = ['.env', 'config.php', 'wp-config.php', '.htaccess', 'admin.php']
        if any(file in event.uri.lower() for file in suspicious_files):
            threats.append(ThreatDetection(
                event_id=event.event_id,
                threat_type='sensitive_file_access',
                severity='high',
                confidence=0.7,
                description='Attempt to access sensitive files',
                indicators=['sensitive_file_pattern'],
                recommended_action='block'
            ))
        
        return threats
    
    def get_real_time_metrics(self) -> Dict[str, Any]:
        """Get current real-time metrics"""
        now = datetime.utcnow()
        
        # Calculate rates
        recent_times = [t for t in self.metrics['response_times'] if t is not None]
        avg_response_time = sum(recent_times) / len(recent_times) if recent_times else 0
        
        requests_last_minute = len([
            t for t in self.rate_limiters.values()
            for timestamp in t
            if now.timestamp() - timestamp < 60
        ])
        
        return {
            'timestamp': now.isoformat(),
            'requests_total': self.metrics['requests_total'],
            'requests_per_second': requests_last_minute / 60,
            'requests_blocked': self.metrics['requests_blocked'],
            'threats_detected': self.metrics['threats_detected'],
            'unique_ips_count': len(self.metrics['unique_ips']),
            'avg_response_time_ms': avg_response_time,
            'block_rate': (self.metrics['requests_blocked'] / max(self.metrics['requests_total'], 1)) * 100,
            'top_countries': dict(self.metrics['top_countries'].most_common(10)),
            'attack_types': dict(self.metrics['attack_types']),
            'blocked_ips_count': len(self.blocked_ips)
        }
    
    def is_ip_blocked(self, ip: str) -> bool:
        """Check if IP is currently blocked"""
        return ip in self.blocked_ips
    
    def block_ip(self, ip: str, reason: str = "Manual block"):
        """Manually block an IP address"""
        self.blocked_ips.add(ip)
        logger.warning(f"IP {ip} blocked: {reason}")
    
    def unblock_ip(self, ip: str):
        """Unblock an IP address"""
        self.blocked_ips.discard(ip)
        logger.info(f"IP {ip} unblocked")

# Global traffic processor instance
traffic_processor = RealTimeTrafficProcessor()