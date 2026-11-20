# COUNCIL BRIDGE — HEARTBEAT RELIABILITY FIX

**Repository:** `C:\Projects\council-bridge`  
**Branch:** `refactor/repository-structure`  
**Starting commit:** `4b1be96`

## Objective

Fix the runtime heartbeat test failure and ensure runtime leases are renewed and recovered safely.

This is a focused heartbeat remediation. Do not start M4 or perform unrelated refactoring.

## 1. Fix the timestamp inconsistency

Inspect `src/runtime/lifecycle.ts`.

The current implementation uses Unix milliseconds in `connect()` but ISO timestamps in `switch()`. `heartbeat()` then parses timestamps using `parseInt()`, causing ISO timestamps to be interpreted incorrectly.

Requirements:

- Use Unix milliseconds consistently for all runtime session timestamps.
- Remove `addMillisecondsToISO()` and the misleading `parseISO()` helper.
- Add strict numeric timestamp parsing.
- Reject null, malformed, non-numeric, and unsafe timestamps.
- Ensure both `connect()` and `switch()` calculate lease expiry identically.
- Preserve the existing 10-minute lease duration and 30-second intended heartbeat interval.
- Do not change unrelated database timestamps.

## 2. Make heartbeat renewal atomic and ownership-safe

Inspect the heartbeat implementation and prepared statements in `src/infrastructure/database/database.ts`.

Requirements:

- A heartbeat must belong to the exact active `session_id`.
- It must only renew a session whose status is `connected`.
- It must reject an expired lease.
- The SQL update must enforce these conditions, not rely exclusively on an earlier application-level SELECT.
- Check the SQLite affected-row count.
- Return an explicit failure if the session is no longer eligible for renewal.
- A disconnected or expired session must never become active merely by sending a heartbeat.

## 3. Fix stale-session recovery races

Inspect `recoverStaleSessions()`.

Requirements:

- Recovery must not disconnect a session whose lease was renewed after the initial expiry check.
- Make the expiry condition part of the actual UPDATE statement.
- Use Unix-millisecond comparisons consistently.
- Keep the recovery operation transactionally safe.
- Add a regression test for heartbeat racing with stale-session recovery.

## 4. Repair the tests

Inspect `tests/unit/runtime-lifecycle.test.ts`.

Add these tests:

1. Connect Claude, then heartbeat successfully.
2. Connect Claude, switch to Hermes, then heartbeat successfully.
3. Verify timestamps created by both `connect()` and `switch()` contain numeric Unix milliseconds.
4. Verify lease expiry is later than the current time.
5. Reject an unknown session.
6. Reject a disconnected session.
7. Reject an expired session.
8. Reject malformed lease timestamps.
9. Verify heartbeat does not revive an expired session.
10. Verify heartbeat cannot renew a session after another runtime has taken ownership.
11. Verify heartbeat and stale recovery cannot leave contradictory session state.

Testing requirements:

- Each independent test must receive its own temporary SQLite database and lifecycle manager.
- Use `beforeEach`/`afterEach` or an equivalent per-test fixture.
- Do not share mutable runtime state between unrelated tests.
- Do not conditionally skip assertions when a session ID is missing.
- Do not use arbitrary sleeps to make concurrency tests pass.
- Use deterministic clocks or controlled timestamps where needed.
- Preserve genuine integration tests that deliberately exercise a multi-step lifecycle.

## 5. Implement actual periodic lease renewal

Inspect the runtime connection architecture and existing MCP integration.

Requirements:

- Identify which process owns the active runtime session.
- That runtime must renew its own lease approximately every 30 seconds.
- Use the existing authenticated heartbeat endpoint or an equivalent authenticated internal mechanism.
- Bind renewal to the exact active session ID.
- Stop renewal when the runtime disconnects or loses ownership.
- Handle heartbeat failures and expired sessions explicitly.
- Do not treat dashboard GET polling as lease renewal.
- Do not make the browser dashboard the sole mechanism keeping a runtime alive.
- Do not claim that runtime heartbeat integration exists unless the actual runtime connection path invokes it.
- Preserve the 10-minute lease duration.

If automatic heartbeat cannot yet be integrated into the actual Claude/Hermes runtime adapter, document that limitation clearly and do not claim production lease renewal is complete.

## 6. Verification

Run:

- The runtime lifecycle test file independently.
- The complete backend test suite.
- TypeScript typecheck.
- Existing security and migration tests.
- Relevant runtime API tests.

Required results:

- Runtime lifecycle tests: all pass.
- Full backend suite: no new failures.
- TypeScript: zero errors.
- Heartbeat after runtime switch: passes.
- Expired and disconnected sessions: rejected.
- Heartbeat/recovery race: deterministic and safe.

## 7. Documentation

Update:

- `docs/reports/SINGLE_ACTIVE_RUNTIME_TEST_EVIDENCE.md`
- `docs/reports/SINGLE_ACTIVE_RUNTIME_FINAL_AUDIT.md`

Record the actual test commands and results. Clearly separate unit-test verification from real runtime-client heartbeat verification.

Do not claim 15/15 if the full-suite result is still 14/15.

## 8. Scope restrictions

- Work only on `refactor/repository-structure`.
- Preserve existing user changes.
- Do not modify `master`.
- Do not start M4.
- Do not perform unrelated UI, governance, memory, or architecture changes.
- Do not run production database migrations.
- Do not modify production data.
- Do not commit, push, merge, rebase, or rewrite Git history without explicit authorization.

## Final report

Provide:

1. Starting and final commit SHA.
2. Exact files changed.
3. Root cause of the heartbeat failure.
4. Timestamp consistency verification.
5. Heartbeat ownership and expiry verification.
6. Stale recovery race test results.
7. Runtime-client heartbeat integration status.
8. Runtime lifecycle test result.
9. Full backend test result.
10. TypeScript result.
11. Remaining limitations.

Do not mark this remediation complete while the full-suite heartbeat regression or required runtime renewal remains unverified.