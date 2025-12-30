"""
JA4+ TLS Fingerprinting Middleware
Security: Identify clients by TLS ClientHello characteristics.

JA4+ is an evolution of JA3, providing more granular fingerprinting.
This implementation parses fingerprints passed by reverse proxy (Traefik/Envoy).

NIST Control: IA-3 (Device Identification and Authentication)
"""
import os
import re
import hashlib
from dataclasses import dataclass
from typing import Optional, Set, Dict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.logging_config import get_logger, audit_logger

logger = get_logger(__name__)


@dataclass
class JA4Fingerprint:
    """
    Parsed JA4+ fingerprint components.
    
    JA4 format: t13d1516h2_8daaf6152771_b0da82dd1658
    - Section A: TLS version, SNI, cipher count, extension count
    - Section B: Sorted cipher suites hash
    - Section C: Sorted extensions hash
    """
    raw: str
    tls_version: str
    sni_present: bool
    cipher_count: int
    extension_count: int
    cipher_hash: str
    extension_hash: str
    
    @classmethod
    def parse(cls, fingerprint: str) -> Optional["JA4Fingerprint"]:
        """
        Parse JA4 fingerprint string.
        Security: Strict parsing, reject malformed fingerprints.
        """
        if not fingerprint:
            return None
        
        # JA4 format: t13d1516h2_8daaf6152771_b0da82dd1658
        parts = fingerprint.split("_")
        if len(parts) != 3:
            return None
        
        section_a, cipher_hash, extension_hash = parts
        
        # Parse section A: t13d1516h2
        # t = TLS, 13 = version, d = SNI present, 15 = cipher count, 16 = ext count, h2 = ALPN
        match = re.match(r"([tq])(\d{2})([dn])(\d{2})(\d{2})([a-z0-9]{2})?", section_a)
        if not match:
            return None
        
        protocol, version, sni, cipher_count, ext_count, alpn = match.groups()
        
        return cls(
            raw=fingerprint,
            tls_version=f"{protocol}{version}",
            sni_present=(sni == "d"),
            cipher_count=int(cipher_count),
            extension_count=int(ext_count),
            cipher_hash=cipher_hash,
            extension_hash=extension_hash,
        )


class JA4FingerprintDatabase:
    """
    Database of known JA4+ fingerprints.
    Security: Allowlist known good clients, blocklist known bad.
    """
    
    def __init__(self):
        # Known good fingerprints (browsers, legitimate tools)
        self.allowlist: Set[str] = set()
        
        # Known bad fingerprints (scanners, exploit tools)
        self.blocklist: Set[str] = set()
        
        # Fingerprint to client mapping
        self.known_clients: Dict[str, str] = {}
        
        self._load_fingerprints()
    
    def _load_fingerprints(self):
        """
        Load fingerprint database.
        Security: In production, load from secure storage/vault.
        """
        # Sample allowlist (common browsers)
        # These are example fingerprints, real ones vary by browser version
        self.allowlist = {
            # Chrome 120+ on Windows
            "t13d1516h2_8daaf6152771_b0da82dd1658",
            # Firefox 120+ on Windows
            "t13d1715h2_5b57614c22b0_3d5424432f57",
            # Safari 17+ on macOS
            "t13d1312h2_e5627efa2ab1_4da5efaf5c5d",
            # Edge 120+ on Windows
            "t13d1516h2_8daaf6152771_b0da82dd1658",
        }
        
        # Sample blocklist (known malicious tools)
        self.blocklist = {
            # Python requests (often used in attacks)
            "t13d0000h1_0000000000_0000000000",
            # sqlmap default
            "t12d0506h1_a0a1a2a3a4_b0b1b2b3b4",
            # nikto scanner
            "t12d0304h1_c0c1c2c3c4_d0d1d2d3d4",
            # Generic curl (suspicious in browser-only endpoints)
            "t13d0102h1_e0e1e2e3e4_f0f1f2f3f4",
        }
        
        # Client identification
        self.known_clients = {
            "t13d1516h2_8daaf6152771_b0da82dd1658": "Chrome/Edge",
            "t13d1715h2_5b57614c22b0_3d5424432f57": "Firefox",
            "t13d1312h2_e5627efa2ab1_4da5efaf5c5d": "Safari",
        }
    
    def check_fingerprint(self, fingerprint: str) -> tuple[bool, str, str]:
        """
        Check fingerprint against database.
        
        Returns:
            Tuple of (allowed: bool, action: str, reason: str)
        """
        if fingerprint in self.blocklist:
            return False, "block", "fingerprint_blocklisted"
        
        if fingerprint in self.allowlist:
            client = self.known_clients.get(fingerprint, "known_client")
            return True, "allow", f"fingerprint_allowlisted:{client}"
        
        # Unknown fingerprint: allow but flag for review
        return True, "flag", "fingerprint_unknown"


class JA4FingerprintMiddleware(BaseHTTPMiddleware):
    """
    JA4+ fingerprint validation middleware.
    Security: Identify and filter clients based on TLS characteristics.
    """
    
    # Header names for JA4 fingerprint (set by reverse proxy)
    JA4_HEADERS = [
        "x-ja4-fingerprint",
        "x-tls-fingerprint",
        "x-client-ja4",
    ]
    
    def __init__(self, app):
        super().__init__(app)
        self.enabled = os.getenv("JA4_ENABLED", "true").lower() == "true"
        self.strict_mode = os.getenv("JA4_STRICT", "false").lower() == "true"
        self.db = JA4FingerprintDatabase()
    
    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)
        
        # Extract JA4 fingerprint from proxy header
        fingerprint = self._extract_fingerprint(request)
        correlation_id = getattr(request.state, "correlation_id", None)
        client_ip = self._get_client_ip(request)
        
        if fingerprint:
            # Parse and validate fingerprint
            parsed = JA4Fingerprint.parse(fingerprint)
            
            if parsed:
                allowed, action, reason = self.db.check_fingerprint(fingerprint)
                
                # Store parsed fingerprint in request state for downstream use
                request.state.ja4_fingerprint = parsed
                request.state.ja4_action = action
                
                logger.info(
                    "ja4_fingerprint_checked",
                    extra={
                        "fingerprint": fingerprint,
                        "action": action,
                        "reason": reason,
                        "client_ip": client_ip,
                        "correlation_id": correlation_id,
                    }
                )
                
                if not allowed:
                    audit_logger.log_access_denied(
                        resource=request.url.path,
                        client_ip=client_ip,
                        reason=f"ja4_blocked:{reason}",
                        correlation_id=correlation_id,
                    )
                    
                    return JSONResponse(
                        status_code=403,
                        content={
                            "error": "client_not_allowed",
                            "message": "Client fingerprint not permitted",
                        },
                    )
            else:
                logger.warning(
                    "ja4_fingerprint_invalid",
                    extra={
                        "fingerprint": fingerprint[:50],  # Truncate for safety
                        "client_ip": client_ip,
                        "correlation_id": correlation_id,
                    }
                )
        else:
            # No fingerprint available
            if self.strict_mode:
                # In strict mode, reject requests without fingerprint
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": "fingerprint_required",
                        "message": "TLS fingerprint header required",
                    },
                )
            
            request.state.ja4_fingerprint = None
            request.state.ja4_action = "unknown"
        
        return await call_next(request)
    
    def _extract_fingerprint(self, request: Request) -> Optional[str]:
        """Extract JA4 fingerprint from request headers."""
        for header in self.JA4_HEADERS:
            value = request.headers.get(header)
            if value:
                return value.strip()
        return None
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"


def compute_ja4_from_clienthello(client_hello_hex: str) -> Optional[str]:
    """
    Compute JA4 fingerprint from raw ClientHello.
    
    This is a simplified implementation. In production, use a dedicated
    TLS parsing library or let the reverse proxy compute it.
    
    Security: This function is for reference; prefer proxy-computed fingerprints.
    """
    # This would require full TLS ClientHello parsing
    # For production, configure Traefik/Envoy to compute and forward JA4
    # 
    # Traefik config example:
    # entryPoints:
    #   websecure:
    #     address: ":443"
    #     http:
    #       middlewares:
    #         - ja4-headers
    # 
    # Envoy config example:
    # http_filters:
    #   - name: envoy.filters.http.lua
    #     typed_config:
    #       inline_code: |
    #         function envoy_on_request(handle)
    #           local ja4 = compute_ja4(handle:streamInfo():downstreamSslConnection())
    #           handle:headers():add("x-ja4-fingerprint", ja4)
    #         end
    
    logger.warning("ja4_compute_not_implemented", 
                   extra={"note": "Use reverse proxy for JA4 computation"})
    return None
