"""
WAF Rule Recommendation Engine for VARDAx.

Converts ML anomaly insights into deployable ModSecurity-compatible rules.
All rules require human approval before activation.

DESIGN PRINCIPLES:
- Human-readable rules with clear intent
- Confidence scoring for prioritization
- Safe defaults (monitor before block)
- Version control and rollback capability
"""
import re
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class RuleAction(str, Enum):
    """ModSecurity rule actions."""
    BLOCK = "deny"
    LOG = "log"
    RATE_LIMIT = "drop"
    REDIRECT = "redirect"


class RulePhase(int, Enum):
    """ModSecurity processing phases."""
    REQUEST_HEADERS = 1
    REQUEST_BODY = 2
    RESPONSE_HEADERS = 3
    RESPONSE_BODY = 4
    LOGGING = 5


@dataclass
class GeneratedRule:
    """A generated ModSecurity rule with metadata."""
    rule_id: str
    modsec_id: int  # ModSecurity rule ID (100000+)
    rule_content: str
    description: str
    confidence: float
    false_positive_estimate: float
    source_anomalies: List[str]
    created_at: datetime
    rule_type: str
    severity: str
    
    def to_modsec_format(self) -> str:
        """Format as ModSecurity rule file content."""
        return f"""# VARDAx Generated Rule
# Rule ID: {self.rule_id}
# Description: {self.description}
# Confidence: {self.confidence:.0%}
# Generated: {self.created_at.isoformat()}
# Source Anomalies: {len(self.source_anomalies)}

{self.rule_content}
"""


class RuleGenerator:
    """
    Generates ModSecurity-compatible rules from ML anomaly insights.
    
    RULE GENERATION STRATEGY:
    1. Cluster similar anomalies
    2. Extract common patterns
    3. Generate targeted rules
    4. Score confidence based on anomaly count and consistency
    5. Estimate false positive rate
    """
    
    # Base ID for generated rules (ModSecurity convention)
    BASE_RULE_ID = 9900000
    
    def __init__(self):
        self.rule_counter = 0
        self.generated_rules: Dict[str, GeneratedRule] = {}
    
    def generate_from_anomalies(
        self,
        anomalies: List[Dict[str, Any]]
    ) -> List[GeneratedRule]:
        """
        Generate rules from a batch of anomalies.
        
        Args:
            anomalies: List of anomaly results with explanations
            
        Returns:
            List of generated rules
        """
        if not anomalies:
            return []
        
        rules = []
        
        # Group anomalies by type
        ip_anomalies = [a for a in anomalies if self._is_ip_based(a)]
        rate_anomalies = [a for a in anomalies if self._is_rate_based(a)]
        pattern_anomalies = [a for a in anomalies if self._is_pattern_based(a)]
        ua_anomalies = [a for a in anomalies if self._is_ua_based(a)]
        
        # Generate IP-based rules
        if ip_anomalies:
            ip_rules = self._generate_ip_rules(ip_anomalies)
            rules.extend(ip_rules)
        
        # Generate rate-limiting rules
        if rate_anomalies:
            rate_rules = self._generate_rate_rules(rate_anomalies)
            rules.extend(rate_rules)
        
        # Generate pattern-based rules
        if pattern_anomalies:
            pattern_rules = self._generate_pattern_rules(pattern_anomalies)
            rules.extend(pattern_rules)
        
        # Generate user-agent rules
        if ua_anomalies:
            ua_rules = self._generate_ua_rules(ua_anomalies)
            rules.extend(ua_rules)
        
        return rules
    
    def _is_ip_based(self, anomaly: Dict) -> bool:
        """Check if anomaly is IP-specific."""
        explanations = anomaly.get('explanations', [])
        ip_features = ['requests_per_minute', 'session_request_count', 'auth_failure_rate']
        return any(
            e.get('feature_name') in ip_features and e.get('contribution', 0) > 0.5
            for e in explanations
        )
    
    def _is_rate_based(self, anomaly: Dict) -> bool:
        """Check if anomaly is rate-based."""
        explanations = anomaly.get('explanations', [])
        rate_features = ['requests_per_minute', 'requests_per_minute_zscore', 'rate_acceleration']
        return any(
            e.get('feature_name') in rate_features
            for e in explanations
        )
    
    def _is_pattern_based(self, anomaly: Dict) -> bool:
        """Check if anomaly is pattern-based."""
        explanations = anomaly.get('explanations', [])
        pattern_features = ['uri_entropy', 'query_entropy', 'body_entropy']
        return any(
            e.get('feature_name') in pattern_features
            for e in explanations
        )
    
    def _is_ua_based(self, anomaly: Dict) -> bool:
        """Check if anomaly is user-agent based."""
        explanations = anomaly.get('explanations', [])
        return any(
            e.get('feature_name') == 'user_agent_anomaly_score'
            for e in explanations
        )
    
    def _generate_ip_rules(self, anomalies: List[Dict]) -> List[GeneratedRule]:
        """Generate IP blocking/rate-limiting rules."""
        rules = []
        
        # Group by IP
        ip_counts: Dict[str, List[Dict]] = {}
        for a in anomalies:
            ip = a.get('client_ip', '')
            if ip:
                if ip not in ip_counts:
                    ip_counts[ip] = []
                ip_counts[ip].append(a)
        
        # Generate rules for IPs with multiple anomalies
        for ip, ip_anomalies in ip_counts.items():
            if len(ip_anomalies) < 3:
                continue  # Need multiple anomalies for confidence
            
            avg_confidence = sum(a.get('confidence', 0) for a in ip_anomalies) / len(ip_anomalies)
            
            rule = self._create_ip_block_rule(
                ip=ip,
                anomaly_count=len(ip_anomalies),
                confidence=avg_confidence,
                source_ids=[a.get('request_id', '') for a in ip_anomalies]
            )
            rules.append(rule)
        
        return rules
    
    def _generate_rate_rules(self, anomalies: List[Dict]) -> List[GeneratedRule]:
        """Generate rate-limiting rules."""
        rules = []
        
        # Group by endpoint
        endpoint_anomalies: Dict[str, List[Dict]] = {}
        for a in anomalies:
            uri = a.get('uri', '').split('?')[0]
            if uri:
                if uri not in endpoint_anomalies:
                    endpoint_anomalies[uri] = []
                endpoint_anomalies[uri].append(a)
        
        # Generate rate limit rules for hot endpoints
        for endpoint, ep_anomalies in endpoint_anomalies.items():
            if len(ep_anomalies) < 5:
                continue
            
            # Calculate recommended rate limit
            avg_rate = sum(
                a.get('features', {}).get('requests_per_minute', 100)
                for a in ep_anomalies
            ) / len(ep_anomalies)
            
            # Set limit at 50% of anomalous rate
            rate_limit = max(int(avg_rate * 0.5), 10)
            
            rule = self._create_rate_limit_rule(
                endpoint=endpoint,
                rate_limit=rate_limit,
                window_seconds=60,
                anomaly_count=len(ep_anomalies),
                source_ids=[a.get('request_id', '') for a in ep_anomalies]
            )
            rules.append(rule)
        
        return rules
    
    def _generate_pattern_rules(self, anomalies: List[Dict]) -> List[GeneratedRule]:
        """Generate pattern-matching rules for suspicious payloads."""
        rules = []
        
        # Look for common suspicious patterns
        high_entropy_anomalies = [
            a for a in anomalies
            if any(
                e.get('feature_name') in ['uri_entropy', 'query_entropy'] 
                and e.get('feature_value', 0) > 4.5
                for e in a.get('explanations', [])
            )
        ]
        
        if len(high_entropy_anomalies) >= 3:
            rule = self._create_entropy_detection_rule(
                anomaly_count=len(high_entropy_anomalies),
                source_ids=[a.get('request_id', '') for a in high_entropy_anomalies]
            )
            rules.append(rule)
        
        return rules
    
    def _generate_ua_rules(self, anomalies: List[Dict]) -> List[GeneratedRule]:
        """Generate user-agent blocking rules."""
        rules = []
        
        # This would extract common suspicious UA patterns
        # For demo, generate a generic scanner detection rule
        if len(anomalies) >= 3:
            rule = self._create_scanner_detection_rule(
                anomaly_count=len(anomalies),
                source_ids=[a.get('request_id', '') for a in anomalies]
            )
            rules.append(rule)
        
        return rules
    
    # ========================================================================
    # RULE CREATION METHODS
    # ========================================================================
    
    def _create_ip_block_rule(
        self,
        ip: str,
        anomaly_count: int,
        confidence: float,
        source_ids: List[str]
    ) -> GeneratedRule:
        """Create an IP blocking rule."""
        self.rule_counter += 1
        rule_id = f"vardax-ip-{hashlib.md5(ip.encode()).hexdigest()[:8]}"
        modsec_id = self.BASE_RULE_ID + self.rule_counter
        
        # Determine action based on confidence
        action = "deny,status:403" if confidence > 0.8 else "log,pass"
        
        rule_content = f'''SecRule REMOTE_ADDR "@ipMatch {ip}" \\
    "id:{modsec_id},\\
    phase:1,\\
    {action},\\
    msg:'VARDAx: Suspicious IP blocked - {anomaly_count} anomalies detected',\\
    tag:'vardax/ip-block',\\
    tag:'confidence/{confidence:.0%}',\\
    severity:'CRITICAL'"'''
        
        return GeneratedRule(
            rule_id=rule_id,
            modsec_id=modsec_id,
            rule_content=rule_content,
            description=f"Block IP {ip} - {anomaly_count} anomalies detected with {confidence:.0%} confidence",
            confidence=confidence,
            false_positive_estimate=0.05 if confidence > 0.8 else 0.15,
            source_anomalies=source_ids,
            created_at=datetime.utcnow(),
            rule_type="ip_block",
            severity="CRITICAL" if confidence > 0.8 else "WARNING"
        )
    
    def _create_rate_limit_rule(
        self,
        endpoint: str,
        rate_limit: int,
        window_seconds: int,
        anomaly_count: int,
        source_ids: List[str]
    ) -> GeneratedRule:
        """Create a rate-limiting rule."""
        self.rule_counter += 1
        rule_id = f"vardax-rate-{hashlib.md5(endpoint.encode()).hexdigest()[:8]}"
        modsec_id = self.BASE_RULE_ID + self.rule_counter
        
        # Escape endpoint for regex
        endpoint_pattern = re.escape(endpoint)
        
        rule_content = f'''# Rate limit rule for {endpoint}
SecRule REQUEST_URI "@rx ^{endpoint_pattern}" \\
    "id:{modsec_id},\\
    phase:1,\\
    pass,\\
    nolog,\\
    setvar:'ip.vardax_rate_counter=+1',\\
    expirevar:'ip.vardax_rate_counter={window_seconds}'"

SecRule IP:VARDAX_RATE_COUNTER "@gt {rate_limit}" \\
    "id:{modsec_id + 1},\\
    phase:1,\\
    deny,status:429,\\
    msg:'VARDAx: Rate limit exceeded for {endpoint}',\\
    tag:'vardax/rate-limit',\\
    severity:'WARNING'"'''
        
        confidence = min(0.5 + (anomaly_count * 0.05), 0.95)
        
        return GeneratedRule(
            rule_id=rule_id,
            modsec_id=modsec_id,
            rule_content=rule_content,
            description=f"Rate limit {endpoint} to {rate_limit} requests per {window_seconds}s",
            confidence=confidence,
            false_positive_estimate=0.1,
            source_anomalies=source_ids,
            created_at=datetime.utcnow(),
            rule_type="rate_limit",
            severity="WARNING"
        )
    
    def _create_entropy_detection_rule(
        self,
        anomaly_count: int,
        source_ids: List[str]
    ) -> GeneratedRule:
        """Create a rule to detect high-entropy (encoded/obfuscated) payloads."""
        self.rule_counter += 1
        rule_id = f"vardax-entropy-{self.rule_counter}"
        modsec_id = self.BASE_RULE_ID + self.rule_counter
        
        # Detect common encoding patterns
        rule_content = f'''# Detect heavily encoded/obfuscated requests
SecRule REQUEST_URI|ARGS|REQUEST_BODY "@rx (?:%[0-9a-fA-F]{{2}}){{10,}}" \\
    "id:{modsec_id},\\
    phase:2,\\
    log,pass,\\
    msg:'VARDAx: Suspicious encoding detected - possible evasion attempt',\\
    tag:'vardax/encoding',\\
    tag:'attack/evasion',\\
    severity:'WARNING'"'''
        
        confidence = min(0.6 + (anomaly_count * 0.03), 0.85)
        
        return GeneratedRule(
            rule_id=rule_id,
            modsec_id=modsec_id,
            rule_content=rule_content,
            description="Detect heavily encoded requests that may indicate evasion attempts",
            confidence=confidence,
            false_positive_estimate=0.2,
            source_anomalies=source_ids,
            created_at=datetime.utcnow(),
            rule_type="pattern_match",
            severity="WARNING"
        )
    
    def _create_scanner_detection_rule(
        self,
        anomaly_count: int,
        source_ids: List[str]
    ) -> GeneratedRule:
        """Create a rule to detect known scanner user agents."""
        self.rule_counter += 1
        rule_id = f"vardax-scanner-{self.rule_counter}"
        modsec_id = self.BASE_RULE_ID + self.rule_counter
        
        rule_content = f'''# Detect scanner/bot user agents
SecRule REQUEST_HEADERS:User-Agent "@rx (?i)(nikto|sqlmap|nmap|masscan|dirbuster|gobuster|wfuzz|burp|zap|acunetix|nessus|openvas)" \\
    "id:{modsec_id},\\
    phase:1,\\
    deny,status:403,\\
    msg:'VARDAx: Known scanner detected',\\
    tag:'vardax/scanner',\\
    tag:'automation/security-scanner',\\
    severity:'CRITICAL'"'''
        
        return GeneratedRule(
            rule_id=rule_id,
            modsec_id=modsec_id,
            rule_content=rule_content,
            description="Block requests from known security scanners",
            confidence=0.95,
            false_positive_estimate=0.01,
            source_anomalies=source_ids,
            created_at=datetime.utcnow(),
            rule_type="ua_block",
            severity="CRITICAL"
        )
    
    # ========================================================================
    # EXAMPLE RULES (for documentation/demo)
    # ========================================================================
    
    @staticmethod
    def get_example_rules() -> List[str]:
        """Return example rules for documentation."""
        return [
            '''# Example 1: Block specific malicious IP
SecRule REMOTE_ADDR "@ipMatch 192.168.1.100" \\
    "id:9900001,\\
    phase:1,\\
    deny,status:403,\\
    msg:'VARDAx: Blocked IP - 47 anomalies detected',\\
    tag:'vardax/ip-block',\\
    tag:'confidence/92%',\\
    severity:'CRITICAL'"''',
            
            '''# Example 2: Rate limit API endpoint
SecRule REQUEST_URI "@rx ^/api/v1/login" \\
    "id:9900002,\\
    phase:1,\\
    pass,nolog,\\
    setvar:'ip.login_counter=+1',\\
    expirevar:'ip.login_counter=60'"

SecRule IP:LOGIN_COUNTER "@gt 10" \\
    "id:9900003,\\
    phase:1,\\
    deny,status:429,\\
    msg:'VARDAx: Login rate limit exceeded',\\
    tag:'vardax/rate-limit',\\
    severity:'WARNING'"''',
            
            '''# Example 3: Detect SQL injection patterns
SecRule ARGS "@rx (?i)(?:union.*select|select.*from|insert.*into|delete.*from|drop.*table)" \\
    "id:9900004,\\
    phase:2,\\
    deny,status:403,\\
    msg:'VARDAx: SQL injection attempt detected',\\
    tag:'vardax/sqli',\\
    tag:'OWASP_CRS/INJECTION/SQL',\\
    severity:'CRITICAL'"''',
            
            '''# Example 4: Block suspicious file uploads
SecRule FILES_NAMES "@rx \\.(?:php|asp|aspx|jsp|exe|sh|bat)$" \\
    "id:9900005,\\
    phase:2,\\
    deny,status:403,\\
    msg:'VARDAx: Dangerous file upload blocked',\\
    tag:'vardax/file-upload',\\
    severity:'CRITICAL'"'''
        ]
