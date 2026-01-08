"""
vardax-ddos/bot-detector/feature_extractor.py
VardaX Bot Detection - Feature Extraction Engine

Extracts 47+ features from HTTP requests for ML-based bot detection.
Features include: time, network, transport, request, behavioral, and reputation.
"""

import hashlib
import time
import re
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict
import ipaddress
import json

import redis
import maxminddb
from user_agents import parse as parse_ua


@dataclass
class RequestContext:
    """Request context with all available information"""
    ip: str
    method: str
    path: str
    query_string: str = ""
    headers: Dict[str, str] = field(default_factory=dict)
    body_size: int = 0
    timestamp: float = field(default_factory=time.time)
    
    # TLS information
    ja3_fingerprint: str = ""
    tls_version: str = ""
    tls_cipher: str = ""
    
    # Geo information
    country_code: str = ""
    asn: int = 0
    asn_org: str = ""
    
    # Challenge information
    challenge_passed: bool = False
    challenge_time_ms: float = 0
    
    # Browser signals (from JS)
    js_signals: Dict[str, Any] = field(default_factory=dict)


@dataclass
class FeatureVector:
    """Extracted feature vector for ML model"""
    features: Dict[str, float]
    metadata: Dict[str, Any]
    
    def to_array(self, feature_names: List[str]) -> List[float]:
        """Convert to ordered array for model input"""
        return [self.features.get(name, 0.0) for name in feature_names]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "features": self.features,
            "metadata": self.metadata,
        }


class FeatureExtractor:
    """
    Extracts features from HTTP requests for bot detection.
    
    Feature categories:
    1. Time features - request timing patterns
    2. Network features - IP, ASN, geo
    3. Transport features - TLS fingerprinting
    4. Request features - HTTP characteristics
    5. Behavioral features - session patterns
    6. Reputation features - historical data
    """
    
    # Known bot user agents (partial matches)
    BOT_UA_PATTERNS = [
        r'bot', r'crawler', r'spider', r'scraper', r'curl', r'wget',
        r'python', r'java', r'php', r'ruby', r'perl', r'go-http',
        r'httpclient', r'okhttp', r'axios', r'node-fetch',
    ]
    
    # Suspicious header patterns
    SUSPICIOUS_HEADERS = [
        'x-forwarded-for',  # Multiple proxies
        'via',              # Proxy chain
        'x-real-ip',        # Proxy headers
    ]
    
    # Known datacenter ASNs (partial list)
    DATACENTER_ASNS = {
        14061,   # DigitalOcean
        16509,   # Amazon AWS
        15169,   # Google Cloud
        8075,    # Microsoft Azure
        13335,   # Cloudflare
        20473,   # Vultr
        63949,   # Linode
        14618,   # Amazon
        16276,   # OVH
    }
    
    # Feature names for model input (ordered)
    FEATURE_NAMES = [
        # Time features (7)
        'hour_of_day', 'day_of_week', 'is_weekend',
        'requests_last_1s', 'requests_last_10s', 'requests_last_60s',
        'inter_request_interval',
        
        # Network features (8)
        'ip_is_ipv6', 'ip_first_octet', 'ip_class',
        'asn_is_datacenter', 'asn_normalized',
        'country_risk_score', 'is_tor_exit', 'is_vpn',
        
        # Transport features (6)
        'ja3_known_bot', 'ja3_known_browser', 'ja3_entropy',
        'tls_version_score', 'cipher_strength', 'has_sni',
        
        # Request features (12)
        'method_encoded', 'path_depth', 'path_length',
        'query_param_count', 'query_length',
        'header_count', 'has_accept', 'has_accept_language',
        'has_accept_encoding', 'has_cookie', 'has_referer',
        'content_length_normalized',
        
        # User agent features (8)
        'ua_is_bot', 'ua_is_mobile', 'ua_is_tablet', 'ua_is_pc',
        'ua_browser_family', 'ua_os_family', 'ua_device_family',
        'ua_entropy',
        
        # Behavioral features (6)
        'challenge_passed', 'challenge_time_normalized',
        'session_request_count', 'session_unique_paths',
        'session_error_rate', 'session_avg_interval',
    ]
    
    def __init__(
        self,
        redis_client: Optional[redis.Redis] = None,
        geoip_db_path: str = "/usr/share/GeoIP/GeoLite2-City.mmdb",
        asn_db_path: str = "/usr/share/GeoIP/GeoLite2-ASN.mmdb",
    ):
        self.redis = redis_client
        self.session_data: Dict[str, Dict] = defaultdict(lambda: {
            'request_times': [],
            'paths': set(),
            'errors': 0,
            'total': 0,
        })
        
        # Load GeoIP databases
        try:
            self.geoip_reader = maxminddb.open_database(geoip_db_path)
            self.asn_reader = maxminddb.open_database(asn_db_path)
        except Exception as e:
            print(f"Warning: GeoIP databases not available: {e}")
            self.geoip_reader = None
            self.asn_reader = None
        
        # Load known JA3 fingerprints
        self.known_bot_ja3 = self._load_known_ja3('bot')
        self.known_browser_ja3 = self._load_known_ja3('browser')
        
        # Compile UA patterns
        self.bot_ua_regex = re.compile(
            '|'.join(self.BOT_UA_PATTERNS),
            re.IGNORECASE
        )
    
    def _load_known_ja3(self, category: str) -> set:
        """Load known JA3 fingerprints from file or Redis"""
        # In production, load from file or Redis
        # These are example fingerprints
        if category == 'bot':
            return {
                '3b5074b1b5d032e5620f69f9f700ff0e',  # Python requests
                '473cd7cb9faa642487833865d516e578',  # curl
                'e7d705a3286e19ea42f587b344ee6865',  # Go http
            }
        else:
            return {
                'b32309a26951912be7dba376398abc3b',  # Chrome
                '5d79e2f2e3fcc2e3e7c5c8e8e8e8e8e8',  # Firefox
                'cd08e31494f9531f560d64c695473da9',  # Safari
            }
    
    def extract(self, ctx: RequestContext) -> FeatureVector:
        """Extract all features from request context"""
        features = {}
        metadata = {
            'ip': ctx.ip,
            'timestamp': ctx.timestamp,
            'path': ctx.path,
        }
        
        # Time features
        features.update(self._extract_time_features(ctx))
        
        # Network features
        features.update(self._extract_network_features(ctx))
        
        # Transport features
        features.update(self._extract_transport_features(ctx))
        
        # Request features
        features.update(self._extract_request_features(ctx))
        
        # User agent features
        features.update(self._extract_ua_features(ctx))
        
        # Behavioral features
        features.update(self._extract_behavioral_features(ctx))
        
        # Update session data
        self._update_session(ctx)
        
        return FeatureVector(features=features, metadata=metadata)
    
    def _extract_time_features(self, ctx: RequestContext) -> Dict[str, float]:
        """Extract time-based features"""
        dt = datetime.fromtimestamp(ctx.timestamp)
        
        # Get request history for this IP
        history = self._get_request_history(ctx.ip)
        
        # Calculate inter-request interval
        if history:
            last_time = history[-1]
            interval = ctx.timestamp - last_time
        else:
            interval = 0
        
        # Count requests in windows
        now = ctx.timestamp
        requests_1s = sum(1 for t in history if now - t <= 1)
        requests_10s = sum(1 for t in history if now - t <= 10)
        requests_60s = sum(1 for t in history if now - t <= 60)
        
        return {
            'hour_of_day': dt.hour / 23.0,  # Normalized 0-1
            'day_of_week': dt.weekday() / 6.0,
            'is_weekend': 1.0 if dt.weekday() >= 5 else 0.0,
            'requests_last_1s': min(requests_1s / 100.0, 1.0),
            'requests_last_10s': min(requests_10s / 500.0, 1.0),
            'requests_last_60s': min(requests_60s / 1000.0, 1.0),
            'inter_request_interval': min(interval / 10.0, 1.0),
        }
    
    def _extract_network_features(self, ctx: RequestContext) -> Dict[str, float]:
        """Extract network-based features"""
        try:
            ip_obj = ipaddress.ip_address(ctx.ip)
            is_ipv6 = isinstance(ip_obj, ipaddress.IPv6Address)
            
            if is_ipv6:
                first_octet = 0
                ip_class = 0
            else:
                octets = ctx.ip.split('.')
                first_octet = int(octets[0]) / 255.0
                # IP class (simplified)
                if int(octets[0]) < 128:
                    ip_class = 0.0  # Class A
                elif int(octets[0]) < 192:
                    ip_class = 0.5  # Class B
                else:
                    ip_class = 1.0  # Class C
        except (ValueError, IndexError, AttributeError) as e:
            # Invalid IP format or parsing error
            is_ipv6 = False
            first_octet = 0
            ip_class = 0
        
        # ASN features
        asn = ctx.asn or self._lookup_asn(ctx.ip)
        is_datacenter = 1.0 if asn in self.DATACENTER_ASNS else 0.0
        
        # Country risk score (simplified)
        country_risk = self._get_country_risk(ctx.country_code)
        
        # Check Tor/VPN (would use external service in production)
        is_tor = self._check_tor_exit(ctx.ip)
        is_vpn = self._check_vpn(ctx.ip)
        
        return {
            'ip_is_ipv6': 1.0 if is_ipv6 else 0.0,
            'ip_first_octet': first_octet,
            'ip_class': ip_class,
            'asn_is_datacenter': is_datacenter,
            'asn_normalized': min(asn / 100000.0, 1.0) if asn else 0.0,
            'country_risk_score': country_risk,
            'is_tor_exit': 1.0 if is_tor else 0.0,
            'is_vpn': 1.0 if is_vpn else 0.0,
        }
    
    def _extract_transport_features(self, ctx: RequestContext) -> Dict[str, float]:
        """Extract TLS/transport features"""
        ja3 = ctx.ja3_fingerprint
        
        # JA3 analysis
        ja3_known_bot = 1.0 if ja3 in self.known_bot_ja3 else 0.0
        ja3_known_browser = 1.0 if ja3 in self.known_browser_ja3 else 0.0
        ja3_entropy = self._calculate_entropy(ja3) if ja3 else 0.0
        
        # TLS version score
        tls_scores = {
            'TLSv1': 0.2,
            'TLSv1.1': 0.4,
            'TLSv1.2': 0.8,
            'TLSv1.3': 1.0,
        }
        tls_score = tls_scores.get(ctx.tls_version, 0.5)
        
        # Cipher strength (simplified)
        cipher = ctx.tls_cipher.lower() if ctx.tls_cipher else ''
        if 'aes256' in cipher or 'chacha20' in cipher:
            cipher_strength = 1.0
        elif 'aes128' in cipher:
            cipher_strength = 0.8
        else:
            cipher_strength = 0.5
        
        return {
            'ja3_known_bot': ja3_known_bot,
            'ja3_known_browser': ja3_known_browser,
            'ja3_entropy': ja3_entropy / 4.0,  # Normalize
            'tls_version_score': tls_score,
            'cipher_strength': cipher_strength,
            'has_sni': 1.0,  # Assume SNI present if we got here
        }
    
    def _extract_request_features(self, ctx: RequestContext) -> Dict[str, float]:
        """Extract HTTP request features"""
        headers = ctx.headers
        
        # Method encoding
        method_map = {'GET': 0.0, 'POST': 0.3, 'PUT': 0.5, 'DELETE': 0.7, 'PATCH': 0.8}
        method_encoded = method_map.get(ctx.method.upper(), 1.0)
        
        # Path analysis
        path_parts = ctx.path.strip('/').split('/')
        path_depth = len(path_parts) / 10.0
        path_length = len(ctx.path) / 200.0
        
        # Query string analysis
        query_params = ctx.query_string.split('&') if ctx.query_string else []
        query_param_count = len(query_params) / 20.0
        query_length = len(ctx.query_string) / 500.0
        
        # Header analysis
        header_count = len(headers) / 30.0
        
        return {
            'method_encoded': method_encoded,
            'path_depth': min(path_depth, 1.0),
            'path_length': min(path_length, 1.0),
            'query_param_count': min(query_param_count, 1.0),
            'query_length': min(query_length, 1.0),
            'header_count': min(header_count, 1.0),
            'has_accept': 1.0 if 'accept' in headers else 0.0,
            'has_accept_language': 1.0 if 'accept-language' in headers else 0.0,
            'has_accept_encoding': 1.0 if 'accept-encoding' in headers else 0.0,
            'has_cookie': 1.0 if 'cookie' in headers else 0.0,
            'has_referer': 1.0 if 'referer' in headers else 0.0,
            'content_length_normalized': min(ctx.body_size / 10000.0, 1.0),
        }
    
    def _extract_ua_features(self, ctx: RequestContext) -> Dict[str, float]:
        """Extract user agent features"""
        ua_string = ctx.headers.get('user-agent', '')
        
        # Check for bot patterns
        is_bot = 1.0 if self.bot_ua_regex.search(ua_string) else 0.0
        
        # Parse user agent
        try:
            ua = parse_ua(ua_string)
            is_mobile = 1.0 if ua.is_mobile else 0.0
            is_tablet = 1.0 if ua.is_tablet else 0.0
            is_pc = 1.0 if ua.is_pc else 0.0
            
            # Encode browser/OS families
            browser_map = {'Chrome': 0.2, 'Firefox': 0.4, 'Safari': 0.6, 'Edge': 0.8}
            browser_family = browser_map.get(ua.browser.family, 1.0)
            
            os_map = {'Windows': 0.2, 'Mac OS X': 0.4, 'Linux': 0.6, 'iOS': 0.7, 'Android': 0.8}
            os_family = os_map.get(ua.os.family, 1.0)
            
            device_map = {'iPhone': 0.2, 'iPad': 0.4, 'Mac': 0.6, 'Other': 0.8}
            device_family = device_map.get(ua.device.family, 1.0)
        except (AttributeError, ImportError) as e:
            # User agent parsing failed or library not available
            is_mobile = 0.0
            is_tablet = 0.0
            is_pc = 0.0
            browser_family = 1.0
            os_family = 1.0
            device_family = 1.0
        
        # UA entropy
        ua_entropy = self._calculate_entropy(ua_string) / 5.0
        
        return {
            'ua_is_bot': is_bot,
            'ua_is_mobile': is_mobile,
            'ua_is_tablet': is_tablet,
            'ua_is_pc': is_pc,
            'ua_browser_family': browser_family,
            'ua_os_family': os_family,
            'ua_device_family': device_family,
            'ua_entropy': min(ua_entropy, 1.0),
        }
    
    def _extract_behavioral_features(self, ctx: RequestContext) -> Dict[str, float]:
        """Extract behavioral/session features"""
        session = self.session_data[ctx.ip]
        
        # Challenge features
        challenge_passed = 1.0 if ctx.challenge_passed else 0.0
        challenge_time = min(ctx.challenge_time_ms / 5000.0, 1.0) if ctx.challenge_time_ms else 0.0
        
        # Session features
        request_count = session['total'] / 1000.0
        unique_paths = len(session['paths']) / 100.0
        error_rate = session['errors'] / max(session['total'], 1)
        
        # Average interval
        times = session['request_times']
        if len(times) >= 2:
            intervals = [times[i] - times[i-1] for i in range(1, len(times))]
            avg_interval = sum(intervals) / len(intervals)
        else:
            avg_interval = 0
        
        return {
            'challenge_passed': challenge_passed,
            'challenge_time_normalized': challenge_time,
            'session_request_count': min(request_count, 1.0),
            'session_unique_paths': min(unique_paths, 1.0),
            'session_error_rate': error_rate,
            'session_avg_interval': min(avg_interval / 10.0, 1.0),
        }
    
    def _get_request_history(self, ip: str) -> List[float]:
        """Get recent request timestamps for IP"""
        if self.redis:
            key = f"vardax:history:{ip}"
            history = self.redis.lrange(key, 0, 100)
            return [float(t) for t in history]
        return self.session_data[ip]['request_times'][-100:]
    
    def _update_session(self, ctx: RequestContext):
        """Update session tracking data"""
        session = self.session_data[ctx.ip]
        session['request_times'].append(ctx.timestamp)
        session['request_times'] = session['request_times'][-100:]  # Keep last 100
        session['paths'].add(ctx.path)
        session['total'] += 1
        
        # Store in Redis for distributed tracking
        if self.redis:
            key = f"vardax:history:{ctx.ip}"
            self.redis.lpush(key, ctx.timestamp)
            self.redis.ltrim(key, 0, 99)
            self.redis.expire(key, 300)
    
    def _lookup_asn(self, ip: str) -> int:
        """Lookup ASN for IP"""
        if self.asn_reader:
            try:
                result = self.asn_reader.get(ip)
                return result.get('autonomous_system_number', 0) if result else 0
            except (KeyError, AttributeError, Exception) as e:
                # ASN lookup failed
                pass
        return 0
    
    def _get_country_risk(self, country_code: str) -> float:
        """Get risk score for country (simplified)"""
        # In production, use actual threat intelligence
        high_risk = {'CN', 'RU', 'KP', 'IR'}
        medium_risk = {'BR', 'IN', 'VN', 'UA'}
        
        if country_code in high_risk:
            return 0.8
        elif country_code in medium_risk:
            return 0.5
        return 0.2
    
    def _check_tor_exit(self, ip: str) -> bool:
        """Check if IP is Tor exit node"""
        # In production, use Tor exit list or service
        return False
    
    def _check_vpn(self, ip: str) -> bool:
        """Check if IP is known VPN"""
        # In production, use VPN detection service
        return False
    
    def _calculate_entropy(self, s: str) -> float:
        """Calculate Shannon entropy of string"""
        if not s:
            return 0.0
        
        from collections import Counter
        import math
        
        counts = Counter(s)
        length = len(s)
        entropy = -sum(
            (count / length) * math.log2(count / length)
            for count in counts.values()
        )
        return entropy


# Singleton instance
_extractor = None

def get_extractor(**kwargs) -> FeatureExtractor:
    """Get or create feature extractor instance"""
    global _extractor
    if _extractor is None:
        _extractor = FeatureExtractor(**kwargs)
    return _extractor
