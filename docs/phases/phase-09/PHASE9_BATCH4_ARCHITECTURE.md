# Phase 9 Batch 4 Architecture Design
## Deliverable Workflow Implementation

**Date**: 2026-11-14  
**Branch**: master  
**Base Commit**: 6275a70 (Phase 9 Batch 3 complete)

---

## 1. Intent & Goals

Extend the Batch 3 Task Delegation Engine with a complete, secure Deliverable Workflow supporting:
- Draft creation, submission, review, revision, approval, rejection
- Configurable quality thresholds with enforcement
- HITL approval (Levels 1/2/3) integrated with existing autonomy system
- Role-based access control preserving cross-division boundaries
- Full audit trail and version history
- Authenticated MCP tool exposure

**Non-Goals**: Batch 5 Full Integration, governance policy changes, destructive DB operations.

---

## 2. Current State (Batch 3)

### Existing Deliverable Table
```sql
CREATE TABLE deliverables (
  deliverable_id    TEXT PRIMARY KEY,
  task_id           TEXT NOT NULL,
  submitted_by_type TEXT NOT NULL CHECK (submitted_by_type IN ('staff', 'division')),
  submitted_by_id   TEXT NOT NULL,
  content           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'accepted', 'rejected', 'revision_requested')),
  reviewed_by_type  TEXT,
  reviewed_by_id    TEXT,
  reviewed_at       TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);
```

### Existing Service Functions (task-delegation.ts)
- `submitDeliverable()` — creates deliverable, marks task `completed`
- `reviewDeliverable()` — updates status, records reviewer
- Authorization: founder, task creator, division head, assigned division staff

### Existing Autonomy System (operations.ts)
- `task_autonomy_levels` table: task_type → level 1/2/3
- `requestExecution()` → `approval_required` for Level 3
- `approveExecution()` — Founder-only, updates status to `approved`

---

## 3. Database Schema Extensions

### 3.1 Deliverables Table — Add Columns
```sql
ALTER TABLE deliverables ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE deliverables ADD COLUMN quality_score INTEGER
  CHECK (quality_score BETWEEN 0 AND 100);
ALTER TABLE deliverables ADD COLUMN reviewer_type TEXT
  CHECK (reviewer_type IN ('founder', 'council', 'division_head'));
ALTER TABLE deliverables ADD COLUMN reviewer_id TEXT;
ALTER TABLE deliverables ADD COLUMN approved_at TEXT;
ALTER TABLE deliverables ADD COLUMN approved_by_type TEXT
  CHECK (approved_by_type IN ('founder', 'council', 'division_head'));
ALTER TABLE deliverables ADD COLUMN approved_by_id TEXT;
ALTER TABLE deliverables ADD COLUMN founder_signature TEXT;
ALTER TABLE deliverables ADD COLUMN founder_signed_at TEXT;
ALTER TABLE deliverables ADD COLUMN revision_notes TEXT;
```

### 3.2 Deliverable Versions Table (Audit Trail)
```sql
CREATE TABLE IF NOT EXISTS deliverable_versions (
  version_id        TEXT PRIMARY KEY,
  deliverable_id    TEXT NOT NULL,
  version_num       INTEGER NOT NULL,
  content           TEXT NOT NULL,
  quality_score     INTEGER,
  status            TEXT NOT NULL,
  submitted_by_type TEXT NOT NULL,
  submitted_by_id   TEXT NOT NULL,
  revision_notes    TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(deliverable_id) ON DELETE CASCADE,
  UNIQUE(deliverable_id, version_num)
);

CREATE INDEX idx_deliverable_versions_deliverable ON deliverable_versions(deliverable_id);
```

### 3.3 Quality Thresholds Table
```sql
CREATE TABLE IF NOT EXISTS quality_thresholds (
  threshold_id      TEXT PRIMARY KEY,
  division_id       TEXT,           -- NULL = global default
  task_type         TEXT,           -- NULL = all types
  min_quality_score INTEGER NOT NULL DEFAULT 70 CHECK (min_quality_score BETWEEN 0 AND 100),
  requires_review   INTEGER NOT NULL DEFAULT 1 CHECK (requires_review IN (0, 1)),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
  UNIQUE(division_id, task_type)
);

CREATE INDEX idx_quality_thresholds_division ON quality_thresholds(division_id);
```

### 3.4 Migration Strategy
- Use existing migration-runner infrastructure (`src/migration-runner/`)
- Backup before migration (WAL mode, foreign keys ON)
- Rollback: drop added columns/tables, restore from backup

---

## 4. Service Layer Extensions (task-delegation.ts)

### 4.1 New Types
```typescript
interface CreateDeliverableDraftInput {
  task_id: string;
  content: string;
  quality_score?: number;
}

interface AssignReviewerInput {
  deliverable_id: string;
  reviewer_type: 'founder' | 'council' | 'division_head';
  reviewer_id: string;
}

interface RequestRevisionInput {
  deliverable_id: string;
  revision_notes: string;
}

interface ResubmitDeliverableInput {
  deliverable_id: string;
  content: string;
  quality_score?: number;
}

interface ApproveDeliverableInput {
  deliverable_id: string;
  quality_score?: number;
  founder_signature?: string; // Required for Level 3
}

interface RejectDeliverableInput {
  deliverable_id: string;
  rejection_reason: string;
}

interface QualityThresholdInput {
  division_id?: string;
  task_type?: string;
  min_quality_score: number;
  requires_review: boolean;
}
```

### 4.2 New Functions

| Function | Purpose | Auth |
|----------|---------|------|
| `createDeliverableDraft()` | Create draft (status: `draft`) | Task assignee |
| `submitDeliverable()` | Submit draft → `submitted` | Task assignee |
| `assignReviewer()` | Explicit reviewer assignment | Task creator, division head, founder |
| `requestRevision()` | Set `revision_requested` with notes | Assigned reviewer |
| `resubmitDeliverable()` | Increment version, reset to `submitted` | Original submitter |
| `approveDeliverable()` | Approve with HITL enforcement | Per autonomy level |
| `rejectDeliverable()` | Reject with reason | Assigned reviewer |
| `getDeliverableHistory()` | Version + audit trail | Task participants |
| `setQualityThreshold()` | Configure threshold | Founder |
| `getQualityThreshold()` | Resolve threshold for task | Internal |

### 4.3 HITL Enforcement Logic

```typescript
function enforceHITL(db, ctx, taskId, deliverable, qualityScore) {
  const autonomy = getTaskAutonomyLevel(db, task.title)?.autonomy_level ?? 1;
  const threshold = getQualityThreshold(db, task);
  
  // Quality gate
  if (qualityScore < threshold.min_quality_score) {
    throw new Error(`Quality score ${qualityScore} below threshold ${threshold.min_quality_score}`);
  }
  
  switch (autonomy) {
    case 1: // Autonomous
      return { approved: true, requires_founder_sig: false };
    case 2: // Permission check / Division head approval
      if (!isDivisionHead(ctx) && !isFounder(ctx)) {
        throw new Error('Level 2 requires Division Head or Founder approval');
      }
      return { approved: true, requires_founder_sig: false };
    case 3: // Founder mandatory
      if (!isFounder(ctx)) {
        throw new Error('Level 3 requires Founder approval');
      }
      if (!founder_signature || !verifyFounderSignature(founder_signature)) {
        throw new Error('Valid Founder signature required for Level 3');
      }
      return { approved: true, requires_founder_sig: true };
  }
}
```

---

## 5. MCP Tool Extensions (tools.ts)

### 5.1 New Zod Schemas
```typescript
const CreateDeliverableDraftSchema = z.object({
  task_id: z.string().min(1).max(255),
  content: z.string().min(1),
  quality_score: z.number().int().min(0).max(100).optional(),
});

const AssignDeliverableReviewerSchema = z.object({
  deliverable_id: z.string().min(1).max(255),
  reviewer_type: z.enum(['founder', 'council', 'division_head']),
  reviewer_id: z.string().min(1).max(255),
});

const RequestDeliverableRevisionSchema = z.object({
  deliverable_id: z.string().min(1).max(255),
  revision_notes: z.string().min(1).max(5000),
});

const ResubmitDeliverableSchema = z.object({
  deliverable_id: z.string().min(1).max(255),
  content: z.string().min(1),
  quality_score: z.number().int().min(0).max(100).optional(),
});

const ApproveDeliverableSchema = z.object({
  deliverable_id: z.string().min(1).max(255),
  quality_score: z.number().int().min(0).max(100).optional(),
  founder_signature: z.string().optional(),
});

const RejectDeliverableSchema = z.object({
  deliverable_id: z.string().min(1).max(255),
  rejection_reason: z.string().min(1).max(5000),
});

const GetDeliverableHistorySchema = z.object({
  deliverable_id: z.string().min(1).max(255),
});

const SetQualityThresholdSchema = z.object({
  division_id: z.string().optional(),
  task_type: z.string().optional(),
  min_quality_score: z.number().int().min(0).max(100),
  requires_review: z.boolean().default(true),
});

const GetQualityThresholdSchema = z.object({
  division_id: z.string().optional(),
  task_type: z.string().optional(),
});
```

### 5.2 Tool Registration (Append to registerMcpTools)
```typescript
// Deliverable Workflow Tools
mcpServer.tool('create_deliverable_draft', ..., createToolHandler(...));
mcpServer.tool('submit_deliverable', ..., createToolHandler(...)); // Wraps existing
mcpServer.tool('assign_deliverable_reviewer', ..., createToolHandler(...));
mcpServer.tool('request_deliverable_revision', ..., createToolHandler(...));
mcpServer.tool('resubmit_deliverable', ..., createToolHandler(...));
mcpServer.tool('approve_deliverable', ..., createToolHandler(...));
mcpServer.tool('reject_deliverable', ..., createToolHandler(...));
mcpServer.tool('get_deliverable_history', ..., createToolHandler(...));

// Quality Threshold Tools (Founder only)
mcpServer.tool('set_quality_threshold', ..., createToolHandler(...));
mcpServer.tool('get_quality_threshold', ..., createToolHandler(...));
```

---

## 6. Authorization Matrix

| Operation | Founder | Division Head (creator) | Division Head (other) | Staff (assignee) | Staff (same division) | Reviewer |
|-----------|---------|------------------------|----------------------|------------------|----------------------|----------|
| `createDeliverableDraft` | ✅ | ✅ | ❌ | ✅ (own task) | ❌ | ❌ |
| `submitDeliverable` | ✅ | ✅ | ❌ | ✅ (own task) | ❌ | ❌ |
| `assignReviewer` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `requestRevision` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (assigned) |
| `resubmitDeliverable` | ✅ | ✅ | ❌ | ✅ (original submitter) | ❌ | ❌ |
| `approveDeliverable` | ✅ | Level 2 only | ❌ | ❌ | ❌ | Level 1 auto |
| `rejectDeliverable` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (assigned) |
| `getDeliverableHistory` | ✅ | ✅ | ❌ | ✅ (own) | ✅ (division) | ✅ |
| `setQualityThreshold` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 7. Quality Threshold Resolution

```typescript
function getQualityThreshold(db, task): { min_quality_score: number; requires_review: boolean } {
  // 1. Division-specific + task_type
  let threshold = db.query(
    'SELECT * FROM quality_thresholds WHERE division_id = ? AND task_type = ?',
    [task.assigned_to_id, task.title]
  )[0];
  
  // 2. Division default
  if (!threshold && task.assigned_to_type === 'division') {
    threshold = db.query(
      'SELECT * FROM quality_thresholds WHERE division_id = ? AND task_type IS NULL',
      [task.assigned_to_id]
    )[0];
  }
  
  // 3. Global default
  if (!threshold) {
    threshold = db.query(
      'SELECT * FROM quality_thresholds WHERE division_id IS NULL AND task_type IS NULL'
    )[0];
  }
  
  return {
    min_quality_score: threshold?.min_quality_score ?? 70,
    requires_review: threshold?.requires_review ?? 1
  };
}
```

---

## 8. Test Plan (22 Required Tests)

| # | Test | Category |
|---|------|----------|
| 1 | Valid deliverable submission | Happy path |
| 2 | Unauthorized submission rejection | Auth |
| 3 | Review assignment and retrieval | Happy path |
| 4 | Authorized review approval | Auth |
| 5 | Unauthorized review rejection | Auth |
| 6 | Revision request and resubmission | Happy path |
| 7 | Quality score validation (0-100) | Validation |
| 8 | Configurable quality threshold enforcement | Quality |
| 9 | Approval blocked when quality requirements fail | Quality |
| 10 | Level 1 workflow (auto-approve ≥ threshold) | HITL |
| 11 | Level 2 permission and approval workflow | HITL |
| 12 | Level 3 Founder approval workflow | HITL |
| 13 | Missing Founder signature rejection | Security |
| 14 | Invalid Founder signature rejection | Security |
| 15 | Expired and replayed authorization rejection | Security |
| 16 | Unauthorized approval bypass rejection | Security |
| 17 | Deliverable version history | Audit |
| 18 | Audit history consistency | Audit |
| 19 | Cross-division authorization | Auth |
| 20 | Concurrent review and approval handling | Concurrency |
| 21 | Task-to-deliverable relationship integrity | Integrity |
| 22 | Failure rollback and recovery | Resilience |

---

## 9. Documentation Deliverables

| File | Purpose |
|------|---------|
| `PHASE9_BATCH4_ARCHITECTURE.md` | This document |
| `PHASE9_BATCH4_IMPLEMENTATION_REPORT.md` | Implementation summary |
| `PHASE9_BATCH4_TEST_REPORT.md` | Test results (22 tests) |
| `PHASE9_BATCH4_SECURITY_AUDIT.md` | Security analysis |
| `PHASE9_BATCH4_INTEGRATION_REPORT.md` | End-to-end workflow verification |
| `PHASE9_BATCH4_REGRESSION_REPORT.md` | Regression analysis |

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Schema migration failure | Low | High | Backup + rollback procedure |
| HITL bypass vulnerability | Low | Critical | Service-layer enforcement + tests |
| Quality threshold misconfiguration | Medium | Medium | Default 70, validation, Founder-only config |
| Cross-division data leak | Low | High | Existing authorization matrix + tests |
| Deliverable version gap | Medium | Medium | Versions table + trigger on update |

---

## 11. Implementation Sequence

1. **Migration**: Add columns + tables (with backup)
2. **Service Layer**: Implement 10 new functions in task-delegation.ts
3. **MCP Tools**: Register 9 new tools in tools.ts
4. **Tests**: Write 22 tests in phase9_deliverable.test.ts
5. **Run**: Verify all pass + TypeScript clean
6. **Security Audit**: STRIDE + authorization matrix verification
7. **Integration Test**: Task → Deliverable → Review → Approve
8. **Documentation**: Generate 6 report files
9. **Commit/Push**: To origin/master
10. **Final Report**: Commit SHA, file list, test results, verdict