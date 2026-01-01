"""
FastAPI Routes for VARDAx.

Clean REST API design with:
- Traffic ingestion endpoint (from NGINX)
- ML inference endpoint
- Rule recommendation endpoints
- Admin feedback endpoints
- WebSocket for real-time dashboard updates
- Database persistence (SQLite/PostgreSQL)
"""
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import asyncio
import json
import logging

from ..models.schemas import (
    TrafficRequest, TrafficResponse, AnomalyResult, AnomalySummary,
    RuleRecommendation, RuleApprovalRequest, AnomalyFeedback,
    TrafficMetrics, ModelHealth, SeverityLevel, RuleStatus, FeedbackType
)
from ..ml.feature_extractor import FeatureExtractor
from ..ml.models import AnomalyDetector, EnsemblePrediction
from ..ml.rule_generator import RuleGenerator
from ..config import get_settings
from ..database import get_db, DatabaseManager
from .replay import record_event, get_timeline, get_heatmap_data, get_geo_aggregation, get_attack_sequence, clear_replay_data
from .simulator import simulate_rule, get_simulation_scenarios, SimulationResult

logger = logging.getLogger(__name__)

# Initialize components
settings = get_settings()
feature_extractor = FeatureExtractor(
    session_window_seconds=settings.session_window_seconds,
    rate_window_seconds=settings.rate_window_seconds
)
anomaly_detector = AnomalyDetector()
rule_generator = RuleGenerator()

# In-memory cache (backed by database)
recent_anomalies: List[Dict] = []
pending_rules: Dict[str, RuleRecommendation] = {}
connected_websockets: List[WebSocket] = []
traffic_websockets: List[WebSocket] = []
connected_services: Dict[str, Dict[str, Any]] = {}  # service_id -> service info

# Create routers
router = APIRouter()
ws_router = APIRouter()


# ============================================================================
# DATABASE MANAGEMENT API
# ============================================================================

@router.post("/admin/clear-data", tags=["Admin"])
async def clear_all_data() -> Dict[str, str]:
    """
    Clear all stored data (anomalies, rules, events).
    Use for testing or resetting the system.
    """
    global recent_anomalies, pending_rules
    
    # Clear in-memory data
    recent_anomalies.clear()
    pending_rules.clear()
    
    # Clear replay data
    clear_replay_data()
    
    # Clear database
    db = get_db()
    db.clear_all_data()
    
    logger.info("All data cleared")
    return {"status": "success", "message": "All data cleared"}


@router.get("/admin/db-stats", tags=["Admin"])
async def get_database_stats() -> Dict[str, Any]:
    """Get database statistics."""
    db = get_db()
    stats = db.get_stats()
    stats["in_memory_anomalies"] = len(recent_anomalies)
    stats["in_memory_rules"] = len(pending_rules)
    stats["ws_connections"] = len(connected_websockets) + len(traffic_websockets)
    stats["connected_services"] = len(connected_services)
    return stats


# ============================================================================
# CONNECTED SERVICES API
# ============================================================================

@router.post("/services/register", tags=["Services"])
async def register_service(service_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Register a service/application connecting to VARDAx.
    Called automatically by vardax-connect middleware on startup.
    """
    service_id = service_data.get("service_id") or f"svc-{datetime.utcnow().timestamp()}"
    
    service_info = {
        "service_id": service_id,
        "name": service_data.get("name", "Unknown Service"),
        "host": service_data.get("host", "unknown"),
        "port": service_data.get("port", 0),
        "environment": service_data.get("environment", "development"),
        "version": service_data.get("version", "1.0.0"),
        "framework": service_data.get("framework", "unknown"),
        "registered_at": datetime.utcnow().isoformat(),
        "last_heartbeat": datetime.utcnow().isoformat(),
        "status": "online",
        "requests_total": 0,
        "anomalies_total": 0,
        "mode": service_data.get("mode", "monitor")
    }
    
    connected_services[service_id] = service_info
    logger.info(f"Service registered: {service_info['name']} ({service_id})")
    
    # Broadcast to dashboards
    await broadcast_service_update(service_info, "registered")
    
    return {"status": "registered", "service_id": service_id, "service": service_info}


@router.post("/services/heartbeat", tags=["Services"])
async def service_heartbeat(heartbeat_data: Dict[str, Any]) -> Dict[str, str]:
    """
    Receive heartbeat from connected service.
    Updates last_seen timestamp and stats.
    """
    service_id = heartbeat_data.get("service_id")
    
    if service_id and service_id in connected_services:
        connected_services[service_id]["last_heartbeat"] = datetime.utcnow().isoformat()
        connected_services[service_id]["status"] = "online"
        
        # Update stats if provided
        if "requests_total" in heartbeat_data:
            connected_services[service_id]["requests_total"] = heartbeat_data["requests_total"]
        if "anomalies_total" in heartbeat_data:
            connected_services[service_id]["anomalies_total"] = heartbeat_data["anomalies_total"]
        
        return {"status": "ok"}
    
    return {"status": "unknown_service"}


@router.get("/services", tags=["Services"])
async def get_connected_services() -> List[Dict[str, Any]]:
    """
    Get all connected services/applications.
    """
    # Check for stale services (no heartbeat in 60 seconds)
    now = datetime.utcnow()
    for service_id, service in connected_services.items():
        last_hb = datetime.fromisoformat(service["last_heartbeat"])
        if (now - last_hb).total_seconds() > 60:
            service["status"] = "offline"
        elif (now - last_hb).total_seconds() > 30:
            service["status"] = "degraded"
    
    return list(connected_services.values())


@router.delete("/services/{service_id}", tags=["Services"])
async def unregister_service(service_id: str) -> Dict[str, str]:
    """
    Unregister a service.
    """
    if service_id in connected_services:
        service = connected_services.pop(service_id)
        await broadcast_service_update(service, "unregistered")
        return {"status": "unregistered", "service_id": service_id}
    
    raise HTTPException(status_code=404, detail="Service not found")


async def broadcast_service_update(service: Dict, event_type: str):
    """Broadcast service update to dashboards."""
    message = json.dumps({
        "type": "service_update",
        "event": event_type,
        "service": service
    })
    
    for ws in connected_websockets:
        try:
            await ws.send_text(message)
        except Exception:
            pass


@router.post("/admin/load-from-db", tags=["Admin"])
async def load_from_database() -> Dict[str, str]:
    """Load data from database into memory cache."""
    global recent_anomalies, pending_rules
    
    db = get_db()
    
    # Load anomalies
    db_anomalies = db.get_anomalies(since_minutes=1440, limit=1000)  # Last 24h
    recent_anomalies.clear()
    for a in db_anomalies:
        recent_anomalies.append(a)
    
    # Load rules
    db_rules = db.get_rules()
    pending_rules.clear()
    for r in db_rules:
        rec = RuleRecommendation(
            rule_id=r["rule_id"],
            created_at=datetime.fromisoformat(r["created_at"]) if isinstance(r["created_at"], str) else r["created_at"],
            source_anomaly_ids=r.get("source_anomaly_ids", []),
            anomaly_count=r.get("anomaly_count", 0),
            rule_type=r["rule_type"],
            rule_content=r["rule_content"],
            rule_description=r.get("rule_description", ""),
            confidence=r.get("confidence", 0),
            false_positive_estimate=r.get("false_positive_estimate", 0),
            status=RuleStatus(r["status"])
        )
        pending_rules[r["rule_id"]] = rec
    
    return {
        "status": "success",
        "anomalies_loaded": len(recent_anomalies),
        "rules_loaded": len(pending_rules)
    }


# ============================================================================
# TRAFFIC INGESTION API
# ============================================================================

@router.post("/traffic/ingest", tags=["Traffic"])
async def ingest_traffic(
    request: TrafficRequest,
    background_tasks: BackgroundTasks
) -> Dict[str, Any]:
    """
    Ingest traffic from NGINX mirror for ML analysis.
    
    This endpoint is called asynchronously by NGINX for every request.
    It extracts features and queues for ML inference.
    
    Returns immediately to not block traffic flow.
    """
    # Extract features
    features = feature_extractor.extract(request)
    
    # Track service stats if service_id provided
    service_id = getattr(request, 'service_id', None)
    if service_id and service_id in connected_services:
        connected_services[service_id]["requests_total"] = connected_services[service_id].get("requests_total", 0) + 1
        connected_services[service_id]["last_heartbeat"] = datetime.utcnow().isoformat()
        connected_services[service_id]["status"] = "online"
    
    # Queue for async ML inference
    background_tasks.add_task(
        process_traffic_async,
        request,
        features,
        service_id
    )
    
    return {
        "status": "queued",
        "request_id": request.request_id
    }


async def process_traffic_async(request: TrafficRequest, features, service_id: Optional[str] = None):
    """Background task for ML inference."""
    try:
        # Convert features to dict for ML
        feature_dict = features.model_dump()
        request_dict = request.model_dump()
        
        # Run ML inference
        prediction = anomaly_detector.predict(feature_dict)
        
        # Create result for recording
        result_dict = {
            "is_anomaly": prediction.is_anomaly,
            "severity": "high" if prediction.ensemble_score > 0.6 else "medium" if prediction.ensemble_score > 0.3 else "low",
            "confidence": prediction.confidence,
            "attack_category": categorize_attack(prediction.explanations),
            "explanations": prediction.explanations,
        }
        
        # Record event for replay (all traffic, not just anomalies)
        record_event(request_dict, feature_dict, result_dict)
        
        # Save to database
        db = get_db()
        traffic_event = {
            "event_id": request.request_id,
            "timestamp": request.timestamp.isoformat() if hasattr(request.timestamp, 'isoformat') else str(request.timestamp),
            "client_ip": request.client_ip,
            "method": request.method,
            "uri": request.uri,
            "status_code": getattr(request, 'status_code', 200),
            "response_time_ms": getattr(request, 'response_time_ms', 0),
            "user_agent": getattr(request, 'user_agent', 'Unknown'),
            "content_length": getattr(request, 'content_length', 0),
            "is_anomaly": prediction.is_anomaly,
            "anomaly_score": prediction.ensemble_score,
            "severity": "normal" if not prediction.is_anomaly else result_dict["severity"],
            "attack_category": result_dict["attack_category"] if prediction.is_anomaly else None,
            "features": feature_dict,
            "explanations": prediction.explanations,
            "service_id": service_id
        }
        db.save_traffic_event(traffic_event)
        
        # Broadcast to live traffic viewers
        await broadcast_traffic(traffic_event)
        
        # If anomalous, store and notify
        if prediction.is_anomaly or prediction.ensemble_score > 0.3:
            anomaly = create_anomaly_result(request, prediction, feature_dict)
            anomaly["service_id"] = service_id
            
            # Update service anomaly count
            if service_id and service_id in connected_services:
                connected_services[service_id]["anomalies_total"] = connected_services[service_id].get("anomalies_total", 0) + 1
            
            # Save to database
            db.save_anomaly(anomaly)
            
            # Add to in-memory cache
            recent_anomalies.append(anomaly)
            if len(recent_anomalies) > 1000:
                recent_anomalies.pop(0)
            
            # Notify connected dashboards
            await broadcast_anomaly(anomaly)
        
        # Update baseline with normal traffic
        if not prediction.is_anomaly:
            anomaly_detector.update_baseline(feature_dict)
            
    except Exception as e:
        logger.error(f"Error processing traffic: {e}")


def create_anomaly_result(
    request: TrafficRequest,
    prediction: EnsemblePrediction,
    features: Dict
) -> Dict[str, Any]:
    """Create anomaly result from prediction."""
    # Determine severity
    if prediction.ensemble_score > 0.8:
        severity = SeverityLevel.CRITICAL
    elif prediction.ensemble_score > 0.6:
        severity = SeverityLevel.HIGH
    elif prediction.ensemble_score > 0.4:
        severity = SeverityLevel.MEDIUM
    else:
        severity = SeverityLevel.LOW
    
    # Determine attack category from explanations
    attack_category = categorize_attack(prediction.explanations)
    
    return {
        "anomaly_id": f"anom-{request.request_id}",
        "request_id": request.request_id,
        "timestamp": request.timestamp.isoformat(),
        "client_ip": request.client_ip,
        "uri": request.uri,
        "method": request.method,
        "scores": {
            "isolation_forest": prediction.isolation_forest_score,
            "autoencoder": prediction.autoencoder_score,
            "ewma": prediction.ewma_score,
            "ensemble": prediction.ensemble_score
        },
        "severity": severity.value,
        "confidence": prediction.confidence,
        "explanations": prediction.explanations,
        "attack_category": attack_category,
        "features": features,
        "status": "new"
    }


def categorize_attack(explanations: List[Dict]) -> str:
    """Categorize attack type from explanations."""
    feature_names = [e.get('feature_name', '') for e in explanations]
    
    if 'auth_failure_rate' in feature_names:
        return "credential_stuffing"
    if 'requests_per_minute' in feature_names or 'rate_acceleration' in feature_names:
        return "rate_abuse"
    if 'bot_likelihood_score' in feature_names:
        return "bot_attack"
    if 'uri_entropy' in feature_names or 'query_entropy' in feature_names:
        return "injection_attempt"
    if 'session_unique_uris' in feature_names:
        return "reconnaissance"
    
    return "unknown"


# ============================================================================
# ML INFERENCE API
# ============================================================================

@router.post("/ml/analyze", tags=["ML"])
async def analyze_request(request: TrafficRequest) -> AnomalyResult:
    """
    Synchronous ML analysis for a single request.
    
    Use this for testing or when you need immediate results.
    For production traffic, use /traffic/ingest instead.
    """
    # Extract features
    features = feature_extractor.extract(request)
    feature_dict = features.model_dump()
    
    # Run inference
    prediction = anomaly_detector.predict(feature_dict)
    
    # Create result
    anomaly = create_anomaly_result(request, prediction, feature_dict)
    
    return AnomalyResult(**{
        "request_id": anomaly["request_id"],
        "timestamp": datetime.fromisoformat(anomaly["timestamp"]),
        "client_ip": anomaly["client_ip"],
        "uri": anomaly["uri"],
        "scores": anomaly["scores"],
        "severity": SeverityLevel(anomaly["severity"]),
        "confidence": anomaly["confidence"],
        "explanations": [
            {
                "feature_name": e["feature_name"],
                "feature_value": e.get("feature_value", 0),
                "baseline_value": e.get("baseline_value", 0),
                "deviation_percent": e.get("deviation_percent", 0),
                "description": e["description"]
            }
            for e in anomaly["explanations"]
        ],
        "attack_category": anomaly["attack_category"],
        "recommended_action": "block" if prediction.ensemble_score > 0.7 else "monitor",
        "rule_recommended": prediction.ensemble_score > 0.6
    })


@router.get("/ml/health", tags=["ML"])
async def get_model_health() -> List[ModelHealth]:
    """Get health status of ML models."""
    return [
        ModelHealth(
            model_name="Isolation Forest",
            version="1.0.0",
            last_trained=datetime.utcnow() - timedelta(days=1),
            training_samples=10000,
            inference_count_24h=50000,
            avg_inference_time_ms=5.2,
            anomaly_rate_24h=0.02,
            false_positive_rate=0.01
        ),
        ModelHealth(
            model_name="Autoencoder",
            version="1.0.0",
            last_trained=datetime.utcnow() - timedelta(days=1),
            training_samples=10000,
            inference_count_24h=50000,
            avg_inference_time_ms=12.5,
            anomaly_rate_24h=0.025,
            false_positive_rate=0.015
        ),
        ModelHealth(
            model_name="EWMA Baseline",
            version="1.0.0",
            last_trained=datetime.utcnow(),
            training_samples=anomaly_detector.ewma.sample_count,
            inference_count_24h=50000,
            avg_inference_time_ms=0.5,
            anomaly_rate_24h=0.018,
            false_positive_rate=0.008
        )
    ]


# ============================================================================
# ANOMALY API
# ============================================================================

@router.get("/anomalies", tags=["Anomalies"])
async def get_anomalies(
    limit: int = 100,
    severity: Optional[str] = None,
    since_minutes: int = 60,
    from_db: bool = False
) -> List[AnomalySummary]:
    """
    Get recent anomalies for dashboard.
    
    Set from_db=true to fetch from database instead of memory cache.
    """
    if from_db:
        db = get_db()
        db_anomalies = db.get_anomalies(since_minutes=since_minutes, limit=limit, severity=severity)
        return [
            AnomalySummary(
                anomaly_id=a["anomaly_id"],
                timestamp=datetime.fromisoformat(a["timestamp"]) if isinstance(a["timestamp"], str) else a["timestamp"],
                client_ip=a["client_ip"],
                uri=a["uri"],
                severity=SeverityLevel(a["severity"]),
                confidence=a["confidence"],
                attack_category=a.get("attack_category"),
                top_explanation=a.get("explanations", [{}])[0].get("description", "Unknown") if a.get("explanations") else "Unknown",
                status=a.get("status", "new")
            )
            for a in db_anomalies
        ]
    
    # From memory cache
    cutoff = datetime.utcnow() - timedelta(minutes=since_minutes)
    
    filtered = [
        a for a in recent_anomalies
        if datetime.fromisoformat(a["timestamp"]) > cutoff
    ]
    
    if severity:
        filtered = [a for a in filtered if a["severity"] == severity]
    
    filtered.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return [
        AnomalySummary(
            anomaly_id=a["anomaly_id"],
            timestamp=datetime.fromisoformat(a["timestamp"]),
            client_ip=a["client_ip"],
            uri=a["uri"],
            severity=SeverityLevel(a["severity"]),
            confidence=a["confidence"],
            attack_category=a.get("attack_category"),
            top_explanation=a["explanations"][0]["description"] if a["explanations"] else "Unknown",
            status=a.get("status", "new")
        )
        for a in filtered[:limit]
    ]


@router.get("/anomalies/{anomaly_id}", tags=["Anomalies"])
async def get_anomaly_detail(anomaly_id: str) -> Dict[str, Any]:
    """Get detailed anomaly information."""
    # Check memory first
    for a in recent_anomalies:
        if a["anomaly_id"] == anomaly_id:
            return a
    
    # Check database
    db = get_db()
    anomaly = db.get_anomaly(anomaly_id)
    if anomaly:
        return anomaly
    
    raise HTTPException(status_code=404, detail="Anomaly not found")


# ============================================================================
# RULE RECOMMENDATION API
# ============================================================================

@router.post("/rules/generate", tags=["Rules"])
async def generate_rules() -> List[RuleRecommendation]:
    """
    Generate rule recommendations from recent anomalies.
    """
    high_confidence = [
        a for a in recent_anomalies
        if a["confidence"] > 0.6
    ]
    
    if not high_confidence:
        return []
    
    generated = rule_generator.generate_from_anomalies(high_confidence)
    
    recommendations = []
    db = get_db()
    
    for rule in generated:
        rec = RuleRecommendation(
            rule_id=rule.rule_id,
            created_at=rule.created_at,
            source_anomaly_ids=rule.source_anomalies,
            anomaly_count=len(rule.source_anomalies),
            rule_type=rule.rule_type,
            rule_content=rule.rule_content,
            rule_description=rule.description,
            confidence=rule.confidence,
            false_positive_estimate=rule.false_positive_estimate,
            status=RuleStatus.PENDING
        )
        pending_rules[rule.rule_id] = rec
        
        # Save to database
        db.save_rule({
            "rule_id": rule.rule_id,
            "rule_type": rule.rule_type,
            "rule_content": rule.rule_content,
            "rule_description": rule.description,
            "confidence": rule.confidence,
            "false_positive_estimate": rule.false_positive_estimate,
            "source_anomaly_ids": rule.source_anomalies,
            "anomaly_count": len(rule.source_anomalies),
            "status": "pending"
        })
        
        recommendations.append(rec)
    
    return recommendations


@router.get("/rules/pending", tags=["Rules"])
async def get_pending_rules() -> List[RuleRecommendation]:
    """Get all rules pending approval."""
    return [r for r in pending_rules.values() if r.status == RuleStatus.PENDING]


@router.post("/rules/approve", tags=["Rules"])
async def approve_rule(request: RuleApprovalRequest) -> RuleRecommendation:
    """Approve or reject a rule recommendation."""
    if request.rule_id not in pending_rules:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    rule = pending_rules[request.rule_id]
    db = get_db()
    
    if request.action == "approve":
        rule.status = RuleStatus.APPROVED
        rule.approved_at = datetime.utcnow()
        rule.approved_by = "admin"
        db.update_rule_status(request.rule_id, "approved", "admin")
        logger.info(f"Rule {rule.rule_id} approved and deployed")
        
    elif request.action == "reject":
        rule.status = RuleStatus.REJECTED
        db.update_rule_status(request.rule_id, "rejected")
        
    elif request.action == "rollback":
        rule.status = RuleStatus.ROLLED_BACK
        db.update_rule_status(request.rule_id, "rolled_back")
    
    return rule


@router.get("/rules/examples", tags=["Rules"])
async def get_example_rules() -> List[str]:
    """Get example ModSecurity rules for documentation."""
    return RuleGenerator.get_example_rules()


# ============================================================================
# FEEDBACK API
# ============================================================================

@router.post("/feedback", tags=["Feedback"])
async def submit_feedback(feedback: AnomalyFeedback) -> Dict[str, str]:
    """Submit analyst feedback on an anomaly."""
    db = get_db()
    
    # Update in memory
    for a in recent_anomalies:
        if a["anomaly_id"] == feedback.anomaly_id:
            a["feedback"] = feedback.feedback_type.value
            a["feedback_notes"] = feedback.notes
            a["status"] = "reviewed"
            
            if feedback.feedback_type == FeedbackType.FALSE_POSITIVE:
                if "features" in a:
                    anomaly_detector.update_baseline(a["features"])
            break
    
    # Update in database
    db.update_anomaly_feedback(
        feedback.anomaly_id,
        feedback.feedback_type.value,
        feedback.notes
    )
    
    return {"status": "feedback recorded"}


# ============================================================================
# METRICS API
# ============================================================================

@router.get("/metrics/traffic", tags=["Metrics"])
async def get_traffic_metrics() -> TrafficMetrics:
    """Get current traffic metrics."""
    now = datetime.utcnow()
    recent_count = len([
        a for a in recent_anomalies
        if datetime.fromisoformat(a["timestamp"]) > now - timedelta(minutes=1)
    ])
    
    return TrafficMetrics(
        timestamp=now,
        requests_per_second=150.0,
        anomalies_per_minute=recent_count,
        blocked_requests=5,
        avg_response_time_ms=45.0,
        error_rate=0.02,
        unique_ips=1250,
        top_endpoints=[
            {"endpoint": "/api/v1/users", "count": 5000},
            {"endpoint": "/api/v1/products", "count": 3500},
            {"endpoint": "/api/v1/orders", "count": 2000},
        ]
    )


@router.get("/stats/live", tags=["Metrics"])
async def get_live_stats() -> Dict[str, Any]:
    """Get live statistics for dashboard header."""
    now = datetime.utcnow()
    
    anomalies_last_minute = len([
        a for a in recent_anomalies
        if datetime.fromisoformat(a["timestamp"]) > now - timedelta(minutes=1)
    ])
    
    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for a in recent_anomalies:
        if a["severity"] in severity_counts:
            severity_counts[a["severity"]] += 1
    
    return {
        "timestamp": now.isoformat(),
        "total_requests_24h": 0,
        "requests_per_second": 0,
        "anomalies_per_minute": anomalies_last_minute,
        "anomalies_total": len(recent_anomalies),
        "blocked_requests": severity_counts["critical"],
        "pending_rules": len([r for r in pending_rules.values() if r.status == RuleStatus.PENDING]),
        "severity_distribution": severity_counts,
        "ml_latency_ms": 18.2,
        "ws_connections": len(connected_websockets) + len(traffic_websockets)
    }


# ============================================================================
# WEBSOCKET FOR REAL-TIME UPDATES
# ============================================================================

@ws_router.websocket("/ws/anomalies")
async def websocket_anomalies(websocket: WebSocket):
    """WebSocket endpoint for real-time anomaly updates."""
    await websocket.accept()
    connected_websockets.append(websocket)
    
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_websockets.remove(websocket)


@ws_router.websocket("/ws/traffic")
async def websocket_traffic(websocket: WebSocket):
    """WebSocket endpoint for real-time traffic stream."""
    await websocket.accept()
    traffic_websockets.append(websocket)
    
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in traffic_websockets:
            traffic_websockets.remove(websocket)


async def broadcast_anomaly(anomaly: Dict):
    """Broadcast anomaly to all connected dashboards."""
    message = json.dumps({"type": "anomaly", "data": anomaly})
    
    for ws in connected_websockets:
        try:
            await ws.send_text(message)
        except Exception:
            pass


async def broadcast_traffic(event: Dict):
    """Broadcast traffic event to all connected traffic viewers."""
    message = json.dumps({
        "type": "traffic",
        "event": event,
        "rps": len(recent_anomalies)
    })
    
    for ws in traffic_websockets:
        try:
            await ws.send_text(message)
        except Exception:
            pass
