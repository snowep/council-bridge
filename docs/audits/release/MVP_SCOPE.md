# MVP Scope — Council Bridge Initial Release
**Generated:** 2026-11-16
**Principle:** Minimal usable product — Founder can govern, staff can execute, system is trustworthy

---

## In Scope (Must Work for Release)

### 1. Core Governance
- [ ] **Council seats & personas** — 11 seats (4 permanent + 7 vacant), 4 personas, 8 runtime mappings
- [ ] **Constitution v1.0.0** — Active, readable via API
- [ ] **Founder authentication** — RSA-2048 session creation, nonce replay protection

### 2. Organization
- [ ] **6 Divisions** — Developer, Marketing, Finance, Creative, Research & Intelligence, Business Operations
- [ ] **51 Staff** — 6 Division Heads + 45 Specialists
- [ ] **Division membership** — Staff ↔ Division assignments

### 3. Task & Execution Flow
- [ ] **Create task** — Founder/Division Head → assigned to staff/division
- [ ] **Assign/reassign task** — Division Head or Founder
- [ ] **Update task status** — Assignee or Founder
- [ ] **Autonomy levels** — Level 1 (auto), Level 2 (Division Head), Level 3 (Founder signature)
- [ ] **Request execution** — Staff/Division/Founder
- [ ] **Approve execution (L3)** — Founder + signature
- [ ] **Execute/Cancel** — Requester or Founder
- [ ] **Execution history** — Audit trail

### 4. Deliverable Workflow
- [ ] **Create draft** — Task assignee
- [ ] **Submit for review** — Assignee
- [ ] **Assign reviewer** — Division Head/Reviewer/Founder
- [ ] **Review (accept/reject/revision)** — Reviewer
- [ ] **Resubmit** — Assignee
- [ ] **HITL enforcement** — Autonomy level gates approval

### 5. Communication
- [ ] **Send message** — Agent-to-agent
- [ ] **List conversations** — Per agent
- [ ] **Message history** — Persistent, survives restart
- [ ] **E2E verified** — Founder→Chat→Bridge→Claude/Hermes→Bridge→Chat→History

### 6. Dashboard (Founder Command Center)
- [ ] **Stats cards** — Active divisions, staff, pending approvals (clickable)
- [ ] **Recent activity** — Real events from /api/activity
- [ ] **Quick actions** — Create Division, Invite Staff, Review Approvals, New Task
- [ ] **Empty state onboarding** — CTAs when counts are zero
- [ ] **Per-section error boundaries** — Partial data on failure

### 7. Data Integrity
- [ ] **Clean database** — Only canonical data (62 org identities)
- [ ] **FK constraints** — tasks.assigned_to_id → staff_agents/divisions
- [ ] **Migration runner** — Automated schema management

---

## Out of Scope (Deferred to Post-Release)

| Feature | Reason |
|---------|--------|
| Meetings full implementation (Decisions, Action Items tabs) | Not core to governance flow |
| Council Decisions/Voting tabs | Advanced governance, not MVP |
| Real-time/WebSocket updates | Polling sufficient for MVP |
| Webhook/push from agents | Polling + manual refresh works |
| Redis session store | In-memory works for single-instance dev |
| Full test coverage | Critical paths only for MVP |
| CI/CD pipeline | Manual deploy acceptable |
| Structured logging (pino/winston) | Console sufficient |
| Advanced rate limiting | Basic on signature endpoints enough |
| Request validation middleware | Zod in handlers works |
| Connection pooling | SQLite WAL handles concurrency |
| Internationalization | Not needed |
| Offline support | Not needed |
| Optimistic UI | Not needed |
| Agent selection UI improvements | Works as-is |

---

## Minimum Acceptance Criteria

### Functional
1. Founder can log in (dev mode + prod mode with signature)
2. Founder sees Dashboard with real stats (6 divisions, 51 staff, 0 approvals initially)
3. Founder can create task → assign to staff → staff updates status
4. Staff can create deliverable → submit → Founder reviews → approve/reject
5. Founder can request Level 3 execution → sign → execute → see history
6. Founder can chat with Claude/Hermes → messages persist → survive restart
7. Database contains ONLY canonical data (62 identities, no test pollution)

### Quality
1. Frontend builds without errors
2. Backend typechecks clean
3. No console errors in normal operation
4. 401 handler preserves SPA state
5. Theme toggle works without reload
6. No memory leaks in polling

### Security
1. Founder signatures required for L3 execution
2. Nonce replay protection active
3. Loopback enforcement in local mode
4. Session tokens HMAC-signed, timed out

---

## Out of Scope for M0 (Audit Only)
- Database cleanup execution (requires Founder approval per NEXT_PROMPT.md §4)
- Test coverage implementation
- CI/CD setup

---

*This scope defines the minimum viable release. Anything not listed here is explicitly deferred.*