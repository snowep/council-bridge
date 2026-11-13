-- Migration 006: Phase 7 Autonomy, Permissions and Execution
-- Purpose: Add execution request/approval workflow and autonomy levels
-- Prerequisites: Migrations 001-005 complete
-- Postconditions: Execution requests with autonomy levels, approval workflow, audit trail
-- Type: Safe ALTER TABLE (additive) + new tables
-- Rollback: DROP TABLE execution_requests, execution_history, task_autonomy_levels

PRAGMA foreign_keys = OFF;

BEGIN IMMEDIATE TRANSACTION;

-- 1. Task autonomy levels (maps task types to autonomy levels)
CREATE TABLE task_autonomy_levels (
  task_type       TEXT PRIMARY KEY,                    -- e.g., 'research', 'analysis', 'drafting', 'planning', 'code_execution', 'deployment', 'permission_grant', 'staff_appointment', 'budget_allocation'
  autonomy_level  INTEGER NOT NULL                     -- 1 = autonomous internal, 2 = bounded execution, 3 = founder approval required
    CHECK (autonomy_level IN (1, 2, 3)),
  description     TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Execution requests (approval workflow + execution tracking)
CREATE TABLE execution_requests (
  execution_id          TEXT PRIMARY KEY,
  task_id               TEXT NOT NULL,                 -- Reference to tasks table
  requested_by_type     TEXT NOT NULL                  -- 'staff' | 'division' | 'founder'
    CHECK (requested_by_type IN ('staff', 'division', 'founder')),
  requested_by_id       TEXT NOT NULL,                 -- staff_id or division_id or 'founder'
  autonomy_level        INTEGER NOT NULL               -- 1, 2, or 3
    CHECK (autonomy_level IN (1, 2, 3)),
  action_description    TEXT NOT NULL,                 -- Human-readable description of proposed action
  action_payload        TEXT NOT NULL DEFAULT '{}',    -- JSON payload with action parameters
  status                TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'permission_check', 'approval_required', 'approved', 'rejected', 'queued', 'running', 'completed', 'failed', 'cancelled')),
  approval_request_id   TEXT,                          -- Reference to approval_requests if Level 3
  approval_id           TEXT,                          -- Reference to approvals table when approved
  permission_grants     TEXT NOT NULL DEFAULT '[]',    -- JSON array of cross_division_shares granted for this execution
  error_message         TEXT,                          -- Failure reason if failed
  result_payload        TEXT,                          -- JSON result of execution
  started_at            TEXT,                          -- When execution started
  completed_at          TEXT,                          -- When execution finished
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);

-- 3. Approval requests (Founder approval for Level 3 actions)
CREATE TABLE approval_requests (
  approval_request_id   TEXT PRIMARY KEY,
  execution_id          TEXT NOT NULL UNIQUE,          -- Links to execution_requests
  requested_by_type     TEXT NOT NULL
    CHECK (requested_by_type IN ('staff', 'division', 'founder')),
  requested_by_id       TEXT NOT NULL,
  action_description    TEXT NOT NULL,
  action_payload        TEXT NOT NULL DEFAULT '{}',
  justification         TEXT NOT NULL,                 -- Why this needs Founder approval
  priority              TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  deadline              TEXT,                          -- ISO datetime for approval deadline
  status                TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  approved_by_type      TEXT,                          -- Always 'founder' when approved
  approved_by_id        TEXT,                          -- Founder's staff_id
  approved_at           TEXT,                          -- Approval timestamp
  rejection_reason      TEXT,                          -- Why rejected
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (execution_id) REFERENCES execution_requests(execution_id) ON DELETE CASCADE
);

-- 4. Execution history (immutable audit trail)
CREATE TABLE execution_history (
  history_id            TEXT PRIMARY KEY,
  execution_id          TEXT NOT NULL,                 -- Reference to execution_requests
  task_id               TEXT NOT NULL,
  requested_by_type     TEXT NOT NULL,
  requested_by_id       TEXT NOT NULL,
  autonomy_level        INTEGER NOT NULL,
  action_description    TEXT NOT NULL,
  action_payload        TEXT NOT NULL,
  status_before         TEXT NOT NULL,
  status_after          TEXT NOT NULL,
  approval_reference    TEXT,                          -- approval_request_id if applicable
  permission_grants     TEXT NOT NULL DEFAULT '[]',
  result_payload        TEXT,
  error_message         TEXT,
  executed_by_type      TEXT,                          -- Who actually executed (may differ from requester)
  executed_by_id        TEXT,
  started_at            TEXT,
  completed_at          TEXT,
  recorded_at           TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (execution_id) REFERENCES execution_requests(execution_id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);

-- 5. Add autonomy_level column to tasks (for quick filtering)
ALTER TABLE tasks ADD COLUMN autonomy_level INTEGER
  CHECK (autonomy_level IN (1, 2, 3));

-- 6. Add execution_id column to deliverables (link execution to deliverable)
ALTER TABLE deliverables ADD COLUMN execution_id TEXT;
-- Note: FK not enforced at DB level to allow orphaned executions, but app-layer validates

-- 7. Indexes for common queries
CREATE INDEX idx_execution_requests_task ON execution_requests(task_id);
CREATE INDEX idx_execution_requests_status ON execution_requests(status);
CREATE INDEX idx_execution_requests_requested ON execution_requests(requested_by_type, requested_by_id);
CREATE INDEX idx_execution_requests_autonomy ON execution_requests(autonomy_level);
CREATE INDEX idx_approval_requests_execution ON approval_requests(execution_id);
CREATE INDEX idx_approval_requests_status ON approval_requests(status);
CREATE INDEX idx_execution_history_execution ON execution_history(execution_id);
CREATE INDEX idx_execution_history_task ON execution_history(task_id);
CREATE INDEX idx_task_autonomy_levels_level ON task_autonomy_levels(autonomy_level);

COMMIT;

PRAGMA foreign_keys = ON;

-- Verification:
-- SELECT * FROM task_autonomy_levels;
-- SELECT * FROM execution_requests;
-- SELECT * FROM approval_requests;
-- SELECT * FROM execution_history;
-- PRAGMA table_info(tasks); -- should show autonomy_level
-- PRAGMA table_info(deliverables); -- should show execution_id