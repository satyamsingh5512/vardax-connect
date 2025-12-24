"""
VARDAx Reverse Proxy with ML Protection

This module makes VARDAx act as a true firewall/reverse proxy.
All traffic goes through VARDAx first, gets analyzed, then forwarded to backend.

Architecture:
User → VARDAx (this proxy) → Protected Backend
       ↓ ML Analysis
       ↓ Block/Allow Decision
"""
import httpx
import logging
from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import JSONResponse
from datetime import datetime
from typing import Optional

from ..ml.feature_extractor import FeatureExtractor
from ..ml.models import AnomalyDetector
from ..models.schemas import TrafficRequest
from ..database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize components
feature_extractor = FeatureExtractor()
anomaly_detector = AnomalyDetector()

# Protected backend URL
PROTECTED_BACKEND_URL = "http://localhost:4000"

# Decision thresholds
BLOCK_THRESHOLD = 0.8
CHALLENGE_THRESHOLD = 0.5


async def analyze_request(request: Request) -> tuple[bool, float, list]:
    """
    Analyze incoming request with ML.
    
    Returns:
        (should_allow, anomaly_score, explanations)
    """
    try:
        # Extract request data
        body = await request.body()
        
        traffic_data = TrafficRequest(
            request_id=f"proxy-{datetime.utcnow().timestamp()}",
            timestamp=datetime.utcnow(),
            client_ip=request.client.host,
            client_port=request.client.port if request.client.port else 0,
            method=request.method,
            uri=str(request.url.path),
            query_string=str(request.url.query) if request.url.query else None,
            protocol=request.scope.get("http_version", "HTTP/1.1"),
            user_agent=request.headers.get("user-agent"),
            content_type=request.headers.get("content-type"),
            content_length=int(request.headers.get("content-length", 0)),
            has_auth_header=bool(request.headers.get("authorization")),
            has_cookie=bool(request.headers.get("cookie")),
            body_length=len(body),
            body_entropy=0.0,  # Calculate if needed
            body_printable_ratio=1.0,
            request_time_ms=0.0
        )
        
        # Extract features
        features = feature_extractor.extract(traffic_data)
        feature_dict = features.model_dump()
        
        # Run ML inference
        prediction = anomaly_detector.predict(feature_dict)
        
        # Save to database
        db = get_db()
        db.save_traffic_event({
            "event_id": traffic_data.request_id,
            "timestamp": traffic_data.timestamp.isoformat(),
            "client_ip": traffic_data.client_ip,
            "method": traffic_data.method,
            "uri": traffic_data.uri,
            "status_code": 0,  # Will be updated after proxying
            "response_time_ms": 0,
            "user_agent": traffic_data.user_agent or "Unknown",
            "content_length": traffic_data.content_length,
            "is_anomaly": prediction.is_anomaly,
            "anomaly_score": prediction.ensemble_score,
            "severity": "high" if prediction.ensemble_score > 0.8 else "medium" if prediction.ensemble_score > 0.5 else "low",
            "attack_category": _categorize_attack(prediction.explanations),
            "features": feature_dict,
            "explanations": prediction.explanations
        })
        
        # Decision
        should_allow = prediction.ensemble_score < BLOCK_THRESHOLD
        
        return should_allow, prediction.ensemble_score, prediction.explanations
        
    except Exception as e:
        logger.error(f"Error analyzing request: {e}")
        # Fail open - allow request but log error
        return True, 0.0, []


def _categorize_attack(explanations: list) -> Optional[str]:
    """Categorize attack type from explanations."""
    if not explanations:
        return None
    
    feature_names = [e.get('feature_name', '') for e in explanations]
    
    if 'auth_failure_rate' in feature_names:
        return "credential_stuffing"
    if 'requests_per_minute' in feature_names:
        return "rate_abuse"
    if 'bot_likelihood_score' in feature_names:
        return "bot_attack"
    if 'uri_entropy' in feature_names or 'query_entropy' in feature_names:
        return "injection_attempt"
    if 'session_unique_uris' in feature_names:
        return "reconnaissance"
    
    return "unknown"


@router.api_route("/protected/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_request(request: Request, path: str):
    """
    Reverse proxy with ML protection.
    
    All requests to /protected/* are analyzed and forwarded to backend.
    """
    # Analyze request with ML
    should_allow, anomaly_score, explanations = await analyze_request(request)
    
    # Block high-risk requests
    if not should_allow:
        logger.warning(f"Blocked request: {request.method} {path} (score: {anomaly_score:.2f})")
        
        return JSONResponse(
            status_code=403,
            content={
                "error": "Request blocked by VARDAx WAF",
                "reason": "Suspicious activity detected",
                "anomaly_score": anomaly_score,
                "explanations": [e.get("description", "") for e in explanations[:3]],
                "request_id": f"blocked-{datetime.utcnow().timestamp()}",
                "support": "Contact support if you believe this is an error"
            },
            headers={
                "X-VARDAx-Blocked": "true",
                "X-VARDAx-Score": str(anomaly_score),
                "X-VARDAx-Reason": "anomaly_detected"
            }
        )
    
    # Challenge medium-risk requests
    if anomaly_score >= CHALLENGE_THRESHOLD:
        logger.info(f"Challenged request: {request.method} {path} (score: {anomaly_score:.2f})")
        # For now, just add warning headers
        # In production, you'd serve a CAPTCHA or JS challenge
    
    # Forward to protected backend
    try:
        # Prepare request
        url = f"{PROTECTED_BACKEND_URL}/{path}"
        if request.url.query:
            url += f"?{request.url.query}"
        
        headers = dict(request.headers)
        # Remove hop-by-hop headers
        headers.pop("host", None)
        headers.pop("connection", None)
        
        body = await request.body()
        
        # Make request to backend
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=request.method,
                url=url,
                headers=headers,
                content=body,
                timeout=30.0
            )
        
        # Add VARDAx headers
        response_headers = dict(response.headers)
        response_headers["X-VARDAx-Protected"] = "true"
        response_headers["X-VARDAx-Score"] = str(anomaly_score)
        
        if anomaly_score >= CHALLENGE_THRESHOLD:
            response_headers["X-VARDAx-Challenge"] = "true"
        
        logger.info(f"Allowed request: {request.method} {path} (score: {anomaly_score:.2f})")
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=response_headers
        )
        
    except httpx.RequestError as e:
        logger.error(f"Error proxying request: {e}")
        return JSONResponse(
            status_code=502,
            content={
                "error": "Bad Gateway",
                "message": "Protected backend is unavailable"
            }
        )


@router.get("/protected-status")
async def protected_status():
    """Check if protected backend is reachable."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{PROTECTED_BACKEND_URL}/health", timeout=5.0)
            return {
                "protected_backend": "reachable",
                "status": response.status_code,
                "vardax_protection": "active"
            }
    except Exception as e:
        return {
            "protected_backend": "unreachable",
            "error": str(e),
            "vardax_protection": "active"
        }
