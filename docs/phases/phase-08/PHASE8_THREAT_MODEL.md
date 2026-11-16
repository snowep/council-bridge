# Phase 8 Threat Model

## Scope

Threat modeling for Council Bridge Phase 8 security hardening.

**IN SCOPE:**
- MCP endpoint communication
- Runtime authentication
- Authorization bypass
- Database integrity
- Execution request manipulation
- Cross-division information access

**OUT OF SCOPE:**
- Physical security
- Network infrastructure
- Cloud service security
- User behavior analysis

## Assets

| Asset | Classification | Value | Threat |
|-------|----------------|-------|--------|
| Memory entries | Confidential | High | Exposure of sensitive planning |
| Execution requests | Operational | Medium | Unauthorized actions |
| Approval requests | Confidential | High | Bypass authorization |
| Audit logs | Compliance | High | Tampering destroys evidence |
| Founder identity | Critical | Maximum | Full system compromise |
| Cross-division shares | Confidential | High | IP leakage |

## Threat Actors

| Actor | Motivation | Capability | Access Method |
|-------|------------|------------|---------------|
| Malicious Claude Code session | Gain unauthorized access | Full MCP client | Compromised/impersonated session |
| Malicious Hermes session | Same as above | Same | Same |
| Compromised staff agent | Access division memories | Limited | Direct tool invocation |
| Insider (legitimate but malicious) | Abuse authority | Full role access | Normal operations |
| Network attacker | Intercept/modify | Network-level | MITM on localhost? |

## Attack Vectors

### 1. Founder Identity Spoofing

**Vector:** Any MCP session claims `owner_id: 'founder'`

**Current Implementation:**
```typescript
// src/council.ts - line ~2810
isFounder(ctx) {
  return ctx.owner_type === 'founder';
}
```

**Attack:**
```json
{
  "owner_type": "founder",
  "owner_id": "founder",
  "runtime": "claude"
}
```

**Impact:** Full system access, all tools, all data

**Verification:** ✅ Confirmed in codebase - no cryptographic verification

**Risk Level:** P0 - Critical

### 2. Runtime Impersonation

**Vector:** Any session claims to be 'claude' or 'hermes'

**Current Implementation:**
```typescript
// Runtime validation in multiple places
ctx.runtime === 'claude' || ctx.runtime === 'hermes'
```

**Attack:**
```json
{
  "owner_type": "staff",
  "owner_id": "staff-001",
  "runtime": "claude"
}
```
Any session can claim any runtime.

**Impact:** Confusion, audit trail corruption, potential bypass of runtime-specific logic

**Verification:** ✅ Confirmed - runtime is self-declared, no verification

**Risk Level:** P0 - Critical

### 3. Cross-Division Memory Access Bypass

**Vector:** Manipulate share queries to access other divisions' memories

**Current Implementation:**
```typescript
// src/council.ts - getMemoryWithShare
const shares = dbInstance.stmt.getCrossDivisionShares.get(memoryId) 
  as CrossDivisionShare[];
return shares.some(s => s.division_id === ctx.owner_id && s.revoked_at IS NULL);
```

**Attack:** Modify SQL or database to create fake shares

**Impact:** Access to confidential cross-division information

**Verification:** ✅ Schema has FK to memory_entries, but query logic could be manipulated

**Risk Level:** P1 - High

### 4. Execution Request Status Manipulation

**Vector:** Direct database modification or API abuse

**Current Implementation:**
- Status transitions not fully protected
- Direct updates possible via database

**Attack:**
1. Insert execution with status 'completed' directly
2. Modify status via unexposed database access

**Impact:** Bypass approval workflow, false audit records

**Verification:** ✅ Status transitions in code but no DB-level constraints

**Risk Level:** P1 - High

### 5. Audit Log Tampering

**Vector:** Modify or delete memory_access records

**Current Implementation:**
```sql
CREATE TABLE memory_access (
  ...
  FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
  ...
);
```

**Attack:** Delete or modify records directly in SQLite file

**Impact:** Destroy evidence of unauthorized access

**Verification:** ✅ Records can be modified/deleted (no immutability)

**Risk Level:** P2 - Medium

### 6. Session Hijacking

**Vector:** Steal/inject session context

**Attack:** If MCP context is stored in shared state, another process could read/modify

**Impact:** Impersonation of legitimate user

**Verification:** Need to check session storage mechanism

**Risk Level:** P2 - Medium

## Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    TRUSTED BOUNDARY                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              COUNCIL BRIDGE PROCESS                  │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │  │
│  │  │  MCP Server │  │  Service     │  │  Database  │ │  │
│  │  │             │  │   Layer      │  │   (SQLite) │ │  │
│  │  └─────────────┘  └──────────────┘  └────────────┘ │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────┬───────────────────────────────────┘
                        │
                        │  (Trusted input only after auth)
                        │
┌───────────────────────▼───────────────────────────────────┐
│                    UNTRUSTED BOUNDARY                     │
│  ┌─────────────┐         ┌─────────────┐                  │
│  │  Claude     │         │  Hermes     │                  │
│  │  Code MCP   │         │  MCP        │                  │
│  └─────────────┘         └─────────────┘                  │
│  (Untrusted - claims identity, untrusted input)           │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Trust Analysis

### Memory Creation Flow

```
1. MCP Request → 2. Zod Validation → 3. Auth Check → 4. DB Insert → 5. Memory Access Log
                        ↓                    ↓              ↓
                   (trusted)           (trusted)        (trusted)
```

**Weak Point:** Step 3 - Founder check is string match only

### Cross-Division Share Flow

```
Request → Validation → Division Head Check → DB Update → Memory Access Log
```

**Weak Point:** Memory access log uses invalid share_id (Phase 7 bug)

## Threat Summary Table

| ID | Threat | Likelihood | Impact | Risk | Status | Mitigation |
|----|--------|------------|--------|------|--------|------------|
| T1 | Founder spoofing | High | Critical | P0 | Confirmed | Cryptographic identity |
| T2 | Runtime impersonation | High | Medium | P0 | Confirmed | Challenge-response auth |
| T3 | Cross-division bypass | Medium | High | P1 | Potential | Centralized permissions |
| T4 | Status manipulation | Medium | High | P1 | Potential | Status guards |
| T5 | Audit log tampering | Low | High | P2 | Possible | Immutable tables |
| T6 | Session hijacking | Low | Medium | P2 | Unknown | Secure session storage |

## STRIDE Analysis

| STRIDE Category | Affected Component | Finding |
|-----------------|-------------------|---------|
| Spoofing | Runtime identity | ✅ Verified - sessions self-declare with no verification |
| Tampering | Audit logs | ✅ Verified - records can be modified |
| Repudiation | Execution history | ⚠️ Risk - no cryptographic proof |
| Information Disclosure | Cross-division shares | ⚠️ Risk - complex query logic |
| Denial of Service | MCP endpoints | ⚠️ Risk - no rate limiting |
| Elevation of Privilege | Authorization | ⚠️ Risk - Decentralized checks |

## Mitigations Required

### P0 - Must Fix

1. **Founder Authentication**
   - Generate founder key pair
   - Sign requests with private key
   - Verify signature on each request
   - Location: MCP wrapper (server.ts)

2. **Session Token Authentication**
   - Generate token at session start
   - Include token in each request
   - Validate token before processing
   - Location: MCP wrapper

### P1 - Should Fix

3. **Status Transition Guards**
   - Define valid status transitions
   - Enforce at application layer
   - Log invalid attempts
   - Location: execution requests

4. **Centralized Permissions**
   - Create permission registry
   - Replace scattered checks
   - Add audit logging
   - Location: New module

### P2 - Address if Resources Allow

5. **Audit Log Immutability**
   - Create read-only views
   - Add hash chain verification
   - Consider append-only tables
   - Location: Database

6. **Rate Limiting**
   - Per-session request limits
   - Configurable thresholds
   - Location: MCP wrapper

## Assumptions

1. **Environment:** Local filesystem only, no external network threats considered
2. **Users:** Legitimate users with valid motives unless proven otherwise
3. **Attacker Model:** Can invoke MCP tools with crafted requests but cannot modify runtime environment
4. **Scope:** No physical security, no network-level attacks considered

## Next Steps

1. Implement session token generation/validation
2. Add founder cryptographic identity
3. Create permission registry
4. Add authorization middleware
5. Implement audit log integrity checks