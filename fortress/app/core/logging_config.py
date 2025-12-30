"""
Structured Logging Configuration
Security: JSON logs, correlation IDs, sensitive data never logged.

NIST Control: AU-2 (Audit Events), AU-3 (Content of Audit Records)
"""
import logging
import json
import sys
from datetime import datetime, timezone
from typing import Any, Dict


class StructuredFormatter(logging.Formatter):
    """
    JSON formatter for structured logging.
    Security: Ensures consistent format for SIEM ingestion.
    """
    
    SENSITIVE_KEYS = frozenset({
        "password", "secret", "token", "key", "authorization",
        "cookie", "session", "credential", "api_key", "private"
    })
    
    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        
        # Add correlation ID if available
        if hasattr(record, "correlation_id"):
            log_entry["correlation_id"] = record.correlation_id
        
        # Add extra fields (redact sensitive data)
        if hasattr(record, "__dict__"):
            for key, value in record.__dict__.items():
                if key not in ("name", "msg", "args", "created", "filename",
                              "funcName", "levelname", "levelno", "lineno",
                              "module", "msecs", "pathname", "process",
                              "processName", "relativeCreated", "stack_info",
                              "exc_info", "exc_text", "thread", "threadName",
                              "message", "correlation_id"):
                    # Redact sensitive fields
                    if any(sensitive in key.lower() for sensitive in self.SENSITIVE_KEYS):
                        log_entry[key] = "[REDACTED]"
                    else:
                        log_entry[key] = value
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        return json.dumps(log_entry, default=str)


def setup_logging(level: str = "INFO") -> None:
    """
    Configure structured logging for the application.
    Security: Centralized logging config, no ad-hoc loggers.
    """
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Add structured JSON handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredFormatter())
    root_logger.addHandler(handler)
    
    # Suppress noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance with the given name."""
    return logging.getLogger(name)


class SecurityAuditLogger:
    """
    Dedicated logger for security events.
    Security: Separate audit trail for security-relevant events.
    NIST Control: AU-6 (Audit Review, Analysis, and Reporting)
    """
    
    def __init__(self):
        self.logger = get_logger("security.audit")
    
    def log_auth_attempt(self, success: bool, client_ip: str, 
                         user_id: str = None, reason: str = None,
                         correlation_id: str = None) -> None:
        """Log authentication attempt."""
        self.logger.info(
            "auth_attempt",
            extra={
                "event_type": "authentication",
                "success": success,
                "client_ip": client_ip,
                "user_id": user_id or "[anonymous]",
                "reason": reason,
                "correlation_id": correlation_id,
            }
        )
    
    def log_access_denied(self, resource: str, client_ip: str,
                          reason: str, correlation_id: str = None) -> None:
        """Log access denial."""
        self.logger.warning(
            "access_denied",
            extra={
                "event_type": "authorization",
                "resource": resource,
                "client_ip": client_ip,
                "reason": reason,
                "correlation_id": correlation_id,
            }
        )
    
    def log_honeytoken_triggered(self, token_id: str, client_ip: str,
                                  endpoint: str, correlation_id: str = None) -> None:
        """Log honeytoken usage (critical security event)."""
        self.logger.critical(
            "honeytoken_triggered",
            extra={
                "event_type": "deception",
                "token_id": token_id,
                "client_ip": client_ip,
                "endpoint": endpoint,
                "correlation_id": correlation_id,
                "action_required": True,
            }
        )
    
    def log_rate_limit_exceeded(self, client_ip: str, endpoint: str,
                                 limit: int, correlation_id: str = None) -> None:
        """Log rate limit violation."""
        self.logger.warning(
            "rate_limit_exceeded",
            extra={
                "event_type": "rate_limiting",
                "client_ip": client_ip,
                "endpoint": endpoint,
                "limit": limit,
                "correlation_id": correlation_id,
            }
        )


# Global audit logger instance
audit_logger = SecurityAuditLogger()
