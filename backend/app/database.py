"""
Database Integration for VARDAx.

Supports:
- SQLite (default, for development/demo)
- PostgreSQL (for production)

Set VARDAX_DATABASE_URL environment variable to configure.
"""
import os
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from contextlib import contextmanager
import sqlite3
import logging

logger = logging.getLogger(__name__)

# Database URL from environment (default: SQLite)
DATABASE_URL = os.getenv("VARDAX_DATABASE_URL", "sqlite:///./vardax.db")


class DatabaseManager:
    """
    Database manager supporting SQLite and PostgreSQL.
    
    For hackathon simplicity, uses SQLite by default.
    Set VARDAX_DATABASE_URL=postgresql://... for production.
    """
    
    def __init__(self, db_url: str = None):
        self.db_url = db_url or DATABASE_URL
        self.is_postgres = self.db_url.startswith("postgresql")
        self.connection = None
        self._init_db()
    
    def _init_db(self):
        """Initialize database tables."""
        if self.is_postgres:
            self._init_postgres()
        else:
            self._init_sqlite()
    
    def _init_sqlite(self):
        """Initialize SQLite database."""
        db_path = self.db_url.replace("sqlite:///", "")
        self.connection = sqlite3.connect(db_path, check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        
        cursor = self.connection.cursor()
        
        # Create tables
        cursor.executescript("""
            -- Traffic events table
            CREATE TABLE IF NOT EXISTS traffic_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT UNIQUE NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                client_ip TEXT NOT NULL,
                method TEXT NOT NULL,
                uri TEXT NOT NULL,
                user_agent TEXT,
                status_code INTEGER DEFAULT 200,
                response_time_ms REAL DEFAULT 0,
                content_length INTEGER DEFAULT 0,
                is_anomaly BOOLEAN DEFAULT FALSE,
                anomaly_score REAL DEFAULT 0,
                severity TEXT DEFAULT 'normal',
                attack_category TEXT,
                features_json TEXT,
                explanations_json TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Anomalies table
            CREATE TABLE IF NOT EXISTS anomalies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                anomaly_id TEXT UNIQUE NOT NULL,
                request_id TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                client_ip TEXT NOT NULL,
                uri TEXT NOT NULL,
                method TEXT,
                severity TEXT NOT NULL,
                confidence REAL NOT NULL,
                attack_category TEXT,
                scores_json TEXT,
                explanations_json TEXT,
                features_json TEXT,
                status TEXT DEFAULT 'new',
                feedback TEXT,
                feedback_notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Rules table
            CREATE TABLE IF NOT EXISTS rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id TEXT UNIQUE NOT NULL,
                rule_type TEXT NOT NULL,
                rule_content TEXT NOT NULL,
                rule_description TEXT,
                confidence REAL DEFAULT 0,
                false_positive_estimate REAL DEFAULT 0,
                source_anomaly_ids TEXT,
                anomaly_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                approved_by TEXT,
                approved_at DATETIME,
                version INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Feedback table
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                anomaly_id TEXT NOT NULL,
                feedback_type TEXT NOT NULL,
                analyst_id TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_events_timestamp ON traffic_events(timestamp);
            CREATE INDEX IF NOT EXISTS idx_events_client_ip ON traffic_events(client_ip);
            CREATE INDEX IF NOT EXISTS idx_events_is_anomaly ON traffic_events(is_anomaly);
            CREATE INDEX IF NOT EXISTS idx_anomalies_timestamp ON anomalies(timestamp);
            CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity);
            CREATE INDEX IF NOT EXISTS idx_rules_status ON rules(status);
        """)
        
        self.connection.commit()
        logger.info(f"SQLite database initialized: {db_path}")
    
    def _init_postgres(self):
        """Initialize PostgreSQL database."""
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            
            self.connection = psycopg2.connect(self.db_url)
            cursor = self.connection.cursor()
            
            # Create tables (PostgreSQL syntax)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS traffic_events (
                    id SERIAL PRIMARY KEY,
                    event_id TEXT UNIQUE NOT NULL,
                    timestamp TIMESTAMPTZ DEFAULT NOW(),
                    client_ip TEXT NOT NULL,
                    method TEXT NOT NULL,
                    uri TEXT NOT NULL,
                    user_agent TEXT,
                    status_code INTEGER DEFAULT 200,
                    response_time_ms REAL DEFAULT 0,
                    content_length INTEGER DEFAULT 0,
                    is_anomaly BOOLEAN DEFAULT FALSE,
                    anomaly_score REAL DEFAULT 0,
                    severity TEXT DEFAULT 'normal',
                    attack_category TEXT,
                    features_json JSONB,
                    explanations_json JSONB,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                
                CREATE TABLE IF NOT EXISTS anomalies (
                    id SERIAL PRIMARY KEY,
                    anomaly_id TEXT UNIQUE NOT NULL,
                    request_id TEXT,
                    timestamp TIMESTAMPTZ DEFAULT NOW(),
                    client_ip TEXT NOT NULL,
                    uri TEXT NOT NULL,
                    method TEXT,
                    severity TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    attack_category TEXT,
                    scores_json JSONB,
                    explanations_json JSONB,
                    features_json JSONB,
                    status TEXT DEFAULT 'new',
                    feedback TEXT,
                    feedback_notes TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                
                CREATE TABLE IF NOT EXISTS rules (
                    id SERIAL PRIMARY KEY,
                    rule_id TEXT UNIQUE NOT NULL,
                    rule_type TEXT NOT NULL,
                    rule_content TEXT NOT NULL,
                    rule_description TEXT,
                    confidence REAL DEFAULT 0,
                    false_positive_estimate REAL DEFAULT 0,
                    source_anomaly_ids TEXT,
                    anomaly_count INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'pending',
                    approved_by TEXT,
                    approved_at TIMESTAMPTZ,
                    version INTEGER DEFAULT 1,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                
                CREATE TABLE IF NOT EXISTS feedback (
                    id SERIAL PRIMARY KEY,
                    anomaly_id TEXT NOT NULL,
                    feedback_type TEXT NOT NULL,
                    analyst_id TEXT,
                    notes TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                
                CREATE INDEX IF NOT EXISTS idx_events_timestamp ON traffic_events(timestamp);
                CREATE INDEX IF NOT EXISTS idx_events_client_ip ON traffic_events(client_ip);
                CREATE INDEX IF NOT EXISTS idx_anomalies_timestamp ON anomalies(timestamp);
            """)
            
            self.connection.commit()
            logger.info("PostgreSQL database initialized")
            
        except ImportError:
            logger.warning("psycopg2 not installed. Falling back to SQLite.")
            self.is_postgres = False
            self.db_url = "sqlite:///./vardax.db"
            self._init_sqlite()
    
    def _execute(self, query: str, params: tuple = None) -> sqlite3.Cursor:
        """Execute a query."""
        cursor = self.connection.cursor()
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        self.connection.commit()
        return cursor
    
    # ========================================================================
    # TRAFFIC EVENTS
    # ========================================================================
    
    def save_traffic_event(self, event: Dict[str, Any]) -> str:
        """Save a traffic event to database."""
        event_id = event.get("event_id") or event.get("request_id") or f"evt-{datetime.utcnow().timestamp()}"
        
        self._execute("""
            INSERT OR REPLACE INTO traffic_events 
            (event_id, timestamp, client_ip, method, uri, user_agent, status_code,
             response_time_ms, content_length, is_anomaly, anomaly_score, severity,
             attack_category, features_json, explanations_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            event_id,
            event.get("timestamp", datetime.utcnow().isoformat()),
            event.get("client_ip", "unknown"),
            event.get("method", "GET"),
            event.get("uri", "/"),
            event.get("user_agent", ""),
            event.get("status_code", 200),
            event.get("response_time_ms", 0),
            event.get("content_length", 0),
            event.get("is_anomaly", False),
            event.get("anomaly_score", 0),
            event.get("severity", "normal"),
            event.get("attack_category"),
            json.dumps(event.get("features", {})),
            json.dumps(event.get("explanations", []))
        ))
        
        return event_id
    
    def get_traffic_events(
        self,
        since_minutes: int = 60,
        limit: int = 500,
        severity: str = None,
        ip: str = None
    ) -> List[Dict[str, Any]]:
        """Get recent traffic events."""
        cutoff = (datetime.utcnow() - timedelta(minutes=since_minutes)).isoformat()
        
        query = "SELECT * FROM traffic_events WHERE timestamp > ?"
        params = [cutoff]
        
        if severity:
            query += " AND severity = ?"
            params.append(severity)
        
        if ip:
            query += " AND client_ip = ?"
            params.append(ip)
        
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        
        cursor = self._execute(query, tuple(params))
        rows = cursor.fetchall()
        
        return [self._row_to_dict(row) for row in rows]
    
    # ========================================================================
    # ANOMALIES
    # ========================================================================
    
    def save_anomaly(self, anomaly: Dict[str, Any]) -> str:
        """Save an anomaly to database."""
        anomaly_id = anomaly.get("anomaly_id", f"anom-{datetime.utcnow().timestamp()}")
        
        self._execute("""
            INSERT OR REPLACE INTO anomalies
            (anomaly_id, request_id, timestamp, client_ip, uri, method, severity,
             confidence, attack_category, scores_json, explanations_json, features_json, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            anomaly_id,
            anomaly.get("request_id"),
            anomaly.get("timestamp", datetime.utcnow().isoformat()),
            anomaly.get("client_ip", "unknown"),
            anomaly.get("uri", "/"),
            anomaly.get("method", "GET"),
            anomaly.get("severity", "low"),
            anomaly.get("confidence", 0),
            anomaly.get("attack_category"),
            json.dumps(anomaly.get("scores", {})),
            json.dumps(anomaly.get("explanations", [])),
            json.dumps(anomaly.get("features", {})),
            anomaly.get("status", "new")
        ))
        
        return anomaly_id
    
    def get_anomalies(
        self,
        since_minutes: int = 60,
        limit: int = 100,
        severity: str = None
    ) -> List[Dict[str, Any]]:
        """Get recent anomalies."""
        cutoff = (datetime.utcnow() - timedelta(minutes=since_minutes)).isoformat()
        
        query = "SELECT * FROM anomalies WHERE timestamp > ?"
        params = [cutoff]
        
        if severity:
            query += " AND severity = ?"
            params.append(severity)
        
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        
        cursor = self._execute(query, tuple(params))
        rows = cursor.fetchall()
        
        return [self._row_to_dict(row) for row in rows]
    
    def get_anomaly(self, anomaly_id: str) -> Optional[Dict[str, Any]]:
        """Get a single anomaly by ID."""
        cursor = self._execute(
            "SELECT * FROM anomalies WHERE anomaly_id = ?",
            (anomaly_id,)
        )
        row = cursor.fetchone()
        return self._row_to_dict(row) if row else None
    
    def update_anomaly_feedback(
        self,
        anomaly_id: str,
        feedback_type: str,
        notes: str = None
    ) -> bool:
        """Update anomaly with feedback."""
        self._execute("""
            UPDATE anomalies 
            SET feedback = ?, feedback_notes = ?, status = 'reviewed'
            WHERE anomaly_id = ?
        """, (feedback_type, notes, anomaly_id))
        
        # Also save to feedback table
        self._execute("""
            INSERT INTO feedback (anomaly_id, feedback_type, notes)
            VALUES (?, ?, ?)
        """, (anomaly_id, feedback_type, notes))
        
        return True
    
    # ========================================================================
    # RULES
    # ========================================================================
    
    def save_rule(self, rule: Dict[str, Any]) -> str:
        """Save a rule to database."""
        rule_id = rule.get("rule_id", f"rule-{datetime.utcnow().timestamp()}")
        
        self._execute("""
            INSERT OR REPLACE INTO rules
            (rule_id, rule_type, rule_content, rule_description, confidence,
             false_positive_estimate, source_anomaly_ids, anomaly_count, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rule_id,
            rule.get("rule_type", "unknown"),
            rule.get("rule_content", ""),
            rule.get("rule_description", ""),
            rule.get("confidence", 0),
            rule.get("false_positive_estimate", 0),
            json.dumps(rule.get("source_anomaly_ids", [])),
            rule.get("anomaly_count", 0),
            rule.get("status", "pending")
        ))
        
        return rule_id
    
    def get_rules(self, status: str = None) -> List[Dict[str, Any]]:
        """Get rules, optionally filtered by status."""
        if status:
            cursor = self._execute(
                "SELECT * FROM rules WHERE status = ? ORDER BY created_at DESC",
                (status,)
            )
        else:
            cursor = self._execute("SELECT * FROM rules ORDER BY created_at DESC")
        
        rows = cursor.fetchall()
        return [self._row_to_dict(row) for row in rows]
    
    def update_rule_status(
        self,
        rule_id: str,
        status: str,
        approved_by: str = None
    ) -> bool:
        """Update rule status."""
        if status == "approved":
            self._execute("""
                UPDATE rules 
                SET status = ?, approved_by = ?, approved_at = ?
                WHERE rule_id = ?
            """, (status, approved_by, datetime.utcnow().isoformat(), rule_id))
        else:
            self._execute(
                "UPDATE rules SET status = ? WHERE rule_id = ?",
                (status, rule_id)
            )
        return True
    
    # ========================================================================
    # UTILITIES
    # ========================================================================
    
    def _row_to_dict(self, row) -> Dict[str, Any]:
        """Convert database row to dictionary."""
        if row is None:
            return None
        
        d = dict(row)
        
        # Parse JSON fields
        for key in ['features_json', 'explanations_json', 'scores_json', 'source_anomaly_ids']:
            if key in d and d[key]:
                try:
                    d[key.replace('_json', '')] = json.loads(d[key])
                except:
                    pass
                del d[key]
        
        return d
    
    def clear_all_data(self):
        """Clear all data from database (for testing/reset)."""
        self._execute("DELETE FROM traffic_events")
        self._execute("DELETE FROM anomalies")
        self._execute("DELETE FROM rules")
        self._execute("DELETE FROM feedback")
        logger.info("All database data cleared")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get database statistics."""
        stats = {}
        
        for table in ['traffic_events', 'anomalies', 'rules', 'feedback']:
            cursor = self._execute(f"SELECT COUNT(*) as count FROM {table}")
            stats[table] = cursor.fetchone()['count']
        
        return stats
    
    def close(self):
        """Close database connection."""
        if self.connection:
            self.connection.close()


# Global database instance
_db: Optional[DatabaseManager] = None


def get_db() -> DatabaseManager:
    """Get database instance (singleton)."""
    global _db
    if _db is None:
        _db = DatabaseManager()
    return _db


def init_db(db_url: str = None) -> DatabaseManager:
    """Initialize database with custom URL."""
    global _db
    _db = DatabaseManager(db_url)
    return _db
