# Release Gap Analysis — Council Bridge
**Generated:** 2026-11-16
**Based on:** CURRENT_STATE_AUDIT.md, DATABASE_AUDIT.md, BACKEND_AUDIT.md, FRONTEND_AUDIT.md

---

## Gap Classification

| Status | Meaning |
|--------|---------|
| ✅ **Implemented & Verified** | Working, tested, evidence confirmed |
| ⚠️ **Implemented, Not Verified** | Code exists but no test/integration proof |
| 🔶 **Partially Implemented** | Core done, significant pieces missing |
| ❌ **Broken** | Code exists but doesn't work |
| 🚫 **Not Implemented** | Missing entirely |
| ⏸️ **Deferred** | Consciously postponed for post-release |

---

## 1. Database Gaps

| ID | Gap | Severity | Current | Expected | Evidence | Action Required |
|----|-----|----------|---------|----------|----------|-----------------|
| DB-01 | Test data pollution (~16K records) | **Critical** | ~90% test data | Clean canonical only | DATABASE_AUDIT.md §6-8 | Delete test divisions, staff, members, thresholds, autonomy levels, agents |
| DB-02 | 3 orphaned tasks → `founder` | High | `assigned_to_type=staff, assigned_to_id='founder'` | Valid staff_id or different type | DATABASE_AUDIT.md §7 | Fix task assignment model; add FK |
| DB-03 | 8 division_id/name mismatches | Medium | Duplicate IDs with different names | Unique ID ↔ name | DATABASE_AUDIT.md §8 | Clean up during test data removal |
| DB-04 | Missing FK on tasks.assigned_to_id | High | No FK constraint | FK to staff_agents/divisions | DATABASE_AUDIT.md §11 | Add conditional FK after cleanup |
| DB-05 | No migration runner integration | Medium | Schema version hardcoded '5.0.0' | Automated migration system | BACKEND_AUDIT.md §8.2 | Integrate migration-runner package |
| DB-06 | Session store in-memory | High | In-memory Map | Redis/DB-backed | BACKEND_AUDIT.md §11 | Replace with Redis before prod |

---

## 2. Frontend Gaps

| ID | Gap | Severity | Current | Expected | Evidence | Action Required |
|----|-----|----------|---------|----------|----------|-----------------|
| FE-01 | 401 handler breaks SPA | Medium | `window.location.href` | Router navigation | FRONTEND_AUDIT.md §9 | Use `navigate('/login')` |
| FE-02 | Theme toggle full reload | Medium | `window.location.reload()` | ThemeProvider context | FRONTEND_AUDIT.md §9 | Migrate to MUI ThemeProvider |
| FE-03 | usePolling unmount leak | Medium | No cleanup on unmount | AbortController + focus-aware | FRONTEND_AUDIT.md §9 | Harden usePolling hook |
| FE-04 | MeetingsPage tabs 2-3 placeholders | High | "Decisions", "Action Items" empty | Full implementation | FRONTEND_AUDIT.md §2 | Implement tabs + backend endpoints |
| FE-05 | CouncilPage tabs 4-5 placeholders | High | "Decisions", "Voting" empty | Full implementation | FRONTEND_AUDIT.md §2 | Implement tabs + backend endpoints |
| FE-06 | `alert()` usage in 3 places | Low | Raw `alert()` | Snackbar/Alert | FRONTEND_AUDIT.md §9 | Replace with MUI Alert |
| FE-07 | LoginPage hardcoded options | Low | Static seat/staff/division lists | API-driven | FRONTEND_AUDIT.md §9 | Fetch from API |

---

## 3. Backend Gaps

| ID | Gap | Severity | Current | Expected | Evidence | Action Required |
|----|-----|----------|---------|----------|----------|-----------------|
| BE-01 | **Zero test coverage** | **Critical** | 0 tests in src/ | Unit + integration tests | BACKEND_AUDIT.md §10 | Add tests for auth, memory, execution, deliverable |
| BE-02 | In-memory session store | High | Map-based | Redis | BACKEND_AUDIT.md §11 | Replace session store |
| BE-03 | Dynamic imports in routes | Medium | `await import()` per request | Static imports | BACKEND_AUDIT.md §11 | Move imports to top-level |
| BE-04 | SQL errors leak to clients | Medium | Some raw errors returned | Sanitized responses | BACKEND_AUDIT.md §11 | Wrap all DB calls |
| BE-05 | No request validation middleware | Medium | Zod in route handlers | Centralized middleware | BACKEND_AUDIT.md §11 | Add validation middleware |
| BE-06 | Date handling inconsistent | Low | ISO strings, no TZ norm | UTC normalized | BACKEND_AUDIT.md §11 | Standardize date handling |
| BE-07 | No connection pooling | Medium | Single SQLite connection | Pool or WAL optimization | BACKEND_AUDIT.md §11 | Review SQLite config |

---

## 4. Chat/Communication Gaps

| ID | Gap | Severity | Current | Expected | Evidence | Action Required |
|----|-----|----------|---------|----------|----------|-----------------|
| CH-01 | No E2E message delivery proof | **Critical** | Not verified | Founder→Chat→Bridge→Claude/Hermes→Bridge→Chat→History | CURRENT_STATE_AUDIT.md §4 | Write integration test |
| CH-02 | No incoming agent reply handling | High | Polling only | Webhook/push from agents | BACKEND_AUDIT.md §7 | Implement webhook endpoint |
| CH-03 | No automatic message updates | High | Manual refresh | Real-time/polling sync | CURRENT_STATE_AUDIT.md §4 | Enhance usePolling or add SSE |
| CH-04 | Message persistence across restarts | ⚠️ Not verified | SQLite messages table | Verified persistence | CURRENT_STATE_AUDIT.md §4 | Test restart scenario |

---

## 5. Dashboard/Workflow Gaps

| ID | Gap | Severity | Current | Expected | Evidence | Action Required |
|----|-----|----------|---------|----------|----------|-----------------|
| DW-01 | MeetingsPage 2 tabs missing | High | Placeholders | Full implementation | FRONTEND_AUDIT.md §2 | Implement + backend endpoints |
| DW-02 | CouncilPage 2 tabs missing | High | Placeholders | Full implementation | FRONTEND_AUDIT.md §2 | Implement + backend endpoints |
| DW-03 | Dashboard activity endpoint | Medium | Silent fallback to empty | Real /api/activity | FRONTEND_AUDIT.md §9 | Implement activity endpoint |
| DW-04 | Memory pagination client-side | Low | Client-side count | Server total | FRONTEND_AUDIT.md §9 | Add server pagination |

---

## 6. Security/Operational Gaps

| ID | Gap | Severity | Current | Expected | Evidence | Action Required |
|----|-----|----------|---------|----------|----------|-----------------|
| OP-01 | No CI/CD pipeline | Medium | Manual deploy | Automated | — | Add GitHub Actions |
| OP-02 | No health check details | Low | `/health` basic | Deep checks (DB, MCP, auth) | BACKEND_AUDIT.md §9 | Enhance health endpoint |
| OP-03 | No structured logging | Low | Console only | JSON logs + levels | BACKEND_AUDIT.md §11 | Add pino/winston |
| OP-04 | No rate limit on auth endpoints | Medium | Only signature endpoints | All auth endpoints | BACKEND_AUDIT.md §9 | Extend rate limiting |

---

## 7. Summary: Critical Release Blockers

| Priority | ID | Description | Effort | Dependencies |
|----------|-----|-------------|--------|--------------|
| **P0** | DB-01 | Remove ~16K test records | 2-4h | None |
| **P0** | BE-01 | Add test coverage (auth, execution, deliverable) | 2-3 days | None |
| **P0** | CH-01 | Verify E2E chat delivery | 1-2 days | Backend running |
| **P0** | DB-06 | Replace session store with Redis | 1-2 days | Redis instance |
| **P1** | DB-02 | Fix orphaned tasks | 1h | DB-01 |
| **P1** | DB-04 | Add FK constraints | 1h | DB-01 |
| **P1** | FE-01 | Fix 401 handler | 1h | None |
| **P1** | FE-03 | Fix usePolling leak | 2-4h | None |
| **P1** | FE-04 | Implement Meetings tabs | 1-2 days | Backend endpoints |
| **P1** | FE-05 | Implement Council tabs | 1-2 days | Backend endpoints |
| **P1** | CH-02 | Add agent webhook endpoint | 1-2 days | Agent integration |

---

## 8. Verified Working (No Gap)

| Area | Evidence |
|------|----------|
| DashboardPage (new) | Frontend audit, build passes |
| TasksPage | Full CRUD, working |
| ChatPage | UI + API complete |
| ApprovalsPage | Founder-only actions work |
| DeliverablesPage | Full workflow |
| ExecutionsPage | Full workflow |
| MemoryPage | Search + filters |
| OrganizationPage | Full CRUD |
| LoginPage | Dual-mode auth |
| Backend auth system | RSA, nonces, 3 modes |
| MCP tools | 26 registered |
| Database schema | 38 tables, FTS5, indexes |
| Canonical org data | All invariants met |
| Migration history | 8 migrations applied |
| Frontend build | Clean TypeScript + Vite |

---

*This analysis identifies gaps between current state and a usable release. Not all gaps must be fixed for initial release — see MVP_SCOPE.md for prioritization.*