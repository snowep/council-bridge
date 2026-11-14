# Phase 10 API Integration Audit

## Frontend Endpoint Inventory

| Frontend Page | HTTP Method | Requested Endpoint | Backend Status |
|---|---|---|---|
| Login | POST | `/api/auth/session` | ✅ Implemented |
| Login | GET | `/api/auth/founder/public-key` | ✅ Implemented |
| Login | GET | `/api/auth/status` | ✅ Implemented |
| Dashboard | - | (no API calls - static) | - |
| Chat | GET | `/api/messages/conversations` | ❌ **MISSING** (404) |
| Chat | GET | `/api/messages/:conversationId` | ❌ **MISSING** (404) |
| Chat | POST | `/api/messages` | ❌ **MISSING** (404) |
| Council | GET | `/api/council/seats` | ❌ **MISSING** (404) |
| Council | GET | `/api/council/personas` | ❌ **MISSING** (404) |
| Council | GET | `/api/council/meetings` | ❌ **MISSING** (404) |
| Meetings | GET | `/api/meetings` | ❌ **MISSING** (404) |
| Meetings | GET | `/api/meetings/:id` | ❌ **MISSING** (404) |
| Meetings | GET | `/api/meetings/:id/phases` | ❌ **MISSING** (404) |
| Memory | GET | `/api/memory` | ❌ **MISSING** (404) |
| Memory | GET | `/api/memory/:id` | ❌ **MISSING** (404) |
| Organization | GET | `/api/divisions` | ❌ **MISSING** (404) |
| Organization | GET | `/api/staff` | ❌ **MISSING** (404) |
| Organization | GET | `/api/divisions/members` | ❌ **MISSING** (404) |
| Organization | GET | `/api/organization/divisions` | ❌ **MISSING** (404) |
| Organization | GET | `/api/organization/staff` | ❌ **MISSING** (404) |
| Tasks | GET | `/api/tasks` | ❌ **MISSING** (404) |
| Tasks | GET | `/api/tasks/:id` | ❌ **MISSING** (404) |
| Tasks | POST | `/api/tasks` | ❌ **MISSING** (404) |
| Tasks | PUT | `/api/tasks/:id/assign` | ❌ **MISSING** (404) |
| Tasks | PUT | `/api/tasks/:id/status` | ❌ **MISSING** (404) |
| Tasks | GET | `/api/organization/divisions` | ❌ **MISSING** (404) |
| Tasks | GET | `/api/organization/staff` | ❌ **MISSING** (404) |
| Executions | GET | `/api/executions` | ❌ **MISSING** (404) |
| Executions | GET | `/api/executions/:id` | ✅ Implemented |
| Executions | GET | `/api/executions/:id/history` | ✅ Implemented |
| Executions | POST | `/api/execution/request` | ✅ Implemented (different path) |
| Executions | POST | `/api/execution/approve` | ✅ Implemented |
| Executions | POST | `/api/execution/:id/execute` | ✅ Implemented |
| Executions | POST | `/api/execution/:id/cancel` | ✅ Implemented |
| Executions | GET | `/api/executions/autonomy-levels` | ❌ **MISSING** (404) |
| Executions | GET | `/api/approvals` | ⚠️ **500 ERROR** |
| Executions | GET | `/api/tasks` | ❌ **MISSING** (404) |
| Deliverables | GET | `/api/deliverables` | ❌ **MISSING** (404) |
| Deliverables | GET | `/api/deliverables/:id` | ❌ **MISSING** (404) |
| Deliverables | GET | `/api/deliverables/:id/versions` | ❌ **MISSING** (404) |
| Deliverables | POST | `/api/deliverables` | ❌ **MISSING** (404) |
| Deliverables | PUT | `/api/deliverables/:id/submit` | ❌ **MISSING** (404) |
| Deliverables | PUT | `/api/deliverables/:id/review` | ❌ **MISSING** (404) |
| Deliverables | PUT | `/api/deliverables/:id/revision` | ❌ **MISSING** (404) |
| Deliverables | GET | `/api/quality-thresholds` | ❌ **MISSING** (404) |
| Deliverables | GET | `/api/tasks` | ❌ **MISSING** (404) |
| Approvals | GET | `/api/approvals` | ⚠️ **500 ERROR** |

## Existing Backend Route Inventory

| Method | Path | Handler | Auth |
|---|---|---|---|
| POST | `/api/auth/session` | Session creation | founderSignatureMiddleware (prod) |
| DELETE | `/api/auth/session` | Session deletion | authMiddleware |
| GET | `/api/auth/status` | Auth status | authMiddleware |
| GET | `/api/auth/founder/public-key` | Founder public key | none |
| POST | `/api/task-autonomy` | Create autonomy level | authMiddleware + founderSignatureRateLimit |
| GET | `/api/task-autonomy` | List autonomy levels | authMiddleware |
| POST | `/api/execution/request` | Request execution | authMiddleware |
| GET | `/api/execution/:id` | Get execution | authMiddleware |
| GET | `/api/execution` | List executions | authMiddleware |
| POST | `/api/execution/approve` | Approve execution | authMiddleware + founderSignatureRateLimit + founderSignatureMiddleware |
| GET | `/api/approvals` | List approval requests | authMiddleware |
| GET | `/api/execution/:id/history` | Get execution history | authMiddleware |
| POST | `/api/execution/:id/execute` | Execute execution | authMiddleware + founderSignatureRateLimit + founderSignatureMiddleware |
| POST | `/api/execution/:id/cancel` | Cancel execution | authMiddleware + founderSignatureRateLimit |
| GET | `/health` | Health check | none |
| ALL | `/mcp` | MCP endpoint | authMiddleware |

## Missing Routes Analysis

### 1. Messages/Chat (3 endpoints)
- `GET /api/messages/conversations` - List conversations for authenticated user
- `GET /api/messages/:conversationId` - Get messages in a conversation
- `POST /api/messages` - Send a message

### 2. Council (3 endpoints)
- `GET /api/council/seats` - List council seats
- `GET /api/council/personas` - List personas
- `GET /api/council/meetings` - List meetings

### 3. Meetings (3 endpoints)
- `GET /api/meetings` - List meetings
- `GET /api/meetings/:id` - Get meeting details
- `GET /api/meetings/:id/phases` - Get meeting phases

### 4. Memory (2 endpoints)
- `GET /api/memory` - List memory entries (with filters)
- `GET /api/memory/:id` - Get memory entry details

### 5. Organization (5 endpoints)
- `GET /api/divisions` - List all divisions
- `GET /api/staff` - List all staff agents
- `GET /api/divisions/members` - List division members
- `GET /api/organization/divisions` - Alias for divisions
- `GET /api/organization/staff` - Alias for staff

### 6. Tasks (5 endpoints)
- `GET /api/tasks` - List tasks (with filters)
- `GET /api/tasks/:id` - Get task details
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id/assign` - Assign/reassign task
- `PUT /api/tasks/:id/status` - Update task status

### 7. Executions (2 missing endpoints)
- `GET /api/executions` - List executions (frontend uses `/api/executions` not `/api/execution`)
- `GET /api/executions/autonomy-levels` - List task autonomy levels

### 8. Approvals (1 endpoint - 500 error)
- `GET /api/approvals` - List approval requests (returns 500)

### 9. Deliverables (6 endpoints)
- `GET /api/deliverables` - List deliverables
- `GET /api/deliverables/:id` - Get deliverable details
- `GET /api/deliverables/:id/versions` - Get version history
- `POST /api/deliverables` - Create deliverable draft
- `PUT /api/deliverables/:id/submit` - Submit for review
- `PUT /api/deliverables/:id/review` - Review deliverable
- `PUT /api/deliverables/:id/revision` - Request revision
- `GET /api/quality-thresholds` - Get quality thresholds

## Root Cause of 500 Error on `/api/approvals`

Looking at `server.ts` line 314-330:

```typescript
app.get('/api/approvals', authMiddleware, async (req, res) => {
  try {
    const ctx = getAuthContext(req)!;
    const input: any = {
      status: req.query.status as any,
      requested_by_type: ctx.owner_type === 'founder' ? req.query.requested_by_type as any : undefined,
      requested_by_id: ctx.owner_type === 'founder' ? req.query.requested_by_id as string | undefined : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0
    };

    const result = await listApprovalRequests(db, ctx, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list approval requests' });
  }
});
```

The issue: `listApprovalRequests` in `operations.ts` (line 644-676) requires Founder context:

```typescript
export function listApprovalRequests(
  db: DatabaseInstance,
  ctx: OperationContext,
  input: ListApprovalRequestsInput
): ApprovalRequest[] {
  requireFounderContext(ctx, 'Only Founder can list approval requests');
  ...
}
```

But the frontend's ApprovalsPage calls this endpoint without ensuring the user is Founder. The endpoint needs to:
1. Allow non-Founder users to see their own approval requests (if they requested them)
2. Or the frontend needs to authenticate as Founder

## Database Compatibility Findings

- Schema version: 5.0.0 (includes task_audit table)
- Migration 013 applied: deliverable_versions, quality_thresholds tables exist
- All required tables present: messages, meetings, divisions, staff_agents, division_members, tasks, deliverables, task_autonomy_levels, execution_requests, approval_requests, execution_history
- Founder nonce store exists for replay protection

## Existing Service Functions Available for Reuse

### Messages (`src/messages.ts`)
- `createMessageService` - sendMessage, checkInbox, replyMessage, listMessages

### Council Meetings (`src/council/meetings.ts`)
- `listMeetings`, `getMeetingById`, `getMeetingPhases`

### Divisions/Staff (`src/council/divisions.ts`)
- `listDivisions`, `getDivisionById`, `listStaffAgents`, `getStaffAgentById`
- `getDivisionMembers`, `getStaffDivisions`
- `listTasks`, `getTaskById`, `createTask`, `updateTask`

### Deliverables (`src/council/divisions.ts`)
- `createDeliverable`, `getDeliverableById`, `listDeliverablesByTask`, `updateDeliverable`

### Task Delegation (`src/council/task-delegation.ts`)
- `delegateTask`, `acceptDelegation`, `rejectDelegation`
- `listDelegationTasks`, `validateTaskAccess`
- `createDeliverableDraft`, `submitDeliverable`, `reviewDeliverable`
- `requestRevision`, `resubmitDeliverable`, `approveDeliverable`, `rejectDeliverable`
- `getDeliverableHistory`, `setQualityThreshold`, `getQualityThresholdConfig`
- `getQualityThreshold`, `enforceHITLApproval`, `isDivisionHead`

### Operations (`src/council/operations.ts`)
- `listExecutionRequests`, `getExecutionRequest`, `getExecutionHistory`
- `listApprovalRequests`, `approveExecution`, `executeExecutionRequest`, `cancelExecutionRequest`
- `listTaskAutonomyLevels`, `getTaskAutonomyLevel`, `createTaskAutonomyLevel`
- Authorization helpers: `isFounder`, `isDivisionMember`, `isDivisionHead`, `isStaffAgent`
- `requireFounderContext`, `requireDivisionMember`, `requireDivisionHead`, `requireStaffAgent`

### Memory (`src/council/memory.ts`)
- `listMemoryEntries`, `getMemoryById`, `createMemory`, `updateMemory`
- `createCrossDivisionShare`, `getCrossDivisionShares`, `getSharesByDivision`

## Proposed Implementation Structure

Following the specified architecture:

```
src/
├── api/
│   ├── routes/
│   │   ├── auth.routes.ts           (existing in server.ts)
│   │   ├── messages.routes.ts       (NEW)
│   │   ├── meetings.routes.ts       (NEW)
│   │   ├── council.routes.ts        (NEW)
│   │   ├── memory.routes.ts         (NEW)
│   │   ├── divisions.routes.ts      (NEW)
│   │   ├── staff.routes.ts          (NEW)
│   │   ├── tasks.routes.ts          (NEW)
│   │   ├── executions.routes.ts     (NEW - consolidate execution routes)
│   │   ├── approvals.routes.ts      (NEW - fix 500 error)
│   │   ├── deliverables.routes.ts   (NEW)
│   │   └── quality.routes.ts        (NEW)
│   ├── middleware/
│   │   ├── authentication.ts        (extract from server.ts)
│   │   ├── authorization.ts         (extract from server.ts)
│   │   └── error-handler.ts         (NEW)
│   └── schemas/                     (Zod validation schemas)
├── services/                        (existing domain services)
├── council/                         (existing)
├── auth/                            (existing)
├── database.ts                      (existing)
└── server.ts                        (refactored to register routes)
```

## Authorization Matrix

| Endpoint | Founder | Division Head | Staff | Division | Council Seat |
|---|---|---|---|---|---|
| `/api/messages/conversations` | All | Division | Own | Division | - |
| `/api/messages/:id` | All | Division | Own | Division | - |
| `/api/messages` (POST) | All | Division | Own | Division | - |
| `/api/meetings` | All | All | - | - | Own |
| `/api/meetings/:id` | All | All | - | - | Participant |
| `/api/meetings/:id/phases` | All | All | - | - | Participant |
| `/api/council/seats` | All | - | - | - | All |
| `/api/council/personas` | All | - | - | - | All |
| `/api/memory` | All | Division | Own | Division | Council |
| `/api/memory/:id` | All | Division | Own | Division | Check access |
| `/api/divisions` | All | Read | Read | Read | Read |
| `/api/staff` | All | Division | Division | Read | - |
| `/api/divisions/members` | All | Division | Division | Division | - |
| `/api/tasks` | All | Division | Own | Division | - |
| `/api/tasks/:id` | All | Division | Own | Division | - |
| `/api/tasks` (POST) | All | Division | - | - | - |
| `/api/tasks/:id/assign` | All | Division | - | - | - |
| `/api/tasks/:id/status` | All | Division | Own | Division | - |
| `/api/executions` | All | Division | Own | Division | - |
| `/api/executions/autonomy-levels` | All | Read | Read | Read | Read |
| `/api/approvals` | All | Division (own) | Own | Division (own) | - |
| `/api/deliverables` | All | Division | Own | Division | - |
| `/api/deliverables/:id` | All | Division | Own | Division | - |
| `/api/deliverables/:id/versions` | All | Division | Own | Division | - |
| `/api/deliverables` (POST) | All | Division | Own | Division | - |
| `/api/deliverables/:id/submit` | All | Division | Own | Division | - |
| `/api/deliverables/:id/review` | All | Division Head | - | Division Head | - |
| `/api/deliverables/:id/revision` | All | Reviewer | - | - | - |
| `/api/quality-thresholds` | All | Read | Read | Read | Read |