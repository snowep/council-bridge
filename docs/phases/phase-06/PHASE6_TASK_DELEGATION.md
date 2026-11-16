# Phase 6: Task Delegation

## Task Lifecycle

### States
```
pending → in_progress → review → completed | cancelled
```

### Transitions
- `pending` → `in_progress`: Division Head or assigned staff agent claims task
- `in_progress` → `review`: Task submitted for review (self-review or Division Head review)
- `review` → `completed`: Reviewer approves
- `review` → `cancelled`: Reviewer rejects; task returns to `in_progress` or re-assigned
- Any state → `cancelled`: Unrecoverable error, resource loss, deadline missed, or explicit cancellation

### Task Creation

#### By Founder
```
create_task(input):
  title, description, assigned_to_type, assigned_to_id,
  created_by_type = 'founder', created_by_id = founder_staff_id,
  status = 'pending', priority (low|medium|high|critical), due_at (optional),
  dependencies (JSON array of task_ids, optional), budget_allocated (optional)
```

#### By Division Head (their division)
```
Division Head can create tasks assigned to:
- Their division staff agents
- The division itself
```

#### By Specialist (own tasks)
```
Specialist creates task assigned to self:
  assigned_to_type = 'staff', assigned_to_id = their_staff_id
```

### Task Assignment

#### Direct Assignment
```
task.assigned_to_type = 'staff' | 'division'
task.assigned_to_id = specific_id
```
- Note: `seat` and `founder` assignment types removed in actual DB schema; use `staff` for individual agents

#### Division-Level Assignment
```
task.assigned_to_type = 'division'
task.assigned_to_id = division_id
```
- All staff in that division see it
- Division Head can reassign within division

### Dependencies
- Not yet in DB schema; add `dependencies` JSON column during implementation
- JSON array of task_ids that must complete first
- Cyclic dependency detection at creation time
- Cannot mark complete if unresolved dependencies remain

#### Dependency Resolution
- When dependency completes: check if dependent can now start
- Automatic status update: `pending` → `in_progress` if all deps complete
- Notification to assignee when deps resolve

### Priority
```
low | medium | high | critical
```
- Default: medium
- Enum type (not integer 1-5 as previously documented)
- Division Head can adjust within approved limits
- Founder can override any priority
- Priority ordering in `listTasks` query

### Deadlines
```
due_at: ISO datetime or NULL
```
- Optional; no enforcement in schema but UI displays
- Task overdue flag in UI (computed: now > due_at AND status != 'completed')
- Founder receives overdue report weekly

### Budget
```
budget_allocated: REAL DEFAULT 0
```
- Tracked per task
- Division Head manages within division budget_limit

## Review and Approval

### Reviewers
- **Self-review**: Assignee can review their own task (status → review)
- **Division Head**: Reviews tasks assigned to their division
- **Founder**: Overrides any review, approves or rejects
- **Council**: Can review tasks created by council

### Review Process
1. Task status → `review`
2. Reviewer examines: title, description, deliverables, progress
3. Reviewer sets outcome: `approved` or `rejected`
4. If approved: status → `completed`
5. If rejected: status → `in_progress` (re-assign) or `cancelled`

### Failure and Retry
- On `rejected`: task returns to `in_progress`
- New assignee can be: same person, different person in same division, Division Head
- Retry counter tracked in `updated_at` or separate field (add during implementation)
- After 3 failures: task escalated to Founder for review
- Founder may: approve as-is, re-assign, cancel, or modify scope

## Deliverables

### Creation
- Linked to exactly one task via `task_id` (FK)
- `submitted_by_type`/`submitted_by_id`: who submitted (staff | division)
- `content`: JSON payload
- Initial `status`: `submitted`

### Lifecycle
```
submitted → accepted | rejected | revision_requested
```
- Note: `under_review` removed; `accepted` replaces `approved`; `revision_requested` added

### Review
- `reviewed_by_type`/`reviewed_by_id`: who reviewed (founder | council | division_head)
- `reviewed_at`: ISO timestamp
- Review outcome recorded

### Version History (Resolves A1)
- **Single-row approach with `audit_log` JSON column** (to be added during implementation)
- Each status change appends to `audit_log`: `{by_type, by_id, action, timestamp, before, after}`
- Immutable append-only: new entries appended, never modified
- Historical versions retrieved by reading `audit_log` entries in order
- Approval history preserved in `reviewed_by_type`, `reviewed_by_id`, `reviewed_at` + `audit_log`
- `updated_at` on the row tracks last modification time

### File References
- Not yet in DB schema; add `file_references` JSON column during implementation
```
file_references: JSON array of file paths
```
- Actual files stored outside DB (project directory, artifact storage)
- DB references only; no binary storage in SQLite

### Task Relationships
- Not yet in DB schema; add `task_relationships` JSON column during implementation
```
task_relationships: JSON array of task_ids
```
- Which tasks this deliverable relates to
- Useful for multi-task deliverables

### Audit History
- Not yet in DB schema; add `audit_log` JSON column during implementation
```
audit_log: JSON array of entries
```
- Each entry: `{by_type, by_id, action, timestamp, before, after}`
- Immutable append-only
- Founder can audit any changes

## Cross-Division Coordination

### Requests Between Division Heads

#### Request Format
```
{
  type: 'task_delegate' | 'deliverable_share' | 'memory_access' | 'resource_request',
  from_division: 'division_id',
  to_division: 'division_id',
  task_id or memory_id or description,
  justification,
  priority: low | medium | high | critical,
  deadline: ISO datetime (optional),
  approved_by: 'founder_staff_id' (null if pending)
}
```

#### Workflow
1. Division Head A submits request via MCP tool
2. Request stored in pending queue (extend `cross_division_shares` with `request_type`, `status` fields during implementation — resolves A6)
3. Founder reviews
4. Founder approves or rejects
5. If approved: cross-division share created
6. If rejected: Division Head A notified; may re-submit with revisions

#### Authorization
- Division Head can request; Founder approves
- No unilateral cross-division access
- All requests auditable: who, when, why, outcome

### Shared Tasks
- Task assigned to `assigned_to_type = 'division'`
- All staff in receiving division see it
- Division Head of receiving division can reassign
- Division Head of originating division retains visibility

### Shared Deliverables
- Deliverable with `task_id` visible across divisions
- Access controlled via `cross_division_shares` if memory involved
- Review can be coordinated: both divisions' Division Heads can review

### Access Authorization
- Default: division-level isolation
- Explicit grants via `cross_division_shares` only
- Query layer: `WHERE memory_id IN (SELECT memory_id FROM cross_division_shares WHERE division_id = current_division)`
- All grants by Founder only; auditable

### Conflict Resolution
1. Originating Division Head's request takes priority
2. If both divisions claim same resource: Founder decides
3. Audit trail documents the conflict and resolution
4. Future requests reference previous resolutions