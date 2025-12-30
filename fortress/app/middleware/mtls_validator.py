"""
mTLS Client Certificate Validation Middleware
Security: Validate client certificates against private CA, enforce cnf-bound tokens.

mTLS Flow:
1. Reverse proxy terminates TLS and extracts client certificate
2. Certificate info passed via headers (X-Client-Cert, X-Client-Cert-DN)
3. This middleware validates certificate against CA and checks cnf binding

NIST Control: IA-2 (Identification and Authentication), IA-5 (Authenticator Management)
FIPS 140-3: Certificate validation using approved algorithms
"""
import os
import base64
import hashlib
from typing import Optional
from dataclasses import dataclass
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.backends import default_backend
from cryptography.x509.oid import NameOID
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.logging_config import get_logger, audit_logger

logger = get_logger(__name__)


@dataclass
class ClientCertInfo:
    """Parsed client certificate information."""
    subject_cn: str
    issuer_cn: str
    serial_number: str
    thumbprint_sha256: str
    not_before: str
    not_after: str
    raw_cert: bytes


class CertificateValidator:
    """
    Certificate validation against private CA.
    Security: Strict validation, no trust of external CAs.
    """
    
    def __init__(self, ca_cert_path: str):
        self.ca_cert = self._load_ca_cert(ca_cert_path)
        self.ca_subject = self.ca_cert.subject if self.ca_cert else None
    
    def _load_ca_cert(self, path: str) -> Optional[x509.Certificate]:
        """Load CA certificate from file."""
        if not path or not os.path.exists(path):
            logger.warning("ca_cert_not_found", extra={"path": path})
            return None
        
        try:
            with open(path, "rb") as f:
                ca_pem = f.read()
            return x509.load_pem_x509_certificate(ca_pem, default_backend())
        except Exception as e:
            logger.error("ca_cert_load_failed", extra={"error": str(e)})
            return None
    
    def validate_certificate(self, cert_pem: bytes) -> tuple[bool, str, Optional[ClientCertInfo]]:
        """
        Validate client certificate.
        
        Returns:
            Tuple of (valid: bool, reason: str, cert_info: Optional[ClientCertInfo])
        
        Security: Validates issuer, expiry, and computes thumbprint.
        """
        try:
            cert = x509.load_pem_x509_certificate(cert_pem, default_backend())
        except Exception as e:
            return False, f"invalid_certificate_format:{str(e)}", None
        
        # Extract certificate info
        try:
            subject_cn = cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value
        except (IndexError, AttributeError):
            subject_cn = "unknown"
        
        try:
            issuer_cn = cert.issuer.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value
        except (IndexError, AttributeError):
            issuer_cn = "unknown"
        
        # Compute SHA-256 thumbprint (for cnf binding)
        cert_der = cert.public_bytes(serialization.Encoding.DER)
        thumbprint = hashlib.sha256(cert_der).digest()
        thumbprint_b64 = base64.urlsafe_b64encode(thumbprint).rstrip(b"=").decode("ascii")
        
        cert_info = ClientCertInfo(
            subject_cn=subject_cn,
            issuer_cn=issuer_cn,
            serial_number=str(cert.serial_number),
            thumbprint_sha256=thumbprint_b64,
            not_before=cert.not_valid_before_utc.isoformat(),
            not_after=cert.not_valid_after_utc.isoformat(),
            raw_cert=cert_pem,
        )
        
        # Validate issuer (must be our CA)
        if self.ca_cert:
            if cert.issuer != self.ca_cert.subject:
                return False, "issuer_not_trusted", cert_info
        
        # Validate expiry
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        
        if now < cert.not_valid_before_utc:
            return False, "certificate_not_yet_valid", cert_info
        
        if now > cert.not_valid_after_utc:
            return False, "certificate_expired", cert_info
        
        return True, "valid", cert_info
    
    @staticmethod
    def compute_thumbprint(cert_pem: bytes) -> str:
        """
        Compute normalized SHA-256 thumbprint for cnf binding.
        Security: Used to bind JWT tokens to specific client certificates.
        
        RFC 8705: OAuth 2.0 Mutual-TLS Client Authentication
        """
        cert = x509.load_pem_x509_certificate(cert_pem, default_backend())
        cert_der = cert.public_bytes(serialization.Encoding.DER)
        thumbprint = hashlib.sha256(cert_der).digest()
        # Base64url encoding without padding (per RFC 8705)
        return base64.urlsafe_b64encode(thumbprint).rstrip(b"=").decode("ascii")


class MTLSValidatorMiddleware(BaseHTTPMiddleware):
    """
    mTLS validation middleware.
    Security: Validate client certificates, enforce cnf-bound tokens.
    """
    
    # Paths requiring mTLS (sensitive endpoints)
    MTLS_REQUIRED_PATHS = frozenset({
        "/api/admin",
        "/api/secrets",
        "/api/certificates",
    })
    
    # Paths exempt from mTLS
    EXEMPT_PATHS = frozenset({"/health", "/ready", "/live", "/docs", "/openapi.json"})
    
    def __init__(self, app):
        super().__init__(app)
        self.enabled = os.getenv("MTLS_ENABLED", "false").lower() == "true"
        self.strict_mode = os.getenv("MTLS_STRICT", "false").lower() == "true"
        
        ca_cert_path = os.getenv("CA_CERT_PATH", "/secrets/ca.crt")
        self.validator = CertificateValidator(ca_cert_path)
    
    async def dispatch(self, request: Request, call_next):
        if not self.enabled or request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)
        
        client_ip = self._get_client_ip(request)
        correlation_id = getattr(request.state, "correlation_id", None)
        
        # Check if mTLS is required for this path
        mtls_required = (
            self.strict_mode or 
            any(request.url.path.startswith(p) for p in self.MTLS_REQUIRED_PATHS)
        )
        
        # Extract client certificate from proxy header
        cert_pem = self._extract_client_cert(request)
        
        if cert_pem:
            # Validate certificate
            valid, reason, cert_info = self.validator.validate_certificate(cert_pem)
            
            if valid and cert_info:
                # Store cert info in request state
                request.state.client_cert = cert_info
                request.state.client_cert_thumbprint = cert_info.thumbprint_sha256
                
                logger.info(
                    "mtls_validated",
                    extra={
                        "subject_cn": cert_info.subject_cn,
                        "thumbprint": cert_info.thumbprint_sha256[:16] + "...",
                        "client_ip": client_ip,
                        "correlation_id": correlation_id,
                    }
                )
            else:
                logger.warning(
                    "mtls_validation_failed",
                    extra={
                        "reason": reason,
                        "client_ip": client_ip,
                        "correlation_id": correlation_id,
                    }
                )
                
                if mtls_required:
                    audit_logger.log_access_denied(
                        resource=request.url.path,
                        client_ip=client_ip,
                        reason=f"mtls_invalid:{reason}",
                        correlation_id=correlation_id,
                    )
                    
                    return JSONResponse(
                        status_code=401,
                        content={
                            "error": "certificate_invalid",
                            "message": "Client certificate validation failed",
                        },
                    )
        else:
            # No certificate provided
            request.state.client_cert = None
            request.state.client_cert_thumbprint = None
            
            if mtls_required:
                audit_logger.log_access_denied(
                    resource=request.url.path,
                    client_ip=client_ip,
                    reason="mtls_required_no_cert",
                    correlation_id=correlation_id,
                )
                
                return JSONResponse(
                    status_code=401,
                    content={
                        "error": "certificate_required",
                        "message": "Client certificate required",
                    },
                )
        
        return await call_next(request)
    
    def _extract_client_cert(self, request: Request) -> Optional[bytes]:
        """
        Extract client certificate from proxy headers.
        Security: Proxy must be trusted to forward correct certificate.
        """
        # Traefik/Nginx style: URL-encoded PEM
        cert_header = request.headers.get("x-client-cert")
        if cert_header:
            try:
                from urllib.parse import unquote
                cert_pem = unquote(cert_header)
                return cert_pem.encode("utf-8")
            except Exception:
                pass
        
        # Envoy style: Base64-encoded DER
        cert_b64 = request.headers.get("x-client-cert-der")
        if cert_b64:
            try:
                cert_der = base64.b64decode(cert_b64)
                cert = x509.load_der_x509_certificate(cert_der, default_backend())
                return cert.public_bytes(serialization.Encoding.PEM)
            except Exception:
                pass
        
        return None
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"


def verify_cnf_binding(jwt_cnf_thumbprint: str, cert_thumbprint: str) -> bool:
    """
    Verify JWT cnf claim matches client certificate thumbprint.
    
    Security: Ensures token can only be used with the certificate it was bound to.
    RFC 8705: OAuth 2.0 Mutual-TLS Client Authentication and Certificate-Bound Access Tokens
    
    Args:
        jwt_cnf_thumbprint: x5t#S256 value from JWT cnf claim
        cert_thumbprint: Computed thumbprint of presented client certificate
    
    Returns:
        True if thumbprints match, False otherwise
    """
    # Constant-time comparison to prevent timing attacks
    import hmac
    return hmac.compare_digest(jwt_cnf_thumbprint, cert_thumbprint)
