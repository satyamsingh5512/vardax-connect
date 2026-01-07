-- TimescaleDB Initialization Schema for Sentinelas
-- Creates hypertables for efficient time-series storage

-- Create extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Alerts table (time-series)
CREATE TABLE IF NOT EXISTS alerts (
    time TIMESTAMPTZ NOT NULL,
    alert_id TEXT NOT NULL,
    request_id TEXT,
    source_ip INET,
    attack_type TEXT,
    severity FLOAT,
    verdict TEXT,
    anomaly_score FLOAT,
    confidence FLOAT,
    uri TEXT,
    method TEXT,
    user_agent TEXT,
    ja4_fingerprint TEXT,
    shap_summary TEXT,
    rule_generated BOOLEAN DEFAULT FALSE,
    rule_id INTEGER,
    inference_time_us INTEGER,
    metadata JSONB
);

-- Convert to hypertable
SELECT create_hypertable('alerts', 'time', if_not_exists => TRUE);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_alerts_source_ip ON alerts (source_ip, time DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_attack_type ON alerts (attack_type, time DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_ja4 ON alerts (ja4_fingerprint, time DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts (severity DESC, time DESC);

-- JA4 fingerprints table
CREATE TABLE IF NOT EXISTS ja4_fingerprints (
    time TIMESTAMPTZ NOT NULL,
    fingerprint TEXT NOT NULL,
    source_ip INET,
    request_count INTEGER DEFAULT 1,
    attack_count INTEGER DEFAULT 0,
    last_seen TIMESTAMPTZ,
    first_seen TIMESTAMPTZ,
    is_malicious BOOLEAN DEFAULT FALSE,
    metadata JSONB
);

SELECT create_hypertable('ja4_fingerprints', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_ja4_fingerprint ON ja4_fingerprints (fingerprint, time DESC);

-- Generated rules table
CREATE TABLE IF NOT EXISTS generated_rules (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    rule_id INTEGER UNIQUE NOT NULL,
    secrule TEXT NOT NULL,
    pattern TEXT,
    attack_type TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_redos_safe BOOLEAN,
    false_positive_rate FLOAT,
    trigger_count INTEGER DEFAULT 0,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_rules_attack_type ON generated_rules (attack_type);
CREATE INDEX IF NOT EXISTS idx_rules_active ON generated_rules (is_active);

-- Request features (for training data collection)
CREATE TABLE IF NOT EXISTS request_features (
    time TIMESTAMPTZ NOT NULL,
    request_id TEXT NOT NULL,
    source_ip INET,
    header_entropy FLOAT,
    header_count INTEGER,
    uri_length INTEGER,
    query_param_count INTEGER,
    path_depth INTEGER,
    special_char_count INTEGER,
    has_sql_keywords BOOLEAN,
    has_script_tags BOOLEAN,
    anomaly_score FLOAT,
    verdict TEXT,
    features FLOAT[],
    metadata JSONB
);

SELECT create_hypertable('request_features', 'time', if_not_exists => TRUE);

-- Continuous aggregates for dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS alerts_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    attack_type,
    COUNT(*) as count,
    AVG(severity) as avg_severity,
    AVG(anomaly_score) as avg_anomaly_score,
    AVG(inference_time_us) as avg_inference_time_us
FROM alerts
GROUP BY bucket, attack_type
WITH NO DATA;

-- Refresh policy
SELECT add_continuous_aggregate_policy('alerts_hourly',
    start_offset => INTERVAL '1 day',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);

-- Retention policy (keep 30 days)
SELECT add_retention_policy('alerts', INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_retention_policy('request_features', INTERVAL '7 days', if_not_exists => TRUE);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sentinelas;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sentinelas;
