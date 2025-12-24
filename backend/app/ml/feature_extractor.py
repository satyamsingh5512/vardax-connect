"""
Feature Extraction Engine for VARDAx.

Extracts 47 behavioral features from HTTP traffic for ML inference.
Designed for real-time processing with minimal latency.

WHY THESE FEATURES:
- Request-level: Catch injection attacks, malformed requests
- Session-level: Catch multi-request attacks, reconnaissance
- Rate-level: Catch DDoS, brute force, credential stuffing
- Behavioral: Catch bots, API abuse, zero-day patterns
"""
import math
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from collections import defaultdict
import numpy as np
from dataclasses import dataclass, field

from ..models.schemas import TrafficRequest, ExtractedFeatures


@dataclass
class SessionState:
    """Tracks session-level metrics for feature extraction."""
    request_count: int = 0
    unique_uris: set = field(default_factory=set)
    unique_methods: set = field(default_factory=set)
    error_count: int = 0
    total_response_time: float = 0.0
    first_seen: datetime = field(default_factory=datetime.utcnow)
    bytes_sent: int = 0
    bytes_received: int = 0
    uri_sequence: List[str] = field(default_factory=list)
    status_codes: List[int] = field(default_factory=list)


@dataclass  
class RateState:
    """Tracks rate-level metrics per time window."""
    request_timestamps: List[datetime] = field(default_factory=list)
    error_timestamps: List[datetime] = field(default_factory=list)
    bytes_transferred: int = 0
    unique_ips: set = field(default_factory=set)
    new_uris: set = field(default_factory=set)
    auth_failures: int = 0


class FeatureExtractor:
    """
    Extracts ML features from HTTP traffic in real-time.
    
    Design principles:
    - Stateful: Maintains session and rate windows
    - Fast: O(1) feature computation where possible
    - Memory-bounded: Automatic cleanup of old data
    """
    
    # HTTP methods encoded as integers
    METHOD_ENCODING = {
        'GET': 0, 'POST': 1, 'PUT': 2, 'DELETE': 3,
        'PATCH': 4, 'HEAD': 5, 'OPTIONS': 6, 'TRACE': 7
    }
    
    # Content types encoded
    CONTENT_TYPE_ENCODING = {
        'application/json': 0,
        'application/x-www-form-urlencoded': 1,
        'multipart/form-data': 2,
        'text/plain': 3,
        'text/html': 4,
        'application/xml': 5,
        'other': 6
    }
    
    # High-risk file extensions
    RISKY_EXTENSIONS = {
        '.php': 0.9, '.asp': 0.9, '.aspx': 0.9, '.jsp': 0.8,
        '.cgi': 0.8, '.pl': 0.7, '.py': 0.6, '.rb': 0.6,
        '.sh': 0.9, '.bat': 0.9, '.exe': 1.0, '.dll': 1.0
    }
    
    def __init__(
        self,
        session_window_seconds: int = 300,
        rate_window_seconds: int = 60,
        baseline_samples: int = 1000
    ):
        self.session_window = timedelta(seconds=session_window_seconds)
        self.rate_window = timedelta(seconds=rate_window_seconds)
        
        # Session tracking by IP
        self.sessions: Dict[str, SessionState] = defaultdict(SessionState)
        
        # Rate tracking by endpoint
        self.rates: Dict[str, RateState] = defaultdict(RateState)
        
        # Global rate tracking
        self.global_rate = RateState()
        
        # Baseline statistics (EWMA)
        self.baseline_samples = baseline_samples
        self.baseline_stats = {
            'requests_per_minute': {'mean': 100.0, 'std': 50.0},
            'uri_length': {'mean': 50.0, 'std': 30.0},
            'body_length': {'mean': 500.0, 'std': 1000.0},
            'response_time': {'mean': 100.0, 'std': 50.0},
        }
        
        # Known URI patterns (learned over time)
        self.known_uris: set = set()
        self.uri_frequencies: Dict[str, int] = defaultdict(int)
        
        # API sequence patterns
        self.api_sequences: Dict[str, List[str]] = defaultdict(list)
    
    def extract(self, request: TrafficRequest) -> ExtractedFeatures:
        """
        Extract all 47 features from a traffic request.
        
        Args:
            request: Incoming HTTP request data
            
        Returns:
            ExtractedFeatures with all computed features
        """
        # Update state
        session = self._update_session(request)
        rate = self._update_rate(request)
        
        # Extract feature groups
        request_features = self._extract_request_features(request)
        session_features = self._extract_session_features(request, session)
        rate_features = self._extract_rate_features(request, rate)
        behavioral_features = self._extract_behavioral_features(request, session)
        api_features = self._extract_api_features(request, session)
        
        return ExtractedFeatures(
            request_id=request.request_id,
            timestamp=request.timestamp,
            **request_features,
            **session_features,
            **rate_features,
            **behavioral_features,
            **api_features
        )
    
    def _update_session(self, request: TrafficRequest) -> SessionState:
        """Update session state for this IP."""
        session = self.sessions[request.client_ip]
        
        # Check if session expired
        if session.first_seen and \
           (request.timestamp - session.first_seen) > self.session_window:
            # Reset session
            self.sessions[request.client_ip] = SessionState()
            session = self.sessions[request.client_ip]
        
        session.request_count += 1
        session.unique_uris.add(request.uri)
        session.unique_methods.add(request.method)
        session.bytes_sent += request.body_length
        session.uri_sequence.append(request.uri)
        
        # Keep sequence bounded
        if len(session.uri_sequence) > 100:
            session.uri_sequence = session.uri_sequence[-100:]
        
        return session
    
    def _update_rate(self, request: TrafficRequest) -> RateState:
        """Update rate tracking for this endpoint."""
        endpoint = f"{request.method}:{request.uri.split('?')[0]}"
        rate = self.rates[endpoint]
        
        # Clean old timestamps
        cutoff = request.timestamp - self.rate_window
        rate.request_timestamps = [
            ts for ts in rate.request_timestamps if ts > cutoff
        ]
        
        rate.request_timestamps.append(request.timestamp)
        rate.unique_ips.add(request.client_ip)
        rate.bytes_transferred += request.body_length
        
        # Track new URIs
        if request.uri not in self.known_uris:
            rate.new_uris.add(request.uri)
            self.known_uris.add(request.uri)
        
        # Update global rate
        self.global_rate.request_timestamps.append(request.timestamp)
        self.global_rate.request_timestamps = [
            ts for ts in self.global_rate.request_timestamps 
            if ts > cutoff
        ]
        
        return rate
    
    def _extract_request_features(self, request: TrafficRequest) -> Dict[str, Any]:
        """Extract 15 request-level features."""
        uri_parts = request.uri.split('/')
        query = request.query_string or ''
        
        # Parse extension
        extension = ''
        if '.' in uri_parts[-1] if uri_parts else '':
            extension = '.' + uri_parts[-1].split('.')[-1].split('?')[0].lower()
        
        return {
            'method_encoded': self.METHOD_ENCODING.get(request.method.upper(), 7),
            'uri_length': len(request.uri),
            'uri_depth': len([p for p in uri_parts if p]),
            'uri_entropy': self._calculate_entropy(request.uri),
            'query_param_count': len(query.split('&')) if query else 0,
            'query_length': len(query),
            'query_entropy': self._calculate_entropy(query) if query else 0.0,
            'has_file_extension': bool(extension),
            'extension_risk_score': self.RISKY_EXTENSIONS.get(extension, 0.0),
            'body_length': request.body_length,
            'body_entropy': request.body_entropy,
            'body_printable_ratio': request.body_printable_ratio,
            'content_type_encoded': self._encode_content_type(request.content_type),
            'header_count': self._count_headers(request),
            'unusual_header_count': 0,  # Would need full headers
        }
    
    def _extract_session_features(
        self, 
        request: TrafficRequest, 
        session: SessionState
    ) -> Dict[str, Any]:
        """Extract 10 session-level features."""
        duration = (request.timestamp - session.first_seen).total_seconds()
        avg_response = (
            session.total_response_time / session.request_count 
            if session.request_count > 0 else 0
        )
        error_rate = (
            session.error_count / session.request_count 
            if session.request_count > 0 else 0
        )
        
        return {
            'session_request_count': session.request_count,
            'session_unique_uris': len(session.unique_uris),
            'session_unique_methods': len(session.unique_methods),
            'session_error_rate': error_rate,
            'session_avg_response_time': avg_response,
            'session_duration_seconds': duration,
            'session_bytes_sent': session.bytes_sent,
            'session_bytes_received': session.bytes_received,
            'session_uri_pattern_score': self._calculate_uri_pattern_score(session),
            'session_api_sequence_score': self._calculate_sequence_score(session),
        }
    
    def _extract_rate_features(
        self, 
        request: TrafficRequest, 
        rate: RateState
    ) -> Dict[str, Any]:
        """Extract 8 rate-level features."""
        rpm = len(rate.request_timestamps)
        global_rpm = len(self.global_rate.request_timestamps)
        
        # Z-score compared to baseline
        baseline = self.baseline_stats['requests_per_minute']
        zscore = (rpm - baseline['mean']) / max(baseline['std'], 1)
        
        # Rate acceleration (change in rate)
        acceleration = 0.0
        if len(rate.request_timestamps) >= 2:
            recent = [ts for ts in rate.request_timestamps 
                     if ts > request.timestamp - timedelta(seconds=30)]
            older = [ts for ts in rate.request_timestamps 
                    if ts <= request.timestamp - timedelta(seconds=30)]
            if older:
                acceleration = (len(recent) - len(older)) / max(len(older), 1)
        
        return {
            'requests_per_minute': float(rpm),
            'requests_per_minute_zscore': zscore,
            'unique_ips_per_minute': len(rate.unique_ips),
            'error_rate_per_minute': len(rate.error_timestamps) / max(rpm, 1),
            'bytes_per_minute': float(rate.bytes_transferred),
            'new_uri_rate': len(rate.new_uris) / max(rpm, 1),
            'auth_failure_rate': rate.auth_failures / max(rpm, 1),
            'rate_acceleration': acceleration,
        }
    
    def _extract_behavioral_features(
        self, 
        request: TrafficRequest,
        session: SessionState
    ) -> Dict[str, Any]:
        """Extract 8 behavioral features."""
        return {
            'user_agent_anomaly_score': self._score_user_agent(request.user_agent),
            'geo_anomaly_score': 0.0,  # Would need GeoIP lookup
            'time_of_day_score': self._score_time_of_day(request.timestamp),
            'referrer_anomaly_score': self._score_referrer(request.referer),
            'request_pattern_score': 0.0,  # Set by ML model
            'payload_anomaly_score': 0.0,  # Set by ML model
            'fingerprint_consistency': 1.0,  # Would need JS fingerprint
            'bot_likelihood_score': self._calculate_bot_score(request, session),
        }
    
    def _extract_api_features(
        self, 
        request: TrafficRequest,
        session: SessionState
    ) -> Dict[str, Any]:
        """Extract 6 API-specific features."""
        endpoint = request.uri.split('?')[0]
        
        return {
            'api_endpoint_encoded': hash(endpoint) % 1000,
            'api_param_deviation': 0.0,  # Would compare to schema
            'api_response_size_deviation': 0.0,
            'api_timing_deviation': 0.0,
            'api_sequence_position': len(session.uri_sequence),
            'api_call_frequency': self.uri_frequencies.get(endpoint, 0),
        }
    
    # ========================================================================
    # HELPER METHODS
    # ========================================================================
    
    @staticmethod
    def _calculate_entropy(text: str) -> float:
        """Calculate Shannon entropy of a string."""
        if not text:
            return 0.0
        
        freq = defaultdict(int)
        for char in text:
            freq[char] += 1
        
        length = len(text)
        entropy = 0.0
        for count in freq.values():
            p = count / length
            entropy -= p * math.log2(p)
        
        return entropy
    
    def _encode_content_type(self, content_type: Optional[str]) -> int:
        """Encode content type to integer."""
        if not content_type:
            return 6
        ct = content_type.lower().split(';')[0].strip()
        return self.CONTENT_TYPE_ENCODING.get(ct, 6)
    
    @staticmethod
    def _count_headers(request: TrafficRequest) -> int:
        """Count non-null headers."""
        count = 0
        for field in ['content_type', 'user_agent', 'accept', 
                      'accept_encoding', 'referer', 'origin']:
            if getattr(request, field, None):
                count += 1
        return count
    
    def _calculate_uri_pattern_score(self, session: SessionState) -> float:
        """Score how unusual the URI access pattern is."""
        if len(session.uri_sequence) < 3:
            return 0.0
        
        # Check for scanning patterns (sequential paths)
        sequential_count = 0
        for i in range(1, len(session.uri_sequence)):
            prev = session.uri_sequence[i-1]
            curr = session.uri_sequence[i]
            # Simple heuristic: similar paths accessed sequentially
            if self._uri_similarity(prev, curr) > 0.8:
                sequential_count += 1
        
        return sequential_count / len(session.uri_sequence)
    
    def _calculate_sequence_score(self, session: SessionState) -> float:
        """Score API call sequence anomaly."""
        # Would compare against learned normal sequences
        # For now, return 0 (normal)
        return 0.0
    
    @staticmethod
    def _uri_similarity(uri1: str, uri2: str) -> float:
        """Calculate similarity between two URIs."""
        parts1 = set(uri1.split('/'))
        parts2 = set(uri2.split('/'))
        if not parts1 or not parts2:
            return 0.0
        intersection = len(parts1 & parts2)
        union = len(parts1 | parts2)
        return intersection / union if union > 0 else 0.0
    
    def _score_user_agent(self, user_agent: Optional[str]) -> float:
        """Score user agent anomaly (0 = normal, 1 = suspicious)."""
        if not user_agent:
            return 0.5  # Missing UA is slightly suspicious
        
        ua_lower = user_agent.lower()
        
        # Known bad patterns
        bad_patterns = ['curl', 'wget', 'python', 'scanner', 'nikto', 
                       'sqlmap', 'nmap', 'masscan']
        for pattern in bad_patterns:
            if pattern in ua_lower:
                return 0.9
        
        # Very short UA
        if len(user_agent) < 20:
            return 0.6
        
        return 0.0
    
    @staticmethod
    def _score_time_of_day(timestamp: datetime) -> float:
        """Score unusual access time (business hours = normal)."""
        hour = timestamp.hour
        # Business hours (9-17) = normal
        if 9 <= hour <= 17:
            return 0.0
        # Night (0-6) = more suspicious
        if 0 <= hour <= 6:
            return 0.4
        return 0.2
    
    def _score_referrer(self, referer: Optional[str]) -> float:
        """Score referrer anomaly."""
        if not referer:
            return 0.2  # Direct access slightly unusual for some endpoints
        return 0.0
    
    def _calculate_bot_score(
        self, 
        request: TrafficRequest, 
        session: SessionState
    ) -> float:
        """Calculate likelihood this is bot traffic."""
        score = 0.0
        
        # High request rate
        if session.request_count > 100:
            score += 0.3
        
        # No cookies
        if not request.has_cookie:
            score += 0.2
        
        # Suspicious UA
        score += self._score_user_agent(request.user_agent) * 0.3
        
        # Accessing many unique URIs quickly
        if session.request_count > 0:
            uri_ratio = len(session.unique_uris) / session.request_count
            if uri_ratio > 0.8:  # Almost all unique
                score += 0.2
        
        return min(score, 1.0)
    
    def update_baseline(self, features: ExtractedFeatures, alpha: float = 0.01):
        """
        Update baseline statistics using EWMA.
        
        Args:
            features: Extracted features from a normal request
            alpha: EWMA smoothing factor (lower = slower adaptation)
        """
        # Update requests per minute baseline
        rpm = features.requests_per_minute
        stats = self.baseline_stats['requests_per_minute']
        stats['mean'] = alpha * rpm + (1 - alpha) * stats['mean']
        stats['std'] = alpha * abs(rpm - stats['mean']) + (1 - alpha) * stats['std']
        
        # Update other baselines similarly
        for key, feature_name in [
            ('uri_length', 'uri_length'),
            ('body_length', 'body_length'),
        ]:
            value = getattr(features, feature_name)
            stats = self.baseline_stats[key]
            stats['mean'] = alpha * value + (1 - alpha) * stats['mean']
            stats['std'] = alpha * abs(value - stats['mean']) + (1 - alpha) * stats['std']
    
    def cleanup_old_sessions(self, max_age_seconds: int = 3600):
        """Remove sessions older than max_age."""
        cutoff = datetime.utcnow() - timedelta(seconds=max_age_seconds)
        expired = [
            ip for ip, session in self.sessions.items()
            if session.first_seen < cutoff
        ]
        for ip in expired:
            del self.sessions[ip]
