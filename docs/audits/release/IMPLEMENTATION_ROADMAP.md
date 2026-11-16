# Implementation Roadmap — Council Bridge
**Generated:** 2026-11-16
**Based on:** CURRENT_STATE_AUDIT.md, RELEASE_GAP_ANALYSIS.md, MVP_SCOPE.md

---

## Milestone Overview

| Milestone | Name | Objective | Priority | Est. Effort |
|-----------|------|-----------|----------|-------------|
| **M0** | Current-State Audit & Release Scope | Complete audit, gap analysis, MVP scope, roadmap | **Done** | — |
| **M1** | Database Cleanup & Data Integrity | Remove test data, fix orphans, add FKs, clean DB | P0 | 4-6h |
| **M2** | Agent & Division Registry Stabilization | Verify canonical data, runtime mappings, org invariants | P0 | 2-4h |
| **M3** | Chat & Claude/Hermes Communication | E2E verified message flow, webhook for incoming | P0 | 2-3 days |
| **M4** | Dashboard Functionality Integration | Complete DashboardPage, activity endpoint, quick actions | P1 | 1-2 days |
| **M5** | Core Founder Workflows | Task → Deliverable → Execution end-to-end | P0 | 2-3 days |
| **M6** | Security & Operational Reliability | Session store, 401 fix, polling fix, auth tests | P1 | 2-3 days |
| **M7** | Full Integration & Regression Testing | All workflows verified, no regressions | P0 | 2-3 days |
| **M8** | Release Candidate | Final build, smoke tests, deploy preparation | P0 | 1 day |
| **M9** | Post-Release Improvements | Meetings/Council tabs, real-time, CI/CD, logging | P2 | Ongoing |

---

## M1 — Database Cleanup & Data Integrity

**Objective:** Clean database to canonical-only state with proper constraints

**Dependencies:** Founder approval of cleanup plan (DATABASE_CLEANUP_PLAN.md)

**Tasks:**
| ID | Task | Files/Modules | Acceptance Criteria |
|----|------|---------------|---------------------|
| M1.1 | Backup production database | `data/council.db` | Backup file created with timestamp |
| M1.2 | Delete test divisions | `divisions` table | Only 6 canonical divisions remain |
| M1.3 | Delete test staff agents | `staff_agents` table | Only 51 canonical staff remain |
| M1.4 | Delete test division members | `division_members` table | Only 51 canonical members remain |
| M1.5 | Delete test quality thresholds | `quality_thresholds` table | Only 1 global threshold remains |
| M1.6 | Delete test task autonomy levels | `task_autonomy_levels` table | Only 3 canonical levels remain |
| M1.7 | Delete test agents | `agents` table | Only canonical runtime agents remain |
| M1.8 | Fix 3 orphaned tasks | `tasks` table | Tasks reference valid staff_id or different type |
| M1.9 | Clean 8 mismatched division IDs | `divisions` table | ID ↔ name consistency |
| M1.10 | Add FK: tasks.assigned_to_id (staff) → staff_agents.staff_id | Schema migration | FK constraint enforced |
| M1.11 | Add FK: tasks.assigned_to_id (division) → divisions.division_id | Schema migration | FK constraint enforced |
| M1.12 | Verify record counts | All tables | Match DATABASE_AUDIT.md canonical counts |

**Risks:** Test suite may break if tests depend on test data — tests should use isolated DBs

**Deliverables:** Clean database, updated migration ledger

---

## M2 — Agent & Division Registry Stabilization

**Objective:** Verify and lock canonical organizational data

**Dependencies:** M1 complete

**Tasks:**
| ID | Task | Files/Modules | Acceptance Criteria |
|----|------|---------------|---------------------|
| M2.1 | Verify council_seats (11, 4 permanent, 7 vacant) | `scripts/seed/initialize-council.ts` | Matches seed spec exactly |
| M2.2 | Verify personas (4 founding members) | `personas` table | 4 personas, correct seat_id |
| M2.3 | Verify runtime_personas (8 mappings) | `runtime_personas` table | 4 personas × 2 runtimes |
| M2.4 | Verify 6 divisions with correct heads | `divisions`, `staff_agents` | Head staff_id matches division |
| M2.5 | Verify 51 staff agents (6 heads + 45 specialists) | `staff_agents` table | Correct division, role, status |
| M2.6 | Verify staff_runtime_personas (938 → canonical only) | `staff_runtime_personas` | Only mappings for 51 staff |
| M2.7 | Lock constitution v1.0.0 | `constitutions` table | Active, unmodified |
| M2.8 | Document canonical registry | `docs/audits/release/AGENT_REGISTRY_AUDIT.md` | Complete reference |

**Risks:** None — verification only

**Deliverables:** AGENT_REGISTRY_AUDIT.md, verified registry

---

## M3 — Chat & Claude/Hermes Communication

**Objective:** End-to-end verified message flow with persistent history

**Dependencies:** M1, M2 complete; backend running

**Tasks:**
| ID | Task | Files/Modules | Acceptance Criteria |
|----|------|---------------|---------------------|
| M3.1 | Write E2E integration test: Founder→Chat→Bridge→Claude→Bridge→Chat→History | `tests/integration/chat-e2e.test.ts` | Test passes, proves full loop |
| M3.2 | Implement agent webhook endpoint for incoming replies | `src/api/routes/agent-webhook.routes.ts` | POST /api/agent/webhook accepts replies |
| M3.3 | Add webhook authentication (agent signature) | `src/auth/agent.ts` | Validates agent identity |
| M3.4 | Enhance usePolling for incoming message sync | `src/shared/hooks/useApi.ts` | Auto-refresh on new messages |
| M3.5 | Verify message persistence across server restart | Integration test | Messages survive restart |
| M3.6 | Test ChatPage with real Claude/Hermes | Manual + automated | Conversation works end-to-end |
| M3.7 | Document chat API contract | `docs/api/chat.md` | Complete API docs |

**Parallelizable:** M3.1 (test) can start before M3.2-M3.4 (implementation)

**Risks:** Requires actual Claude/Hermes runtime for full verification

**Deliverables:** E2E test passing, webhook endpoint, verified chat flow

---

## M4 — Dashboard Functionality Integration

**Objective:** Complete Founder Command Center with real data and actions

**Dependencies:** M1 complete (clean DB for accurate stats)

**Tasks:**
| ID | Task | Files/Modules | Acceptance Criteria |
|----|------|---------------|---------------------|
| M4.1 | Implement /api/activity endpoint | `src/api/routes/activity.routes.ts` | Returns real activity events |
| M4.2 | Wire DashboardPage to real activity feed | `DashboardPage.tsx` | Shows real events, clickable |
| M4.3 | Verify stat card navigation | `DashboardPage.tsx` | Click divisions→/organization, etc. |
| M4.4 | Verify quick actions navigation | `DashboardPage.tsx` | All 4 buttons navigate correctly |
| M4.5 | Test empty state CTAs | `DashboardPage.tsx` | Zero counts show onboarding buttons |
| M4.6 | Test per-section error boundaries | `DashboardPage.tsx` | One section fails, others show |

**Risks:** Low — mostly frontend wiring

**Deliverables:** Working DashboardPage with real data

---

## M5 — Core Founder Workflows

**Objective:** Task → Deliverable → Execution end-to-end verified

**Dependencies:** M1, M2, M3, M4

**Tasks:**
| ID | Task | Files/Modules | Acceptance Criteria |
|----|------|---------------|---------------------|
| M5.1 | Write integration test: Create task → assign → update status | `tests/integration/task-workflow.test.ts` | Full flow passes |
| M5.2 | Write integration test: Deliverable workflow (draft→submit→review→approve) | `tests/integration/deliverable-workflow.test.ts` | Full flow passes |
| M5.3 | Write integration test: L3 execution (request→sign→execute→history) | `tests/integration/execution-l3.test.ts` | Full flow passes |
| M5.4 | Verify HITL enforcement by autonomy level | `src/council/task-delegation.ts` | L1=auto, L2=head, L3=founder+sig |
| M5.5 | Verify quality threshold resolution | `src/council/task-delegation.ts` | Division→task→global fallback |
| M5.6 | Test Dashboard quick actions trigger workflows | Manual + automated | Buttons create real entities |

**Parallelizable:** M5.1, M5.2, M5.3 can run in parallel

**Risks:** Complex state machines — thorough testing required

**Deliverables:** 3 passing integration tests, verified workflows

---

## M6 — Security & Operational Reliability

**Objective:** Harden production readiness

**Dependencies:** Can start after M1 (independent of M3-M5)

**Tasks:**
| ID | Task | Files/Modules | Acceptance Criteria |
|----|------|---------------|---------------------|
| M6.1 | Replace in-memory session store with Redis | `src/auth/session.ts`, `src/auth/redis-session.ts` | Redis-backed, survives restart |
| M6.2 | Fix 401 handler — use router navigation | `frontend/src/shared/api/client.ts` | SPA state preserved |
| M6.3 | Fix usePolling — add AbortController + focus awareness | `frontend/src/shared/hooks/useApi.ts` | No leaks, pauses in background |
| M6.4 | Replace theme reload with ThemeProvider | `frontend/src/app/Layout.tsx`, `App.tsx` | Instant toggle, no reload |
| M6.5 | Replace `alert()` with MUI Snackbar (3 locations) | `TasksPage.tsx`, `ExecutionsPage.tsx` | Consistent error UX |
| M6.6 | Add auth middleware tests (3 modes) | `tests/integration/auth-middleware.test.ts` | Local/Dev/Prod all pass |
| M6.7 | Add founder signature tests (valid/invalid/replay/expired/rotation) | `tests/unit/founder-signature.test.ts` | All scenarios covered |
| M6.8 | Add memory privacy tests (11 categories × 4 actors) | `tests/unit/memory-privacy.test.ts` | All 44 combinations pass |

**Parallelizable:** M6.1-M6.5 (frontend) can run parallel to M6.6-M6.8 (backend tests)

**Risks:** Redis dependency for M6.1

**Deliverables:** Hardened auth, fixed frontend issues, test coverage for critical paths

---

## M7 — Full Integration & Regression Testing

**Objective:** All workflows verified, no regressions

**Dependencies:** M3, M4, M5, M6 complete

**Tasks:**
| ID | Task | Files/Modules | Acceptance Criteria |
|----|------|---------------|---------------------|
| M7.1 | Full regression suite | All test files | All tests pass |
| M7.2 | Manual smoke test: Founder login → Dashboard → Task → Deliverable → Execution → Chat | Manual | All flows work |
| M7.3 | Manual smoke test: Staff login → Task → Deliverable → Chat | Manual | Staff flows work |
| M7.4 | Load test: 50 concurrent users | k6/artillery | <500ms p95, no errors |
| M7.5 | Database integrity check after load | `PRAGMA integrity_check` | Clean |
| M7.6 | Verify all MVP_SCOPE.md acceptance criteria | Checklist | All ✅ |

**Risks:** Integration issues between independently developed components

**Deliverables:** Regression test report, load test results, MVP checklist

---

## M8 — Release Candidate

**Objective:** Production-ready build

**Dependencies:** M7 complete (all green)

**Tasks:**
| ID | Task | Acceptance Criteria |
|----|------|---------------------|
| M8.1 | Production build (frontend + backend) | Clean builds |
| M8.2 | Create release tag | Git tag `v1.0.0-rc1` |
| M8.3 | Deploy to staging | Accessible, functional |
| M8.4 | Staging smoke tests | All MVP flows work |
| M8.5 | Prepare release notes | `RELEASE_NOTES_v1.0.0.md` |

**Deliverables:** Release candidate deployed to staging

---

## M9 — Post-Release Improvements

**Objective:** Enhance beyond MVP

**Priority:** P2 (after release)

**Tasks:**
| ID | Task | Notes |
|----|------|-------|
| M9.1 | Implement MeetingsPage Decisions/Action Items tabs | Backend endpoints exist |
| M9.2 | Implement CouncilPage Decisions/Voting tabs | Advanced governance |
| M9.3 | Add WebSocket/SSE for real-time updates | Replace polling |
| M9.4 | CI/CD pipeline (GitHub Actions) | Automated deploy |
| M9.5 | Structured logging (pino) | Production observability |
| M9.6 | Advanced rate limiting | All auth endpoints |
| M9.7 | Request validation middleware | Centralized Zod |
| M9.8 | Connection pooling review | SQLite optimization |
| M9.9 | Internationalization prep | i18n infrastructure |

---

## Parallelization Map

```
M0 (Done)
  │
  ├─→ M1 (Database Cleanup) ──→ M2 (Registry) ──→ M4 (Dashboard)
  │                                    │
  │                                    ├─→ M3 (Chat) ──→ M5 (Workflows)
  │                                    │
  │                                    └─→ M6 (Security) ─┐
  │                                                         │
  └─────────────────────────────────────────────────────────┼──→ M7 (Integration)
                                                             │
                                                            M8 (RC)
                                                             │
                                                            M9 (Post-release)
```

**Critical Path:** M1 → M2 → M3 → M5 → M7 → M8 (≈ 10-14 days)
**Parallel Opportunities:** M4, M6 can run alongside M3/M5

---

## Resource Requirements

| Milestone | Backend Dev | Frontend Dev | QA/Testing | Infra |
|-----------|-------------|--------------|------------|-------|
| M1 | 1 | 0 | 0 | DB backup |
| M2 | 1 | 0 | 0 | — |
| M3 | 1 | 1 | 1 | Claude/Hermes access |
| M4 | 0 | 1 | 0 | — |
| M5 | 1 | 1 | 1 | — |
| M6 | 1 | 1 | 1 | Redis instance |
| M7 | 1 | 1 | 1 | Load test env |
| M8 | 0 | 0 | 1 | Staging env |
| M9 | Ongoing | Ongoing | — | — |

---

## Risk Register

| Risk | Milestone | Likelihood | Impact | Mitigation |
|------|-----------|------------|--------|------------|
| Test data cleanup breaks tests | M1 | High | Medium | Use isolated test DBs |
| Redis unavailable for M6.1 | M6 | Medium | High | Fallback: improve in-memory with persistence |
| Claude/Hermes access for M3 | M3 | Medium | High | Mock for CI, real for staging |
| Integration regressions in M7 | M7 | Medium | High | Incremental integration, not big bang |
| Schema migration issues in M1 | M1 | Low | High | Full backup, test on copy first |

---

## Go/No-Go Criteria for Each Milestone

| Milestone | Go Criteria |
|-----------|-------------|
| M1 | DB clean, canonical counts match, FKs enforced, no test data |
| M2 | All 62 identities verified, registry doc complete |
| M3 | E2E chat test passes, webhook works, persistence verified |
| M4 | Dashboard shows real data, all actions navigate correctly |
| M5 | 3 integration tests pass, HITL enforcement verified |
| M6 | Redis sessions, no 401 reload, no polling leaks, critical tests pass |
| M7 | Full regression green, load test passes, MVP checklist ✅ |
| M8 | Staging deployed, smoke tests pass |

---

*This roadmap is the implementation plan for the Council Bridge usable release. M0 is complete. M1 requires Founder approval of DATABASE_CLEANUP_PLAN.md before execution.*