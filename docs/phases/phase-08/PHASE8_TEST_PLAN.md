# Phase 8 Test Plan

## Test Categories

### 1. Authentication Tests

#### Session Token Tests
```
- test_valid_session_token_accepted
- test_invalid_token_rejected
- test_expired_token_rejected
- test_tampered_token_rejected
- test_missing_token_rejected
- test_token_rotation
- test_concurrent_sessions_limit
```

#### Founder Authentication Tests
```
- test_founder_request_requires_signature
- test_valid_founder_signature_accepted
- test_tampered_signature_rejected
- test_missing_signature_rejected
- test_invalid_key_rejected
- test_key_rotation_handling
```

#### Runtime Verification Tests
```
- test_claude_runtime_validation
- test_hermes_runtime_validation
- test_spoofed_runtime_rejected
- test_mixed_runtime_sessions
```

### 2. Authorization Tests

#### Permission Boundary Tests
```
- test_founder_can_approve_any_execution
- test_non_founder_cannot_approve_level3
- test_division_head_can_execute_own_division
- test_staff_can_execute_own_tasks_only
- test_staff_cannot_execute_other_division
- test_cross_division_access_required_for_shared_memory
```

#### Adversarial Permission Tests
```
- test_founder_spoofing_blocked
- test_role_escalation_blocked
- test_permission_bypass_blocked
- test_delegated_permission_verification
```

### 3. MCP Security Tests

#### Endpoint Security Tests
```
- test_all_tools_require_valid_session
- test_tool_arguments_sanitized
- test_malformed_JSON_rejected
- test_oversized_inputs_rejected
- test_special_characters_in_inputs
```

#### Session Security Tests
```
- test_session_fixation_blocked
- test_session_hijacking_attempts_logged
- test_concurrent_session_limits
- test_session_timeout_enforcement
```

### 4. Database Security Tests

#### Injection Prevention Tests
```
- test_SQL_injection_in_all_inputs
- test_Unicode_normalization
- test_null_byte_injection
- test_escape_sequence_attacks
```

#### Integrity Tests
```
- test_FK_constraint_enforcement
- test_unique_constraint_enforcement
- test_ck_constraint_enforcement
- test_orphaned_record_prevention
```

### 5. Execution Safety Tests

#### Status Transition Tests
```
- test_valid_status_transitions_only
- test_invalid_transitions_rejected
- test_terminal_state_protection
- test_status_jump_prevention
```

#### Permission Re-validation Tests
```
- test_level2_permission_revalidation
- test_approval_validity_check
- test_division_head_change_detection
- test_staff_deactivation_handling
```

#### Duplicate Prevention Tests
```
- test_no_concurrent_executions_same_task
- test_execution_queue_deduplication
- test_duplicate_request_prevention
```

### 6. Database Recovery Tests

#### Backup Tests
```
- test_full_backup_creation
- test_backup_integrity_verification
- test_backup_restore
- test_incremental_backup_applying
```

#### Migration Tests
```
- test_migration_rollback
- test_partial_migration_recovery
- test_migration_checksum_verification
- test_concurrent_migration_prevention
```

#### Corruption Recovery Tests
```
- test_WAL_recovery
- test_journal_recovery
- test_corruption_detection
- test_point_in_time_recovery
```

### 7. Failure Injection Tests

#### Database Failure Tests
```
- test_disk_full_handling
- test_IO_error_handling
- test_connection_drop_handling
- test_timeout_handling
```

#### Execution Failure Tests
```
- test_process_crash_during_execution
- test_signal_interrupt_handling
- test_memory_exhaustion_handling
- test_queuing_under_load
```

#### Recovery Tests
```
- test_auto_recovery_from_interruption
- test_manual_recovery_procedures
- test_recovery_logging
```

## Test Implementation

### Testing Framework

Using Node.js built-in test runner (same as Phase 7):

```typescript
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
```

### Test Directory Structure

```
tests/
├── auth/
│   ├── session.test.ts
│   ├── founder.test.ts
│   └── runtime.test.ts
├── authz/
│   ├── permissions.test.ts
│   ├── boundaries.test.ts
│   └── adversarial.test.ts
├── mcp/
│   ├── security.test.ts
│   └── endpoints.test.ts
├── database/
│   ├── injection.test.ts
│   ├── integrity.test.ts
│   └── backup.test.ts
├── execution/
│   ├── safety.test.ts
│   ├── transitions.test.ts
│   └── recovery.test.ts
└── integration/
    ├── full_flow.test.ts
    └── adversarial_flow.test.ts
```

### Testing Methodology

#### 1. Unit Tests (Primary)
- Test individual functions/methods
- Mock external dependencies
- Fast execution (< 100ms each)

#### 2. Integration Tests
- Test full workflows
- Use actual database
- Slower execution but comprehensive

#### 3. Adversarial Tests
- Craft malicious inputs
- Test edge cases
- Verify security boundaries

#### 4. Chaos Tests (Optional)
- Random failures
- Resource exhaustion
- Network partition simulation

### Test Data Management

```typescript
// helpers/test-db.ts
export class TestDb {
  static async create(): Promise<DatabaseInstance> {
    // Create isolated test database
  }
  
  static async destroy(db: DatabaseInstance): Promise<void> {
    // Cleanup including WAL files
  }
  
  static async seed(): Promise<void> {
    // Pre-populate with test data
  }
  
  static async snapshot(): Promise<string> {
    // Create backup point
  }
  
  static async restore(snapshot: string): Promise<void> {
    // Restore to snapshot
  }
}
```

## Test Matrix

| Feature | Unit Test | Integration | Adversarial | Notes |
|---------|-----------|-------------|-------------|-------|
| Session tokens | ✅ | ✅ | ✅ | Critical security |
| Founder auth | ✅ | ✅ | ✅ | Must be perfect |
| Runtime verification | ✅ | ✅ | ⚠️ | Local trust model |
| Permission checks | ✅ | ✅ | ✅ | Boundary tests |
| SQL injection | ✅ | ⚠️ | ✅ | All input surfaces |
| Status transitions | ✅ | ✅ | ✅ | Core integrity |
| Duplicate prevention | ✅ | ✅ | ⚠️ | Race conditions |
| Backup/restore | ✅ | ✅ | - | Operational |
| Migration rollback | ✅ | ✅ | - | Data integrity |
| Execution recovery | ✅ | ✅ | - | Reliability |
| Timeout handling | ✅ | ✅ | - | Execution safety |

## Test Coverage Requirements

### Minimum Coverage

| Area | Target | Enforcement |
|------|--------|-------------|
| Auth functions | 100% | Required |
| Authorization | 95% | Required |
| Status transitions | 100% | Required |
| Database operations | 90% | Required |
| MCP handlers | 85% | Required |
| Recovery functions | 90% | Required |

### Coverage Measurement

```bash
# Generate coverage report
npx c8 --reporter=lcov npm test

# Check thresholds
c8 check --lines 90 --functions 90 --branches 85
```

## Regression Tests (Phases 1-7)

### Must Preserve Tests

All existing Phase 1-7 tests must continue to pass:

```bash
# Full regression suite
npm test

# Expected: 152 tests pass (add Phase 8 tests)
```

### Version Compatibility Tests

```
- test_phase1_communication_still_works
- test_phase2_personas_still_work
- test_phase3_council_still_works
- test_phase4_memory_still_works
- test_phase5_dashboard_still_works
- test_phase6_division_still_works
- test_phase7_execution_still_works
```

## Performance Tests

### Load Tests

```
- 100 concurrent session tokens
- 1000 authorization checks
- 100 execution requests
- 10 backup/restore cycles
```

### Benchmark Tests

```
- Token validation < 5ms
- Authorization check < 10ms
- Session lookup < 2ms
- Health check < 50ms
```

## Security Test Cases

### Test Case: Founder Spoofing

```typescript
test('founder spoofing blocked', async () => {
  const maliciousToken = generateValidToken();
  const maliciousContext = {
    owner_type: 'founder',
    owner_id: 'founder',
    runtime: 'claude',
    session: maliciousToken
  };
  
  assert.throws(() => {
    councilService.approveExecution(maliciousContext, approvalInput);
  }, /Founder signature required/);
});
```

### Test Case: SQL Injection

```typescript
test('SQL injection in execution request blocked', async () => {
  const input = {
    execution_id: "1' OR '1'='1"
  };
  
  assert.throws(() => {
    councilService.getExecutionRequest(ctx, input);
  }, /SQLITE/);
});
```

### Test Case: Privilege Escalation

```typescript
test('staff cannot impersonate founder', async () => {
  const staffContext = {
    owner_type: 'founder',  // Fake
    owner_id: 'founder',    // Fake
    runtime: 'claude',
    staff_id: 'staff-001'   // Actual
  };
  
  assert.throws(() => {
    councilService.approveExecution(staffContext, approvalInput);
  }, /Only Founder can approve/);
});
```

## Test Execution Schedule

### Development
- Unit tests: Run on every save (watch mode)
- Fast feedback loop

### CI/CD Pipeline
```yaml
# On every push
- npm test                           # All tests
- npx tsc --noEmit                   # Type check
- npm run test:coverage              # Coverage report
- npm run test:security              # Adversarial tests
- npm run test:integration           # Full flow tests

# On main branch only
- npm run test:chaos                 # Chaos tests
- npm run test:performance           # Benchmark tests
```

### Nightly
- Full regression suite
- Backup verification
- Migration verification
- Security scan

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Security Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '18' }
      - run: npm ci
      - run: npm test
      - run: npm run test:security
      
  security:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v3
      - run: npm audit
      - run: npm run test:adversarial
      
  performance:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - run: npm run test:benchmark
```

## Test Documentation

### Test Case Template

```markdown
## Test: [Description]

**ID:** TEST-AUTHZ-001

**Purpose:** [Why this test exists]

**Preconditions:**
- Database initialized
- Test users exist

**Test Steps:**
1. Create test context
2. Attempt unauthorized operation
3. Verify rejection

**Expected Result:** Operation rejected with specific error

**Related Code:** src/council.ts:approveExecution()
**Related Threat:** T1 - Founder Identity Spoofing
```

## Test Maintenance

### Adding New Tests

1. Create test file in appropriate directory
2. Follow existing test patterns
3. Include description and purpose
4. Link to threat model if security-related

### Updating Tests

When production code changes:
1. Update affected tests
2. Add new test cases for new behavior
3. Remove obsolete tests
4. Maintain coverage thresholds

### Test Ownership

- **Security tests:** Security team
- **Execution tests:** Core team
- **Database tests:** Infrastructure team
- **Integration tests:** QA team

## Verification Checklist

Before Phase 8 implementation:

- [ ] All Phase 1-7 tests pass (152 tests)
- [ ] TypeScript compiles with no errors
- [ ] Database migrations verified
- [ ] MCP tools registered correctly

After Phase 8 implementation:

- [ ] All new security tests pass
- [ ] All regression tests pass
- [ ] Coverage meets targets
- [ ] Performance benchmarks meet requirements
- [ ] Adversarial tests pass
- [ ] No security vulnerabilities detected