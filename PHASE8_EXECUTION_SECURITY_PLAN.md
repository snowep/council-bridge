# Phase 8 Execution Security Plan

## Current Execution State

### Phase 7 Execution Capabilities

**Execution Request Flow:**
```
requestExecution() → Status based on autonomy_level
  Level 1: queued
  Level 2: permission_check
  Level 3: approval_required

approveExecution() 
  - Level 3 approval
  - Updates execution status to 'approved'
  - Requires Founder only

executeExecutionRequest()
  - Validates status is 'queued' or 'approved'
  - Validates Level 3 requires 'approved' status
  - Transitions: queued/approved → running → completed/failed
```

**Database Schema:**
```sql
execution_requests: status in ('proposed','permission_check','approval_required',
  'approved','rejected','queued','running','completed','failed','cancelled')

execution_history: immutable audit trail
```

### Identified Security Risks

| Risk | Location | Severity |
|------|----------|----------|
| No permission validation | executeExecutionRequest() | P1 |
| Direct status modification | No DB constraints | P1 |
| No duplicate prevention | requestExecution() | P1 |
| Stale approvals | No expiration | P2 |
| No timeout | executeExecutionRequest() | P2 |
| Partial failure handling | Incomplete | P2 |

## Execution Security Requirements

### R1: Permission Validation
Every execution must verify the runner has appropriate permissions at execution time, not just at request time.

### R2: Status Transition Guards
Only valid status transitions allowed:
- proposed → queued (auto)
- proposed → permission_check (auto)
- proposed → approval_required (auto)
- approval_required → approved (Founder)
- approval_required → rejected (Founder)
- queued → running (authorized)
- running → completed (authorized)
- running → failed (authorized)
- any → cancelled (owner/Founder)

### R3: Duplicate Prevention
No two concurrent executions for same task.

### R4: Stale Approval Handling
Approvals expire after configurable timeout (default: 24 hours).

### R5: Execution Timeout
Executions must complete or fail after configurable timeout (default: 1 hour).

### R6: Resource Limits
Maximum execution time, memory, and I/O defined per autonomy level.

## Proposed Security Controls

### Control 1: Execution Context Verification

**Implementation:**
```typescript
// src/council.ts - enhanced executeExecutionRequest
async function executeExecutionRequest(ctx, executionId, resultPayload?, errorMessage?): ExecutionRequest {
  const execution = dbInstance.stmt.getExecutionRequest.get(executionId);
  
  // 1. Verify requester has execution rights
  if (!await verifyExecutionAuthorization(ctx, execution)) {
    throw new Error('Not authorized to execute this request');
  }
  
  // 2. Re-validate permissions at execution time
  if (execution.autonomy_level === 2) {
    if (!await validatePermissions(execution.task_id, execution.requested_by_type, execution.requested_by_id)) {
      throw new Error('Permissions no longer valid');
    }
  }
  
  // 3. Check for duplicate execution
  if (await hasActiveExecution(execution.task_id)) {
    throw new Error('Task already has active execution');
  }
  
  // ... rest of execution
}
```

### Control 2: Status Transition Matrix

**Implementation:**
```typescript
// src/council.ts
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  proposed: ['queued', 'permission_check', 'approval_required', 'cancelled'],
  permission_check: ['queued', 'cancelled'],
  approval_required: ['approved', 'rejected', 'cancelled'],
  approved: ['queued', 'cancelled'],
  rejected: [], // Terminal
  queued: ['running', 'cancelled'],
  running: ['completed', 'failed', 'cancelled'],
  completed: [], // Terminal
  failed: [], // Terminal
  cancelled: [] // Terminal
};

function validateStatusTransition(from: string, to: string): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
```

### Control 3: Permission Re-validation

**Implementation:**
```typescript
// For Level 2 (bounded) executions
async function validatePermissions(taskId: string, requestedByType: string, requestedById: string): Promise<boolean> {
  const task = await dbInstance.stmt.getTaskById.get(taskId);
  
  // Re-check task assignment
  if (task.assigned_to_type === 'staff' && task.assigned_to_id !== requestedById) {
    return false;
  }
  
  // Re-check division membership
  if (task.assigned_to_type === 'division') {
    const members = await dbInstance.stmt.getDivisionMembers.all(task.assigned_to_id);
    if (!members.find(m => m.staff_id === requestedById)) {
      return false;
    }
  }
  
  return true;
}

// For Level 3, check approval still valid
async function verifyLevel3Approval(executionId: string, execution: ExecutionRequest): Promise<boolean> {
  if (execution.autonomy_level !== 3) return true;
  if (execution.status === 'approved') return true;
  
  const approval = await dbInstance.stmt.getApprovalRequest.get(execution.approval_request_id);
  if (!approval) return false;
  
  // Check approval hasn't expired (24 hours)
  const approvalAge = Date.now() - new Date(approval.approved_at).getTime();
  if (approvalAge > 24 * 60 * 60 * 1000) {
    return false;
  }
  
  return approval.status === 'approved';
}
```

### Control 4: Execution Timeout Guard

**Implementation:**
```typescript
// Add to execution requests table
-- Add timeout tracking
ALTER TABLE execution_requests ADD COLUMN started_at TEXT;
ALTER TABLE execution_requests ADD COLUMN timeout_at TEXT;

// In executeExecutionRequest
const now = new Date().toISOString();
const timeoutAt = new Date(Date.now() + EXECUTION_TIMEOUT).toISOString();

dbInstance.stmt.updateExecutionRequest.run(
  ...existing fields,
  now,  // started_at
  timeoutAt,  // completed_at (will be updated)
  executionId
);

// Background check (or on next access)
function checkExecutionTimeouts() {
  const now = new Date().toISOString();
  const timedOut = dbInstance.stmt.getTimedOutExecutions.all(now);
  for (const exec of timedOut) {
    failExecution(exec.execution_id, 'Execution timeout exceeded');
  }
}
```

### Control 5: Duplicate Prevention

**Implementation:**
```typescript
// Add status index for quick check
CREATE INDEX IF NOT EXISTS idx_executions_running ON execution_requests(status) WHERE status IN ('queued', 'running');

async function hasActiveExecution(taskId: string): Promise<boolean> {
  const active = await dbInstance.stmt.getActiveExecutions.get(taskId);
  return active?.count > 0;
}
```

### Control 6: Execution Queue Management

**Implementation:**
```typescript
// Add queue position tracking
ALTER TABLE execution_requests ADD COLUMN queue_position INTEGER;

// When requesting execution
function calculateQueuePosition(autonomyLevel: number, requestedByType: string): number | null {
  if (autonomyLevel === 1 && requestedByType === 'founder') {
    return 0; // Immediate execution
  }
  return null; // Let background processor handle
}
```

## Phase 8 Implementation Details

### Database Changes Required

**Migration 007 additions:**
```sql
-- Track timeout for executions
ALTER TABLE execution_requests ADD COLUMN timeout_at TEXT;

-- Track queue position
ALTER TABLE execution_requests ADD COLUMN queue_position INTEGER;
CREATE INDEX idx_execution_queue ON execution_requests(queue_position) WHERE queue_position IS NOT NULL;

-- Track execution attempts
ALTER TABLE execution_requests ADD COLUMN attempt_count INTEGER DEFAULT 0;

-- Approval expiration
ALTER TABLE approval_requests ADD COLUMN expires_at TEXT;
CREATE INDEX idx_approvals_expires ON approval_requests(expires_at);
```

### Code Changes Required

**Files to modify:**
- `src/council.ts` - Core execution logic
- `src/database.ts` - Prepared statements

**New functions needed:**
- `verifyExecutionAuthorization()`
- `validatePermissions()`
- `verifyLevel3Approval()`
- `hasActiveExecution()`
- `checkExecutionTimeouts()`
- `calculateQueuePosition()`
- `failExecution()`
- `getTimedOutExecutions()`

### Execution Safety Guards

#### 1. Pre-execution Validation

```typescript
async function preExecutionValidation(ctx, execution): Promise<void> {
  // Authorization check
  if (!await verifyExecutionAuthorization(ctx, execution)) {
    throw new Error('Not authorized to execute this request');
  }
  
  // Status check
  if (!['queued', 'approved'].includes(execution.status)) {
    throw new Error(`Execution not ready: ${execution.status}`);
  }
  
  // Permission re-validation (Level 2)
  if (execution.autonomy_level === 2) {
    if (!await validatePermissions(execution.task_id, execution.requested_by_type, execution.requested_by_id)) {
      throw new Error('Permissions no longer valid');
    }
  }
  
  // Level 3 approval check
  if (execution.autonomy_level === 3 && execution.status !== 'approved') {
    throw new Error('Level 3 execution requires valid Founder approval');
  }
  
  // Duplicate check
  if (await hasActiveExecution(execution.task_id)) {
    throw new Error('Task already has active execution');
  }
}
```

#### 2. Post-execution Validation

```typescript
async function postExecutionValidation(executionId): Promise<void> {
  const execution = await dbInstance.stmt.getExecutionRequest.get(executionId);
  
  // Verify final status
  if (!['completed', 'failed', 'cancelled'].includes(execution.status)) {
    throw new Error('Execution did not reach terminal state');
  }
  
  // Log final audit record
  await logExecutionCompletion(execution);
}
```

### Cross-Division Execution Security

**Current risk:** Division head can execute for their division members, but no runtime validation.

**Fix:**
```typescript
function validateDivisionExecution(ctx, execution): boolean {
  if (execution.requested_by_type !== 'division') return true;
  
  // Verify division head is still head
  const division = dbInstance.stmt.getDivisionById.get(execution.requested_by_id);
  return division?.head_staff_id === ctx.owner_id;
}
```

### Founder Operation Protection

Only Founder should be able to:
- Approve executions (already restricted)
- Override execution failures
- Cancel any execution
- Access all execution history

```typescript
function requireFounderForOperation(ctx, operation: string): boolean {
  const founderOnlyOps = [
    'approve_execution',
    'fail_execution',
    'cancel_any_execution',
    'access_all_history'
  ];
  
  if (founderOnlyOps.includes(operation)) {
    return ctx.owner_type === 'founder';
  }
  return true;
}
```

## Testing Strategy

### Unit Tests

```typescript
// test/execution-security.test.ts

describe('Execution Security', () => {
  describe('Authorization', () => {
    test('cannot execute another division head request');
    test('cannot execute staff request when not assigned');
    test('cannot execute without founder approval (Level 3)');
  });
  
  describe('Status Transitions', () => {
    test('cannot skip approval (approved → completed)');
    test('cannot go from failed → running');
    test('cannot go from completed → running');
  });
  
  describe('Duplicate Prevention', () => {
    test('cannot request execution for active task');
    test('concurrent execution detection');
  });
  
  describe('Permission Re-validation', () => {
    test('Level 2 fails if permissions revoked');
    test('Level 3 fails if staff leaves division');
  });
  
  describe('Timeouts', () => {
    test('stale approvals are rejected');
    test('execution timeouts are handled');
    test('founder override on timeout');
  });
});
```

### Integration Tests

```
- Full execution lifecycle with security checks
- Cross-division execution boundaries
- Approval expiration scenarios
- Concurrent execution conflicts
- Permission revocation during execution
```

### Adversarial Tests

```
- Attempted status jumps (queued → completed)
- Unauthorized execution triggers
- Fake approval requests
- Race conditions in approval
```

## Rollout Strategy

### Phase 1: Validation Layer (Low Risk)
- Add pre-execution validation
- Add status transition guards
- Deploy with logging only

### Phase 2: Security Enforcement (Medium Risk)
- Reject invalid executions
- Add duplicate prevention
- Add timeout handling

### Phase 3: Full Security (High Confidence)
- Enable all controls
- Add execution history guards
- Implement queue management

## Monitoring and Alerting

### Metrics to Track

```typescript
// Execution security metrics
- execution_authorization_failures
- status_transition_violations
- duplicate_execution_attempts
- permission_validation_failures
- stale_approvals_used
- execution_timeout_count
```

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Auth failures | >5/min | >20/min |
| Status violations | >10/hr | >50/hr |
| Duplicates | >1/hr | >10/hr |

## Backward Compatibility

### Existing Executions

**Problem:** Running executions may not have all security fields.

**Solution:**
```typescript
function sanitizeExecutionForSecurity(execution): ExecutionRequest {
  // Fill in missing fields with defaults
  if (!execution.timeout_at) {
    execution.timeout_at = calculateDefaultTimeout(execution.autonomy_level);
  }
  
  if (execution.attempt_count === undefined) {
    execution.attempt_count = 1;
  }
  
  return execution;
}
```

### Migration Path

1. Add new columns (nullable)
2. Backfill missing values
3. Enforce constraints
4. Update application logic

## Documentation Updates

### Required Documentation

1. **Execution Lifecycle Diagram** - Updated with security states
2. **Permission Matrix** - Who can execute what
3. **Status Transition Table** - Valid transitions
4. **Timeout Configuration** - Default values and overrides
5. **Error Message Reference** - Security-related errors

## Rollback Plan

If security controls cause operational issues:

1. **Immediate:** Disable authorization checks, keep status guards
2. **Short-term:** Disable duplicate detection, keep timeouts
3. **Long-term:** Fix issues and re-enable all controls

**Rollback triggers:**
- >10% execution failures due to security
- Critical founder operations blocked
- Execution latency >5x baseline