# Phase 8 Implementation Roadmap

## Overview

Phase 8 delivers the security and reliability hardening layer for Council Bridge.

**Total Estimated Effort:** ~40-60 developer hours

**Implementation Approach:** Incremental, backward-compatible delivery

## Phase 8.1: Authentication Infrastructure (Week 1)

### Milestone 1A: Session Token System

**Duration:** 2 days

**Deliverables:**
- `src/auth/session.ts` - Session token generation/validation
- `src/auth/types.ts` - Authentication types
- Integration with MCP handlers
- Session store (in-memory Map)

**Changes Required:**
- `src/server.ts` - Add middleware for token validation
- `src/council.ts` - Accept auth context in all methods

**Testing:**
- Unit tests for token generation/validation
- Integration tests for MCP flow
- Performance tests (token ops < 5ms)

**Risk:** Low - new functionality, no behavior change

### Milestone 1B: Founder Authentication

**Duration:** 1.5 days

**Deliverables:**
- `src/auth/founder.ts` - Key generation, signing, verification
- Key persistence mechanism
- Founder signature requirement for sensitive ops

**Changes Required:**
- `src/server.ts` - Add signature verification to MCP tools
- `src/council.ts` - Reject unsigned founder operations

**Testing:**
- Unit tests for key operations
- Integration tests for signed requests
- Backward compatibility tests

**Risk:** Medium - affects Founder operations

## Phase 8.2: Authorization Hardening (Week 2)

### Milestone 2A: Permission Registry

**Duration:** 1.5 days

**Deliverables:**
- `src/auth/permissions.ts` - Centralized permission system
- Permission decorators/middleware
- Authorization audit logging

**Changes Required:**
- Refactor scattered `isFounder()`, `isDivisionHead()` calls
- Add permission checks to all tools
- Database schema for audit (optional)

**Testing:**
- Unit tests for permission logic
- Integration tests for role enforcement
- Adversarial tests for privilege escalation

**Risk:** Medium - refactoring existing logic

### Milestone 2B: Status Transition Guards

**Duration:** 1 day

**Deliverables:**
- Status transition matrix
- Validation functions in council.ts
- Error messages for invalid transitions

**Changes Required:**
- `src/council.ts` - Add transition validation to all state changes

**Testing:**
- Unit tests for status transitions
- Integration tests for full lifecycles
- Adversarial tests for transition bypass

**Risk:** Medium - core execution logic

## Phase 8.3: Execution Security (Week 3)

### Milestone 3A: Permission Re-validation

**Duration:** 1 day

**Deliverables:**
- Permission re-check before execution
- Division head verification
- Level 3 approval freshness check

**Changes Required:**
- `src/council.ts` - Enhanced executeExecutionRequest()
- `src/database.ts` - Add approval expiration query

**Testing:**
- Integration tests for permission changes
- Adversarial tests for timing attacks

**Risk:** Medium - affects execution behavior

### Milestone 3B: Duplicate Prevention

**Duration:** 0.5 days

**Deliverables:**
- Active execution detection
- Queue position management
- Concurrency controls

**Changes Required:**
- `src/council.ts` - Request validation
- `src/database.ts` - Add indexes/columns

**Testing:**
- Concurrency stress tests
- Integration tests for queue behavior

**Risk:** Low - preventive controls

## Phase 8.4: Database Reliability (Week 4)

### Milestone 4A: Backup System

**Duration:** 1.5 days

**Deliverables:**
- Automated backup functions
- WAL archiving
- Backup verification

**Changes Required:**
- `src/database.ts` - Backup/restore methods
- Configuration for schedules

**Testing:**
- Backup integrity tests
- Restore verification tests
- Performance tests

**Risk:** Low - new functionality

### Milestone 4B: Recovery Mechanisms

**Duration:** 1.5 days

**Deliverables:**
- Interrupted execution recovery
- Migration rollback
- Health check endpoint

**Changes Required:**
- `src/council.ts` - Recovery functions
- `src/server.ts` - Health endpoint
- `src/database.ts` - Health checks

**Testing:**
- Recovery scenario tests
- Chaos injection tests
- Integration tests

**Risk:** Medium - recovery critical path

## Phase 8.5: Audit and Monitoring (Week 5)

### Milestone 5A: Audit Integrity

**Duration:** 1 day

**Deliverables:**
- Audit log tamper detection
- Read-only audit views
- Hash chain implementation

**Changes Required:**
- Database schema additions
- Audit logging enhancements

**Testing:**
- Tamper detection tests
- Integrity verification tests

**Risk:** Low - append-only logic

### Milestone 5B: Monitoring

**Duration:** 1 day

**Deliverables:**
- Metrics collection
- Alert thresholds
- Health dashboard

**Changes Required:**
- Metrics middleware
- Alert system integration points

**Testing:**
- Metric accuracy tests
- Alert threshold tests

**Risk:** Low - observability

## Database Schema Changes

### Migration 007: Phase 8 Reliability

```sql
-- Approval expiration
ALTER TABLE approval_requests ADD COLUMN expires_at TEXT;
CREATE INDEX idx_approvals_expires ON approval_requests(expires_at);

-- Execution tracking
ALTER TABLE execution_requests ADD COLUMN started_at TEXT;
ALTER TABLE execution_requests ADD COLUMN timeout_at TEXT;
ALTER TABLE execution_requests ADD COLUMN attempt_count INTEGER DEFAULT 0;

-- Audit integrity
ALTER TABLE execution_history ADD COLUMN prev_hash TEXT;
CREATE INDEX idx_history_prev ON execution_history(prev_hash);

-- Session state (optional, in-memory preferred)
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
```

## API Changes

### New MCP Tools

| Tool | Purpose | Founder Required |
|------|---------|------------------|
| list_session_audit | List session audit trail | Yes |
| get_system_health | Get system health status | No |
| backup_database | Create manual backup | Yes |
| restore_database | Restore from backup | Yes |

### Modified Tool Signatures

```typescript
// All tools now accept optional session token
ToolCall = {
  name: string,
  arguments: any,
  session_token?: string,  // NEW
  founder_signature?: string  // NEW
}
```

## Rollback Sequence

### If issues arise:

1. **Rollback Phase 5A/5B** - Disable audit enhancements and monitoring
2. **Rollback Phase 4B** - Disable recovery, use old behavior
3. **Rollback Phase 4A** - Disable backup system
4. **Rollback Phase 3B** - Disable duplicate prevention
5. **Rollback Phase 3A** - Re-enable old execution logic
6. **Rollback Phase 2B** - Remove status guards
7. **Rollback Phase 2A** - Remove centralized permissions, revert to old auth
8. **Rollback Phase 1B** - Disable founder signatures
9. **Rollback Phase 1A** - Disable session tokens

**Rollback Trigger Criteria:**
- Security test failures
- >10% execution failures
- Founder operations blocked
- Data integrity issues

## Dependencies and Compatibility

### Node.js Version
- Requires: Node.js 18+ (built-in crypto module)
- No additional npm packages

### Backward Compatibility
- Legacy sessions allowed in transition mode
- All existing functionality preserved
- MCP tool names unchanged
- Database migrations are additive only

### Cross-Platform
- Works on Linux, macOS, Windows
- File-based (no cloud dependencies)
- Local-only storage

## Success Criteria

### Must Have (Blocker for completion)
- [ ] All 200+ tests pass (152 existing + new)
- [ ] TypeScript compiles with no errors
- [ ] No security vulnerabilities detected
- [ ] All Phase 1-7 tests still pass
- [ ] MCP tools functional

### Should Have
- [ ] Session token validation < 5ms
- [ ] Backup restore < 30 seconds (1GB DB)
- [ ] Health check < 50ms
- [ ] Recovery from interruption works
- [ ] All adversarial tests pass

### Could Have
- [ ] Chaos tests pass
- [ ] Performance benchmarks meet targets
- [ ] Documentation complete

## Estimated Effort Breakdown

| Phase | Developer Hours | Testing Hours | Total |
|-------|-----------------|---------------|-------|
| 8.1 Auth Infra | 8 | 4 | 12 |
| 8.2 Auth Hardening | 6 | 4 | 10 |
| 8.3 Execution Security | 6 | 4 | 10 |
| 8.4 Database Reliability | 8 | 6 | 14 |
| 8.5 Audit & Monitoring | 6 | 4 | 10 |
| **Totals** | **34** | **22** | **56** |

## Implementation Order

### Recommended Sequence

1. **Session tokens** - Foundation for all security
2. **Session token integration** - Enable in MCP
3. **Status transition guards** - Protect execution integrity
4. **Permission registry** - Centralize authorization
5. **Founder authentication** - Secure privileged ops
6. **Permission re-validation** - Execution safety
7. **Backup system** - Reliability foundation
8. **Recovery mechanisms** - Handle failures
9. **Duplicate prevention** - Prevent conflicts
10. **Audit integrity** - Tamper detection
11. **Monitoring** - Observability

### Rationale

- Start with foundation (auth) before building on it
- Add safety checks before new features
- Backup/recovery before audit (need recovery first)
- Security before monitoring (monitor what we secure)

## Verification Points

### Week 1 End
- ✅ Session tokens working
- ✅ All MCP tools accept tokens
- ✅ Tests pass

### Week 2 End
- ✅ Authorization centralized
- ✅ Status guards in place
- ✅ Backward compatibility verified

### Week 3 End
- ✅ Execution safety implemented
- ✅ No duplicate executions
- ✅ All tests pass

### Week 4 End
- ✅ Backup system working
- ✅ Recovery functional
- ✅ Health checks live

### Week 5 End
- ✅ Full audit trail
- ✅ Monitoring in place
- ✅ Phase 8 complete

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Auth breaks existing flows | Medium | High | Legacy mode, gradual rollout |
| Performance degradation | Low | Medium | Performance tests, caching |
| Data corruption in backup | Low | Critical | Checksum verification, testing |
| Recovery fails when needed | Low | Critical | Manual procedures documented |
| MCP client incompatibility | Medium | High | Backward compatibility layer |

## Post-Implementation

### Monitoring
- Track security test pass rate
- Monitor execution success rate
- Alert on backup failures
- Review audit logs

### Maintenance
- Rotate session keys monthly
- Backup verification weekly
- Security audit quarterly
- Performance review biannually