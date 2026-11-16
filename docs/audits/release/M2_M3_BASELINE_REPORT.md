# M2/M3 Baseline Report

**Repository:** `snowep/council-bridge`
**Branch:** `refactor/repository-structure`
**Date:** 2026-11-16
**Audited Commit:** `c49f180`

---

## 1. Current Implementation Status

### ✅ Working (M1 Complete)
- **Security (SEC-01..06, DB-01..02)**: All 61 tests passing
- **Founder Key Rotation**: New key generated locally (4fd4c30a32c68c8829ad9b99d7521b41), old key rejected
- **.gitignore**: Fixed to track reports, migrations, tests; ignores `.secrets/`
- **Migration Runner**: Transitive dependency resolution verified (8 tests)
- **Deliverable Workflow**: Full CRUD + reviewer assignment endpoint added (27 tests)
- **API Dev Server**: Running on port 3334 (development mode)
- **Frontend Dev Server**: Running on port 5174 (Vite)

### ⚠️ Partially Working
- **Chat API**: Backend uses `id`, frontend expects `message_id`; POST returns `{ message }` vs direct `Message`
- **Conversation History**: `checkInbox` only returns recipient messages, not sent messages
- **New Conversation**: UI only lists existing conversations, no agent selection to start new
- **Polling**: Basic 3s polling implemented but no conversation list refresh
- **Dashboard Activity**: `/api/activity` endpoint NOT registered (frontend requests it)
- **Dashboard Statistics**: Retry key mismatches (`activedivisions` vs `divisions`, etc.)
- **Quick Actions**: Create Division → read-only Org page; Invite Staff → ignored query param; New Task → no creation dialog
- **Theme**: Dual state management (App ThemeWrapper + Layout darkMode) with page reload
- **Navigation**: Invalid nested CSS in NavLink styles; no 404 page
- **Test Isolation**: Security tests pass individually but fail when run together (shared state)

### ❌ Not Implemented
- **Agent Selection UI**: No way to start conversation with registered agent
- **Bidirectional History**: Messages sent by current user not shown in conversation
- **MCP Integration Verification**: No E2E test of Founder→Chat→Bridge→Agent→Bridge→Chat
- **Activity Endpoint**: Missing backend route
- **404 Page**: Unknown routes show blank
- **Settings/Profile Actions**: Inert controls

---

## 2. Confirmed Defects

### Chat API Contract Mismatches
| Component | Field | Backend | Frontend |
|-----------|-------|---------|----------|
| Message | ID | `id` | `message_id` |
| POST Response | Structure | `{ message }` | Direct `Message` |
| Conversation | Last Message | `Message` | Uses `message` from response |

### Conversation Retrieval
- `messageService.checkInbox(agentId, conversationId)` filters only by `recipient_id === conversationId || sender_id === conversationId` but `listConversations` only gets messages where agent is recipient
- Messages sent by current user are excluded from conversation history

### Dashboard Issues
| Issue | Location | Impact |
|-------|----------|--------|
| `/api/activity` 404 | DashboardPage.tsx line ~ | Activity widget shows error |
| Retry key mismatch | DashboardPage.tsx | Retry buttons don't work |
| Quick actions non-functional | DashboardPage.tsx | Decorative buttons |
| Theme reload | Layout.tsx + ThemeWrapper | Full page reload on toggle |

### Test Isolation
- `founder-key-permissions.test.ts`: Uses filesystem `.secrets/` dir
- `founder-key-startup.test.ts`: Modifies `process.env`
- `founder-signature-replay.test.ts`: Uses shared in-memory DB with nonce table
- Running together causes state bleed (file system, env vars, DB)

---

## 3. Existing Working Functionality

### Backend (Verified)
- ✅ Auth: Session creation, validation, founder signature verification
- ✅ Messages: `sendMessage`, `listConversations`, `checkInbox`, `markAsRead`
- ✅ Tasks: CRUD, delegation, status transitions, audit logging
- ✅ Deliverables: Draft → Submit → Review → Approve/Reject/Revise → Resubmit
- ✅ Cross-Division Shares: Request (division) → Approve (founder) workflow
- ✅ Divisions/Staff: CRUD, membership, runtime personas
- ✅ Migration Runner: Dependency resolution, checksums, backup

### Frontend (Verified)
- ✅ Auth: Login, session management, token storage
- ✅ Dashboard: Layout, navigation, theme toggle (with reload)
- ✅ Chat: Conversation list, message view, send, optimistic updates, 3s polling
- ✅ Organization: Divisions, staff, seats display
- ✅ Tasks: List, create (via dialog), status updates
- ✅ Deliverables: List, detail, submit, review, assign-reviewer

### Database Schema
- `messages`: id, sender_id, recipient_id, content, reply_to, created_at, read_at
- `agents`: agent_id, display_name, runtime
- `cross_division_shares`: granted_by_type CHECK ('founder','division') - migration 016

---

## 4. Missing Functionality (M2/M3 Scope)

### M2 - Core Communication
1. **API Contract Normalization**: Single message model across backend/REST/MCP/frontend
2. **Bidirectional History**: Include sent + received messages in conversations
3. **New Conversation Flow**: Agent selection → create conversation → send first message
4. **Reliable Polling**: Conversation list refresh + selected conversation refresh + unread counts
5. **MCP Runtime Verification**: Document actual Claude/Hermes integration status
6. **Task/Execution/Deliverable**: Verify complete workflow end-to-end

### M3 - Dashboard/UI
1. **Activity Endpoint**: Real database-backed `/api/activity`
2. **Statistics Fix**: Canonical keys, working retry buttons
3. **Quick Actions**: Functional Create Division, Invite Staff, New Task
4. **Theme Consolidation**: Single source of truth, no reload
5. **Navigation**: Valid NavLink styles, 404 page, responsive drawer
6. **Settings/Profile**: Implement or label deferred

---

## 5. Relevant Files

### Backend
- `src/communication/messages.ts` - Message service (checkInbox, listConversations)
- `src/api/routes/messages.routes.ts` - REST endpoints
- `src/api/routes/deliverables.routes.ts` - Deliverable endpoints (assign-reviewer added)
- `src/council/task-delegation.ts` - Task delegation, execution, deliverable workflow
- `src/council/divisions.ts` - Division/staff/task/deliverable operations
- `src/council/memory.ts` - Cross-division shares
- `src/api/schemas/index.ts` - Zod validation schemas

### Frontend
- `frontend/src/features/chat/pages/ChatPage.tsx` - Main chat component
- `frontend/src/features/dashboard/pages/DashboardPage.tsx` - Dashboard with quick actions
- `frontend/src/app/layouts/Layout.tsx` - Layout with theme state
- `frontend/src/app/App.tsx` - App with ThemeWrapper
- `frontend/src/shared/theme/index.ts` - Theme system
- `frontend/src/shared/api/client.ts` - API client
- `frontend/src/shared/types/api.ts` - TypeScript types (Message, Conversation)

### Tests
- `tests/security/*.test.ts` - Security regression tests
- `tests/unit/phase9_deliverable.test.ts` - Deliverable workflow tests
- `tests/integration/migration-dependencies.test.ts` - Migration tests

---

## 6. Dependencies

### Internal
- M1 security fixes must remain intact
- Migration 016 (cross_division_shares CHECK) must not be reverted
- Founder key rotation local state must be preserved
- Database schema v5.0.0 baseline

### External
- No WebSocket infrastructure required (polling acceptable)
- No Redis required
- Claude/Hermes runtime access for E2E verification (may be blocked)

---

## 7. Implementation Sequence (Per NEXT_PROMPT.md)

| Batch | Focus | Key Deliverables |
|-------|-------|------------------|
| 1 | Baseline & Contracts | M2_M3_BASELINE_REPORT.md, API contract fix |
| 2 | Chat Core | Bidirectional history, new conversation, agent selection |
| 3 | Runtime & Workflow | MCP verification, task delegation, deliverable reviewer |
| 4 | Dashboard Backend | Activity endpoint, statistics, quick-action support |
| 5 | Dashboard Frontend | Quick action UI, theme, navigation, 404 |
| 6 | Regression | Test isolation, full test suite, TypeScript, build |
| 7 | Final Audit | Reports, git tracking, next milestone recommendation |

---

## 8. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Test isolation not fixable without major refactor | Medium | High | Document precisely, run suites separately |
| Claude/Hermes runtime unavailable | High | Medium | Document blocked status, provide verification procedure |
| API contract changes break frontend | Medium | High | Update types simultaneously, add contract tests |
| Theme consolidation breaks existing pages | Low | Medium | Test all pages after change |
| Quick actions require new backend endpoints | Medium | Medium | Use existing division/staff/task APIs |

---

## 9. Current Test Status

```
SEC-02 (Permissions):       9 pass
SEC-04 (Startup):           9 pass
SEC-06 (Replay):            8 pass
Migration Dependencies:     8 pass
Phase 9 Deliverable:       27 pass
TOTAL (individual):        61 pass

Combined suite:            35 pass, 1 fail (test runner issue)
```

Run individually: All pass. Combined: Intermittent failures due to shared state.