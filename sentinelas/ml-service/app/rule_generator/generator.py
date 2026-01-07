"""
Sentinelas Rule Generator
Synthesizes Coraza SecRules from detected attack patterns.
Includes ReDoS safety checking for generated regex patterns.
"""

import hashlib
import logging
import re
import time
from typing import Dict, List, Optional, Tuple

from app.rule_generator.redos_checker import ReDoSChecker

logger = logging.getLogger(__name__)


class RuleGenerator:
    """
    Generates SecRules for Coraza WAF based on detected attacks.
    
    Algorithm:
    1. Extract malicious tokens from request
    2. Synthesize concise regex pattern
    3. Check for ReDoS vulnerability
    4. Test against sample legitimate traffic
    5. Return idempotent SecRule with metadata
    """
    
    # Base rule ID range for generated rules (avoid collision with OWASP CRS)
    BASE_RULE_ID = 9900000
    
    # Attack-specific patterns for rule generation
    ATTACK_PATTERNS = {
        "sqli": {
            "tokens": [r"(?:--|#)", r"(?:;|'|\")", r"\b(?:union|select|insert|update|delete|drop)\b"],
            "target": "ARGS|REQUEST_BODY",
            "severity": "CRITICAL",
        },
        "xss": {
            "tokens": [r"<script", r"javascript:", r"on\w+\s*=", r"<iframe", r"<svg\s+on"],
            "target": "ARGS|REQUEST_BODY|REQUEST_HEADERS",
            "severity": "CRITICAL",
        },
        "lfi": {
            "tokens": [r"\.\./", r"\.\.\\", r"/etc/passwd", r"/proc/self"],
            "target": "ARGS|REQUEST_URI",
            "severity": "CRITICAL",
        },
        "rce": {
            "tokens": [r";\s*\w+", r"\|\s*\w+", r"`[^`]+`", r"\$\([^)]+\)"],
            "target": "ARGS|REQUEST_BODY",
            "severity": "CRITICAL",
        },
        "path_traversal": {
            "tokens": [r"(?:\.\.[\\/]){2,}", r"%2e%2e[\\/]", r"\.\.%2f"],
            "target": "REQUEST_URI|ARGS",
            "severity": "HIGH",
        },
        "ssrf": {
            "tokens": [r"(?:127\.0\.0\.1|localhost|0\.0\.0\.0)", r"file://", r"gopher://"],
            "target": "ARGS|REQUEST_BODY",
            "severity": "CRITICAL",
        },
    }
    
    # Sample legitimate traffic patterns for FP testing
    LEGITIMATE_SAMPLES = [
        "GET /products?id=123&category=electronics",
        "POST /login username=john&password=secret123",
        "GET /search?q=best+laptops+2024",
        "GET /api/users/profile",
        "POST /api/comments content=Great article!&rating=5",
        "GET /blog/how-to-select-the-best-database",
        "POST /contact name=John Doe&email=john@example.com&message=Hello",
    ]
    
    def __init__(self):
        self.redos_checker = ReDoSChecker()
        self.generated_rules: Dict[str, str] = {}  # Cache for idempotency
        self._rule_counter = 0
    
    def generate(
        self,
        request_data: Dict,
        attack_type: str,
        shap_explanation: Dict,
    ) -> Optional[Dict]:
        """
        Generate a SecRule based on attack detection.
        
        Args:
            request_data: Original request data
            attack_type: Detected attack type (e.g., "sqli", "xss")
            shap_explanation: SHAP feature contributions
            
        Returns:
            Rule dictionary or None if generation fails
        """
        try:
            # Extract malicious token from request
            malicious_token = self._extract_malicious_token(request_data, attack_type, shap_explanation)
            
            if not malicious_token:
                logger.warning(f"Could not extract malicious token for {attack_type}")
                return None
            
            # Synthesize regex pattern
            pattern = self._synthesize_pattern(malicious_token, attack_type)
            
            # Check for ReDoS
            is_safe, safe_pattern = self._check_and_fix_redos(pattern)
            if not is_safe:
                logger.warning(f"Original pattern was ReDoS vulnerable, using safe alternative")
                pattern = safe_pattern
            
            # Test against legitimate traffic
            fp_rate = self._estimate_false_positives(pattern)
            if fp_rate > 0.01:  # >1% FP rate
                logger.warning(f"Pattern has high FP rate ({fp_rate:.2%}), tightening")
                pattern = self._tighten_pattern(pattern, malicious_token)
            
            # Generate unique rule ID
            rule_id = self._get_rule_id(pattern)
            
            # Build SecRule
            rule_config = self.ATTACK_PATTERNS.get(attack_type.lower(), {
                "target": "ARGS|REQUEST_BODY",
                "severity": "HIGH",
            })
            
            secrule = self._build_secrule(
                rule_id=rule_id,
                pattern=pattern,
                target=rule_config["target"],
                severity=rule_config["severity"],
                attack_type=attack_type,
                malicious_token=malicious_token[:50],  # Truncate for readability
            )
            
            # Cache for idempotency
            cache_key = hashlib.md5(pattern.encode()).hexdigest()[:8]
            self.generated_rules[cache_key] = secrule
            
            return {
                "secrule": secrule,
                "rule_id": rule_id,
                "pattern": pattern,
                "is_redos_safe": is_safe or safe_pattern is not None,
                "estimated_fp_rate": fp_rate,
                "mitigation_type": "BLOCK",
                "metadata": {
                    "attack_type": attack_type,
                    "generated_at": int(time.time()),
                    "malicious_token_preview": malicious_token[:50],
                    "cache_key": cache_key,
                },
            }
            
        except Exception as e:
            logger.error(f"Rule generation error: {e}")
            return None
    
    def _extract_malicious_token(
        self,
        request_data: Dict,
        attack_type: str,
        shap_explanation: Dict,
    ) -> Optional[str]:
        """
        Extract the malicious token that triggered detection.
        Uses SHAP contributions to identify suspicious features.
        """
        # Get top contributing features
        top_features = shap_explanation.get("contributions", [])
        if not top_features:
            top_features = shap_explanation.get("top_features", [])
        
        # Combine request components
        uri = request_data.get("uri", "")
        body = request_data.get("raw_body", "")
        combined = uri + body
        
        # Attack-specific extraction
        attack_patterns = self.ATTACK_PATTERNS.get(attack_type.lower(), {})
        tokens = attack_patterns.get("tokens", [])
        
        for token_pattern in tokens:
            match = re.search(token_pattern, combined, re.IGNORECASE)
            if match:
                # Get surrounding context (up to 50 chars each side)
                start = max(0, match.start() - 20)
                end = min(len(combined), match.end() + 20)
                return combined[start:end]
        
        # Fallback: extract suspicious substrings based on heuristics
        suspicious_chars = re.findall(r"[<>'\";|&$(){}[\]\\]+.{0,30}", combined)
        if suspicious_chars:
            return max(suspicious_chars, key=len)
        
        # Last resort: return the query string or body snippet
        if "?" in uri:
            return uri.split("?", 1)[1][:100]
        
        return body[:100] if body else None
    
    def _synthesize_pattern(self, malicious_token: str, attack_type: str) -> str:
        """
        Synthesize a concise regex pattern from malicious token.
        """
        # Escape special regex characters
        escaped = re.escape(malicious_token)
        
        # Make pattern more general but still targeted
        # Replace specific values with character classes
        pattern = escaped
        
        # Generalize numbers
        pattern = re.sub(r"\d+", r"\\d+", pattern)
        
        # Generalize whitespace
        pattern = re.sub(r"\\s+", r"\\s*", pattern)
        
        # For SQL injection, focus on structure
        if attack_type.lower() == "sqli":
            pattern = re.sub(r"\\b(union|select|insert|update|delete|drop)\\b", 
                           r"\\b(?:union|select|insert|update|delete|drop)\\b", 
                           pattern, flags=re.IGNORECASE)
        
        # For XSS, focus on event handlers
        if attack_type.lower() == "xss":
            pattern = re.sub(r"on\\w+", r"on[a-z]+", pattern, flags=re.IGNORECASE)
        
        # Wrap in word boundary for better matching
        if len(pattern) > 10:
            pattern = f"(?i){pattern}"
        
        return pattern
    
    def _check_and_fix_redos(self, pattern: str) -> Tuple[bool, Optional[str]]:
        """
        Check pattern for ReDoS vulnerability and provide fix if needed.
        """
        is_safe = self.redos_checker.is_safe(pattern)
        
        if is_safe:
            return True, pattern
        
        # Try to fix the pattern
        safe_pattern = self.redos_checker.make_safe(pattern)
        
        return False, safe_pattern
    
    def _estimate_false_positives(self, pattern: str) -> float:
        """
        Estimate false positive rate by testing against legitimate samples.
        """
        try:
            compiled = re.compile(pattern, re.IGNORECASE)
            matches = sum(1 for sample in self.LEGITIMATE_SAMPLES if compiled.search(sample))
            return matches / len(self.LEGITIMATE_SAMPLES)
        except re.error:
            return 1.0  # Invalid pattern = 100% FP
    
    def _tighten_pattern(self, pattern: str, malicious_token: str) -> str:
        """
        Make pattern more specific to reduce false positives.
        """
        # Use more of the original token
        if len(malicious_token) > 20:
            return re.escape(malicious_token[:40])
        
        # Add anchoring
        if not pattern.startswith("^") and not pattern.startswith("(?:"):
            pattern = f"(?:^|[^\\w]){pattern}"
        
        return pattern
    
    def _get_rule_id(self, pattern: str) -> int:
        """Generate unique rule ID based on pattern hash."""
        pattern_hash = int(hashlib.md5(pattern.encode()).hexdigest()[:6], 16)
        rule_id = self.BASE_RULE_ID + (pattern_hash % 99999)
        return rule_id
    
    def _build_secrule(
        self,
        rule_id: int,
        pattern: str,
        target: str,
        severity: str,
        attack_type: str,
        malicious_token: str,
    ) -> str:
        """
        Build a complete Coraza/ModSecurity SecRule.
        """
        # Escape any quotes in pattern for rule string
        pattern_escaped = pattern.replace('"', '\\"')
        
        secrule = f'''SecRule {target} "@rx {pattern_escaped}" \\
    "id:{rule_id},\\
    phase:2,\\
    block,\\
    t:none,t:urlDecodeUni,t:htmlEntityDecode,t:lowercase,\\
    msg:'Sentinelas ML: {attack_type.upper()} attack detected',\\
    logdata:'Matched pattern: %{{MATCHED_VAR}}',\\
    severity:'{severity}',\\
    tag:'application-multi',\\
    tag:'language-multi',\\
    tag:'platform-multi',\\
    tag:'attack-{attack_type.lower()}',\\
    tag:'OWASP_CRS',\\
    tag:'ml-generated',\\
    ver:'sentinelas/1.0.0',\\
    setvar:'tx.anomaly_score_pl1=+%{{tx.critical_anomaly_score}}'"'''
        
        return secrule
    
    def get_cached_rule(self, cache_key: str) -> Optional[str]:
        """Retrieve cached rule for idempotent generation."""
        return self.generated_rules.get(cache_key)
    
    def clear_cache(self) -> None:
        """Clear the rule cache."""
        self.generated_rules.clear()
