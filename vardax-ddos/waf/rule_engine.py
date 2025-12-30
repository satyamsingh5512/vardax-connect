#!/usr/bin/env python3
"""
vardax-ddos/waf/rule_engine.py
VardaX WAF - Rule Engine

OWASP-compatible rule engine with custom rule support.
Supports regex matching, rate limiting, and emergency blocklists.
"""

import re
import time
import json
import hashlib
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import yaml

import redis


class RuleAction(Enum):
    ALLOW = "allow"
    BLOCK = "block"
    CHALLENGE = "challenge"
    LOG = "log"
    THROTTLE = "throttle"


class RulePhase(Enum):
    REQUEST_HEADERS = 1
    REQUEST_BODY = 2
    RESPONSE_HEADERS = 3
    RESPONSE_BODY = 4
    LOGGING = 5


@dataclass
class WAFRule:
    """WAF rule definition"""
    id: str
    name: str
    description: str = ""
    phase: RulePhase = RulePhase.REQUEST_HEADERS
    action: RuleAction = RuleAction.BLOCK
    severity: int = 5  # 1-10, 10 being most severe
    enabled: bool = True
    
    # Matching conditions
    variables: List[str] = field(default_factory=list)  # REQUEST_URI, REQUEST_HEADERS, etc.
    operator: str = "rx"  # rx (regex), eq, contains, gt, lt
    pattern: str = ""
    
    # Optional transformations
    transformations: List[str] = field(default_factory=list)  # lowercase, urldecode, etc.
    
    # Rate limiting (optional)
    rate_limit: Optional[Dict] = None  # {"requests": 100, "window": 60}
    
    # Tags for categorization
    tags: List[str] = field(default_factory=list)
    
    # Compiled regex (cached)
    _compiled_pattern: Optional[re.Pattern] = field(default=None, repr=False)
    
    def compile(self):
        """Compile regex pattern"""
        if self.operator == "rx" and self.pattern:
            try:
                self._compiled_pattern = re.compile(self.pattern, re.IGNORECASE)
            except re.error as e:
                print(f"Invalid regex in rule {self.id}: {e}")
                self._compiled_pattern = None


@dataclass
class WAFRequest:
    """Request context for WAF inspection"""
    ip: str
    method: str
    uri: str
    path: str
    query_string: str
    headers: Dict[str, str]
    body: bytes = b""
    cookies: Dict[str, str] = field(default_factory=dict)
    
    # Computed fields
    request_line: str = ""
    
    def __post_init__(self):
        self.request_line = f"{self.method} {self.uri}"


@dataclass
class WAFResult:
    """WAF inspection result"""
    allowed: bool
    action: RuleAction
    matched_rules: List[str]
    score: int = 0
    details: Dict[str, Any] = field(default_factory=dict)


class WAFRuleEngine:
    """
    WAF Rule Engine
    
    Features:
    - OWASP CRS compatible rule format
    - Custom rule support
    - Emergency blocklist
    - Per-route policies
    - Rate limiting integration
    """
    
    # OWASP CRS-like rule categories
    RULE_CATEGORIES = {
        "sql-injection": "SQL Injection",
        "xss": "Cross-Site Scripting",
        "rce": "Remote Code Execution",
        "lfi": "Local File Inclusion",
        "rfi": "Remote File Inclusion",
        "protocol": "Protocol Violations",
        "scanner": "Scanner Detection",
        "dos": "Denial of Service",
    }
    
    def __init__(
        self,
        rules_path: Optional[str] = None,
        redis_client: Optional[redis.Redis] = None,
        paranoia_level: int = 1,
    ):
        self.rules: Dict[str, WAFRule] = {}
        self.rules_by_phase: Dict[RulePhase, List[WAFRule]] = {
            phase: [] for phase in RulePhase
        }
        self.emergency_blocklist: Set[str] = set()
        self.redis = redis_client
        self.paranoia_level = paranoia_level
        
        # Load default rules
        self._load_default_rules()
        
        # Load custom rules
        if rules_path:
            self.load_rules(rules_path)
    
    def _load_default_rules(self):
        """Load default OWASP-like rules"""
        default_rules = [
            # SQL Injection
            WAFRule(
                id="941100",
                name="SQL Injection Attack Detected via libinjection",
                phase=RulePhase.REQUEST_HEADERS,
                action=RuleAction.BLOCK,
                severity=9,
                variables=["REQUEST_URI", "REQUEST_BODY", "REQUEST_HEADERS:Cookie"],
                operator="rx",
                pattern=r"(?i)(\b(select|insert|update|delete|drop|union|exec|execute)\b.*\b(from|into|where|table|database)\b)",
                tags=["sql-injection", "owasp-crs"],
            ),
            WAFRule(
                id="941110",
                name="SQL Injection Attack - Common Injection Testing",
                phase=RulePhase.REQUEST_HEADERS,
                action=RuleAction.BLOCK,
                severity=9,
                variables=["REQUEST_URI", "ARGS"],
                operator="rx",
                pattern=r"(?i)(\'|\"|;|--|\#|\/\*|\*\/|@@|@|char\(|nchar\(|varchar\(|nvarchar\(|cast\(|convert\()",
                tags=["sql-injection", "owasp-crs"],
            ),
            
            # XSS
            WAFRule(
                id="941160",
                name="XSS Attack Detected via libinjection",
                phase=RulePhase.REQUEST_HEADERS,
                action=RuleAction.BLOCK,
                severity=9,
                variables=["REQUEST_URI", "REQUEST_BODY", "ARGS"],
                operator="rx",
                pattern=r"(?i)(<script[^>]*>|javascript:|on\w+\s*=|<\s*img[^>]+onerror)",
                tags=["xss", "owasp-crs"],
            ),
            WAFRule(
                id="941170",
                name="XSS Filter - Category 1: Script Tag Vector",
                phase=RulePhase.REQUEST_HEADERS,
                action=RuleAction.BLOCK,
                severity=9,
                variables=["REQUEST_URI", "ARGS"],
                operator="rx",
                pattern=r"(?i)<script[\s\S]*?>[\s\S]*?<\/script>",
                tags=["xss", "owasp-crs"],
            ),
            
            # Remote Code Execution
            WAFRule(
                id="932100",
                name="Remote Command Execution: Unix Command Injection",
                phase=RulePhase.REQUEST_HEADERS,
                action=RuleAction.BLOCK,
                severity=10,
                variables=["REQUEST_URI", "ARGS", "REQUEST_BODY"],
                operator="rx",
                pattern=r"(?i)(;|\||`|\$\(|&&|\|\|)\s*(cat|ls|id|whoami|pwd|uname|wget|curl|nc|bash|sh|python|perl|ruby|php)",
                tags=["rce", "owasp-crs"],
            ),
            
            # Local File Inclusion
            WAFRule(
                id="930100",
                name="Path Traversal Attack (/../)",
                phase=RulePhase.REQUEST_HEADERS,
                action=RuleAction.BLOCK,
                severity=8,
                variables=["REQUEST_URI", "ARGS"],
                operator="rx",
                pattern=r"(?i)(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f|%2e%2e%5c)",
                tags=["lfi", "owasp-crs"],
            ),
            WAFRule(
                id="930110",
                name="Path Traversal Attack - /etc/passwd",
                phase=RulePhase.REQUEST_HEADERS,
                action=RuleAction.BLOCK,
                severity=9,
                variables=["REQUEST_URI", "ARGS"],
                operator="rx",
                pattern=r"(?i)(\/etc\/passwd|\/etc\/shadow|\/etc\/hosts|\/proc\/self)",
                tags=["lfi", "owasp-crs"],
            ),
            
            # Protocol Violations
            WAFRule(
                id="920170",
                name="GET or HEAD Request with Body Content",
                phase=RulePhase.REQUEST_HEADERS,
                action=RuleAction.BLOCK,
                severity=5,
                variables=["REQUEST_METHOD"],
                operator="rx",
                pattern=r"^(GET|HEAD)$",
                tags=["protocol", "owasp-crs"],
            ),
            
            # Scanner Detection
            WAFRule(
                id="913100",
                name="Found User-Agent associated with security scanner",
                phase=RulePhase.REQUEST_HEADERS,
                action=RuleAction.BLOCK,
                severity=7,
                variables=["REQUEST_HEADERS:User-Agent"],
                operator="rx",
                pattern=r"(?i)(nikto|sqlmap|nmap|masscan|dirbuster|gobuster|wfuzz|burp|zap|acunetix|nessus|openvas)",
                tags=["scanner", "owasp-crs"],
            ),
            
            # DoS Protection
            WAFRule(
                id="912100",
                name="Request Rate Limit Exceeded",
                phase=RulePhase.REQUEST_HEADERS,
                action=RuleAction.THROTTLE,
                severity=6,
                variables=["REMOTE_ADDR"],
                operator="rate",
                pattern="",
                rate_limit={"requests": 100, "window": 60},
                tags=["dos", "rate-limit"],
            ),
            
            # Log4j/Log4Shell
            WAFRule(
                id="944100",
                name="Log4j/Log4Shell Attack Detected",
                phase=RulePhase.REQUEST_HEADERS,
                action=RuleAction.BLOCK,
                severity=10,
                variables=["REQUEST_URI", "REQUEST_HEADERS", "REQUEST_BODY"],
                operator="rx",
                pattern=r"(?i)\$\{(jndi|lower|upper|env|sys|java|date):",
                tags=["rce", "log4j", "cve-2021-44228"],
            ),
        ]
        
        for rule in default_rules:
            self.add_rule(rule)
    
    def load_rules(self, path: str):
        """Load rules from YAML file"""
        rules_path = Path(path)
        if not rules_path.exists():
            print(f"Rules file not found: {path}")
            return
        
        with open(rules_path) as f:
            rules_data = yaml.safe_load(f)
        
        for rule_data in rules_data.get("rules", []):
            rule = WAFRule(
                id=rule_data["id"],
                name=rule_data["name"],
                description=rule_data.get("description", ""),
                phase=RulePhase(rule_data.get("phase", 1)),
                action=RuleAction(rule_data.get("action", "block")),
                severity=rule_data.get("severity", 5),
                enabled=rule_data.get("enabled", True),
                variables=rule_data.get("variables", []),
                operator=rule_data.get("operator", "rx"),
                pattern=rule_data.get("pattern", ""),
                transformations=rule_data.get("transformations", []),
                rate_limit=rule_data.get("rate_limit"),
                tags=rule_data.get("tags", []),
            )
            self.add_rule(rule)
        
        print(f"Loaded {len(rules_data.get('rules', []))} rules from {path}")
    
    def add_rule(self, rule: WAFRule):
        """Add a rule to the engine"""
        rule.compile()
        self.rules[rule.id] = rule
        self.rules_by_phase[rule.phase].append(rule)
    
    def remove_rule(self, rule_id: str):
        """Remove a rule from the engine"""
        if rule_id in self.rules:
            rule = self.rules[rule_id]
            self.rules_by_phase[rule.phase].remove(rule)
            del self.rules[rule_id]
    
    def inspect(self, request: WAFRequest) -> WAFResult:
        """Inspect request against all rules"""
        matched_rules = []
        total_score = 0
        final_action = RuleAction.ALLOW
        details = {}
        
        # Check emergency blocklist first
        if request.ip in self.emergency_blocklist:
            return WAFResult(
                allowed=False,
                action=RuleAction.BLOCK,
                matched_rules=["emergency_blocklist"],
                score=100,
                details={"reason": "IP in emergency blocklist"},
            )
        
        # Check Redis blocklist
        if self.redis:
            blocked = self.redis.sismember("vardax:waf:blocklist", request.ip)
            if blocked:
                return WAFResult(
                    allowed=False,
                    action=RuleAction.BLOCK,
                    matched_rules=["redis_blocklist"],
                    score=100,
                    details={"reason": "IP in blocklist"},
                )
        
        # Process rules by phase
        for phase in [RulePhase.REQUEST_HEADERS, RulePhase.REQUEST_BODY]:
            for rule in self.rules_by_phase[phase]:
                if not rule.enabled:
                    continue
                
                # Check paranoia level
                if rule.severity < (10 - self.paranoia_level * 2):
                    continue
                
                matched, match_details = self._check_rule(rule, request)
                
                if matched:
                    matched_rules.append(rule.id)
                    total_score += rule.severity
                    details[rule.id] = {
                        "name": rule.name,
                        "severity": rule.severity,
                        "action": rule.action.value,
                        "match": match_details,
                    }
                    
                    # Determine final action (most severe wins)
                    if rule.action == RuleAction.BLOCK:
                        final_action = RuleAction.BLOCK
                    elif rule.action == RuleAction.CHALLENGE and final_action != RuleAction.BLOCK:
                        final_action = RuleAction.CHALLENGE
                    elif rule.action == RuleAction.THROTTLE and final_action == RuleAction.ALLOW:
                        final_action = RuleAction.THROTTLE
        
        allowed = final_action == RuleAction.ALLOW or final_action == RuleAction.LOG
        
        return WAFResult(
            allowed=allowed,
            action=final_action,
            matched_rules=matched_rules,
            score=total_score,
            details=details,
        )
    
    def _check_rule(self, rule: WAFRule, request: WAFRequest) -> Tuple[bool, Dict]:
        """Check if a rule matches the request"""
        for variable in rule.variables:
            value = self._get_variable(variable, request)
            if value is None:
                continue
            
            # Apply transformations
            for transform in rule.transformations:
                value = self._apply_transformation(transform, value)
            
            # Check operator
            matched, match_info = self._check_operator(rule, value)
            if matched:
                return True, {"variable": variable, "value": value[:100], **match_info}
        
        return False, {}
    
    def _get_variable(self, variable: str, request: WAFRequest) -> Optional[str]:
        """Get variable value from request"""
        if variable == "REQUEST_URI":
            return request.uri
        elif variable == "REQUEST_METHOD":
            return request.method
        elif variable == "REQUEST_BODY":
            return request.body.decode('utf-8', errors='ignore') if request.body else None
        elif variable == "ARGS":
            return request.query_string
        elif variable == "REMOTE_ADDR":
            return request.ip
        elif variable.startswith("REQUEST_HEADERS:"):
            header_name = variable.split(":", 1)[1].lower()
            return request.headers.get(header_name)
        elif variable == "REQUEST_HEADERS":
            return json.dumps(request.headers)
        elif variable.startswith("REQUEST_COOKIES:"):
            cookie_name = variable.split(":", 1)[1]
            return request.cookies.get(cookie_name)
        
        return None
    
    def _apply_transformation(self, transform: str, value: str) -> str:
        """Apply transformation to value"""
        if transform == "lowercase":
            return value.lower()
        elif transform == "uppercase":
            return value.upper()
        elif transform == "urldecode":
            from urllib.parse import unquote
            return unquote(value)
        elif transform == "htmldecode":
            import html
            return html.unescape(value)
        elif transform == "base64decode":
            import base64
            try:
                return base64.b64decode(value).decode('utf-8', errors='ignore')
            except:
                return value
        elif transform == "removewhitespace":
            return re.sub(r'\s+', '', value)
        
        return value
    
    def _check_operator(self, rule: WAFRule, value: str) -> Tuple[bool, Dict]:
        """Check if value matches rule operator"""
        if rule.operator == "rx":
            if rule._compiled_pattern:
                match = rule._compiled_pattern.search(value)
                if match:
                    return True, {"matched": match.group(0)}
        elif rule.operator == "eq":
            if value == rule.pattern:
                return True, {"matched": value}
        elif rule.operator == "contains":
            if rule.pattern.lower() in value.lower():
                return True, {"matched": rule.pattern}
        elif rule.operator == "rate":
            # Rate limiting handled separately
            pass
        
        return False, {}
    
    def add_to_blocklist(self, ip: str, duration: int = 3600, reason: str = ""):
        """Add IP to blocklist"""
        self.emergency_blocklist.add(ip)
        
        if self.redis:
            self.redis.sadd("vardax:waf:blocklist", ip)
            if duration > 0:
                self.redis.expire(f"vardax:waf:blocklist:{ip}", duration)
            
            # Log the block
            self.redis.lpush("vardax:waf:blocks", json.dumps({
                "ip": ip,
                "reason": reason,
                "timestamp": time.time(),
                "duration": duration,
            }))
    
    def remove_from_blocklist(self, ip: str):
        """Remove IP from blocklist"""
        self.emergency_blocklist.discard(ip)
        
        if self.redis:
            self.redis.srem("vardax:waf:blocklist", ip)
    
    def get_stats(self) -> Dict:
        """Get WAF statistics"""
        return {
            "total_rules": len(self.rules),
            "rules_by_category": {
                cat: len([r for r in self.rules.values() if cat in r.tags])
                for cat in self.RULE_CATEGORIES
            },
            "blocklist_size": len(self.emergency_blocklist),
            "paranoia_level": self.paranoia_level,
        }


# Sample rules YAML format
SAMPLE_RULES_YAML = """
# vardax-ddos/waf/rules.yaml
# Custom WAF rules for VardaX

rules:
  - id: "custom-001"
    name: "Block known bad bot"
    description: "Block requests from known malicious bot"
    phase: 1
    action: block
    severity: 10
    enabled: true
    variables:
      - REQUEST_HEADERS:User-Agent
    operator: rx
    pattern: "BadBot|EvilCrawler|MaliciousSpider"
    tags:
      - custom
      - bot

  - id: "custom-002"
    name: "Rate limit login endpoint"
    description: "Limit login attempts to prevent brute force"
    phase: 1
    action: throttle
    severity: 6
    enabled: true
    variables:
      - REQUEST_URI
    operator: contains
    pattern: "/api/login"
    rate_limit:
      requests: 10
      window: 60
    tags:
      - custom
      - rate-limit
      - auth

  - id: "custom-003"
    name: "Block sensitive file access"
    description: "Block access to sensitive configuration files"
    phase: 1
    action: block
    severity: 9
    enabled: true
    variables:
      - REQUEST_URI
    operator: rx
    pattern: "\\.(env|git|svn|htaccess|htpasswd|config|ini|yml|yaml|json|xml|sql|bak|backup|old|orig|swp)$"
    tags:
      - custom
      - sensitive-files
"""


if __name__ == "__main__":
    # Test the WAF engine
    engine = WAFRuleEngine()
    
    # Test SQL injection
    request = WAFRequest(
        ip="192.168.1.100",
        method="GET",
        uri="/search?q=1' OR '1'='1",
        path="/search",
        query_string="q=1' OR '1'='1",
        headers={"user-agent": "Mozilla/5.0"},
    )
    
    result = engine.inspect(request)
    print(f"SQL Injection Test: allowed={result.allowed}, rules={result.matched_rules}")
    
    # Test XSS
    request = WAFRequest(
        ip="192.168.1.100",
        method="GET",
        uri="/comment?text=<script>alert('xss')</script>",
        path="/comment",
        query_string="text=<script>alert('xss')</script>",
        headers={"user-agent": "Mozilla/5.0"},
    )
    
    result = engine.inspect(request)
    print(f"XSS Test: allowed={result.allowed}, rules={result.matched_rules}")
    
    # Test normal request
    request = WAFRequest(
        ip="192.168.1.100",
        method="GET",
        uri="/api/users",
        path="/api/users",
        query_string="",
        headers={"user-agent": "Mozilla/5.0"},
    )
    
    result = engine.inspect(request)
    print(f"Normal Request Test: allowed={result.allowed}, rules={result.matched_rules}")
    
    print(f"\nWAF Stats: {engine.get_stats()}")
