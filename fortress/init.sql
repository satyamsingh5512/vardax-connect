-- Fortress Database Initialization
-- Security: Create tables with audit logging

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,
    actor VARCHAR(100),
    resource VARCHAR(200),
    action VARCHAR(50),
    outcome VARCHAR(20),
    details JSONB,
    client_ip INET,
    correlation_id UUID
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_correlation ON audit_log(correlation_id);

-- Honeytoken tracking table
CREATE TABLE IF NOT EXISTS honeytokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    token_type VARCHAR(20) NOT NULL,
    context VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    triggered_at TIMESTAMPTZ,
    triggered_by_ip INET,
    is_active BOOLEAN DEFAULT TRUE
);

-- Rate limit violations table
CREATE TABLE IF NOT EXISTS rate_limit_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_ip INET NOT NULL,
    endpoint VARCHAR(200) NOT NULL,
    violation_count INTEGER DEFAULT 1,
    first_violation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_violation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(client_ip, endpoint)
);

-- Security alerts table
CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    source VARCHAR(100),
    description TEXT,
    indicators JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    analysis_result JSONB,
    remediation_actions JSONB
);

CREATE INDEX IF NOT EXISTS idx_alerts_severity ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON security_alerts(created_at DESC);

-- Tripwire decoy tables (see database_tripwire.py for full setup)
-- These are created by the application on startup

-- Grant permissions (adjust for production)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fortress;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO fortress;
