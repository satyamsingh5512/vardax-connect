"""
Honeytoken Detection Middleware
Security: Detect usage of fake credentials injected as deception.

Honeytoken Strategy:
1. Inject fake API keys in responses (marked internally)
2. Monitor for usage of these fake keys
3. Any usage indicates compromise or insider threat
4. Trigger immediate containment and alerting

NIST Control: SI-4 (Information System Monitoring), IR-4 (Incident Handling)
"""
import os
import hashlib
import secrets
from typing import Set, Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.logging_config import get_logger, audit_logger

logger = get_logger(__name__)


class HoneytokenRegistry:
    """
    Registry of active honeytokens.
    Security: Track fake credentials for detection.
    """
    
    # Prefix for honeytoken identification (internal use only)
    HONEYTOKEN_PREFIX = "HT_"
    
    def __init__(self):
        # In production, store in Redis/database with encryption
        self._active_tokens: Set[str] = set()
        self._token_metadata: dict = {}
    
    def generate_honeytoken(self, token_type: str = "api_key", 
                            context: str = None) -> str:
        """
        Generate a new honeytoken.
        Security: Tokens look legitimate but are tracked.
        """
        # Generate realistic-looking token
        random_part = secrets.token_hex(16)
        
        # Create token that looks like a real API key
        if token_type == "api_key":
            token = f"vdx_{random_part}"
        elif token_type == "bearer":
            token = f"Bearer {secrets.token_urlsafe(32)}"
        else:
            token = random_part
        
        # Compute hash for storage (don't store plaintext)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        self._active_tokens.add(token_hash)
        self._token_metadata[token_hash] = {
            "type": token_type,
            "context": context,
            "created_at": self._get_timestamp(),
        }
        
        logger.info(
            "honeytoken_generated",
            extra={
                "token_hash": token_hash[:16] + "...",
                "type": token_type,
                "context": context,
            }
        )
        
        return token
    
    def is_honeytoken(self, token: str) -> bool:
        """Check if a token is a honeytoken."""
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        return token_hash in self._active_tokens
    
    def get_token_metadata(self, token: str) -> Optional[dict]:
        """Get metadata for a honeytoken."""
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        return self._token_metadata.get(token_hash)
    
    def revoke_honeytoken(self, token: str) -> bool:
        """Revoke a honeytoken after detection."""
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        if token_hash in self._active_tokens:
            self._active_tokens.remove(token_hash)
            del self._token_metadata[token_hash]
            return True
        return False
    
    @staticmethod
    def _get_timestamp() -> str:
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat()


# Global registry instance
honeytoken_registry = HoneytokenRegistry()


class HoneytokenMiddleware(BaseHTTPMiddleware):
    """
    Honeytoken detection middleware.
    Security: Detect and respond to honeytoken usage.
    """
    
    # Headers to check for honeytokens
    TOKEN_HEADERS = ["authorization", "x-api-key", "api-key"]
    
    def __init__(self, app):
        super().__init__(app)
        self.enabled = os.getenv("HONEYTOKEN_ENABLED", "true").lower() == "true"
        self.registry = honeytoken_registry
    
    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)
        
        client_ip = self._get_client_ip(request)
        correlation_id = getattr(request.state, "correlation_id", None)
        
        # Check all token headers for honeytokens
        for header in self.TOKEN_HEADERS:
            token = request.headers.get(header)
            if token:
                # Strip "Bearer " prefix if present
                if token.lower().startswith("bearer "):
                    token = token[7:]
                
                if self.registry.is_honeytoken(token):
                    # CRITICAL: Honeytoken detected!
                    metadata = self.registry.get_token_metadata(token)
                    
                    audit_logger.log_honeytoken_triggered(
                        token_id=hashlib.sha256(token.encode()).hexdigest()[:16],
                        client_ip=client_ip,
                        endpoint=request.url.path,
                        correlation_id=correlation_id,
                    )
                    
                    logger.critical(
                        "honeytoken_triggered",
                        extra={
                            "client_ip": client_ip,
                            "endpoint": request.url.path,
                            "method": request.method,
                            "user_agent": request.headers.get("user-agent", "unknown"),
                            "token_context": metadata.get("context") if metadata else None,
                            "correlation_id": correlation_id,
                            "action": "containment_initiated",
                        }
                    )
                    
                    # Execute containment playbook
                    await self._execute_containment(client_ip, token, request)
                    
                    # Return generic error (don't reveal detection)
                    return JSONResponse(
                        status_code=401,
                        content={
                            "error": "unauthorized",
                            "message": "Invalid credentials",
                        },
                    )
        
        return await call_next(request)
    
    async def _execute_containment(self, client_ip: str, token: str, 
                                    request: Request) -> None:
        """
        Execute containment playbook for honeytoken detection.
        Security: Immediate response to potential compromise.
        
        Playbook:
        1. Add IP to penalty box (immediate tarpit)
        2. Log all request details for forensics
        3. Revoke the honeytoken
        4. Trigger alert to SOC
        """
        from app.core.redis_client import get_redis_pool
        from app.middleware.tarpit import TarpitManager
        
        try:
            redis_client = await get_redis_pool()
            tarpit_manager = TarpitManager(redis_client)
            
            # Add to penalty box with high score
            await tarpit_manager.add_to_penalty_box(
                client_ip=client_ip,
                reason="honeytoken_usage",
                penalty_points=100,  # Immediate block threshold
            )
            
            # Store forensic data
            forensic_data = {
                "timestamp": self._get_timestamp(),
                "client_ip": client_ip,
                "method": request.method,
                "path": request.url.path,
                "query": str(request.query_params),
                "headers": dict(request.headers),
                "user_agent": request.headers.get("user-agent"),
            }
            
            import json
            await redis_client.lpush(
                f"forensics:honeytoken:{client_ip}",
                json.dumps(forensic_data, default=str)
            )
            await redis_client.expire(f"forensics:honeytoken:{client_ip}", 86400 * 30)
            
            # Revoke the honeytoken
            self.registry.revoke_honeytoken(token)
            
            logger.info(
                "containment_executed",
                extra={
                    "client_ip": client_ip,
                    "actions": ["penalty_box", "forensics_logged", "token_revoked"],
                }
            )
            
        except Exception as e:
            logger.error(
                "containment_failed",
                extra={"error": str(e), "client_ip": client_ip}
            )
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"
    
    @staticmethod
    def _get_timestamp() -> str:
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat()


def inject_honeytoken_in_response(response_data: dict, 
                                   injection_key: str = "api_keys") -> dict:
    """
    Inject honeytoken into API response.
    Security: Plant fake credentials for detection.
    
    Example usage in route handler:
        @app.get("/api/settings")
        async def get_settings():
            settings = {"theme": "dark", "api_keys": ["real_key_1"]}
            return inject_honeytoken_in_response(settings)
    """
    if injection_key in response_data and isinstance(response_data[injection_key], list):
        honeytoken = honeytoken_registry.generate_honeytoken(
            token_type="api_key",
            context=f"injected_in_{injection_key}"
        )
        response_data[injection_key].append(honeytoken)
    
    return response_data
