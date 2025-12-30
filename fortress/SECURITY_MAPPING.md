# Security Controls Mapping

## NIST SP 800-53 Control Alignment

| Feature | Control ID | Control Name | Implementation |
|---------|-----------|--------------|----------------|
| TLS Enforcement | SC-8 | Transmission Confidentiality and Integrity | Middleware rejects non-TLS connections, enforces HSTS |
| TLS Enforcement | SC-23 | Session Authenticity | TLS 1.2+ required, certificate validation |
| JA4+ Fingerprinting | IA-3 | Device Identification and Authentication | TLS ClientHello analysis for client classification |
| JA4+ Fingerprinting | SI-4 | Information System Monitoring | Fingerprint tracking and anomaly detection |
| Rate Limiting | SC-5 | Denial of Service Protection | Token bucket algorithm, per-IP and per-endpoint limits |
| Rate Limiting | AC-10 | Concurrent Session Control | Limits concurrent requests from single source |
| Tarpit/Penalty Box | SC-5 | Denial of Service Protection | Progressive delays waste attacker resources |
| Tarpit/Penalty Box | SI-4 | Information System Monitoring | Track repeat offenders |
| mTLS Validation | IA-2 | Identification and Authentication | Client certificate required for sensitive endpoints |
| mTLS Validation | IA-5 | Authenticator Management | Certificate validation against private CA |
| cnf-bound Tokens | IA-5 | Authenticator Management | JWT bound to client certificate thumbprint |
| Schema Validation | SI-10 | Information Input Validation | Reject unknown fields, content-type enforcement |
| Honeytoken Detection | SI-4 | Information System Monitoring | Detect usage of planted fake credentials |
| Honeytoken Detection | IR-4 | Incident Handling | Automatic containment on detection |
| Database Tripwires | SI-4 | Information System Monitoring | Audit hooks on decoy tables |
| Database Tripwires | AU-2 | Audit Events | Log all access to sensitive decoys |
| GraphQL Complexity | SC-5 | Denial of Service Protection | Reject expensive queries |
| Steganalysis | SI-3 | Malicious Code Protection | Scan uploads for hidden content |
| Steganalysis | SC-18 | Mobile Code | Quarantine suspicious files |
| AI SOC Analyst | IR-4 | Incident Handling | Automated alert processing |
| AI SOC Analyst | IR-5 | Incident Monitoring | Continuous alert analysis |
| Structured Logging | AU-2 | Audit Events | JSON logs with correlation IDs |
| Structured Logging | AU-3 | Content of Audit Records | Comprehensive event details |
| Structured Logging | AU-6 | Audit Review, Analysis, and Reporting | SIEM-compatible format |

## FIPS 140-3 Considerations

| Component | Requirement | Implementation Notes |
|-----------|-------------|---------------------|
| TLS | FIPS-approved algorithms | Use TLS 1.2+ with AES-GCM, SHA-256+ |
| Certificates | RSA 2048+ or ECDSA P-256+ | CA uses RSA 4096 |
| JWT Signing | FIPS-approved algorithms | RS256 (RSA with SHA-256) |
| Hashing | SHA-256 or SHA-3 | SHA-256 for thumbprints |
| Random Numbers | DRBG compliant | Python secrets module uses OS CSPRNG |
| Key Storage | HSM recommended | AWS KMS with FIPS 140-2 Level 3 HSMs |

## Cryptographic Module Status

| Library | FIPS Status | Notes |
|---------|-------------|-------|
| cryptography | Uses OpenSSL | OpenSSL can be FIPS-validated |
| python-jose | Uses cryptography | Inherits FIPS status |
| hashlib | Uses OpenSSL | SHA-256 is FIPS-approved |

## Defense-in-Depth Layers

```
Layer 1: Network (TLS Enforcement)
    ↓
Layer 2: Identity (JA4+ Fingerprinting)
    ↓
Layer 3: Rate Control (Token Bucket)
    ↓
Layer 4: Penalty (Tarpit)
    ↓
Layer 5: Authentication (mTLS + cnf)
    ↓
Layer 6: Input Validation (Schema)
    ↓
Layer 7: Deception (Honeytokens)
    ↓
Layer 8: Application
```

## Audit Trail Requirements

All security events are logged with:
- Timestamp (ISO 8601 UTC)
- Correlation ID (UUID)
- Event type
- Actor (user/IP)
- Resource accessed
- Action taken
- Outcome (success/failure)
- Additional context (JSON)

Sensitive data is NEVER logged:
- Passwords
- API keys
- Session tokens
- PII
- Certificate private keys
