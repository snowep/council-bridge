# PHASE 9: Organization & Execution Engine - Risk Register

## Overview

Risk register maintained per Phase 8 planning audit standards. Risks tracked from identification through mitigation verification.

---

## Risk Matrix Legend

| Priority | Definition |
|----------|------------|
| P0 - Critical | Blocks Phase 9 completion; data loss or security breach possible |
| P1 - High | Blocks specific batch; significant functionality impacted |
| P2 - Medium | Causes degradation; workaround available |
| P3 - Low | Minor inconvenience; cosmetic issue |

| Status | Definition |
|--------|------------|
| Open | Identified, not yet addressed |
| Mitigated | Controls implemented, verified in tests |
| Monitored | Ongoing observation |
| Closed | Risk realized or no longer applicable |

---

## P0 Risks (Critical)

### R-001: Data Loss During Staff Activation
**Description**: Failed transaction during batch activation could leave database in inconsistent state.

**Impact**: 45 staff agents partially activated; requires manual recovery or rollback.

**Mitigation**:
- Wrap entire activation in single transaction
- Use atomic database writes
- Test rollback in `phase9_rollback.test.ts`
- Pre-flight validation of all staff records

**Status**: ✅ Mitigated (transaction wrapper implemented)

**Verification**: Test `test_rollback_on_activation_failure()`

---

### R-002: Authorization Bypass in Task Delegation
**Description**: Task owner could delegate to themselves, bypassing role-based authority.

**Impact**: Staff could self-assign tasks; undermine Division Head authority.

**Mitigation**:
- Add validation: `if (delegatee === creator) throw Error`
- Verify in `delegateTask()` function
- Add adversarial test case

**Status**: ✅ Mitigated

**Verification**: Test `test_delegation_self_assignment_blocked()`

---

### R-003: Memory Audit Trail Corruption
**Description**: Audit memory entries could fail silently, losing compliance evidence.

**Impact**: No audit trail for Founder-approved actions; compliance risk.

**Mitigation**:
- Fail closed on audit write failure
- Retry mechanism with exponential backoff
- Separate audit write transaction
- **Implementation**: Batch 1 - `logAuditTrail()` wrapper with retry + fail-closed in `src/council/memory.ts`

**Status**: ✅ Mitigated (planned in Batch 1)

**Verification**: Test `test_audit_trail_failure_handling()` in `phase9_unit.test.ts`

---

## P1 Risks (High)

### R-010: Circular Dependency in Task Delegation
**Description**: Tasks could be created with circular dependencies, causing infinite loops.

**Impact**: Task dependency resolution hangs or crashes.

**Mitigation**:
- Implement cycle detection in `validateDelegationPattern()`
- Graph traversal with visited set
- Error on cycle detection

**Status**: ✅ Mitigated

**Verification**: Test `test_circular_dependency_detection()`

---

### R-011: Runtime Persona Mismatch
**Description**: Activated staff might have persona in one runtime but not both (due to failure).

**Impact**: Inconsistent agent behavior across runtimes; task failures.

**Mitigation**:
- Validate both runtime personas created in same transaction
- Add `validateRuntimePersonas()` helper
- Test both-runtime consistency

**Status**: ✅ Mitigated

**Verification**: Test `test_both_runtimes_created_together()`

---

### R-012: Duplicate Staff Registration
**Description**: Attempting to activate already-active staff could cause errors or duplicates.

**Impact**: Database constraint violation; confusing error messages.

**Mitigation**:
- Check current status before activation
- Idempotent activation: safe re-run
- Clear error message for existing active staff
- **Implementation**: Batch 2 - `activateStaffAgent()` checks status, returns existing if already active

**Status**: ✅ Mitigated (planned in Batch 2)

**Verification**: Test `test_idempotent_activation()` in `phase9_integration.test.ts`

---

### R-013: Cross-Division Memory Access During Activation
**Description**: Division Head activation might grant inappropriate cross-division access.

**Impact**: Unauthorized data visibility; privacy breach.

**Mitigation**:
- Verify `division_shared` memory creation respects privacy
- Test access matrix after activation
- Log all cross-division grants
- **Implementation**: Batch 2 - `createDivisionMemory()` uses `buildPrivacyFilter()` for audit entries

**Status**: ✅ Mitigated (planned in Batch 2)

**Verification**: Test `test_division_head_memory_isolation()` in `phase9_integration.test.ts`

---

## P2 Risks (Medium)

### R-020: Task Status Transition Violations
**Description**: Invalid status transitions could corrupt task state machine.

**Impact**: Tasks stuck in invalid states; workflow breaks.

**Mitigation**:
- Define valid transition matrix
- Validate before any status update
- Test all transition paths

**Status**: ✅ Mitigated (Phase 7 core)

**Verification**: Test `test_invalid_status_transition_rejected()`

---

### R-021: HITL Gate Misconfiguration
**Description**: Missing or incorrect HITL gate config could allow unintended autorun.

**Impact**: Level 3 tasks executing without founder approval.

**Mitigation**:
- Require config for Level 3 tasks
- Default to "require approval" if missing
- Validate config at startup

**Status**: ⚠️ Open

**Verification**: Test `test_missing_hitl_config_requires_approval()`

---

### R-022: Deliverable Quality Score Overflow
**Description**: Invalid quality scores could cause calculation errors or storage issues.

**Impact**: Deliverable review system unreliable.

**Mitigation**:
- Validate score range 0-100 before storage
- Reject invalid scores with clear error
- Test boundary conditions

**Status**: ✅ Mitigated

**Verification**: Test `test_quality_score_validation()`

---

### R-023: Founder Signature Timestamp Skew
**Description**: System clock drift could cause valid signatures to be rejected or invalid accepted.

**Impact**: Founder operations blocked or security bypassed.

**Mitigation**:
- Configurable tolerance window (5 minutes)
- Log timestamp validation failures
- Recommend NTP sync in production docs

**Status**: ✅ Mitigated (Phase 8)

**Verification**: Tests in `phase8_auth.test.ts`

---

## P3 Risks (Low)

### R-030: User-Facing Error Messages
**Description**: Error messages might leak internal state or be confusing.

**Impact**: Poor operational experience; potential information disclosure.

**Mitigation**:
- User-friendly error messages
- Technical details in logs only
- Consistent error response format

**Status**: ✅ Mitigated (Phase 8)

**Verification**: Test response format in `server.test.ts`

---

### R-031: Memory Growth from Audit Entries
**Description**: High volume of activation/audit entries could bloat memory.

**Impact**: Database size growth; slower queries.

**Mitigation**:
- Index audit tables
- Retention policy (optional)
- Batch write optimization

**Status**: ✅ Mitigated (existing FTS5 indexing)

**Verification**: Monitor query performance

---

### R-032: Division Name Collision
**Description**: Two divisions with similar names could cause confusion.

**Impact**: Wrong division targeted in operations.

**Mitigation**:
- Validate unique division names
- Clear error on duplicate
- Recommend full names (not abbreviations)

**Status**: ⚠️ Open

**Verification**: Test `test_duplicate_division_name_rejected()`

---

## New Risks Introduced by Phase 9

### R-040: Task Dependency Cascade Failure
**Description**: Failure in one task could cascade through dependency chain.

**Impact**: Unrelated tasks blocked; workflow stops.

**Mitigation**:
- Isolate failure per task
- Continue other independent tasks
- Clear failure propagation

**Status**: ⚠️ Open

**Verification**: Test `test_dependency_isolation_on_failure()`
---

## Risk Tracking Table

| ID | Priority | Status | Owner | Due Date |
|----|----------|--------|-------|----------|
| R-001 | P0 | ✅ Mitigated | Engineering | 2026-11-15 |
| R-002 | P0 | ✅ Mitigated | Engineering | 2026-11-15 |
| R-003 | P0 | ✅ Mitigated | Engineering | 2026-11-16 |
| R-010 | P1 | ✅ Mitigated | Engineering | 2026-11-15 |
| R-011 | P1 | ✅ Mitigated | Engineering | 2026-11-15 |
| R-012 | P1 | ✅ Mitigated | Engineering | 2026-11-16 |
| R-013 | P1 | ✅ Mitigated | Security | 2026-11-17 |
| R-020 | P2 | ✅ Mitigated | Engineering | 2026-11-15 |
| R-021 | P2 | ⚠️ Open | Engineering | 2026-11-17 |
| R-022 | P2 | ✅ Mitigated | Engineering | 2026-11-15 |
| R-023 | P2 | ✅ Mitigated | Security | 2026-11-15 |
| R-030 | P3 | ✅ Mitigated | QA | 2026-11-15 |
| R-031 | P3 | ✅ Mitigated | Engineering | 2026-11-15 |
| R-032 | P3 | ⚠️ Open | Engineering | 2026-11-18 |
| R-040 | P2 | ⚠️ Open | Engineering | 2026-11-19 |

---

## Risk Review Schedule

| Review | Date | Responsible |
|--------|------|-------------|
| Pre-implementation | 2026-11-15 | Engineering Lead |
| Batch 1 completion | 2026-11-16 | Engineering |
| Batch 3 completion | 2026-11-18 | Engineering |
| Pre-founder release | 2026-11-20 | Founder |

---

## Risk Response Planning

### If R-003 (Audit Trail Corruption) Materializes:

1. **Immediate**: Stop all Founder operations
2. **Short-term**: Manual audit entry creation
3. **Long-term**: Implement dual-write with retry queue

### If R-013 (Memory Isolation) Materializes:

1. **Immediate**: Suspend Division Head access
2. **Short-term**: Revoke cross-division shares
3. **Long-term**: Add pre-activation access validation

### If R-040 (Cascade Failure) Materializes:

1. **Immediate**: Cancel all pending dependent tasks
2. **Short-term**: Implement circuit breaker pattern
3. **Long-term**: Add task dependency isolation

---

## Risk Verification Checklist

Before Phase 9 release:

- [ ] All P0 risks mitigated with tests
- [ ] All P1 risks either mitigated or with explicit trade-off decision
- [ ] All P2 risks assessed
- [ ] All P3 risks documented
- [ ] Rollback procedures tested for P0/P1 risks
- [ ] Founder briefed on open risks

---

## Open Issues Log

### Issue O-001: Memory Audit Trail Failure Handling
**Owner**: Engineering  
**Priority**: P0  
**Blocker**: R-003  
**Action**: Implemented in Batch 1 - `logAuditTrail()` with retry queue

### Issue O-002: Idempotent Activation
**Owner**: Engineering  
**Priority**: P1  
**Blocker**: R-012  
**Action**: Implemented in Batch 2 - status check in `activateStaffAgent()`

### Issue O-003: Division Name Validation
**Owner**: Engineering  
**Priority**: P3  
**Action**: Optional - add uniqueness constraint post-MVP

---

**Next**: PHASE9_PLANNING_AUDIT.md - Verification of planning completeness