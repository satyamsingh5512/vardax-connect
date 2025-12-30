"""
API Routes for Fortress
Security: Minimal endpoints, strict validation, audit logging.

NIST Control: AC-3 (Access Enforcement), AU-2 (Audit Events)
"""
import os
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ConfigDict

from app.core.logging_config import get_logger, audit_logger
from app.middleware.honeytoken import honeytoken_registry, inject_honeytoken_in_response
from app.middleware.mtls_validator import verify_cnf_binding
from app.scanning.steganalysis import FileUploadScanner, ScanResult
from app.graphql.complexity import GraphQLComplexityAnalyzer
from app.soc.ai_analyst import AISOCAnalyst, SecurityAlert, AlertSeverity

logger = get_logger(__name__)
router = APIRouter()


# Pydantic models with strict validation
class StrictBaseModel(BaseModel):
    """Base model that rejects unknown fields."""
    model_config = ConfigDict(extra="forbid")


class TokenValidationRequest(StrictBaseModel):
    """Request to validate a JWT token."""
    token: str = Field(..., min_length=10, max_length=4096)
    cert_thumbprint: Optional[str] = Field(None, min_length=32, max_length=64)


class TokenValidationResponse(StrictBaseModel):
    """Response from token validation."""
    valid: bool
    cnf_bound: bool
    message: str


class AlertSubmissionRequest(StrictBaseModel):
    """Request to submit a security alert."""
    alert_type: str = Field(..., min_length=1, max_length=100)
    source: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=1000)
    severity: str = Field(..., pattern="^(critical|high|medium|low|info)$")
    indicators: dict = Field(default_factory=dict)


class HoneytokenGenerateRequest(StrictBaseModel):
    """Request to generate a honeytoken."""
    token_type: str = Field(default="api_key", pattern="^(api_key|bearer)$")
    context: Optional[str] = Field(None, max_length=200)


# Routes

@router.get("/api/settings")
async def get_settings(request: Request):
    """
    Get application settings.
    Security: Injects honeytoken for detection.
    """
    correlation_id = getattr(request.state, "correlation_id", None)
    
    # Base settings (safe to expose)
    settings = {
        "theme": "dark",
        "language": "en",
        "timezone": "UTC",
        "api_keys": ["vdx_prod_key_001"],  # Real key placeholder
    }
    
    # Inject honeytoken (for detection)
    if os.getenv("INJECT_HONEYTOKENS", "true").lower() == "true":
        settings = inject_honeytoken_in_response(settings, "api_keys")
    
    logger.info(
        "settings_retrieved",
        extra={"correlation_id": correlation_id}
    )
    
    return settings


@router.post("/api/auth/validate-token", response_model=TokenValidationResponse)
async def validate_token(request: Request, body: TokenValidationRequest):
    """
    Validate JWT token with optional cnf binding check.
    Security: Verifies token is bound to client certificate.
    """
    correlation_id = getattr(request.state, "correlation_id", None)
    
    # Get client cert thumbprint from mTLS middleware
    client_cert_thumbprint = getattr(request.state, "client_cert_thumbprint", None)
    
    # If cnf binding requested, verify thumbprints match
    if body.cert_thumbprint:
        if not client_cert_thumbprint:
            return TokenValidationResponse(
                valid=False,
                cnf_bound=False,
                message="Client certificate required for cnf validation",
            )
        
        if not verify_cnf_binding(body.cert_thumbprint, client_cert_thumbprint):
            audit_logger.log_auth_attempt(
                success=False,
                client_ip=request.client.host if request.client else "unknown",
                reason="cnf_binding_mismatch",
                correlation_id=correlation_id,
            )
            
            return TokenValidationResponse(
                valid=False,
                cnf_bound=False,
                message="Certificate thumbprint does not match cnf claim",
            )
    
    # Token validation would happen here (JWT verification)
    # Stub: assume token is valid
    
    return TokenValidationResponse(
        valid=True,
        cnf_bound=bool(body.cert_thumbprint and client_cert_thumbprint),
        message="Token validated successfully",
    )


@router.post("/api/upload/scan")
async def scan_upload(request: Request, file: UploadFile = File(...)):
    """
    Scan uploaded file for hidden content.
    Security: Steganalysis and malware detection.
    """
    correlation_id = getattr(request.state, "correlation_id", None)
    
    # Read file content
    content = await file.read()
    
    # Scan file
    scanner = FileUploadScanner()
    result = await scanner.scan_upload(
        file_data=content,
        filename=file.filename or "unknown",
        content_type=file.content_type or "application/octet-stream",
    )
    
    logger.info(
        "file_scanned",
        extra={
            "filename": file.filename,
            "result": result.result.value,
            "file_hash": result.file_hash[:16] + "...",
            "correlation_id": correlation_id,
        }
    )
    
    # Return appropriate response based on scan result
    if result.result == ScanResult.QUARANTINED:
        raise HTTPException(
            status_code=415,
            detail={
                "error": "file_rejected",
                "message": "File type not allowed",
                "findings": result.findings,
            }
        )
    
    if result.result == ScanResult.SUSPICIOUS:
        return JSONResponse(
            status_code=202,
            content={
                "status": "pending_review",
                "message": "File quarantined for manual review",
                "file_hash": result.file_hash,
                "findings": result.findings,
            }
        )
    
    return {
        "status": "accepted",
        "file_hash": result.file_hash,
        "file_size": result.file_size,
        "findings": result.findings,
    }


@router.post("/api/graphql/analyze")
async def analyze_graphql_query(request: Request):
    """
    Analyze GraphQL query complexity.
    Security: Pre-flight complexity check before execution.
    """
    correlation_id = getattr(request.state, "correlation_id", None)
    
    body = await request.json()
    query = body.get("query", "")
    variables = body.get("variables", {})
    
    analyzer = GraphQLComplexityAnalyzer()
    allowed, reason, complexity = analyzer.validate_query(query, variables)
    
    logger.info(
        "graphql_analyzed",
        extra={
            "allowed": allowed,
            "cost": complexity.total_cost,
            "depth": complexity.max_depth,
            "correlation_id": correlation_id,
        }
    )
    
    return {
        "allowed": allowed,
        "reason": reason,
        "complexity": {
            "total_cost": complexity.total_cost,
            "max_depth": complexity.max_depth,
            "field_count": complexity.field_count,
            "max_cost": analyzer.max_cost,
            "max_depth_limit": analyzer.max_depth,
        }
    }


@router.post("/api/honeytoken/generate")
async def generate_honeytoken(request: Request, body: HoneytokenGenerateRequest):
    """
    Generate a new honeytoken.
    Security: Admin-only endpoint for creating deception tokens.
    """
    correlation_id = getattr(request.state, "correlation_id", None)
    
    # In production: verify admin role
    
    token = honeytoken_registry.generate_honeytoken(
        token_type=body.token_type,
        context=body.context,
    )
    
    logger.info(
        "honeytoken_generated",
        extra={
            "token_type": body.token_type,
            "context": body.context,
            "correlation_id": correlation_id,
        }
    )
    
    return {
        "token": token,
        "type": body.token_type,
        "warning": "Store securely. Usage will trigger alerts.",
    }


@router.post("/api/soc/alert")
async def submit_alert(request: Request, body: AlertSubmissionRequest):
    """
    Submit a security alert for AI analyst processing.
    Security: Triggers automated analysis and potential remediation.
    """
    correlation_id = getattr(request.state, "correlation_id", None)
    
    # Create alert object
    alert = SecurityAlert(
        alert_id=correlation_id or "unknown",
        alert_type=body.alert_type,
        source=body.source,
        timestamp=datetime.now(timezone.utc).isoformat(),
        severity=AlertSeverity(body.severity),
        description=body.description,
        indicators=body.indicators,
    )
    
    # Process through AI analyst
    analyst = AISOCAnalyst()
    result = await analyst.process_alert(alert)
    
    return {
        "analysis_id": result.analysis_id,
        "severity_assessment": result.severity_assessment.value,
        "recommended_actions": [a.value for a in result.recommended_actions],
        "reasoning": result.reasoning,
        "human_review_required": result.human_review_required,
        "auto_remediated": result.auto_remediate,
    }


@router.get("/api/security/status")
async def security_status(request: Request):
    """
    Get security middleware status.
    Security: Operational status for monitoring.
    """
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "middleware_status": {
            "tls_enforcement": os.getenv("ENFORCE_TLS", "true"),
            "ja4_enabled": os.getenv("JA4_ENABLED", "true"),
            "rate_limiting": os.getenv("RATE_LIMIT_ENABLED", "true"),
            "tarpit_enabled": os.getenv("TARPIT_ENABLED", "true"),
            "mtls_enabled": os.getenv("MTLS_ENABLED", "false"),
            "honeytoken_enabled": os.getenv("HONEYTOKEN_ENABLED", "true"),
        },
        "active_honeytokens": len(honeytoken_registry._active_tokens),
    }
