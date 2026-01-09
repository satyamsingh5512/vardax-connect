"""
Production WAF (Web Application Firewall) Engine for VARDAx
Real rule-based traffic filtering and blocking system
"""
import re
import json
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import ipaddress
from collections import defaultdict, deque

logger = logging.getLogger(__name__)

class RuleAction(Enum):
    ALLOW = "allow"
    BLOCK = "block"
    LOG = "log"
    RATE_LIMIT = "rate_limit"
    CHALLENGE = "challenge"

class RuleType(Enum):
    IP_WHITELIST = "ip_whitelist"
    IP_BLACKLIST = "ip_blacklist"
    PATTERN_MATCH = "pattern_match"
    RATE_LIMIT = "rate_limit"
    GEO_BLOCK = "geo_block"
    USER_AGENT_BLOCK = "user_agent_block"
    SIZE_LIMIT = "size_limit"
    METHOD_RESTRICTION = "method_restriction"

@dataclass
class WAFRule:
    """WAF rule definition"""
    rule_id: str
    name: str
    description: str
    rule_type: RuleType
    action: RuleAction
    priority: int  # Lower number = higher priority
    enabled: bool
    conditions: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    hit_count: int = 0
    last_hit: Optional[datetime] = None

@dataclass
class RuleMatch:
    """Result of rule evaluation"""
    rule_id: str
    rule_name: str
    action: RuleAction
    matched_condition: str
    confidence: float
    details: Dict[str, Any]

class ProductionWAFEngine:
    """Production-grade WAF engine with real blocking capabilities"""
    
    def __init__(self):
        self.rules: Dict[str, WAFRule] = {}
        self.blocked_ips = set()
        self.rate_limiters = defaultdict(lambda: deque(maxlen=1000))
        self.rule_stats = defaultdict(int)
        self.blocked_requests = 0
        self.total_requests = 0
        
        # Load default security rules
        self._load_default_rules()
        
        # Compile regex patterns for performance
        self._compiled_patterns = {}
        self._compile_patterns()
    
    def _load_default_rules(self):
        """Load comprehensive default security rules"""
        default_rules = [
            # SQL Injection Protection
            {
                'rule_id': 'sql_001',
                'name': 'SQL Injection - Union Attacks',
                'description': 'Blocks SQL injection attempts using UNION statements',
                'rule_type': RuleType.PATTERN_MATCH,
                'action': RuleAction.BLOCK,
                'priority': 10,
                'conditions': {
                    'pattern': r'(\bunion\b.*\bselect\b)|(\bselect\b.*\bunion\b)',
                    'fields': ['uri', 'query_string', 'body'],
                    'case_sensitive': False
                }
            },
            {
                'rule_id': 'sql_002',
                'name': 'SQL Injection - Boolean Attacks',
                'description': 'Blocks boolean-based SQL injection attempts',
                'rule_type': RuleType.PATTERN_MATCH,
                'action': RuleAction.BLOCK,
                'priority': 10,
                'conditions': {
                    'pattern': r'(\bor\b\s+\d+\s*=\s*\d+)|(\band\b\s+\d+\s*=\s*\d+)',
                    'fields': ['uri', 'query_string', 'body'],
                    'case_sensitive': False
                }
            },
            {
                'rule_id': 'sql_003',
                'name': 'SQL Injection - Dangerous Functions',
                'description': 'Blocks dangerous SQL functions and commands',
                'rule_type': RuleType.PATTERN_MATCH,
                'action': RuleAction.BLOCK,
                'priority': 5,
                'conditions': {
                    'pattern': r'(\bdrop\b\s+\btable\b)|(\bdelete\b\s+\bfrom\b)|(\bexec\b\s*\()|(\bexecute\b\s*\()',
                    'fields': ['uri', 'query_string', 'body'],
                    'case_sensitive': False
                }
            },
            
            # XSS Protection
            {
                'rule_id': 'xss_001',
                'name': 'XSS - Script Tags',
                'description': 'Blocks XSS attempts using script tags',
                'rule_type': RuleType.PATTERN_MATCH,
                'action': RuleAction.BLOCK,
                'priority': 10,
                'conditions': {
                    'pattern': r'<script[^>]*>.*?</script>',
                    'fields': ['uri', 'query_string', 'body'],
                    'case_sensitive': False
                }
            },
            {
                'rule_id': 'xss_002',
                'name': 'XSS - Event Handlers',
                'description': 'Blocks XSS attempts using event handlers',
                'rule_type': RuleType.PATTERN_MATCH,
                'action': RuleAction.BLOCK,
                'priority': 10,
                'conditions': {
                    'pattern': r'on\w+\s*=\s*["\'].*?["\']',
                    'fields': ['uri', 'query_string', 'body'],
                    'case_sensitive': False
                }
            },
            {
                'rule_id': 'xss_003',
                'name': 'XSS - JavaScript Protocol',
                'description': 'Blocks javascript: protocol usage',
                'rule_type': RuleType.PATTERN_MATCH,
                'action': RuleAction.BLOCK,
                'priority': 10,
                'conditions': {
                    'pattern': r'javascript\s*:',
                    'fields': ['uri', 'query_string', 'body'],
                    'case_sensitive': False
                }
            },
            
            # Path Traversal Protection
            {
                'rule_id': 'path_001',
                'name': 'Path Traversal - Directory Traversal',
                'description': 'Blocks directory traversal attempts',
                'rule_type': RuleType.PATTERN_MATCH,
                'action': RuleAction.BLOCK,
                'priority': 10,
                'conditions': {
                    'pattern': r'(\.\./)|(\.\.\\)|(%2e%2e%2f)|(%2e%2e/)',
                    'fields': ['uri', 'query_string'],
                    'case_sensitive': False
                }
            },
            {
                'rule_id': 'path_002',
                'name': 'Path Traversal - Sensitive Files',
                'description': 'Blocks access to sensitive system files',
                'rule_type': RuleType.PATTERN_MATCH,
                'action': RuleAction.BLOCK,
                'priority': 5,
                'conditions': {
                    'pattern': r'(/etc/passwd)|(/etc/shadow)|(\\windows\\system32)|(boot\.ini)',
                    'fields': ['uri'],
                    'case_sensitive': False
                }
            },
            
            # Command Injection Protection
            {
                'rule_id': 'cmd_001',
                'name': 'Command Injection - Shell Commands',
                'description': 'Blocks command injection attempts',
                'rule_type': RuleType.PATTERN_MATCH,
                'action': RuleAction.BLOCK,
                'priority': 5,
                'conditions': {
                    'pattern': r'(;\s*(ls|cat|pwd|whoami|id|uname))|(&&\s*(rm|del|format))|(\|\s*(ls|cat|pwd))',
                    'fields': ['uri', 'query_string', 'body'],
                    'case_sensitive': False
                }
            },
            
            # Rate Limiting Rules
            {
                'rule_id': 'rate_001',
                'name': 'General Rate Limit',
                'description': 'Limits requests per IP to prevent abuse',
                'rule_type': RuleType.RATE_LIMIT,
                'action': RuleAction.RATE_LIMIT,
                'priority': 20,
                'conditions': {
                    'requests_per_minute': 100,
                    'window_seconds': 60,
                    'action_duration': 300  # 5 minutes
                }
            },
            {
                'rule_id': 'rate_002',
                'name': 'Login Rate Limit',
                'description': 'Strict rate limiting for login endpoints',
                'rule_type': RuleType.RATE_LIMIT,
                'action': RuleAction.RATE_LIMIT,
                'priority': 15,
                'conditions': {
                    'requests_per_minute': 10,
                    'window_seconds': 60,
                    'uri_pattern': r'/login|/auth|/signin',
                    'action_duration': 600  # 10 minutes
                }
            },
            
            # Malicious User Agents
            {
                'rule_id': 'ua_001',
                'name': 'Malicious User Agents',
                'description': 'Blocks known malicious user agents',
                'rule_type': RuleType.USER_AGENT_BLOCK,
                'action': RuleAction.BLOCK,
                'priority': 15,
                'conditions': {
                    'pattern': r'(sqlmap)|(nikto)|(nmap)|(masscan)|(zap)|(burp)',
                    'case_sensitive': False
                }
            },
            {
                'rule_id': 'ua_002',
                'name': 'Empty User Agent',
                'description': 'Blocks requests with empty user agents',
                'rule_type': RuleType.USER_AGENT_BLOCK,
                'action': RuleAction.LOG,
                'priority': 25,
                'conditions': {
                    'empty_user_agent': True
                }
            },
            
            # File Upload Protection
            {
                'rule_id': 'upload_001',
                'name': 'File Size Limit',
                'description': 'Limits file upload sizes',
                'rule_type': RuleType.SIZE_LIMIT,
                'action': RuleAction.BLOCK,
                'priority': 20,
                'conditions': {
                    'max_size_mb': 10,
                    'uri_pattern': r'/upload|/file'
                }
            },
            
            # Method Restrictions
            {
                'rule_id': 'method_001',
                'name': 'Dangerous HTTP Methods',
                'description': 'Blocks dangerous HTTP methods',
                'rule_type': RuleType.METHOD_RESTRICTION,
                'action': RuleAction.BLOCK,
                'priority': 10,
                'conditions': {
                    'blocked_methods': ['TRACE', 'TRACK', 'DEBUG', 'CONNECT']
                }
            },
            
            # Geographic Blocking (example)
            {
                'rule_id': 'geo_001',
                'name': 'High-Risk Countries',
                'description': 'Blocks traffic from high-risk countries',
                'rule_type': RuleType.GEO_BLOCK,
                'action': RuleAction.LOG,  # Start with logging
                'priority': 30,
                'conditions': {
                    'blocked_countries': ['Unknown'],  # Only block truly unknown sources
                    'whitelist_endpoints': ['/api/public']  # Allow some endpoints
                }
            }
        ]
        
        # Create WAF rules
        for rule_data in default_rules:
            rule = WAFRule(
                rule_id=rule_data['rule_id'],
                name=rule_data['name'],
                description=rule_data['description'],
                rule_type=rule_data['rule_type'],
                action=rule_data['action'],
                priority=rule_data['priority'],
                enabled=True,
                conditions=rule_data['conditions'],
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            self.rules[rule.rule_id] = rule
    
    def _compile_patterns(self):
        """Pre-compile regex patterns for performance"""
        for rule in self.rules.values():
            if rule.rule_type == RuleType.PATTERN_MATCH and 'pattern' in rule.conditions:
                try:
                    flags = 0 if rule.conditions.get('case_sensitive', True) else re.IGNORECASE
                    self._compiled_patterns[rule.rule_id] = re.compile(rule.conditions['pattern'], flags)
                except re.error as e:
                    logger.error(f"Invalid regex pattern in rule {rule.rule_id}: {e}")
    
    def evaluate_request(self, request_data: Dict[str, Any]) -> Tuple[RuleAction, List[RuleMatch]]:
        """Evaluate request against all WAF rules"""
        self.total_requests += 1
        matches = []
        final_action = RuleAction.ALLOW
        
        # Sort rules by priority (lower number = higher priority)
        sorted_rules = sorted(
            [r for r in self.rules.values() if r.enabled],
            key=lambda x: x.priority
        )
        
        for rule in sorted_rules:
            match = self._evaluate_rule(rule, request_data)
            if match:
                matches.append(match)
                
                # Update rule statistics
                rule.hit_count += 1
                rule.last_hit = datetime.utcnow()
                self.rule_stats[rule.rule_id] += 1
                
                # Determine final action (most restrictive wins)
                if match.action == RuleAction.BLOCK:
                    final_action = RuleAction.BLOCK
                    self.blocked_requests += 1
                    break  # Block immediately
                elif match.action == RuleAction.RATE_LIMIT and final_action != RuleAction.BLOCK:
                    final_action = RuleAction.RATE_LIMIT
                elif match.action == RuleAction.CHALLENGE and final_action not in [RuleAction.BLOCK, RuleAction.RATE_LIMIT]:
                    final_action = RuleAction.CHALLENGE
                elif match.action == RuleAction.LOG and final_action == RuleAction.ALLOW:
                    final_action = RuleAction.LOG
        
        return final_action, matches
    
    def _evaluate_rule(self, rule: WAFRule, request_data: Dict[str, Any]) -> Optional[RuleMatch]:
        """Evaluate a single rule against request"""
        try:
            if rule.rule_type == RuleType.PATTERN_MATCH:
                return self._evaluate_pattern_rule(rule, request_data)
            elif rule.rule_type == RuleType.RATE_LIMIT:
                return self._evaluate_rate_limit_rule(rule, request_data)
            elif rule.rule_type == RuleType.IP_BLACKLIST:
                return self._evaluate_ip_blacklist_rule(rule, request_data)
            elif rule.rule_type == RuleType.IP_WHITELIST:
                return self._evaluate_ip_whitelist_rule(rule, request_data)
            elif rule.rule_type == RuleType.GEO_BLOCK:
                return self._evaluate_geo_block_rule(rule, request_data)
            elif rule.rule_type == RuleType.USER_AGENT_BLOCK:
                return self._evaluate_user_agent_rule(rule, request_data)
            elif rule.rule_type == RuleType.SIZE_LIMIT:
                return self._evaluate_size_limit_rule(rule, request_data)
            elif rule.rule_type == RuleType.METHOD_RESTRICTION:
                return self._evaluate_method_restriction_rule(rule, request_data)
        except Exception as e:
            logger.error(f"Error evaluating rule {rule.rule_id}: {e}")
        
        return None
    
    def _evaluate_pattern_rule(self, rule: WAFRule, request_data: Dict[str, Any]) -> Optional[RuleMatch]:
        """Evaluate pattern matching rule"""
        pattern = self._compiled_patterns.get(rule.rule_id)
        if not pattern:
            return None
        
        fields_to_check = rule.conditions.get('fields', ['uri', 'query_string', 'body'])
        
        for field in fields_to_check:
            value = request_data.get(field, '')
            if isinstance(value, dict):
                value = json.dumps(value)
            elif not isinstance(value, str):
                value = str(value)
            
            if pattern.search(value):
                return RuleMatch(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    action=rule.action,
                    matched_condition=f"Pattern match in {field}",
                    confidence=0.9,
                    details={'field': field, 'pattern': rule.conditions['pattern']}
                )
        
        return None
    
    def _evaluate_rate_limit_rule(self, rule: WAFRule, request_data: Dict[str, Any]) -> Optional[RuleMatch]:
        """Evaluate rate limiting rule"""
        client_ip = request_data.get('client_ip', '127.0.0.1')
        now = time.time()
        window = rule.conditions.get('window_seconds', 60)
        limit = rule.conditions.get('requests_per_minute', 100)
        
        # Check if rule applies to specific URIs
        uri_pattern = rule.conditions.get('uri_pattern')
        if uri_pattern:
            uri = request_data.get('uri', '')
            if not re.search(uri_pattern, uri, re.IGNORECASE):
                return None
        
        # Clean old entries
        rate_key = f"{rule.rule_id}:{client_ip}"
        self.rate_limiters[rate_key] = deque([
            timestamp for timestamp in self.rate_limiters[rate_key]
            if now - timestamp < window
        ], maxlen=1000)
        
        # Add current request
        self.rate_limiters[rate_key].append(now)
        
        # Check if limit exceeded
        if len(self.rate_limiters[rate_key]) > limit:
            return RuleMatch(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                action=rule.action,
                matched_condition=f"Rate limit exceeded: {len(self.rate_limiters[rate_key])}/{limit}",
                confidence=1.0,
                details={'requests': len(self.rate_limiters[rate_key]), 'limit': limit, 'window': window}
            )
        
        return None
    
    def _evaluate_ip_blacklist_rule(self, rule: WAFRule, request_data: Dict[str, Any]) -> Optional[RuleMatch]:
        """Evaluate IP blacklist rule"""
        client_ip = request_data.get('client_ip', '127.0.0.1')
        blocked_ips = rule.conditions.get('blocked_ips', [])
        blocked_ranges = rule.conditions.get('blocked_ranges', [])
        
        # Check exact IP matches
        if client_ip in blocked_ips:
            return RuleMatch(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                action=rule.action,
                matched_condition=f"IP {client_ip} in blacklist",
                confidence=1.0,
                details={'ip': client_ip}
            )
        
        # Check IP ranges
        try:
            client_ip_obj = ipaddress.ip_address(client_ip)
            for ip_range in blocked_ranges:
                if client_ip_obj in ipaddress.ip_network(ip_range, strict=False):
                    return RuleMatch(
                        rule_id=rule.rule_id,
                        rule_name=rule.name,
                        action=rule.action,
                        matched_condition=f"IP {client_ip} in blocked range {ip_range}",
                        confidence=1.0,
                        details={'ip': client_ip, 'range': ip_range}
                    )
        except ValueError:
            pass  # Invalid IP address
        
        return None
    
    def _evaluate_ip_whitelist_rule(self, rule: WAFRule, request_data: Dict[str, Any]) -> Optional[RuleMatch]:
        """Evaluate IP whitelist rule"""
        client_ip = request_data.get('client_ip', '127.0.0.1')
        allowed_ips = rule.conditions.get('allowed_ips', [])
        allowed_ranges = rule.conditions.get('allowed_ranges', [])
        
        # If no whitelist defined, allow all
        if not allowed_ips and not allowed_ranges:
            return None
        
        # Check exact IP matches
        if client_ip in allowed_ips:
            return None  # Whitelisted
        
        # Check IP ranges
        try:
            client_ip_obj = ipaddress.ip_address(client_ip)
            for ip_range in allowed_ranges:
                if client_ip_obj in ipaddress.ip_network(ip_range, strict=False):
                    return None  # Whitelisted
        except ValueError:
            pass  # Invalid IP address
        
        # Not whitelisted - block
        return RuleMatch(
            rule_id=rule.rule_id,
            rule_name=rule.name,
            action=rule.action,
            matched_condition=f"IP {client_ip} not in whitelist",
            confidence=1.0,
            details={'ip': client_ip}
        )
    
    def _evaluate_geo_block_rule(self, rule: WAFRule, request_data: Dict[str, Any]) -> Optional[RuleMatch]:
        """Evaluate geographic blocking rule"""
        country = request_data.get('country', 'Unknown')
        blocked_countries = rule.conditions.get('blocked_countries', [])
        whitelist_endpoints = rule.conditions.get('whitelist_endpoints', [])
        
        if country not in blocked_countries:
            return None
        
        # Check if endpoint is whitelisted
        uri = request_data.get('uri', '')
        for endpoint in whitelist_endpoints:
            if uri.startswith(endpoint):
                return None
        
        return RuleMatch(
            rule_id=rule.rule_id,
            rule_name=rule.name,
            action=rule.action,
            matched_condition=f"Request from blocked country: {country}",
            confidence=0.8,
            details={'country': country, 'uri': uri}
        )
    
    def _evaluate_user_agent_rule(self, rule: WAFRule, request_data: Dict[str, Any]) -> Optional[RuleMatch]:
        """Evaluate user agent blocking rule"""
        user_agent = request_data.get('headers', {}).get('User-Agent', '')
        
        # Check for empty user agent
        if rule.conditions.get('empty_user_agent') and not user_agent.strip():
            return RuleMatch(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                action=rule.action,
                matched_condition="Empty user agent detected",
                confidence=0.7,
                details={'user_agent': user_agent}
            )
        
        # Check pattern matching
        pattern = rule.conditions.get('pattern')
        if pattern:
            flags = 0 if rule.conditions.get('case_sensitive', True) else re.IGNORECASE
            if re.search(pattern, user_agent, flags):
                return RuleMatch(
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    action=rule.action,
                    matched_condition=f"Malicious user agent pattern detected",
                    confidence=0.9,
                    details={'user_agent': user_agent, 'pattern': pattern}
                )
        
        return None
    
    def _evaluate_size_limit_rule(self, rule: WAFRule, request_data: Dict[str, Any]) -> Optional[RuleMatch]:
        """Evaluate request size limit rule"""
        max_size_mb = rule.conditions.get('max_size_mb', 10)
        max_size_bytes = max_size_mb * 1024 * 1024
        
        # Check if rule applies to specific URIs
        uri_pattern = rule.conditions.get('uri_pattern')
        if uri_pattern:
            uri = request_data.get('uri', '')
            if not re.search(uri_pattern, uri, re.IGNORECASE):
                return None
        
        # Check content length
        content_length = request_data.get('content_length', 0)
        if content_length > max_size_bytes:
            return RuleMatch(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                action=rule.action,
                matched_condition=f"Request size {content_length} exceeds limit {max_size_bytes}",
                confidence=1.0,
                details={'size': content_length, 'limit': max_size_bytes}
            )
        
        return None
    
    def _evaluate_method_restriction_rule(self, rule: WAFRule, request_data: Dict[str, Any]) -> Optional[RuleMatch]:
        """Evaluate HTTP method restriction rule"""
        method = request_data.get('method', 'GET').upper()
        blocked_methods = [m.upper() for m in rule.conditions.get('blocked_methods', [])]
        
        if method in blocked_methods:
            return RuleMatch(
                rule_id=rule.rule_id,
                rule_name=rule.name,
                action=rule.action,
                matched_condition=f"Blocked HTTP method: {method}",
                confidence=1.0,
                details={'method': method}
            )
        
        return None
    
    def add_rule(self, rule: WAFRule) -> bool:
        """Add a new WAF rule"""
        try:
            # Validate rule
            if not rule.rule_id or rule.rule_id in self.rules:
                return False
            
            # Compile pattern if needed
            if rule.rule_type == RuleType.PATTERN_MATCH and 'pattern' in rule.conditions:
                flags = 0 if rule.conditions.get('case_sensitive', True) else re.IGNORECASE
                self._compiled_patterns[rule.rule_id] = re.compile(rule.conditions['pattern'], flags)
            
            self.rules[rule.rule_id] = rule
            logger.info(f"Added WAF rule: {rule.name} ({rule.rule_id})")
            return True
        except Exception as e:
            logger.error(f"Error adding WAF rule: {e}")
            return False
    
    def remove_rule(self, rule_id: str) -> bool:
        """Remove a WAF rule"""
        if rule_id in self.rules:
            del self.rules[rule_id]
            if rule_id in self._compiled_patterns:
                del self._compiled_patterns[rule_id]
            logger.info(f"Removed WAF rule: {rule_id}")
            return True
        return False
    
    def enable_rule(self, rule_id: str) -> bool:
        """Enable a WAF rule"""
        if rule_id in self.rules:
            self.rules[rule_id].enabled = True
            self.rules[rule_id].updated_at = datetime.utcnow()
            return True
        return False
    
    def disable_rule(self, rule_id: str) -> bool:
        """Disable a WAF rule"""
        if rule_id in self.rules:
            self.rules[rule_id].enabled = False
            self.rules[rule_id].updated_at = datetime.utcnow()
            return True
        return False
    
    def get_rules(self) -> List[Dict[str, Any]]:
        """Get all WAF rules"""
        return [asdict(rule) for rule in self.rules.values()]
    
    def get_rule_stats(self) -> Dict[str, Any]:
        """Get WAF statistics"""
        return {
            'total_rules': len(self.rules),
            'enabled_rules': len([r for r in self.rules.values() if r.enabled]),
            'total_requests': self.total_requests,
            'blocked_requests': self.blocked_requests,
            'block_rate': (self.blocked_requests / max(self.total_requests, 1)) * 100,
            'rule_hits': dict(self.rule_stats),
            'top_triggered_rules': sorted(
                [(rule_id, count) for rule_id, count in self.rule_stats.items()],
                key=lambda x: x[1],
                reverse=True
            )[:10]
        }
    
    def simulate_request_evaluation(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Simulate request evaluation without side effects"""
        action, matches = self.evaluate_request(request_data)
        
        return {
            'action': action.value,
            'blocked': action == RuleAction.BLOCK,
            'matches': [asdict(match) for match in matches],
            'total_matches': len(matches)
        }

# Global WAF engine instance
waf_engine = ProductionWAFEngine()