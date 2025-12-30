# VARDAx Fortress Middleware Stack

**Defense-Grade Security Middleware for High-Value Web Platforms**

> "Assume hostilities. Trust nothing. Log everything. Fail deterministically."

## Overview

Fortress is a FastAPI middleware stack implementing defense-in-depth security controls aligned with NIST SP 800-53 and FIPS 140-3 requirements. Designed for federal-grade deployments where security is non-negotiable.

## Features

- **Tarpit/Penalty Box**: Redis-backed progressive delays for suspicious clients
- **mTLS Enforcement**: Client certificate validation with cnf-bound JWT tokens
- **JA4+ Fingerprinting**: TLS ClientHello analysis for client classification
- **Distributed Rate Limiting**: Redis + Lua token-bucket with CRDT patterns
- **GraphQL Complexity Analysis**: AST cost evaluation with depth limits
- **Honeytoken Detection**: Fake credential injection and usage detection
- **Database Tripwires**: Audit hooks on decoy tables
- **Steganalysis Pipeline**: LSB analysis for upload scanning
- **AI SOC Agent Stub**: Deterministic alert enrichment and remediation

## Quick Start

```bash
# Clone and enter directory
cd fortress

# Start all services
docker-compose up -d

# Run tests
docker-compose exec app pytest -v

# Check health
curl http://localhost:8000/health
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRAEFIK (TLS/mTLS)                       │
│                    JA4+ Header Injection                        │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                     FORTRESS MIDDLEWARE STACK                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ TLS/Host    │→│ JA4+ Check  │→│ Rate Limit  │→│ Tarpit    │ │
│  │ Enforcement │ │ Fingerprint │ │ Token Bucket│ │ Penalty   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ mTLS/cnf    │→│ Schema      │→│ GraphQL     │→│ Honeytoken│ │
│  │ Validation  │ │ Validation  │ │ Complexity  │ │ Detection │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                      FASTAPI APPLICATION                         │
└─────────────────────────────────────────────────────────────────┘
```

## Environment Variables

```bash
# Required (use vault/KMS in production)
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost:5432/fortress
JWT_PUBLIC_KEY_PATH=/secrets/jwt_public.pem
CA_CERT_PATH=/secrets/ca.crt

# Optional
LOG_LEVEL=INFO
TARPIT_MAX_DELAY_MS=30000
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_SEC=60
```

## Security Controls Mapping

See SECURITY_MAPPING.md for NIST 800-53 control alignment.

## License

MIT License - See LICENSE file.
