"""
Attack Replay System for VARDAx.

Stores all analyzed events for forensic replay and timeline visualization.
Enables "time-travel" debugging of attack sequences.
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import deque
import asyncio

# In-memory event store (would be TimescaleDB in production)
# Using deque for automatic size limiting
event_store: deque = deque(maxlen=10000)

# Indexed by session for sequence analysis
session_events: Dict[str, List[Dict]] = {}


def record_event(
    request_data: Dict[str, Any],
    features: Dict[str, Any],
    result: Dict[str, Any]
) -> str:
    """
    Record an analyzed event for replay.
    
    Args:
        request_data: Original request information
        features: Extracted features
        result: ML analysis result
        
    Returns:
        Event ID
    """
    event_id = f"evt-{datetime.utcnow().timestamp():.0f}-{len(event_store)}"
    
    event = {
        "event_id": event_id,
        "timestamp": datetime.utcnow().isoformat(),
        "request": {
            "client_ip": request_data.get("client_ip", "unknown"),
            "method": request_data.get("method", "GET"),
            "uri": request_data.get("uri", "/"),
            "user_agent": request_data.get("user_agent", ""),
        },
        "features": {
            "requests_per_minute": features.get("requests_per_minute", 0),
            "session_request_count": features.get("session_request_count", 0),
            "uri_entropy": features.get("uri_entropy", 0),
            "bot_likelihood_score": features.get("bot_likelihood_score", 0),
        },
        "result": {
            "is_anomaly": result.get("is_anomaly", False),
            "severity": result.get("severity", "low"),
            "confidence": result.get("confidence", 0),
            "attack_category": result.get("attack_category"),
            "top_explanation": result.get("explanations", [{}])[0].get("description", "") if result.get("explanations") else "",
        },
        "geo": None,  # Will be populated by GeoIP lookup
    }
    
    event_store.append(event)
    
    # Index by IP for session analysis
    ip = request_data.get("client_ip", "unknown")
    if ip not in session_events:
        session_events[ip] = []
    session_events[ip].append(event)
    
    # Keep session events bounded
    if len(session_events[ip]) > 500:
        session_events[ip] = session_events[ip][-500:]
    
    return event_id


def get_timeline(
    since_minutes: int = 60,
    severity_filter: Optional[str] = None,
    ip_filter: Optional[str] = None,
    limit: int = 500
) -> List[Dict[str, Any]]:
    """
    Get event timeline for replay.
    
    Args:
        since_minutes: How far back to look
        severity_filter: Filter by severity level
        ip_filter: Filter by client IP
        limit: Maximum events to return
        
    Returns:
        List of events sorted by timestamp
    """
    cutoff = datetime.utcnow() - timedelta(minutes=since_minutes)
    
    events = []
    for event in event_store:
        # Time filter
        event_time = datetime.fromisoformat(event["timestamp"])
        if event_time < cutoff:
            continue
        
        # Severity filter
        if severity_filter and event["result"]["severity"] != severity_filter:
            continue
        
        # IP filter
        if ip_filter and event["request"]["client_ip"] != ip_filter:
            continue
        
        events.append(event)
        
        if len(events) >= limit:
            break
    
    # Sort by timestamp
    events.sort(key=lambda x: x["timestamp"])
    
    return events


def get_attack_sequence(ip: str) -> List[Dict[str, Any]]:
    """Get all events from a specific IP for attack chain analysis."""
    return session_events.get(ip, [])


def get_heatmap_data(
    since_minutes: int = 60,
    bucket_minutes: int = 5
) -> List[Dict[str, Any]]:
    """
    Generate heatmap data for traffic visualization.
    
    Returns grid of [time_bucket, endpoint, intensity]
    """
    cutoff = datetime.utcnow() - timedelta(minutes=since_minutes)
    
    # Aggregate by time bucket and endpoint
    buckets: Dict[str, Dict[str, int]] = {}
    
    for event in event_store:
        event_time = datetime.fromisoformat(event["timestamp"])
        if event_time < cutoff:
            continue
        
        # Create time bucket
        bucket_start = event_time.replace(
            minute=(event_time.minute // bucket_minutes) * bucket_minutes,
            second=0,
            microsecond=0
        )
        bucket_key = bucket_start.strftime("%H:%M")
        
        # Get endpoint (simplified)
        endpoint = event["request"]["uri"].split("?")[0]
        if len(endpoint) > 20:
            endpoint = endpoint[:20] + "..."
        
        if bucket_key not in buckets:
            buckets[bucket_key] = {}
        
        if endpoint not in buckets[bucket_key]:
            buckets[bucket_key][endpoint] = 0
        
        # Intensity based on anomaly
        intensity = 1
        if event["result"]["is_anomaly"]:
            intensity = 5 if event["result"]["severity"] in ["high", "critical"] else 3
        
        buckets[bucket_key][endpoint] += intensity
    
    # Convert to heatmap format
    heatmap = []
    for time_bucket, endpoints in buckets.items():
        for endpoint, count in endpoints.items():
            # Normalize intensity to 0-1
            intensity = min(count / 50, 1.0)
            heatmap.append({
                "time": time_bucket,
                "endpoint": endpoint,
                "count": count,
                "intensity": intensity,
            })
    
    return heatmap


def clear_replay_data():
    """Clear all replay data (events and session data)."""
    global event_store, session_events
    event_store.clear()
    session_events.clear()


def get_geo_aggregation() -> List[Dict[str, Any]]:
    """
    Aggregate events by geographic location for map visualization.
    
    Returns list of {lat, lng, count, anomaly_count, country}
    """
    # In production, this would use GeoIP database
    # For demo, return mock data based on IP patterns
    
    geo_data = {}
    
    for event in list(event_store)[-1000:]:  # Last 1000 events
        ip = event["request"]["client_ip"]
        
        # Mock geo lookup based on IP octets
        # In production: use GeoLite2 database
        octets = ip.split(".")
        if len(octets) == 4:
            # Generate pseudo-random but consistent location from IP
            lat = (int(octets[0]) - 128) * 0.7
            lng = (int(octets[1]) - 128) * 1.4
            country = f"Country-{octets[0][:2]}"
        else:
            lat, lng, country = 0, 0, "Unknown"
        
        geo_key = f"{lat:.1f},{lng:.1f}"
        
        if geo_key not in geo_data:
            geo_data[geo_key] = {
                "lat": lat,
                "lng": lng,
                "country": country,
                "count": 0,
                "anomaly_count": 0,
                "ips": set(),
            }
        
        geo_data[geo_key]["count"] += 1
        geo_data[geo_key]["ips"].add(ip)
        
        if event["result"]["is_anomaly"]:
            geo_data[geo_key]["anomaly_count"] += 1
    
    # Convert to list and remove sets
    result = []
    for data in geo_data.values():
        result.append({
            "lat": data["lat"],
            "lng": data["lng"],
            "country": data["country"],
            "count": data["count"],
            "anomaly_count": data["anomaly_count"],
            "unique_ips": len(data["ips"]),
        })
    
    return result
