# PHASE 9: Organization & Execution Engine - Test Plan

## Overview

**Test Framework**: Node.js Test Runner (`npm test` via `tsx --test`)  
**Coverage Target**: 95% of Phase 9 code paths  
**Regression Threshold**: 221 tests minimum (Phase 1-8)  

---

## Test Categories

### 1. Unit Tests (phase9_unit.test.ts)

#### 1.1 Division Approval Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| U-DD-01 | `approveDivisionHead()` requires founder context | Error if not founder |
| U-DD-02 | `approveDivisionHead()` validates division exists | Error if division missing |
| U-DD-03 | `approveDivisionHead()` validates staff belongs to division | Error if mismatch |
| U-DD-04 | `approveDivisionHead()` updates division record | `head_staff_id` updated |
| U-DD-05 | `approveDivisionHead()` creates audit memory | Memory logged in `council_shared` |

#### 1.2 Specialist Approval Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| U-DS-01 | `approveSpecialist()` requires founder context | Error if not founder |
| U-DS-02 | `approveSpecialist()` validates staff exists | Error if staff missing |
| U-DS-03 | `approveSpecialist()` validates division exists | Error if division missing |
| U-DS-04 | `approveSpecialist()` sets status to 'approved' | `status` = 'approved' |
| U-DS-05 | `approveSpecialist()` creates audit memory | Memory logged |

#### 1.3 Staff Activation Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| U-SA-01 | `activateStaffAgent()` requires founder context | Error if not founder |
| U-SA-02 | `activateStaffAgent()` validates staff approved | Error if not approved |
| U-SA-03 | `activateStaffAgent()` assigns runtime personas | 1-2 persona records per runtime |
| U-SA-04 | `activateStaffAgent()` updates runtime_instances | JSON array populated |
| U-SA-05 | `activateStaffAgent()` sets status to 'active' | `status` = 'active' |

#### 1.4 Delegation Validation Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| U-DV-01 | Sequential pattern requires valid dependencies | Error if cycle detected |
| U-DV-02 | Parallel pattern allows multiple delegates | Success with array |
| U-DV-03 | Hierarchical pattern validates structure | Single delegate allowed |
| U-DV-04 | Evaluator-optimizer requires evaluator | Error if missing |
| U-DV-05 | Pattern validation rejects unknown types | Error on invalid pattern |

#### 1.5 Deliverable Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| U-DL-01 | `submitDeliverable()` requires task access | Error if no access |
| U-DL-02 | `submitDeliverable()` validates version | Version increments |
| U-DL-03 | `submitDeliverable()` quality score range | 0-100 enforced |
| U-DL-04 | `reviewDeliverable()` requires authorization | Only task owner/division |
| U-DL-05 | `reviewDeliverable()` updates status | Status transitions correctly |

### 2. Integration Tests (phase9_integration.test.ts)

#### 2.1 Appointment Workflow Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| I-AW-01 | Full appointment ceremony | Division Head activated |
| I-AW-02 | Multi-specialist activation | All specialists active |
| I-AW-03 | Runtime persona assignment | Both runtimes active |
| I-AW-04 | Memory audit trail | All appointments logged |
| I-AW-05 | Cross-validation | Division ↔ Staff consistency |

#### 2.2 Task Lifecycle Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| I-TL-01 | Create task → Delegate | Task status transitions |
| I-TL-02 | Execute autonomous task (Level 1) | Auto-completes |
| I-TL-03 | Execute with approval (Level 2) | Requires approval |
| I-TL-04 | Execute founder-only (Level 3) | Requires founder signature |
| I-TL-05 | Cancel execution | Status updated, memory logged |

#### 2.3 Deliverable Lifecycle Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| I-DL-01 | Submit deliverable → Review | Status progresses |
| I-DL-02 | Quality score rejection | Deliverable rejected |
| I-DL-03 | Multiple reviewers | Aggregation works |
| I-DL-04 | Revision cycle | Version increments |
| I-DL-05 | Audit trail completeness | All changes logged |

### 3. End-to-End Tests (phase9_e2e.test.ts)

#### 3.1 Complete Activation Flow

```
Test: founder_full_activation()
1. Founder creates Developer Division
2. Founder approves Developer Division Head
3. Founder activates Division Head (both runtimes)
4. Founder approves 9 Developer Specialists
5. Founder activates all 9 specialists
6. Verify database state
7. Verify memory audit trail
```

**Expected**: All 10 Developer staff members active, runtimes assigned

#### 3.2 Task Execution Flow

```
Test: task_execution_e2e()
1. Developer Division Head creates task
2. Staff requests execution (Level 1)
3. Execution auto-approves and completes
4. Staff submits deliverable
5. Division Head reviews and approves
6. Verify history entries
7. Verify task completed
```

**Expected**: Task marked completed, deliverable approved

#### 3.3 Cross-Division Collaboration

```
Test: cross_division_task()
1. Marketing Head creates cross-division task
2. Developer Staff assigned as delegate
3. Execution completes
4. Deliverable shared with Marketing
5. Marketing Head reviews
```

**Expected**: Cross-division permissions enforced, sharing works

### 4. Regression Tests

**Must preserve**: All 221 tests from Phases 1-8

| Test File | Test Count | Critical Path |
|-----------|------------|---------------|
| tests/agents.test.ts | 20 | MCP communication |
| tests/council.test.ts | 180 | Core business logic |
| tests/phase6_migration_verification.test.ts | 15 | Schema integrity |
| tests/phase7_autonomy_execution.test.ts | 50 | Execution engine |
| tests/phase8_auth.test.ts | 70 | Security |
| tests/service_authorization.test.ts | 45 | Access control |
| tests/server.test.ts | 15 | API endpoints |

---

## Adversarial Tests

### Security Tests

| Test ID | Attack Vector | Expected Defense |
|---------|--------------|------------------|
| AT-S-01 | Staff approves Division Head | Authorization denial |
| AT-S-02 | Founder signature replay | 5-minute tolerance |
| AT-S-03 | Cross-division task hijacking | Ownership validation |
| AT-S-04 | Deliverable tampering | Version hash check |
| AT-S-05 | Session fixation | Token invalidation |

### Data Integrity Tests

| Test ID | Corruption Scenario | Expected Prevention |
|---------|---------------------|---------------------|
| DT-I-01 | Duplicate staff_id | Unique constraint |
| DT-I-02 | FK violation on division | Constraint enforces |
| DT-I-03 | Negative quality score | Input validation |
| DT-I-04 | Circular dependency | Cycle detection |
| DT-I-05 | Memory audit gap | Write-through logging |

---

## Performance Benchmarks

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Approve Division Head | < 50ms | Database + memory audit |
| Activate Staff Agent | < 50ms | 2 runtime persona inserts |
| Delegate Task | < 100ms | Dependency graph building |
| Submit Deliverable | < 50ms | Version creation |
| Memory Audit Entry | < 20ms | Async write acceptable |

---

## Test Data Management

### Fixtures

```typescript
// tests/fixtures/phase9-fixtures.ts
export const FIXTURES = {
  divisions: [
    { division_id: "Developer Division", name: "Developer", description: "..." },
    // ... 5 more divisions
  ],
  staff: [
    { staff_id: "staff-dev-head-001", name: "Dev Head", role: "division_head", ... },
    // ... 44 more specialists
  ],
  tasks: [
    { task_id: "task-001", title: "Sample Task", ... },
  ]
};
```

### Setup/Teardown

```typescript
// Each test file
beforeEach(async () => {
  db = await createTestDatabase();
  await initTestState();  // Empty but schema ready
});

afterEach(async () => {
  await cleanupTestDatabase(db);
});
```

---

## Test Execution Schedule

### Development Phase
```bash
# Run unit tests only
npm test tests/phase9_unit.test.ts

# Run specific test
npm test tests/phase9_unit.test.ts --grep "approveDivisionHead"
```

### Integration Validation
```bash
# Run all Phase 9 tests
npm test tests/phase9*.test.ts

# Run with coverage
npm test tests/phase9*.test.ts --coverage
```

### Pre-Release (Before Founder Authorization)
```bash
# Full regression suite
npm test

# Type check
npm run typecheck
```

---

## Coverage Requirements

| Module | Target Lines | Target Branches |
|--------|--------------|-----------------|
| src/council/divisions.ts | 95% | 90% |
| src/council/operations.ts (Phase 9 additions) | 95% | 90% |
| tests/phase9_*.test.ts | - | 100% (all cases) |

### Uncovered Code Policy

Code paths not covered must have a documented `shortcut:` comment explaining the limitation and when the test will be added.

---

## Verification Checklist

Before Phase 9 release to Founder:

- [ ] 221 Phase 1-8 tests pass unchanged
- [ ] 60 new Phase 9 tests written
- [ ] 95% coverage on new code
- [ ] TypeScript compiles with `strict: true`
- [ ] Manual E2E flow succeeds
- [ ] Security tests pass
- [ ] Performance benchmarks met
- [ ] Rollback procedures tested

---

## Test Ownership

| Test File | Owner | Review Required |
|-----------|-------|-----------------|
| phase9_unit.test.ts | Engineering | Yes |
| phase9_integration.test.ts | Engineering | Yes |
| phase9_e2e.test.ts | Founder | Yes (before sign-off) |
| All tests | QA | Pre-release |

---

**Next**: PHASE9_RISK_REGISTER.md - Risk analysis and mitigation