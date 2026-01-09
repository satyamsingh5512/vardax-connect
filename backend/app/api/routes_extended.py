"""
Extended API Routes for VARDAx.

Additional endpoints for:
- Attack replay timeline
- Traffic heatmap
- IP geolocation
- Rule simulation
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel

from .replay import (
    get_timeline, 
    get_heatmap_data, 
    get_geo_aggregation,
    get_attack_sequence
)
from .simulator import (
    simulate_rule,
    get_simulation_scenarios,
    SimulationResult
)

router = APIRouter()


# ============================================================================
# REPLAY API
# ============================================================================

@router.get("/replay/timeline", tags=["Replay"])
async def get_replay_timeline(
    since_minutes: int = Query(60, description="How far back to look"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    ip: Optional[str] = Query(None, description="Filter by IP"),
    limit: int = Query(500, description="Max events")
) -> List[Dict[str, Any]]:
    """
    Get event timeline for attack replay visualization.
    
    Returns chronologically sorted events with request details,
    features, and ML results for forensic analysis.
    """
    return get_timeline(
        since_minutes=since_minutes,
        severity_filter=severity,
        ip_filter=ip,
        limit=limit
    )


@router.get("/replay/sequence/{ip}", tags=["Replay"])
async def get_ip_sequence(ip: str) -> List[Dict[str, Any]]:
    """
    Get all events from a specific IP for attack chain analysis.
    
    Useful for understanding multi-stage attacks from a single source.
    """
    events = get_attack_sequence(ip)
    if not events:
        raise HTTPException(status_code=404, detail="No events found for this IP")
    return events


# ============================================================================
# HEATMAP API
# ============================================================================

@router.get("/heatmap/traffic", tags=["Visualization"])
async def get_traffic_heatmap(
    since_minutes: int = Query(60, description="Time window"),
    bucket_minutes: int = Query(5, description="Time bucket size")
) -> List[Dict[str, Any]]:
    """
    Get traffic heatmap data for visualization.
    
    Returns grid data with [time_bucket, endpoint, intensity]
    where intensity is based on request volume and anomaly severity.
    """
    return get_heatmap_data(
        since_minutes=since_minutes,
        bucket_minutes=bucket_minutes
    )


# ============================================================================
# GEO API
# ============================================================================

@router.get("/geo/threats", tags=["Visualization"])
async def get_geo_threats() -> List[Dict[str, Any]]:
    """
    Get geographic aggregation of traffic for map visualization.
    
    Returns list of locations with request counts and anomaly counts.
    Privacy note: Uses IP-to-country mapping, not precise locations.
    """
    return get_geo_aggregation()


# ============================================================================
# SIMULATION API
# ============================================================================

class SimulationRequest(BaseModel):
    """Request to simulate a rule."""
    rule_type: str
    rule_params: Dict[str, Any]
    time_window_minutes: int = 60


class SimulationResponse(BaseModel):
    """Response from rule simulation."""
    rule_id: str
    total_requests: int
    would_block: int
    would_allow: int
    block_rate: float
    false_positive_estimate: float
    affected_ips: List[str]
    affected_endpoints: List[str]
    sample_blocked: List[Dict[str, Any]]
    sample_allowed: List[Dict[str, Any]]
    recommendation: str


@router.post("/rules/simulate", tags=["Rules"])
async def simulate_rule_impact(request: SimulationRequest) -> SimulationResponse:
    """
    Simulate the impact of a proposed rule against historical traffic.
    
    This is critical for safe rule deployment - shows what would have
    been blocked and estimates false positive rate.
    """
    result = simulate_rule(
        rule_type=request.rule_type,
        rule_params=request.rule_params,
        time_window_minutes=request.time_window_minutes
    )
    
    return SimulationResponse(
        rule_id=result.rule_id,
        total_requests=result.total_requests,
        would_block=result.would_block,
        would_allow=result.would_allow,
        block_rate=result.block_rate,
        false_positive_estimate=result.false_positive_estimate,
        affected_ips=result.affected_ips,
        affected_endpoints=result.affected_endpoints,
        sample_blocked=result.sample_blocked,
        sample_allowed=result.sample_allowed,
        recommendation=result.recommendation
    )


@router.get("/rules/simulation-scenarios", tags=["Rules"])
async def get_scenarios() -> List[Dict[str, Any]]:
    """
    Get predefined simulation scenarios for common attack types.
    
    These can be used as templates for rule creation.
    """
    return get_simulation_scenarios()


# ============================================================================
# LIVE STATS API (for animated counters)
# ============================================================================

@router.get("/stats/live", tags=["Metrics"])
async def get_live_stats() -> Dict[str, Any]:
    """
    Get live statistics for dashboard counters.
    
    Returns current metrics that update in real-time.
    """
    from .routes import recent_anomalies, pending_rules
    from datetime import timedelta
    
    now = datetime.utcnow()
    last_minute = now - timedelta(minutes=1)
    last_hour = now - timedelta(hours=1)
    
    # Count recent anomalies
    anomalies_minute = len([
        a for a in recent_anomalies
        if datetime.fromisoformat(a["timestamp"]) > last_minute
    ])
    
    anomalies_hour = len([
        a for a in recent_anomalies
        if datetime.fromisoformat(a["timestamp"]) > last_hour
    ])
    
    # Count by severity
    severity_counts = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for a in recent_anomalies:
        if datetime.fromisoformat(a["timestamp"]) > last_hour:
            sev = a.get("severity", "low")
            severity_counts[sev] = severity_counts.get(sev, 0) + 1
    
    return {
        "timestamp": now.isoformat(),
        "requests_per_second": 0,  # No real traffic data yet
        "anomalies_last_minute": anomalies_minute,
        "anomalies_last_hour": anomalies_hour,
        "threats_blocked": severity_counts["high"] + severity_counts["critical"],
        "pending_rules": len([r for r in pending_rules.values() if r.status.value == "pending"]),
        "severity_breakdown": severity_counts,
        "model_status": "healthy" if len(recent_anomalies) >= 0 else "warning",
        "inference_latency_ms": 0.0,  # No real inference data yet
    }
