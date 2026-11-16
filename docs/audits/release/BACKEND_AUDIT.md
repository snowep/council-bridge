# Backend Audit Report - Council Bridge

**Generated:** 2026-11-16  
**Branch:** refactor/repository-structure  
**Scope:** Complete backend codebase at `C:/Projects/council-bridge/src`

---

## Executive Summary

The Council Bridge backend is a sophisticated multi-agent governance platform built with Express.js, SQLite (better-sqlite3), and TypeScript. It implements a council-based decision-making system with divisions, staff agents, tasks, deliverables, meetings, memory/knowledge management, and a phased autonomy/execution model.

**Architecture Pattern:** Modular monolith with clear separation between API routes, services (council/operations), middleware, auth, MCP tools, and database layer.

**Key Technologies:**
- Express.js + TypeScript (ESM)
- better-sqlite3 with WAL mode
- Zod v4 for validation
- MCP (Model Context Protocol) server integration
- RSA-2048 founder signature authentication

---

## 1. API Routes (`src/api/routes/`)

### 1.1 Messages Routes (`messages.routes.ts`)
**Status:** ✅ Implemented  
**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/messages/conversations` | ✅ Required | List conversations for authenticated agent |
| GET | `/api/messages/:conversationId` | ✅ Required | Get messages in a conversation |
| POST | `/api/messages` | ✅ Required | Send a message |

**Request/Response Types:**
- `SendMessageInput`: `{ recipient_id, content, reply_to? }`
- `ListConversationsInput`: `{ limit, offset, unread_only }`
- Response: `{ message }` / `{ conversations, limit, offset }` / `{ messages }`

**Auth/Authorization:** JWT-like session tokens via `authMiddleware`. Agents can only access their own conversations. Founder sees all.

**Database Operations:** `messageService.sendMessage`, `messageService.checkInbox`, `messageService.listMessages`

**Error Handling:** Uses `asyncHandler` wrapper, throws `ValidationError`, `NotFoundError` from error-handler middleware

---

### 1.2 Meetings Routes (`meetings.routes.ts`)
**Status:** ✅ Implemented  
**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/meetings` | ✅ Required | List all meetings |
| GET | `/api/meetings/:id` | ✅ Required | Get meeting details |
| GET | `/api/meetings/:id/phases` | ✅ Required | Get meeting phases |

**Request/Response Types:**
- `ListMeetingsInput`: `{ limit, offset, status }`
- Response: `{ meetings, limit, offset }` / `{ meeting }` / `{ phases }`

**Auth/Authorization:** Session auth via `authMiddleware`. All authenticated users can view meetings.

**Database Operations:** `listMeetings(db)`, `getMeetingById(db, id)`, `getMeetingPhases(db, id)`

**Error Handling:** `asyncHandler` + `NotFoundError`

---

### 1.3 Council Routes (`council.routes.ts`)
**Status:** ✅ Implemented  
**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/council/seats` | ✅ Required | List council seats |
| GET | `/api/council/personas` | ✅ Required | List personas (memory entries) |
| GET | `/api/council/meetings` | ✅ Required | Alias for meetings list |
| GET | `/api/council/constitution` | ✅ Required | Get active constitution |
| GET | `/api/council/runtime-assignments` | ✅ Required | Get runtime persona assignments |

**Auth/Authorization:** 
- Founder sees all personas
- Others see only their own `individual_persona` entries
- All authenticated users can view seats, constitution, runtime assignments

**Database Operations:** Direct SQL queries for seats, `listMemoryEntries` for personas, `getActiveConstitution`, `getStaffRuntimePersonas`

---

### 1.4 Memory Routes (`memory.routes.ts`)
**Status:** ✅ Implemented  
**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/memory` | ✅ Required | List memory entries with filters |
| GET | `/api/memory/:id` | ✅ Required | Get memory entry details |

**Request/Response Types:**
- `ListMemoryInput`: `{ limit, offset, owner_type, owner_id, category, archived, search }`
- Response: `{ entries, limit, offset }` / `{ entry }`

**Auth/Authorization:** Complex privacy filtering in `listMemoryEntries`:
- Founder: all entries
- Seat: own `individual_persona`, public categories, meeting history, task history
- Division: division shared/private, cross-division shares, task history
- Staff: own `staff_private`, division shared, cross-division, task history

**Database Operations:** `listMemoryEntries`, `getMemoryById` with FTS5 search support

---

### 1.5 Divisions Routes (`divisions.routes.ts`)
**Status:** ✅ Implemented  
**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/divisions` | ✅ Required | List all divisions |
| GET | `/api/divisions/:id` | ✅ Required | Get division details |
| GET | `/api/organization/divisions` | ✅ Required | Alias for divisions list |

**Auth/Authorization:** All authenticated users can view divisions

**Database Operations:** `listDivisions(db)`, `getDivisionById(db, id)`

---

### 1.6 Staff Routes (`staff.routes.ts`)
**Status:** ✅ Implemented  
**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/staff` | ✅ Required | List staff agents (filtered by auth) |
| GET | `/api/staff/:id` | ✅ Required | Get staff agent details |
| GET | `/api/organization/staff` | ✅ Required | Alias for staff list |
| GET | `/api/divisions/members` | ✅ Required | List division members |

**Auth/Authorization:**
- Founder: sees all staff
- Division: sees division staff
- Staff: sees only themselves

**Database Operations:** `listStaffAgents`, `getStaffAgentById`, `getDivisionMembers`, `getAllDivisionMembers`, `getStaffDivisions`

---

### 1.7 Tasks Routes (`tasks.routes.ts`)
**Status:** ✅ Implemented  
**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tasks` | ✅ Required | List tasks (filtered by auth) |
| GET | `/api/tasks/:id` | ✅ Required | Get task details |
| POST | `/api/tasks` | ✅ Required (Founder/Division Head) | Create task |
| PUT | `/api/tasks/:id/assign` | ✅ Required (Founder/Division Head) | Assign/reassign task |
| PUT | `/api/tasks/:id/status` | ✅ Required (Assignee/Founder) | Update task status |

**Request/Response Types:**
- `CreateTaskInput`: `{ title, description, assigned_to_type, assigned_to_id, created_by_type, created_by_id, status, priority, budget_allocated, due_at, dependencies, deliverable_id }`
- `AssignTaskInput`: `{ assigned_to_type, assigned_to_id }`
- `UpdateTaskStatusInput`: `{ status }`

**Auth/Authorization:**
- Create: Founder, Council, Division Head only
- Assign: Founder or Division Head of assigned division
- Status: Assignee or Founder

**Database Operations:** `listTasks`, `getTaskById`, `createTask`, `updateTask`

---

### 1.8 Executions Routes (`executions.routes.ts`)
**Status:** ✅ Implemented (Phase 7/9)  
**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/executions` | ✅ Required | List execution requests |
| GET | `/api/executions/autonomy-levels` | ✅ Required | List task autonomy levels |
| GET | `/api/executions/autonomy-levels/:taskId` | ✅ Required | Get autonomy level for task |
| POST | `/api/executions/autonomy-levels` | ✅ Required (Founder + signature) | Create autonomy level |
| GET | `/api/executions/:id` | ✅ Required | Get execution details |
| GET | `/api/executions/:id/history` | ✅ Required | Get execution history |
| POST | `/api/executions/request` | ✅ Required | Request execution |
| POST | `/api/executions/approve` | ✅ Required (Founder + signature) | Approve execution |
| POST | `/api/executions/:id/execute` | ✅ Required (Founder + signature) | Execute execution |
| POST | `/api/executions/:id/cancel` | ✅ Required (Requester/Founder) | Cancel execution |

**Auth/Authorization:**
- List: Founder sees all, others see own requests
- Autonomy levels: Founder-only for write
- Approve/Execute: Founder with signature verification
- Cancel: Requester or Founder

**Database Operations:** `listExecutionRequests`, `getExecutionRequest`, `getExecutionHistory`, `requestExecution`, `approveExecution`, `executeExecutionRequest`, `cancelExecutionRequest`, `listTaskAutonomyLevels`, `getTaskAutonomyLevel`, `createTaskAutonomyLevel`

---

### 1.9 Approvals Routes (`approvals.routes.ts`)
**Status:** ✅ Implemented  
**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/approvals` | ✅ Required | List approval requests (fixed for non-Founder) |

**Auth/Authorization:** Founder sees all, others see only their own requests

**Database Operations:** `listApprovalRequests`

---

### 1.10 Deliverables Routes (`deliverables.routes.ts`)
**Status:** ✅ Implemented (Phase 9 Batch 4)  
**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/deliverables` | ✅ Required | List deliverables with filters |
| GET | `/api/deliverables/:id` | ✅ Required | Get deliverable details |
| GET | `/api/deliverables/:id/versions` | ✅ Required | Get version history |
| POST | `/api/deliverables` | ✅ Required | Create deliverable draft |
| PUT | `/api/deliverables/:id/submit` | ✅ Required | Submit for review |
| PUT | `/api/deliverables/:id/review` | ✅ Required | Review (accept/reject/revision) |
| PUT | `/api/deliverables/:id/revision` | ✅ Required | Request revision |

**Auth/Authorization:** 
- Create/Submit: Task assignee or Founder
- Review: Assigned reviewer, task creator, Division Head, or Founder
- Revision: Assigned reviewer or Founder

**Database Operations:** `listDeliverablesByTask`, `getDeliverableById`, `createDeliverableDraft`, `submitDeliverable`, `reviewDeliverable`, `requestRevision`, `approveDeliverable`, `rejectDeliverable`, `resubmitDeliverable`, `getDeliverableHistory`

---

### 1.11 Quality Thresholds Routes (`quality.routes.ts`)
**Status:** ✅ Implemented  
**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/quality-thresholds` | ✅ Required (Founder only) | Get quality thresholds |
| POST | `/api/quality-thresholds` | ✅ Required (Founder only) | Set quality threshold |

**Auth/Authorization:** Founder only

**Database Operations:** `getQualityThresholdConfig`, `setQualityThreshold`

---

## 2. Services (`src/council/`)

### 2.1 CouncilService (Core Operations in `operations.ts`)
**Status:** ✅ Implemented  
**Key Functions:**

| Function | Auth Required | Description |
|----------|---------------|-------------|
| `createTaskAutonomyLevel` | Founder | Define autonomy level for task type |
| `getTaskAutonomyLevel` | Any authenticated | Get autonomy level |
| `listTaskAutonomyLevels` | Any authenticated | List all levels |
| `updateTaskAutonomyLevel` | Founder | Update level |
| `requestExecution` | Staff/Division/Founder | Create execution request |
| `getExecutionRequest` | Requester/Founder | Get execution details |
| `listExecutionRequests` | Filtered by auth | List executions |
| `approveExecution` | Founder + signature | Approve Level 3 execution |
| `executeExecutionRequest` | Requester/Founder | Execute approved/queued |
| `cancelExecutionRequest` | Requester/Founder | Cancel execution |
| `getExecutionHistory` | Requester/Founder | Get history |
| `listApprovalRequests` | Founder only | List approval requests |

**Authorization Model (`operations.ts`):**
- `getTaskForActor`: Validates task access per actor type
- `getExecutionForActor`: Validates execution access
- `checkMemoryAccess`: Complex privacy rules per category
- `buildPrivacyFilter`: SQL WHERE clause builder for memory queries
- `isDivisionMember`, `isDivisionHead`, `isStaffAgent`, `isFounder`: Helper guards

**Transaction Support:** `beginTransaction`, `commitTransaction`, `rollbackTransaction` for multi-step operations

---

### 2.2 Memory Service (`memory.ts`)
**Status:** ✅ Implemented  
**Key Functions:**
- `createMemory`, `getMemoryById`, `updateMemory`, `archiveMemory`, `restoreMemory`
- `createMemoryVersion`, `getMemoryVersions`
- `createMemoryLink`, `logMemoryAccess`
- `createCrossDivisionShare`, `getCrossDivisionShares`, `getSharesByDivision`, `updateCrossDivisionShare`
- `listMemoryEntries`: With privacy filtering based on auth context

**Categories:** 11 memory categories with different access rules

---

### 2.3 Meetings Service (`meetings.ts`)
**Status:** ✅ Implemented  
**Key Functions:**
- Meeting CRUD: `createMeeting`, `getMeetingById`, `listMeetings`
- Phases: `createMeetingPhase`, `getMeetingPhases`, `updateMeetingPhase`
- Candidates: `createCandidate`, `getCandidateById`, `listCandidates`
- Founder Deliberation: `createFounderDeliberation`, `getFounderDeliberationsByCandidate`
- Founder Votes: `createFounderVote`, `getFounderVotesByCandidate`
- Meeting Phases Data: Primary Ideas, Brainstorming, Challenges, Defenses, Syntheses, Reassessments, Evaluations
- Evaluation Criteria: `createEvaluationCriteria`, `getEvaluationCriteria`

---

### 2.4 Task Delegation Service (`task-delegation.ts`)
**Status:** ✅ Implemented (Phase 9 Batches 3-4)  
**Key Functions:**

**Delegation:**
- `delegateTask`: Create subtask with dependency link
- `acceptDelegation` / `rejectDelegation`: Handle delegation response

**Deliverable Workflow:**
- `createDeliverableDraft`: Create draft
- `submitDeliverable`: Submit for review
- `assignReviewer`: Assign reviewer
- `requestRevision`: Request changes
- `resubmitDeliverable`: Resubmit after revision
- `approveDeliverable`: Approve with HITL enforcement
- `rejectDeliverable`: Reject
- `getDeliverableHistory`: Version history

**Quality Gates:**
- `getQualityThreshold`: Resolve threshold (division/task/global)
- `enforceHITLApproval`: Autonomy-level based approval (Level 1=auto, 2=division head, 3=founder+signature)
- `verifyFounderSignature`: Verify nonce consumption

**Audit/Validation:**
- `validateTaskAccess`, `validateDivisionHeadAuthority`, `validateActiveStaffIdentity`
- `validateDependenciesAndPreventCycles`: Cycle detection
- `recordTaskMutationAudit`, `getTaskAuditTrail`
- `logTaskAudit`: Structured audit logging

---

### 2.5 Divisions Service (`divisions.ts`)
**Status:** ✅ Implemented  
**Key Functions:**
- Division CRUD: `createDivision`, `getDivisionById`, `listDivisions`, `updateDivision`
- Staff Management: `registerStaffAgent`, `getStaffAgentById`, `listStaffAgents`, `updateStaffAgent`
- Member Management: `addDivisionMember`, `getDivisionMembers`, `getAllDivisionMembers`, `getStaffDivisions`
- Task Operations: `createTask`, `getTaskById`, `listTasks`, `updateTask`
- Deliverable Operations: `createDeliverable`, `getDeliverableById`, `listDeliverablesByTask`, `updateDeliverable`
- Appointments: `approveDivisionHead`, `approveSpecialist`, `activateStaffAgent`
- Constitution: `getActiveConstitution`
- Runtime Personas: `getStaffRuntimePersonas`

**Audit:** `logTaskAudit` for task mutations

---

### 2.6 Types & Inputs
**Files:** `types.ts`, `core-types.ts`, `inputs.ts`
- Comprehensive Zod v4 schemas for all domain entities
- Type guards: `isExecutionStatus`, `isAutonomyLevel`
- Re-exports from `core-types.ts` for Phase 1-6 types

---

## 3. Middleware (`src/api/middleware/`)

### 3.1 Authentication Middleware (`authentication.ts`)
**Status:** ✅ Implemented  
**Features:**
- **Three Auth Modes:**
  1. **Local Single-User Mode** (`LOCAL_SINGLE_USER_MODE=true`): Auto-auth as Founder for loopback only, rejects remote connections
  2. **Development Mode**: Hardcoded fallback allowed (`allow_hardcoded_fallback=true`)
  3. **Production Mode**: Strict session validation, no fallbacks

- **Session Validation:** `validateSessionToken` with HMAC-SHA256 signatures, constant-time comparison, replay protection via timestamp

- **Auth Guards:**
  - `authMiddleware`: Main middleware, attaches `authContext` to request
  - `getAuthContext`: Extract context
  - `requireAuth`: Throw if not authenticated
  - `requireFounder`: Throw if not Founder
  - `requireStaff` / `requireDivision`: Role-specific
  - `requireDivisionHead`: Division head or founder

- **Loopback Enforcement:** `isLoopbackAddress` checks for IPv4/IPv6 localhost

**Config Validation:** `validateLocalSingleUserConfig` ensures loopback bind address, not production

---

### 3.2 Error Handler (`error-handler.ts`)
**Status:** ✅ Implemented  
**Features:**
- Correlation ID generation for tracing
- Zod v4 error handling (`ZodError` → 400 with details)
- Custom error classes: `ValidationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`
- Structured error responses with `code`, `message`, `details`, `correlationId`
- `asyncHandler` wrapper for promise-based route handlers

---

## 4. Schemas (`src/api/schemas/index.ts`)
**Status:** ✅ Implemented  
**Zod v4 Schemas for All Routes:**

| Schema | Purpose |
|--------|---------|
| `PaginationSchema` | Base pagination (limit/offset) |
| `CreateSessionSchema` | Session creation input |
| `SendMessageSchema` / `ListConversationsSchema` | Messages |
| `ListMeetingsSchema` | Meetings |
| `ListMemorySchema` | Memory with category filters |
| `CreateDivisionSchema` / `UpdateDivisionSchema` | Divisions |
| `RegisterStaffSchema` / `UpdateStaffSchema` / `ListStaffSchema` | Staff |
| `CreateTaskSchema` / `UpdateTaskSchema` / `AssignTaskSchema` / `UpdateTaskStatusSchema` / `ListTasksSchema` | Tasks |
| `RequestExecutionSchema` / `ApproveExecutionSchema` / `ExecuteExecutionSchema` / `CancelExecutionSchema` / `ListExecutionsSchema` | Executions |
| `ListApprovalsSchema` | Approvals |
| `CreateDeliverableSchema` / `SubmitDeliverableSchema` / `ReviewDeliverableSchema` / `RequestRevisionSchema` / `ListDeliverablesSchema` | Deliverables |
| `QualityThresholdSchema` | Quality thresholds |

---

## 5. Authentication (`src/auth/`)

### 5.1 Auth Config (`config.ts`)
**Auth Modes:** `development` | `production`  
**Config Options:**
- `mode`: Auth mode
- `session_timeout_ms`: 30 min default
- `max_sessions`: 100
- `require_founder_signature_for`: Array of operations requiring founder signature
- `allow_hardcoded_fallback`: Dev only
- `local_single_user_mode`: Loopback-only mode
- `local_single_user_bind_address`: Default `127.0.0.1`

**Validation:** `validateAuthMode()` enforces no hardcoded fallback in production, requires `SESSION_SECRET`

---

### 5.2 Session Management (`session.ts`)
**Token Format:** `session_id|timestamp|random|signature`  
**Security Features:**
- Cryptographically secure random (32 bytes)
- HMAC-SHA256 signatures with timing-safe comparison
- In-memory store with TTL cleanup (5-min interval)
- Session limit enforcement
- Client IP binding (optional)
- Permission system per session

**Functions:**
- `generateSessionToken`, `validateSessionToken`, `invalidateSession`
- `invalidateAllSessionsForOwner`, `refreshSession`
- `addPermission`, `hasPermission`
- `cleanupExpiredSessions`, `getSessionStats`, `revokeSessionsByCriteria`

---

### 5.3 Founder Authentication (`founder.ts`)
**Status:** ✅ Production-Hardened  
**RSA-2048 Key Management:**
- Key generation with `crypto.generateKeyPairSync`
- Secure file storage (`.secrets/founder-keys.json`, mode 0o600)
- Key rotation with archival
- Key ID tracking for rotation detection

**Signature Verification (`verifyFounderOperation`):**
1. Load keys, validate key ID match
2. Timestamp freshness check (±5 min)
3. Nonce format validation (base64url, max 128 chars)
4. Canonicalize payload (sorted keys, operation-bound)
5. RSA-SHA256 signature verification
6. **Atomic nonce consumption** via SQLite unique constraint
7. Returns `{ valid: boolean, error?: string }` with specific error codes

**Error Codes:** `NO_KEYS`, `KEY_MISMATCH`, `TIMESTAMP_EXPIRED`, `NONCE_MISSING`, `NONCE_TOO_LONG`, `NONCE_MALFORMED`, `NONCE_REPLAY`, `INVALID_SIGNATURE`, `VERIFICATION_ERROR`

**Nonce Store:** SQLite table `founder_nonces` with composite PK `(key_id, operation, nonce)` and expiry

---

### 5.4 Auth Index (`index.ts`)
**Exports:** All auth modules + shared types
- `AuthContext` interface
- `requirePermission`, `requireFounder`, `requireDivisionHead`
- `validateSessionOwnership`
- `validateAuthMode`, `validateIdentityForSession` (DB-backed identity validation)

---

## 6. MCP Tools (`src/mcp/tools.ts`)
**Status:** ✅ Implemented  
**Registration Pattern:** `registerMcpTools(mcpServer, db, getAuthContext)`  

**Tool Categories:**

### Phase 1: Communication (6 tools)
- `send_message`, `get_messages`, `list_agents`, `register_agent`, `check_inbox`, `reply_message`, `list_messages`

### Phase 7/9: Autonomy & Execution (10 tools)
- `create_task_autonomy_level`, `update_task_autonomy_level`, `get_task_autonomy_level`, `list_task_autonomy_levels`
- `request_execution`, `get_execution_request`, `list_execution_requests`
- `execute_execution_request`, `cancel_execution_request`
- `approve_execution`, `list_approval_requests`
- `get_execution_history`

### Phase 9 Batch 4: Deliverable Workflow (10 tools)
- `create_deliverable_draft`, `submit_deliverable`, `assign_deliverable_reviewer`
- `request_deliverable_revision`, `resubmit_deliverable`
- `approve_deliverable`, `reject_deliverable`, `get_deliverable_history`
- `set_quality_threshold`, `get_quality_threshold`

**Authorization Pattern:** `createToolHandler` wrapper:
1. Extract auth context from request
2. `requireAuthenticated(ctx)` validation
3. Call service function with DB, context, args
4. Catch errors → `MCP_ERROR` or `AUTH_DENIED`

---

## 7. Communication (`src/communication/`)

### 7.1 Agent Service (`agents.ts`)
**Functions:** `registerAgent`, `listAgents`, `getAgent`, `agentExists`  
**Storage:** `agents` table with `agent_id` unique constraint

### 7.2 Message Service (`messages.ts`)
**Functions:** `sendMessage`, `checkInbox`, `replyMessage`, `listMessages`  
**Validation:** Sender/recipient must exist, reply_to must be valid and recipient must be original sender

---

## 8. Database (`src/infrastructure/database/database.ts`)

### 8.1 Schema (Single-file, 1000+ lines)
**Tables (30+):**
- **Phase 1:** agents, messages
- **Phase 2:** council_seats, personas, runtime_personas, staff_runtime_personas, constitutions, founder_approvals
- **Phase 3:** candidates, founder_deliberations, founder_votes, meetings, meeting_phases, primary_ideas, brainstorm_records, challenges, defenses, syntheses, reassessments, evaluations, evaluation_criteria
- **Phase 4:** memory_entries, memory_versions, memory_links, memory_access, cross_division_shares, memory_fts (FTS5)
- **Phase 6:** divisions, staff_agents, division_members, tasks, deliverables
- **Phase 9 Batch 4:** deliverable_versions, quality_thresholds
- **Phase 7:** task_autonomy_levels, execution_requests, approval_requests, execution_history
- **Phase 9 Task 5:** task_audit
- **Security:** founder_nonces

**Indexes:** 50+ indexes on foreign keys, status columns, search fields

**FTS5:** Virtual table with triggers for full-text search on memory

**Prepared Statements:** 150+ typed prepared statements in `stmt` object

**Transaction Support:** `BEGIN IMMEDIATE`, `COMMIT`, `ROLLBACK`

---

### 8.2 Database Instance (`database.ts`)
**Factory:** `createDatabase(dbPath?)`  
**Production Guards:** Rejects `:memory:` in production, requires `DATABASE_PATH`  
**Pragmas:** `journal_mode = WAL`, `foreign_keys = ON`  
**Singleton:** `databaseInstance` exported for app use

---

## 9. Server Entry Point (`server.ts`)

**Route Registration:** Modular `app.use('/api/*', routes)` pattern  
**Special Endpoints:**
- `/health` - No auth
- `/api/auth/session` - Session creation (founder signature required in prod)
- `/api/auth/session` DELETE - Session revocation
- `/api/auth/status` - Session info
- `/api/auth/founder/public-key` - Public key for clients
- `/api/task-autonomy` - Autonomy levels (founder + signature for write)
- `/mcp` - MCP endpoint (stateless per request)

**Middleware Stack:** CORS → JSON → Auth → Routes → Error Handler  
**Rate Limiting:** Founder signature endpoints (10/min)  
**Founder Signature Middleware:** Operation-bound verification for privileged ops

---

## 10. Test Coverage Assessment

**No test files found in src/** - This is a **critical gap**. The codebase has:
- Complex authorization logic (memory privacy, task access, execution permissions)
- Cryptographic operations (founder signatures, session tokens)
- Multi-step transactions (execution approval, deliverable workflow)
- State machines (meeting phases, task statuses, deliverable statuses)

**Recommended Test Areas:**
1. Auth middleware: All three modes, loopback enforcement, session validation
2. Founder signatures: Valid/invalid/replay/expired/key rotation
3. Memory privacy: All 11 categories × 4 actor types
4. Task authorization: Staff/division/founder boundaries
5. Execution flow: Level 1/2/3 state transitions
6. Deliverable workflow: Draft → submit → review → approve/reject/revision
7. Cycle detection in task dependencies
8. MCP tool authorization

---

## 11. Key Findings & Risks

### Critical
1. **No test coverage** - High-risk code paths untested
2. **In-memory session store** - Not production-ready (should use Redis)
3. **Single database connection** - No connection pooling

### High
4. **Dynamic imports in routes** - `await import()` for schemas/services creates runtime overhead
5. **Error messages leak internals** - Some SQL errors returned to clients
6. **No request validation middleware** - Zod parsing happens in route handlers

### Medium
7. **Schema version hardcoded** - `SCHEMA_VERSION = '5.0.0'` but no migration runner integration visible
8. **FTS5 triggers** - Complex trigger logic for memory sync, potential for drift
9. **Date handling** - ISO strings throughout, no timezone normalization
10. **Soft delete pattern** - `archived_at` used but not consistently filtered

### Low
11. **Duplicate `getParamId`** - Copied in 9 route files
12. **Legacy deliverable code paths** - Migration 004 fallback logic in `divisions.ts`

---

## 12. API Contract Summary

| Domain | Routes | Auth Model | Key Constraints |
|--------|--------|------------|-----------------|
| Messages | 3 | Session + agent ownership | Agents only see own conversations |
| Meetings | 3 | Session | Read-only for all authenticated |
| Council | 5 | Session + role | Founder sees all personas |
| Memory | 2 | Session + privacy filter | 11 categories, complex rules |
| Divisions | 3 | Session | Read-only |
| Staff | 4 | Session + role | Division-scoped visibility |
| Tasks | 5 | Session + role | Creator/assignee permissions |
| Executions | 10 | Session + autonomy level | Level 3 = founder signature |
| Approvals | 1 | Session | Founder sees all, others own |
| Deliverables | 7 | Session + workflow state | HITL enforcement by autonomy |
| Quality | 2 | Founder only | Configuration only |

---

## 13. File Inventory

```
src/
├── server.ts                     # Entry point, route registration
├── database.ts                   # DB facade
├── auth/
│   ├── index.ts                  # Exports, AuthContext, validation
│   ├── config.ts                 # AuthConfig, mode management
│   ├── session.ts                # Session tokens, HMAC, store
│   ├── founder.ts                # RSA keys, signatures, nonces
│   └── middleware.ts             # Re-exports
├── api/
│   ├── middleware/
│   │   ├── authentication.ts     # Auth middleware, guards
│   │   └── error-handler.ts      # Error classes, handler
│   ├── routes/
│   │   ├── messages.routes.ts
│   │   ├── meetings.routes.ts
│   │   ├── council.routes.ts
│   │   ├── memory.routes.ts
│   │   ├── divisions.routes.ts
│   │   ├── staff.routes.ts
│   │   ├── tasks.routes.ts
│   │   ├── executions.routes.ts
│   │   ├── approvals.routes.ts
│   │   ├── deliverables.routes.ts
│   │   └── quality.routes.ts
│   └── schemas/
│       └── index.ts              # All Zod v4 schemas
├── council/
│   ├── operations.ts             # Core execution/autonomy logic
│   ├── memory.ts                 # Memory CRUD, privacy, shares
│   ├── meetings.ts               # Meeting phases, evaluations
│   ├── divisions.ts              # Division, staff, tasks, deliverables
│   ├── task-delegation.ts        # Delegation, deliverable workflow, HITL
│   ├── types.ts                  # Phase 7+ types, re-exports
│   ├── core-types.ts             # Phase 1-6 types
│   ├── inputs.ts                 # Input interfaces
│   ├── index.ts                  # Exports
│   └── legacy.ts                 # Legacy compatibility
├── communication/
│   ├── agents.ts                 # Agent registry
│   └── messages.ts               # Messaging service
├── mcp/
│   └── tools.ts                  # MCP tool registration
└── infrastructure/
    └── database/
        └── database.ts           # Schema, prepared statements, factory
```

---

## Conclusion

The backend is **feature-complete for the specified phases** (1-9) with a sophisticated authorization model, phased autonomy system, and deliverable workflow. The codebase demonstrates solid architectural patterns but lacks **any test coverage**, which is the primary blocker for production confidence. The authentication system is production-hardened with cryptographic best practices. The database schema is comprehensive but would benefit from a formal migration system.

**Priority Actions:**
1. Add integration tests for auth middleware (3 modes)
2. Add unit tests for memory privacy rules
3. Add test coverage for execution state machine
4. Replace in-memory session store with Redis
5. Implement request validation middleware