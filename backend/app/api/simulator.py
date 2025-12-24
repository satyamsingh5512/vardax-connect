"""
Rule Simulation Engine for VARDAx.

Simulates the impact of proposed WAF rules against historical traffic
before deployment. This is critical for safe rule deployment.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import re
from dataclasses import dataclass

from .replay import event_store


@dataclass
class SimulationResult:
    """Result of rule simulation."""
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


def simulate_rule(
    rule_type: str,
    rule_params: Dict[str, Any],
    time_window_minutes: int = 60
) -> SimulationResult:
    """
    Simulate a rule against historical traffic.
    
    Args:
        rule_type: Type of rule (ip_block, rate_limit, pattern_match, etc.)
        rule_params: Rule parameters
        time_window_minutes: How far back to simulate
        
    Returns:
        SimulationResult with impact analysis
    """
    cutoff = datetime.utcnow() - timedelta(minutes=time_window_minutes)
    
    # Get relevant events
    events = [
        e for e in event_store
        if datetime.fromisoformat(e["timestamp"]) > cutoff
    ]
    
    if not events:
        return SimulationResult(
            rule_id=rule_params.get("rule_id", "unknown"),
            total_requests=0,
            would_block=0,
            would_allow=0,
            block_rate=0,
            false_positive_estimate=0,
            affected_ips=[],
            affected_endpoints=[],
            sample_blocked=[],
            sample_allowed=[],
            recommendation="Insufficient data for simulation"
        )
    
    # Apply rule logic
    blocked = []
    allowed = []
    affected_ips = set()
    affected_endpoints = set()
    
    for event in events:
        would_block = _evaluate_rule(rule_type, rule_params, event)
        
        if would_block:
            blocked.append(event)
            affected_ips.add(event["request"]["client_ip"])
            affected_endpoints.add(event["request"]["uri"].split("?")[0])
        else:
            allowed.append(event)
    
    # Calculate metrics
    total = len(events)
    block_count = len(blocked)
    block_rate = block_count / total if total > 0 else 0
    
    # Estimate false positives
    # If blocking non-anomalous traffic, that's likely a false positive
    false_positives = sum(
        1 for e in blocked
        if not e["result"]["is_anomaly"]
    )
    fp_rate = false_positives / block_count if block_count > 0 else 0
    
    # Generate recommendation
    if block_rate > 0.5:
        recommendation = "⚠️ HIGH IMPACT: This rule would block >50% of traffic. Review carefully."
    elif fp_rate > 0.2:
        recommendation = "⚠️ HIGH FALSE POSITIVES: Estimated >20% false positive rate. Consider narrowing rule."
    elif block_rate < 0.01:
        recommendation = "✅ LOW IMPACT: Rule is very targeted. Safe to deploy."
    else:
        recommendation = "✅ MODERATE IMPACT: Review sample blocked requests before deploying."
    
    return SimulationResult(
        rule_id=rule_params.get("rule_id", "unknown"),
        total_requests=total,
        would_block=block_count,
        would_allow=len(allowed),
        block_rate=block_rate,
        false_positive_estimate=fp_rate,
        affected_ips=list(affected_ips)[:10],
        affected_endpoints=list(affected_endpoints)[:10],
        sample_blocked=blocked[:5],
        sample_allowed=allowed[:5],
        recommendation=recommendation
    )


def _evaluate_rule(
    rule_type: str,
    params: Dict[str, Any],
    event: Dict[str, Any]
) -> bool:
    """
    Evaluate if a rule would block an event.
    
    Returns True if the rule would block this request.
    """
    request = event["request"]
    features = event["features"]
    
    if rule_type == "ip_block":
        # Block specific IP
        target_ip = params.get("ip", "")
        return request["client_ip"] == target_ip
    
    elif rule_type == "ip_range_block":
        # Block IP range (simplified)
        target_prefix = params.get("ip_prefix", "")
        return request["client_ip"].startswith(target_prefix)
    
    elif rule_type == "rate_limit":
        # Block if rate exceeds threshold
        threshold = params.get("threshold", 100)
        return features.get("requests_per_minute", 0) > threshold
    
    elif rule_type == "endpoint_block":
        # Block specific endpoint
        target_endpoint = params.get("endpoint", "")
        return target_endpoint in request["uri"]
    
    elif rule_type == "pattern_match":
        # Block if URI matches pattern
        pattern = params.get("pattern", "")
        try:
            return bool(re.search(pattern, request["uri"]))
        except re.error:
            return False
    
    elif rule_type == "bot_block":
        # Block high bot likelihood
        threshold = params.get("threshold", 0.7)
        return features.get("bot_likelihood_score", 0) > threshold
    
    elif rule_type == "ua_block":
        # Block specific user agent pattern
        pattern = params.get("pattern", "")
        ua = request.get("user_agent", "")
        return pattern.lower() in ua.lower()
    
    elif rule_type == "composite":
        # Multiple conditions (AND logic)
        conditions = params.get("conditions", [])
        return all(
            _evaluate_rule(c["type"], c["params"], event)
            for c in conditions
        )
    
    return False


def get_simulation_scenarios() -> List[Dict[str, Any]]:
    """
    Get predefined simulation scenarios for common attack types.
    """
    return [
        {
            "name": "Block High-Rate IPs",
            "description": "Block IPs exceeding 200 requests/minute",
            "rule_type": "rate_limit",
            "params": {"threshold": 200}
        },
        {
            "name": "Block Bot Traffic",
            "description": "Block requests with bot likelihood > 70%",
            "rule_type": "bot_block",
            "params": {"threshold": 0.7}
        },
        {
            "name": "Block Scanner User Agents",
            "description": "Block known security scanner user agents",
            "rule_type": "ua_block",
            "params": {"pattern": "sqlmap|nikto|nmap"}
        },
        {
            "name": "Block Login Abuse",
            "description": "Rate limit login endpoint",
            "rule_type": "composite",
            "params": {
                "conditions": [
                    {"type": "endpoint_block", "params": {"endpoint": "/login"}},
                    {"type": "rate_limit", "params": {"threshold": 10}}
                ]
            }
        }
    ]
