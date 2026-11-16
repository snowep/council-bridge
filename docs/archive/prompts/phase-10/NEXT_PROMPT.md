# COUNCIL BRIDGE — M1
## DATA INTEGRITY, DATABASE CLEANUP & CRITICAL SECURITY FIXES

Repository: `snowep/council-bridge`  
Local path: `C:\Projects\council-bridge`

The Founder has completed M0 and supplied the current-state audit, release gap analysis, database audit, database cleanup plan, and agent registry audit.

The objective is to prepare Council Bridge for its first usable release as quickly as possible.

This milestone focuses on:
1. Database integrity.
2. Removal of verified test pollution.
3. Critical authentication and authorization fixes.
4. Migration correctness.
5. Reproducible database initialization.
6. Regression testing.

Do not expand the product scope or redesign the dashboard.

---

# PART 1 — ESTABLISH THE BASELINE

Before implementation:

1. Inspect Git status, current branch, and commit SHA.
2. Preserve all uncommitted dashboard changes.
3. Read all seven M0 audit documents.
4. Inspect the actual database schema and migration history.
5. Identify the active database path and environment.
6. Establish whether the current database is development, test, or production.
7. Record existing record counts and database integrity.
8. Run the existing backend and security test suites.
9. Identify the actual test coverage. Resolve the contradictory M0 statements about zero backend coverage versus comprehensive critical-path coverage.

Create a baseline report before making changes.

Do not reset, replace, or overwrite the database.

# PART 2 — CRITICAL SECURITY FIXES

Implement and test the following verified findings.

### SEC-01: Session signing secret

File: `src/auth/session.ts`

Problem:
Session tokens currently use `config.session_timeout_ms.toString()` as the HMAC signing key.

Required:
- Use `process.env.SESSION_SECRET` as the production signing key.
- Require a sufficiently strong secret in production.
- Never derive a signing key from a timeout or other predictable configuration.
- Use a generated process-local secret in development only.
- Ensure configuration validation and token signing use the same source.
- Add regression tests proving tokens cannot be forged using the timeout value.

### SEC-02: Founder private-key directory permissions

File: `src/auth/founder.ts`

Required:
- Create `.secrets` with restrictive permissions (`0o700`).
- Keep private key files at `0o600`.
- Verify existing permissions where supported.
- Avoid logging private key material.
- Test directory and file permissions on supported platforms.

### SEC-03: Production authentication fallback

File: `src/api/middleware/authentication.ts`

Required:
- Never allow hardcoded development Founder fallback when `NODE_ENV=production`.
- Keep production authentication fail-closed.
- Preserve legitimate local single-user mode.
- Reject invalid environment combinations.
- Add regression tests covering development, test, and production configurations.

### SEC-04: Founder key validation

File: `src/auth/index.ts`

Required:
- Validate the required Founder public key or initialized key configuration during production startup.
- Fail startup with a clear error when required key material is missing.
- Do not silently defer a mandatory production configuration failure until an endpoint is called.

### SEC-05: Deliverable authorization

File: `src/council/divisions.ts`

Required:
- Review `updateDeliverable`.
- Define allowed status transitions.
- Ensure staff and Division Heads cannot accept or approve deliverables without the required authorization.
- Preserve legitimate task-access permissions for content updates.
- Add tests for unauthorized status transitions and valid Founder approval.

### SEC-06: Founder signature ownership and replay

Inspect:
- `src/server.ts`
- `src/auth/founder.ts`
- `tests/security/phase8_security.test.ts`

Required:
- Verify that signed owner identity, owner type, and runtime match the values stored in the resulting session.
- Add a concurrent replay test using the same nonce.
- Verify exactly one request succeeds and subsequent requests receive the correct replay error.
- Preserve existing signature verification and nonce-consumption behavior.

# PART 3 — MIGRATION CORRECTNESS

### DB-01: Migration dependency resolution

File: `src/migration-runner/executor.ts`

Required:
- When specific migration IDs are requested, calculate their transitive dependencies.
- Execute prerequisites in the correct order.
- Preserve migration checksums and validation.
- Reject missing dependencies and invalid migration graphs.
- Add tests for direct dependencies, transitive dependencies, and ordering.
- Do not execute migrations against the production database as part of this task.

### DB-02: Cross-division share constraint

Inspect:
- `src/infrastructure/database/database.ts`
- `src/council/memory.ts`
- `src/council/legacy.ts`

Required:
- Confirm the constitutional and permission policy for granting cross-division shares.
- The current migration policy says Founder-only grants.
- Ensure all code paths follow that policy.
- Remove or reject unsupported Division-level grants.
- Add tests proving unauthorized grants fail and authorized Founder grants work.
- Do not loosen database constraints merely to accommodate incorrect legacy callers.

### DB-03: Database privacy query safety

File: `src/council/operations.ts`

Required:
- Review dynamic SQL construction in `buildPrivacyFilter`.
- Replace untrusted interpolated values with parameterized queries.
- Preserve existing privacy and access-control behavior.
- Add tests for unusual owner IDs and SQL injection attempts.

### DB-04: Database access performance

Inspect `checkMemoryAccess` and task-history filtering.

Required:
- Evaluate the N+1 query issue.
- Prefer a safe batch query or JOIN where it improves performance.
- Preserve all existing access-control rules.
- Add tests for multiple entries with mixed access permissions.

# PART 4 — DATABASE CLEANUP

This is the most important data operation in M1.

M0 reports approximately 16,000 test records and approximately 90% database pollution.

Do not assume the number is correct. Recount the actual records.

### Step 1: Inventory

Inspect every table and identify:
- Operational records.
- Canonical organizational records.
- Test records.
- Duplicate records.
- Orphaned records.
- Historical records.
- Records with ambiguous ownership or purpose.

### Step 2: Build an exact cleanup manifest

Create:

`docs/audits/release/DATABASE_CLEANUP_MANIFEST.md`

For every proposed deletion, include:
- Table.
- Record ID.
- Classification.
- Reason for removal.
- Related records.
- Foreign-key implications.
- Whether cascading deletion is involved.
- Backup and restoration implications.

Provide exact counts per table.

Classify records as:
- KEEP
- REMOVE
- ARCHIVE
- INVESTIGATE

Do not classify ambiguous records as REMOVE.

### Step 3: Protect canonical organization

Preserve:

- 11 Council seats.
- Four permanent founding personas.
- Seven replaceable seats.
- Six divisions.
- Six Division Heads.
- Forty-five specialists.
- Fifty-one logical staff identities.
- Sixty-two total organizational identities.
- Eight existing runtime mappings.
- Constitution v1.0.0.

Do not remove canonical identities or legitimate organizational history.

### Step 4: Cleanup execution preparation

Prepare a reproducible, idempotent cleanup script or migration.

Requirements:
- Create a verified backup before cleanup.
- Record the database checksum.
- Support dry-run mode.
- Report exact affected records.
- Respect foreign-key dependencies.
- Run database integrity checks afterward.
- Verify canonical organization counts.
- Provide a rollback/recovery procedure.

**STOP BEFORE DELETING OR ARCHIVING ANY RECORDS IN THE ACTIVE DATABASE.**

The Founder must review and explicitly approve the exact cleanup manifest before destructive execution.

# PART 5 — SESSION STORE DECISION

M0 identified the in-memory session store as a concern.

Current deployment assumption:
- Local single-user mode.
- Low tens of concurrent users.
- Single server instance unless explicitly configured otherwise.

For this milestone:
- Document the single-instance limitation.
- Verify session expiration and cleanup behavior.
- Test restart behavior.
- Verify session invalidation and authentication behavior.
- Do not introduce Redis unless the current deployment architecture actually requires multiple instances or persistent distributed sessions.

Do not add infrastructure merely for theoretical scalability.

# PART 6 — REPOSITORY HYGIENE

Inspect:
- Root-level `test-corrupt-*` directories.
- `test-recovery-*` directories.
- `test-data` and `test-fk-*` directories.
- Temporary database files.
- Test output and generated artifacts.
- `check_orphans.cjs`.

Required:
- Determine which artifacts are tracked and which are generated.
- Move test output to temporary directories where appropriate.
- Update `.gitignore` with explicit patterns.
- Keep legitimate test fixtures.
- Avoid broad ignore patterns that hide source files.
- Convert CommonJS scripts to ESM only if appropriate and safe.

Do not delete tracked files without verifying their purpose.

# PART 7 — TESTING

Run and record:

- Backend unit tests.
- Backend integration tests.
- Authentication and security tests.
- Migration runner tests.
- Deliverable authorization tests.
- Database integrity checks.
- Frontend typecheck.
- Frontend production build.

Add tests for every security or correctness fix above.

Do not claim full coverage unless measured and supported by evidence.

Do not weaken, delete, or rewrite tests simply to obtain passing results.

# PART 8 — REQUIRED DELIVERABLES

Create or update:

1. `docs/audits/release/M1_BASELINE_REPORT.md`
2. `docs/audits/release/M1_SECURITY_FIX_REPORT.md`
3. `docs/audits/release/M1_MIGRATION_REPORT.md`
4. `docs/audits/release/DATABASE_CLEANUP_MANIFEST.md`
5. `docs/audits/release/M1_DATABASE_CLEANUP_REPORT.md`
6. `docs/audits/release/M1_TEST_REPORT.md`
7. `docs/audits/release/M1_COMPLETION_REPORT.md`

The completion report must distinguish:
- Implemented.
- Tested and passed.
- Tested and failed.
- Not implemented.
- Requires Founder approval.
- Deferred.

# PART 9 — STRICT EXECUTION BOUNDARIES

Authorized:
- Read-only database inspection.
- Non-destructive code changes.
- Security fixes.
- Migration runner fixes.
- Test additions.
- Dry-run cleanup.
- Documentation.
- Local isolated test database operations.

Not authorized:
- Deleting production records.
- Archiving production records.
- Applying production migrations.
- Resetting or replacing the active database.
- Changing canonical Council membership.
- Changing canonical divisions or staff identities.
- Weakening security or permissions.
- Introducing Redis without demonstrated need.
- Merging or pushing branches.
- Deploying.

Preserve the Founder's latest dashboard changes.

# COMPLETION CONDITION

M1 is complete only when:

1. Critical security fixes are implemented and tested.
2. Migration dependency handling is verified.
3. Deliverable authorization is correct.
4. Database cleanup candidates are precisely identified.
5. A dry-run cleanup produces an exact manifest.
6. Database recovery procedures are documented.
7. Regression tests pass or remaining failures are explicitly explained.
8. All required reports are created.

Stop before destructive database cleanup.

Present the exact cleanup manifest and request Founder approval before executing deletion or archival.

The goal is a clean, secure, reliable foundation for M2 and M3. Do not expand scope.