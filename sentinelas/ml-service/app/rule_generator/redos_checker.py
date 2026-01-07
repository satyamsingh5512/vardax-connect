"""
Sentinelas ReDoS Checker
Detects and mitigates Regular Expression Denial of Service vulnerabilities.
"""

import logging
import re
import time
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


class ReDoSChecker:
    """
    Checks regex patterns for ReDoS vulnerability.
    
    ReDoS occurs when a regex has exponential time complexity on certain inputs,
    typically caused by nested quantifiers or overlapping alternations.
    
    Detection methods:
    1. Static pattern analysis (fast)
    2. Timed execution test (accurate)
    """
    
    # Known vulnerable patterns
    VULNERABLE_PATTERNS = [
        r"\(.*\)\+",           # (a+)+
        r"\(.*\)\*",           # (a*)*
        r"\(\.\*\)\+",         # (.*)+
        r"\(\.\+\)\+",         # (.+)+
        r"\[.*\]\+\[.*\]\+",   # [a-z]+[a-z]+
        r"\(.*\|\.\*\)\+",     # (a|.*)+
        r"a\+a\+",             # a+a+
        r"\\w\+\\w\+",         # \w+\w+
    ]
    
    # Maximum allowed execution time for safety test (ms)
    MAX_EXECUTION_TIME_MS = 10
    
    # Test input that can trigger exponential behavior
    ATTACK_INPUTS = [
        "a" * 30,
        "a" * 30 + "!",
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaa!",
        "<" * 20 + "x",
        "0" * 30 + "x",
    ]
    
    def __init__(self, timeout_ms: int = 10):
        self.timeout_ms = timeout_ms
    
    def is_safe(self, pattern: str) -> bool:
        """
        Check if a regex pattern is safe from ReDoS.
        
        Returns True if pattern is safe, False if vulnerable.
        """
        # Step 1: Static analysis
        if self._has_vulnerable_structure(pattern):
            logger.warning(f"Pattern has potentially vulnerable structure: {pattern[:50]}")
            return False
        
        # Step 2: Try to compile (catches invalid regex)
        try:
            compiled = re.compile(pattern, re.IGNORECASE)
        except re.error as e:
            logger.error(f"Invalid regex pattern: {e}")
            return False
        
        # Step 3: Execution time test
        if not self._passes_time_test(compiled):
            logger.warning(f"Pattern failed time test: {pattern[:50]}")
            return False
        
        return True
    
    def _has_vulnerable_structure(self, pattern: str) -> bool:
        """
        Static analysis for common vulnerable regex structures.
        """
        # Check for nested quantifiers
        if re.search(r"\(.+\)[\+\*]\)?[\+\*]", pattern):
            return True
        
        # Check for overlapping quantifiers
        if re.search(r"[\+\*].*[\+\*]", pattern):
            # More specific check: quantifiers on similar character classes
            if re.search(r"\\w[\+\*].*\\w[\+\*]", pattern):
                return True
            if re.search(r"\.[\+\*].*\.[\+\*]", pattern):
                return True
        
        # Check for alternation with similar patterns
        if re.search(r"\([^|]+\|[^)]*\)[\+\*]", pattern):
            # Check if alternation members overlap
            match = re.search(r"\(([^|]+)\|([^)]+)\)", pattern)
            if match:
                left, right = match.groups()
                if self._patterns_overlap(left, right):
                    return True
        
        # Check known vulnerable patterns
        for vuln_pattern in self.VULNERABLE_PATTERNS:
            if re.search(vuln_pattern, pattern, re.IGNORECASE):
                return True
        
        return False
    
    def _patterns_overlap(self, left: str, right: str) -> bool:
        """Check if two patterns can match overlapping strings."""
        # Simplified check: if both contain .* or similar
        if ".*" in left and ".*" in right:
            return True
        if ".+" in left and ".+" in right:
            return True
        # Check for same character classes
        if "\\w" in left and "\\w" in right:
            return True
        if "\\d" in left and "\\d" in right:
            return True
        return False
    
    def _passes_time_test(self, compiled: re.Pattern) -> bool:
        """
        Test regex execution time against attack inputs.
        """
        for attack_input in self.ATTACK_INPUTS:
            start = time.time()
            try:
                compiled.search(attack_input)
            except Exception:
                pass
            elapsed_ms = (time.time() - start) * 1000
            
            if elapsed_ms > self.timeout_ms:
                logger.warning(f"Regex took {elapsed_ms:.2f}ms on input length {len(attack_input)}")
                return False
        
        return True
    
    def make_safe(self, pattern: str) -> str:
        """
        Attempt to make a vulnerable pattern safe.
        
        Strategies:
        1. Replace nested quantifiers with possessive quantifiers (not available in Python re)
        2. Add atomic grouping (not available in Python re)
        3. Simplify overlapping quantifiers
        4. Fall back to a simpler, safer pattern
        """
        safe_pattern = pattern
        
        # Strategy 1: Replace .* with .*? (non-greedy)
        safe_pattern = re.sub(r"(?<!\?)\.\*(?!\?)", ".*?", safe_pattern)
        
        # Strategy 2: Replace .+ with .+? (non-greedy)
        safe_pattern = re.sub(r"(?<!\?)\.+(?!\?)", ".+?", safe_pattern)
        
        # Strategy 3: Limit repetition
        safe_pattern = re.sub(r"\+(?!\?)", "{1,100}", safe_pattern)
        safe_pattern = re.sub(r"\*(?!\?)", "{0,100}", safe_pattern)
        
        # Strategy 4: Remove nested quantifiers
        # Replace (...)+ with (...)
        safe_pattern = re.sub(r"\(([^()]+)\)\+", r"(\1){1,20}", safe_pattern)
        safe_pattern = re.sub(r"\(([^()]+)\)\*", r"(\1){0,20}", safe_pattern)
        
        # Verify the fixed pattern is actually safe
        if self.is_safe(safe_pattern):
            return safe_pattern
        
        # Ultimate fallback: return a simple literal match
        # Extract the most distinctive part of the pattern
        literal_part = re.sub(r"[\\.*+?^${}()|[\]]", "", pattern)
        if len(literal_part) >= 5:
            return re.escape(literal_part[:20])
        
        # If nothing works, return a very specific pattern
        return r"(?!.)"  # Matches nothing (safe but useless)
    
    def analyze(self, pattern: str) -> dict:
        """
        Comprehensive analysis of a regex pattern.
        """
        result = {
            "pattern": pattern,
            "is_valid": False,
            "is_safe": False,
            "vulnerabilities": [],
            "recommendations": [],
        }
        
        # Check validity
        try:
            compiled = re.compile(pattern)
            result["is_valid"] = True
        except re.error as e:
            result["vulnerabilities"].append(f"Invalid regex: {e}")
            return result
        
        # Check for vulnerabilities
        if re.search(r"\(.+\)[\+\*]\)?[\+\*]", pattern):
            result["vulnerabilities"].append("Nested quantifiers detected")
            result["recommendations"].append("Limit inner quantifier: use {1,N} instead of +")
        
        if re.search(r"\.[\+\*](?!\?)", pattern):
            result["vulnerabilities"].append("Greedy dot-star may cause backtracking")
            result["recommendations"].append("Use non-greedy .*? or limit with {0,N}")
        
        # Time test
        result["is_safe"] = self._passes_time_test(compiled)
        if not result["is_safe"]:
            result["vulnerabilities"].append("Failed execution time test")
        
        return result
    
    def benchmark(self, pattern: str, test_input: str) -> Tuple[bool, float]:
        """
        Benchmark regex execution time.
        
        Returns (success, time_ms).
        """
        try:
            compiled = re.compile(pattern, re.IGNORECASE)
            start = time.time()
            compiled.search(test_input)
            elapsed_ms = (time.time() - start) * 1000
            return True, elapsed_ms
        except Exception as e:
            return False, -1
