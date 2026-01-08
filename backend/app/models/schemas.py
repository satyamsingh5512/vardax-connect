"""
Pydantic schemas for API request/response validation.
Clean, typed data structures for the entire system.
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import ipaddress


# ============================================================================
# ENUMS
# ============================================================================

class SeverityLevel(str, Enum):
    """Anomaly severity levels for UI color coding."""
    LOW = "low"           # Green - informational
    MEDIUM = "medium"     # Amber - investigate
    HIGH = "high"         # Red - likely attack
    CRITICAL = "critical" # Red + alert - confirmed attack


class RuleStatus(str, Enum):
    """WAF rule lifecycle status."""
    PENDING = "pending"     # Awaiting approval
    APPROVED = "approved"   # Active in WAF
    REJECTED = "rejected"   # Declined by admin
    ROLLED_BACK = "rolled_back"  # Was active, now disabled


class FeedbackType(str, Enum):
    """Analyst feedback on anomalies."""
    TRUE_POSITIVE = "true_positive"   # Correct detection
    FALSE_POSITIVE = "false_positive" # Wrong detection
    NEEDS_REVIEW = "needs_review"     # Uncertain


# ============================================================================
# TRAFFIC INGESTION
# ============================================================================

class TrafficRequest(BaseModel):
    """
    Incoming HTTP request data from NGINX mirror.
    This is what we receive for ML analysis.
    """
    request_id: str = Field(..., description="Unique request identifier")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Client info
    client_ip: str = Field(..., description="Client IP address")
    client_port: int = Field(..., ge=1, le=65535, description="Client port number")
    user_agent: Optional[str] = Field(None, max_length=1000)
    
    @validator('client_ip')
    def validate_ip_address(cls, v):
        """Validate that client_ip is a valid IP address."""
        try:
            ipaddress.ip_address(v)
            return v
        except ValueError:
            raise ValueError(f"Invalid IP address: {v}")
    
    @validator('method')
    def validate_http_method(cls, v):
        """Validate HTTP method."""
        valid_methods = {'GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH', 'TRACE'}
        if v.upper() not in valid_methods:
            raise ValueError(f"Invalid HTTP method: {v}")
        return v.upper()
    
    @validator('uri')
    def validate_uri_length(cls, v):
        """Validate URI length to prevent extremely long URIs."""
        if len(v) > 8192:  # 8KB limit
            raise ValueError("URI too long (max 8192 characters)")
        return v
    
    # Request details
    method: str  # GET, POST, etc.
    uri: str
    query_string: Optional[str] = None
    protocol: str = "HTTP/1.1"
    
    # Headers (selected, not all)
    content_type: Optional[str] = None
    content_length: int = 0
    accept: Optional[str] = None
    accept_encoding: Optional[str] = None
    accept_language: Optional[str] = None
    referer: Optional[str] = None
    origin: Optional[str] = None
    
    # Auth indicators (not actual tokens)
    has_auth_header: bool = False
    has_cookie: bool = False
    
    # Body statistics (NOT raw body)
    body_length: int = 0
    body_entropy: float = 0.0  # Shannon entropy
    body_printable_ratio: float = 1.0
    
    # Timing
    request_time_ms: float = 0.0


class TrafficResponse(BaseModel):
    """Response metadata for correlation."""
    request_id: str
    status_code: int
    response_length: int
    response_time_ms: float


# ============================================================================
# FEATURE EXTRACTION
# ============================================================================

class ExtractedFeatures(BaseModel):
    """
    47 features extracted from traffic for ML inference.
    These are the actual inputs to our models.
    """
    request_id: str
    timestamp: datetime
    
    # Request-level features (15)
    method_encoded: int  # One-hot encoded
    uri_length: int
    uri_depth: int  # Number of path segments
    uri_entropy: float
    query_param_count: int
    query_length: int
    query_entropy: float
    has_file_extension: bool
    extension_risk_score: float  # .php, .asp = higher
    body_length: int
    body_entropy: float
    body_printable_ratio: float
    content_type_encoded: int
    header_count: int
    unusual_header_count: int
    
    # Session-level features (10)
    session_request_count: int
    session_unique_uris: int
    session_unique_methods: int
    session_error_rate: float  # 4xx/5xx ratio
    session_avg_response_time: float
    session_duration_seconds: float
    session_bytes_sent: int
    session_bytes_received: int
    session_uri_pattern_score: float  # Deviation from normal patterns
    session_api_sequence_score: float  # API call order anomaly
    
    # Rate features (8)
    requests_per_minute: float
    requests_per_minute_zscore: float  # Compared to baseline
    unique_ips_per_minute: int  # For this endpoint
    error_rate_per_minute: float
    bytes_per_minute: float
    new_uri_rate: float  # URIs not seen before
    auth_failure_rate: float
    rate_acceleration: float  # Rate of change
    
    # Behavioral features (8)
    user_agent_anomaly_score: float
    geo_anomaly_score: float  # If IP geolocation available
    time_of_day_score: float  # Unusual access time
    referrer_anomaly_score: float
    request_pattern_score: float  # ML-derived
    payload_anomaly_score: float  # ML-derived
    fingerprint_consistency: float  # Browser fingerprint match
    bot_likelihood_score: float
    
    # API-specific features (6)
    api_endpoint_encoded: int
    api_param_deviation: float
    api_response_size_deviation: float
    api_timing_deviation: float
    api_sequence_position: int
    api_call_frequency: float


# ============================================================================
# ANOMALY DETECTION
# ============================================================================

class AnomalyScore(BaseModel):
    """Individual model scores."""
    isolation_forest: float = Field(..., ge=0, le=1)
    autoencoder: float = Field(..., ge=0, le=1)
    ewma_baseline: float = Field(..., ge=0, le=1)
    ensemble: float = Field(..., ge=0, le=1)


class AnomalyExplanation(BaseModel):
    """Human-readable explanation of why something is anomalous."""
    feature_name: str
    feature_value: float
    baseline_value: float
    deviation_percent: float
    description: str  # "Request rate 340% above baseline"


class AnomalyResult(BaseModel):
    """Complete anomaly detection result."""
    request_id: str
    timestamp: datetime
    client_ip: str
    uri: str
    
    # Scores
    scores: AnomalyScore
    severity: SeverityLevel
    confidence: float = Field(..., ge=0, le=1)
    
    # Explanations (top contributing factors)
    explanations: List[AnomalyExplanation]
    
    # Categorization
    attack_category: Optional[str] = None  # "rate_abuse", "injection", etc.
    
    # Actions
    recommended_action: str  # "monitor", "rate_limit", "block"
    rule_recommended: bool = False


# ============================================================================
# RULE RECOMMENDATION
# ============================================================================

class RuleRecommendation(BaseModel):
    """WAF rule recommendation from ML insights."""
    rule_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Source anomaly
    source_anomaly_ids: List[str]
    anomaly_count: int  # How many anomalies triggered this
    
    # Rule details
    rule_type: str  # "rate_limit", "block_ip", "block_pattern", etc.
    rule_content: str  # ModSecurity-compatible rule
    rule_description: str  # Human-readable
    
    # Confidence
    confidence: float = Field(..., ge=0, le=1)
    false_positive_estimate: float = Field(..., ge=0, le=1)
    
    # Status
    status: RuleStatus = RuleStatus.PENDING
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    
    # Versioning
    version: int = 1
    previous_version_id: Optional[str] = None


class RuleApprovalRequest(BaseModel):
    """Admin request to approve/reject a rule."""
    rule_id: str
    action: str  # "approve", "reject", "rollback"
    reason: Optional[str] = None


# ============================================================================
# FEEDBACK
# ============================================================================

class AnomalyFeedback(BaseModel):
    """Analyst feedback on an anomaly detection."""
    anomaly_id: str
    feedback_type: FeedbackType
    analyst_id: str
    notes: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# DASHBOARD
# ============================================================================

class TrafficMetrics(BaseModel):
    """Real-time traffic metrics for dashboard."""
    timestamp: datetime
    requests_per_second: float
    anomalies_per_minute: int
    blocked_requests: int
    avg_response_time_ms: float
    error_rate: float
    unique_ips: int
    top_endpoints: List[Dict[str, Any]]


class AnomalySummary(BaseModel):
    """Anomaly summary for timeline view."""
    anomaly_id: str
    timestamp: datetime
    client_ip: str
    uri: str
    severity: SeverityLevel
    confidence: float
    attack_category: Optional[str]
    top_explanation: str
    status: str  # "new", "reviewed", "resolved"


class ModelHealth(BaseModel):
    """ML model health metrics."""
    model_name: str
    version: str
    last_trained: datetime
    training_samples: int
    inference_count_24h: int
    avg_inference_time_ms: float
    anomaly_rate_24h: float
    false_positive_rate: float
