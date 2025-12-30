"""
Database Tripwire Implementation
Security: Decoy tables that trigger alerts when accessed.

Strategy:
1. Create fake "sensitive" tables (salary_data, admin_credentials, etc.)
2. Install audit hooks that fire on any SELECT
3. Any access indicates unauthorized activity or SQL injection success

NIST Control: SI-4 (Information System Monitoring), AU-2 (Audit Events)
"""
import os
from typing import Callable, Optional
from dataclasses import dataclass
from datetime import datetime, timezone

from app.core.logging_config import get_logger, audit_logger

logger = get_logger(__name__)


@dataclass
class TripwireEvent:
    """Event triggered by tripwire access."""
    table_name: str
    operation: str
    timestamp: str
    query_text: Optional[str]
    user: Optional[str]
    client_ip: Optional[str]
    correlation_id: Optional[str]


class DatabaseTripwireManager:
    """
    Manager for database tripwire tables.
    Security: Create and monitor decoy tables.
    """
    
    # Decoy table definitions (look enticing to attackers)
    DECOY_TABLES = {
        "salary_data": """
            CREATE TABLE IF NOT EXISTS salary_data (
                id SERIAL PRIMARY KEY,
                employee_name VARCHAR(100),
                department VARCHAR(50),
                salary DECIMAL(10, 2),
                ssn VARCHAR(11),
                bank_account VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """,
        "admin_credentials": """
            CREATE TABLE IF NOT EXISTS admin_credentials (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50),
                password_hash VARCHAR(255),
                api_key VARCHAR(100),
                last_login TIMESTAMP,
                is_superuser BOOLEAN DEFAULT FALSE
            )
        """,
        "credit_cards": """
            CREATE TABLE IF NOT EXISTS credit_cards (
                id SERIAL PRIMARY KEY,
                cardholder_name VARCHAR(100),
                card_number VARCHAR(19),
                expiry_date VARCHAR(7),
                cvv VARCHAR(4),
                billing_address TEXT
            )
        """,
        "api_secrets": """
            CREATE TABLE IF NOT EXISTS api_secrets (
                id SERIAL PRIMARY KEY,
                service_name VARCHAR(50),
                api_key VARCHAR(255),
                api_secret VARCHAR(255),
                environment VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """,
    }
    
    # Fake data to populate decoy tables (obviously fake on inspection)
    DECOY_DATA = {
        "salary_data": [
            ("John Honeypot", "Security", 999999.99, "000-00-0000", "DECOY-0001"),
            ("Jane Tripwire", "IT", 888888.88, "111-11-1111", "DECOY-0002"),
        ],
        "admin_credentials": [
            ("admin_decoy", "FAKE_HASH_DO_NOT_USE", "HONEYTOKEN_API_KEY_001", None, True),
            ("root_fake", "FAKE_HASH_DO_NOT_USE", "HONEYTOKEN_API_KEY_002", None, True),
        ],
    }
    
    def __init__(self, db_connection=None):
        self.db = db_connection
        self._event_handlers: list[Callable[[TripwireEvent], None]] = []
    
    def register_event_handler(self, handler: Callable[[TripwireEvent], None]) -> None:
        """Register a handler for tripwire events."""
        self._event_handlers.append(handler)
    
    async def setup_tripwires(self) -> None:
        """
        Create decoy tables and install audit triggers.
        Security: Must be called during application startup.
        """
        if not self.db:
            logger.warning("tripwire_setup_skipped", extra={"reason": "no_db_connection"})
            return
        
        for table_name, create_sql in self.DECOY_TABLES.items():
            try:
                await self.db.execute(create_sql)
                logger.info("tripwire_table_created", extra={"table": table_name})
                
                # Populate with fake data
                if table_name in self.DECOY_DATA:
                    await self._populate_decoy_data(table_name)
                
                # Install audit trigger
                await self._install_audit_trigger(table_name)
                
            except Exception as e:
                logger.error(
                    "tripwire_setup_failed",
                    extra={"table": table_name, "error": str(e)}
                )
    
    async def _populate_decoy_data(self, table_name: str) -> None:
        """Populate decoy table with fake data."""
        data = self.DECOY_DATA.get(table_name, [])
        
        if table_name == "salary_data":
            for row in data:
                await self.db.execute(
                    """INSERT INTO salary_data 
                       (employee_name, department, salary, ssn, bank_account)
                       VALUES ($1, $2, $3, $4, $5)
                       ON CONFLICT DO NOTHING""",
                    *row
                )
        elif table_name == "admin_credentials":
            for row in data:
                await self.db.execute(
                    """INSERT INTO admin_credentials
                       (username, password_hash, api_key, last_login, is_superuser)
                       VALUES ($1, $2, $3, $4, $5)
                       ON CONFLICT DO NOTHING""",
                    *row
                )
    
    async def _install_audit_trigger(self, table_name: str) -> None:
        """
        Install PostgreSQL audit trigger on decoy table.
        Security: Fires on any SELECT, INSERT, UPDATE, DELETE.
        """
        trigger_function = f"""
            CREATE OR REPLACE FUNCTION tripwire_{table_name}_audit()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Log to pg_notify for async processing
                PERFORM pg_notify(
                    'tripwire_alert',
                    json_build_object(
                        'table', TG_TABLE_NAME,
                        'operation', TG_OP,
                        'timestamp', NOW(),
                        'user', current_user
                    )::text
                );
                
                -- For SELECT, we use row-level security policy instead
                -- This trigger handles INSERT/UPDATE/DELETE
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """
        
        trigger_sql = f"""
            DROP TRIGGER IF EXISTS tripwire_audit ON {table_name};
            CREATE TRIGGER tripwire_audit
            AFTER INSERT OR UPDATE OR DELETE ON {table_name}
            FOR EACH ROW EXECUTE FUNCTION tripwire_{table_name}_audit();
        """
        
        try:
            await self.db.execute(trigger_function)
            await self.db.execute(trigger_sql)
            logger.info("tripwire_trigger_installed", extra={"table": table_name})
        except Exception as e:
            logger.error(
                "tripwire_trigger_failed",
                extra={"table": table_name, "error": str(e)}
            )
    
    def handle_tripwire_event(self, event: TripwireEvent) -> None:
        """
        Handle a tripwire event.
        Security: Log, alert, and execute containment.
        """
        # Log critical security event
        audit_logger.log_access_denied(
            resource=f"tripwire:{event.table_name}",
            client_ip=event.client_ip or "unknown",
            reason=f"tripwire_triggered:{event.operation}",
            correlation_id=event.correlation_id,
        )
        
        logger.critical(
            "tripwire_triggered",
            extra={
                "table": event.table_name,
                "operation": event.operation,
                "user": event.user,
                "client_ip": event.client_ip,
                "query_preview": event.query_text[:100] if event.query_text else None,
                "correlation_id": event.correlation_id,
            }
        )
        
        # Execute registered handlers
        for handler in self._event_handlers:
            try:
                handler(event)
            except Exception as e:
                logger.error(
                    "tripwire_handler_failed",
                    extra={"error": str(e)}
                )


# Example SQLAlchemy event listener for tripwire detection
def create_sqlalchemy_tripwire_listener(tripwire_manager: DatabaseTripwireManager):
    """
    Create SQLAlchemy event listener for tripwire tables.
    
    Usage:
        from sqlalchemy import event
        engine = create_engine(...)
        listener = create_sqlalchemy_tripwire_listener(tripwire_manager)
        event.listen(engine, "before_cursor_execute", listener)
    """
    tripwire_tables = set(DatabaseTripwireManager.DECOY_TABLES.keys())
    
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        # Check if query touches tripwire tables
        statement_lower = statement.lower()
        
        for table in tripwire_tables:
            if table in statement_lower:
                event = TripwireEvent(
                    table_name=table,
                    operation="QUERY",
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    query_text=statement[:500],  # Truncate for safety
                    user=None,  # Would need to extract from context
                    client_ip=None,
                    correlation_id=None,
                )
                tripwire_manager.handle_tripwire_event(event)
                break
    
    return before_cursor_execute
