# PHASE 9: Organization & Execution Engine - Implementation Roadmap

## Overview

**Estimated Effort**: 60-80 developer hours  
**Batch Structure**: 5 batches, independent verification per batch  
**Rollout**: Founder authorization required before implementation  

---

## Batch 1: Founder Appointment Ceremony System

**Objective**: Enable Founder to activate Division Heads and Specialists

### Files Modified/Created
- `src/council/divisions.ts` - Add approval/activation functions
- `tests/phase9_appointment.test.ts` - New test file

### Steps

- [ ] **Step 1**: Write failing tests for `approveDivisionHead()` in `tests/phase9_appointment.test.ts`

```typescript
// tests/phase9_appointment.test.ts
def test_approve_division_head_founder_only():
    # Founder can approve
    ctx = { owner_type: 'founder', owner_id: 'founder', runtime: 'claude' }
    input = { division_id: 'Developer Division', staff_id: 'staff-dev-head-001' }
    result = approveDivisionHead(ctx, input)
    assert result.division.head_staff_id == 'staff-dev-head-001'

def test_approve_division_head_rejects_staff():
    # Staff cannot approve Division Head
    ctx = { owner_type: 'staff', owner_id: 'staff-001', runtime: 'claude' }
    with pytest.raises(AuthorizationError):
        approveDivisionHead(ctx, input)
```

- [ ] **Step 2**: Run test to verify it fails with "function not defined"

```bash
npm test tests/phase9_appointment.test.ts -v
```

- [ ] **Step 3**: Implement `approveDivisionHead()` in `src/council/divisions.ts:1-50`

- [ ] **Step 4**: Run test to verify it passes

```bash
npm test tests/phase9_appointment.test.ts -v
```

- [ ] **Step 5**: Implement `approveSpecialist()` and `activateStaffAgent()` functions

### Interfaces

**Consensus: `approveDivisionHead(ctx, input)`**
```typescript
input: { division_id: string; staff_id: string }
→ Division
```

**Consensus: `approveSpecialist(ctx, input)`**
```typescript
input: { staff_id: string; division_id: string }
→ StaffAgent
```

**Consensus: `activateStaffAgent(ctx, input)`**
```typescript
input: { staff_id: string; runtimes: ('claude' | 'hermes')[] }
→ StaffAgent
```

### Verification Points

- ✅ All 3 new functions require Founder context
- ✅ Runtime persona assignment for activated agents
- ✅ Audit memory log entry created
- ✅ TypeScript compiles clean

---

## Batch 2: Division Population & Staff Activation

**Objective**: Populate database with divisions and activate 45 specialists

### Files Modified/Created
- `tests/phase9_activation.test.ts` - Activation tests
- `src/council/memory.ts` - Audit logging helper (enhanced)

### Steps

- [ ] **Step 1**: Write failing tests for division population in `tests/phase9_activation.test.ts`

```typescript
def test_population_creates_all_divisions():
    result = populateDivisions(db)
    assert len(result) == 6

def test_activation_creates_runtime_personas():
    result = activateStaffAgent(ctx, { staff_id: 'staff-dev-head-001', runtimes: ['claude', 'hermes'] })
    assert result.runtime_instances == 2
```

- [ ] **Step 2**: Run test to verify it fails

```bash
npm test tests/phase9_activation.test.ts -v
```

- [ ] **Step 3**: Implement `populateDivisions()` batch operation

- [ ] **Step 4**: Run test to verify population works

- [ ] **Step 5**: Implement `activateSpecialists()` batch operation

### Database Operations

```sql
-- Divisions (6)
INSERT INTO divisions (division_id, name, description, head_staff_id, budget_limit, permissions, strategic_objectives) VALUES (...);

-- Staff Agents (45)  
INSERT INTO staff_agents (staff_id, name, role, division_id, runtime_instances, permissions, status) VALUES (...);

-- Division Members (45 links)
INSERT INTO division_members (division_id, staff_id, role) VALUES (...);
```

### Verification Points

- ✅ 6 divisions created with correct head_staff_id
- ✅ 45 staff agents created with status = 'inactive' (awaiting activation)
- ✅ No FK violations
- ✅ All tests pass

---

## Batch 3: Task Delegation Engine Extensions

**Objective**: Enable task delegation patterns and deliverable workflow

### Files Modified/Created
- `src/council/divisions.ts` - Add delegation functions
- `src/council/operations.ts` - Enhance task operations
- `tests/phase9_delegation.test.ts` - New test file

### Steps

- [ ] **Step 1**: Write failing tests for delegation patterns

```typescript
def test_delegation_sequential_invalidates_parent():
    pattern = 'sequential'
    result = validateDelegationPattern(pattern, dependencies=[])
    assert result.valid == True

def test_delegation_parallel_allows_concurrent():
    pattern = 'parallel'
    result = validateDelegationPattern(pattern, dependencies=['task-1', 'task-2'])
    assert result.valid == True
```

- [ ] **Step 2**: Run test to verify it fails

- [ ] **Step 3**: Implement `validateDelegationPattern()` and `delegateTask()`

- [ ] **Step 4**: Run test to verify it passes

- [ ] **Step 5**: Implement `submitDeliverable()` with quality scoring

### New Types

```typescript
interface DelegationPattern {
  type: 'sequential' | 'parallel' | 'hierarchical' | 'evaluator-optimizer';
  description: string;
  hitl_required?: boolean;
  max_delegates?: number;
}

interface DelegationNode {
  task_id: string;
  status: string;
  depends_on?: string[];
  delegates_to?: string[];
}
```

### Verification Points

- ✅ Delegation pattern validation
- ✅ Dependency cycle detection
- ✅ Deliverable quality scoring
- ✅ All existing task tests still pass

---

## Batch 4: Deliverable Workflow & HITL Gates

**Objective**: Implement reviewer workflow and quality gates

### Files Modified/Created
- `src/council/divisions.ts` - Add deliverable review functions
- `tests/phase9_deliverable.test.ts` - Deliverable tests

### Steps

- [ ] **Step 1**: Write failing tests for deliverable reviews

```typescript
def test_deliverable_review_requires_authorization():
    reviewer = { owner_type: 'division', owner_id: 'Developer Division' }
    deliverable = { task_id: 'task-1', submitted_by_type: 'staff', submitted_by_id: 'staff-001' }
    with pytest.raises(AuthorizationError):
        reviewDeliverable(reviewer, { deliverable_id: 'del-001', status: 'approved' })
```

- [ ] **Step 2**: Run test to verify it fails

- [ ] **Step 3**: Implement `reviewDeliverable()` with role-based access

- [ ] **Step 4**: Run test to verify it passes

- [ ] **Step 5**: Add HITL gate configuration and enforcement

### HITL Gate Configuration

```typescript
interface HitlGateConfig {
  division_id: string;
  task_type?: string;
  level: 1 | 2 | 3;
  required_approvals: number;
  timeout_hours?: number;
  escalation_path?: string;
}
```

### Verification Points

- ✅ Only authorized reviewers can review deliverables
- ✅ Quality score thresholds enforced
- ✅ HITL gates block execution when required
- ✅ Audit trail complete

---

## Batch 5: Full Integration & Founder Activation

**Objective**: Complete the founder activation workflow from ceremony to operational state

### Files Modified/Created
- `tests/phase9_integration.test.ts` - Full workflow test
- `docs/phase9_operators_guide.md` - Documentation (optional)

### Steps

- [ ] **Step 1**: Write failing E2E test for complete activation workflow

```
Founder → Approve Developer Division Head → Activate Developer Division Head
       → Approve 9 Developer Specialists → Activate all 9
       → Create Task → Delegate → Execute → Submit Deliverable → Review
```

- [ ] **Step 2**: Run test to verify it fails

- [ ] **Step 3**: Execute founder commands via MCP or direct API calls

- [ ] **Step 4**: Run E2E test to verify complete workflow

- [ ] **Step 5**: Verify all 221+ existing tests still pass

### Integration Test Script

```bash
# 1. Verify divisions table empty
sqlite3 council.db "SELECT COUNT(*) FROM divisions;"

# 2. Run founder activation
node -e "const { createCouncilService } = require('./dist/council.js'); 
         const svc = createCouncilService(db); 
         svc.activateAll('founder-config.json')"

# 3. Verify activation
sqlite3 council.db "SELECT status FROM staff_agents WHERE staff_id='staff-dev-head-001';"
```

---

## Rollback Sequence

### If Batch 1-3 Issues:

1. **Rollback Division Head Approval**:
   - Mark approved_head_status = NULL
   - Log rollback in council_shared

2. **Rollback Specialist Approval**:
   - Delete approved records from memory
   - Mark staff.status = 'inactive'

### If Batch 4-5 Issues:

3. **Rollback Task Creation**:
   - Delete uncompleted tasks
   - Reset execution_requests to 'cancelled'

4. **Rollback Deliverables**:
   - Delete un-rejected deliverables
   - Log all rollback actions

---

## Test Plan Summary

| Test Category | Count | Pass Criteria |
|---------------|-------|---------------|
| Unit Tests | 15 | All individual functions pass |
| Integration Tests | 10 | All cross-function workflows |
| E2E Tests | 5 | Complete activation + task flow |
| Regression Tests | 221 | All Phase 1-8 tests unchanged |

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| FK constraint violations | Low | Critical | Pre-flight validation, test transactions |
| Authorization bypass | Low | Critical | Code review, security test |
| Memory audit gaps | Low | High | Mandatory audit calls in tests |
| Runtime persona mismatch | Medium | Medium | Dual-runtime verification |
| Founder signature replay | Low | Critical | 5-minute timestamp validation |

---

## Success Criteria

- [ ] All 221+ existing tests pass
- [ ] 6 divisions populated in database
- [ ] 45 staff agents activated across runtimes
- [ ] Task delegation MCP tools functional
- [ ] Deliverable workflow complete
- [ ] Founder can activate organization end-to-end
- [ ] TypeScript compiles with no errors

---

## Founder Decisions Required

| Decision | Required Before |
|----------|-----------------|
| Activate Developer Division first? | Batch 1 start |
| HITL gate thresholds | Batch 3 |
| Cross-division governance | Batch 2 |
| Task template library | Post-MVP |

---

**Next**: PHASE9_TEST_PLAN.md - Detailed test scenarios