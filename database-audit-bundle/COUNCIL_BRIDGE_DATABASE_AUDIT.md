# Council Bridge --- Independent SQLite Database Audit

**Audit target:** uploaded `council-bridge-audit.db`\
**Reported source path:** `C:\Projects\council-bridge\data\council.db`\
**Audit mode:** read-only; no database changes made\
**Database size:** 8,220,672 bytes (8 MB)

## Executive result

**SQLite physical integrity: PASS. Application data quality: FAIL /
NEEDS CLEANUP.**

The database opens successfully. Independent checks returned:

-   `PRAGMA integrity_check`: `ok`
-   `PRAGMA quick_check`: `ok`
-   `PRAGMA foreign_key_check`: 0 violations
-   48 SQLite tables: 42 application tables plus 6 FTS5
    virtual-table/shadow tables
-   123 indexes and 5 triggers
-   63 declared foreign-key relationships
-   25,738 rows across the 42 application tables (33,293 including FTS5
    internal tables)

The database is not clean enough to treat every record as production
data. Several tables contain large volumes of apparent test/fixture
data, including malformed division-member roles and dangling
application-level references that SQLite's foreign-key checker cannot
detect.

## 1. Confirmed findings

### F-01 --- Migration 014 has not been applied

**Severity: High --- blocks the draft-deliverable workflow**

The migration ledger contains migrations `001` through `006` and `013`,
all marked successful. There is no `014` entry.

The live `deliverables` table has this status constraint:

`submitted`, `accepted`, `rejected`, `revision_requested`

It does **not** include `draft`.

Therefore, the uploaded database snapshot does not contain the Migration
014 schema change. A code path that inserts a deliverable with status
`draft` will be rejected by this database constraint.

All 141 existing deliverables have version `1`; `deliverable_versions`
contains 0 rows.

### F-02 --- Large volume of apparent test/fixture records in core organization tables

**Severity: Critical for production data hygiene**

  Table                        Total rows   Canonical organization rows   Additional rows
  -------------------------- ------------ ----------------------------- -----------------
  `divisions`                       5,427                             6             5,421
  `staff_agents`                    6,925                            51             6,874
  `division_members`                5,529                            51             5,478
  `staff_runtime_personas`            938                           102               836

The six canonical division IDs are present. They contain 51 active staff
identities, 51 memberships, and 102 staff/runtime mappings (51 Claude
and 51 Hermes).

The additional rows include UUID-suffixed division names and test-like
staff names/roles. The pattern strongly indicates test or fixture data
persisted in the database. The source of those writes cannot be proven
from the database snapshot alone.

**Do not delete these records automatically.** First establish which
records are disposable test data and which are legitimate operational
records.

### F-03 --- 4,367 `division_members.role` values are invalid

**Severity: High**

The `division_members.role` column should contain role values such as
`head` or `specialist` (and the schema default is `member`).

There are **4,367 rows** where `role` contains an ISO timestamp instead
of a role. The table has no CHECK constraint preventing this.

The 51 canonical organization memberships are correct: - 6 `head` - 45
`specialist`

This issue is concentrated in the additional/noncanonical rows, but it
is real persisted data corruption at the application-field level.

### F-04 --- 70 division head references and 3 task assignee references do not resolve

**Severity: High**

SQLite's foreign-key checker does not detect these because these fields
are not declared as foreign keys.

-   70 `divisions.head_staff_id` values do not match a
    `staff_agents.staff_id`.
-   3 tasks have `assigned_to_type = 'staff'` but
    `assigned_to_id = 'founder'`, which is not a staff identity.

All six canonical division head references resolve to active staff in
their own divisions.

### F-05 --- Global quality threshold differs from the migration default

**Severity: Medium --- Founder confirmation required**

The sole global `quality_thresholds` row is:

-   `min_quality_score = 80`
-   `requires_review = 0`

Migration 013's initial default was `70` and `requires_review = 1`. The
row's `updated_at` value indicates it was modified after creation.

This may be an intentional configuration change. However, it currently
means the global configuration does not require review by default.
Confirm that this is intended before relying on it operationally.

There are also 154 quality-threshold rows referencing
noncanonical/test-like divisions.

### F-06 --- Deliverable workflow history is absent from this database

**Severity: Medium --- operational evidence gap**

The database contains 141 deliverables: - 84 `submitted` - 57 `accepted`

However: - `deliverable_versions`: 0 rows - `deliverables.audit_log`:
empty (`[]`) for all 141 rows - new `reviewer_type`: NULL for all 141 -
new `reviewer_id`: NULL for all 141 - `approved_at`: NULL for all 141 -
`approved_by_type`: NULL for all 141 - `founder_signature`: NULL for all
141 - every deliverable remains at version 1

Some legacy `reviewed_by_type` values exist, but the new Phase 9 Batch 4
workflow metadata is not populated in this snapshot.

This does not disprove isolated E2E test results. It means this
production database does not itself contain evidence of persisted
revision/version/Founder-approval workflow execution.

### F-07 --- Task audit table is empty

**Severity: Medium --- auditability gap**

`tasks` contains 3,251 rows, but `task_audit` contains 0 rows.

The database therefore has no persisted task-audit history for those
records. Some tasks may have been inserted directly by test fixtures
rather than through the application service; the snapshot alone cannot
establish the cause.

### F-08 --- Persisted data does not demonstrate Level 2/Level 3 approval workflows

**Severity: Medium --- evidence gap**

-   `execution_requests`: 15 rows
    -   14 `queued`
    -   1 `completed`
    -   all 15 are autonomy Level 1
-   `approval_requests`: 0 rows
-   `founder_approvals`: 0 rows

The database contains no persisted Level 2/Level 3 execution approval
examples. The test report may verify those paths in isolated tests, but
this database snapshot does not demonstrate them.

### F-09 --- Many operational tables are empty

These empty tables may be legitimate if the Council has not yet used
those workflows. They are listed because they limit what can be
validated from persisted production history:

-   `meetings`: 0
-   `meeting_phases`: 0
-   `evaluation_criteria`: 0
-   `evaluations`: 0
-   `candidates`: 0
-   `founder_votes`: 0
-   `founder_deliberations`: 0
-   `founder_approvals`: 0
-   `cross_division_shares`: 0
-   `memory_links`: 0
-   `task_audit`: 0
-   `deliverable_versions`: 0
-   `approval_requests`: 0

## 2. Confirmed healthy areas

### SQLite and schema integrity

-   `integrity_check`: `ok`
-   `quick_check`: `ok`
-   `foreign_key_check`: no violations
-   No NULL primary-key values found.
-   No NULL values found in columns declared NOT NULL.
-   All 63 declared foreign-key relationships pass SQLite's foreign-key
    check.
-   Migration ledger checksums are 64-character SHA-256 values; all 7
    recorded migrations have status `success`.

### Canonical organization

-   6 canonical divisions present.
-   51 canonical staff identities present and active.
-   51 canonical division memberships present.
-   6 division-head references resolve to active staff in the
    corresponding division.
-   102 canonical staff runtime mappings present: 51 Claude and 51
    Hermes.
-   Canonical membership roles are correct: 6 heads and 45 specialists.

### Council

-   11 Council seats present.
-   4 seats marked permanent and 7 vacant.
-   4 persona records present.
-   Runtime persona mappings: 4 Claude and 4 Hermes.
-   Constitution record: version `1.0.0`, status `active`, Founder
    approval flag set.

Note: all four permanent Council seats have `is_founder = 1`. Confirm
that this column means "founding Council member," not "the human
Founder," because the system's governance model distinguishes the
Founder from Council voting seats.

### Memory and full-text search

-   `memory_entries`: 2,447
-   `memory_versions`: 78
-   `memory_access`: 78
-   `memory_links`: 0
-   FTS index rows: 2,447

The FTS index matches all active memory entries exactly: - no missing
FTS rows - no stale FTS rows - no content mismatches

All checked memory `content` and `tags` values are valid JSON. Memory
version and access references resolve.

## 3. Table inventory --- all 48 SQLite tables

The six `memory_fts*` tables are FTS5 virtual-table/shadow structures,
not six additional business-domain tables.

  Table                       Rows
  ------------------------ -------
  agents                       160
  approval_requests              0
  brainstorm_records             0
  candidates                     0
  challenges                     0
  constitutions                  1
  council_seats                 11
  cross_division_shares          0
  defenses                       0
  deliverable_versions           0
  deliverables                 141
  division_members           5,529
  divisions                  5,427
  evaluation_criteria            0
  evaluations                    0
  execution_history             17
  execution_requests            15
  founder_approvals              0
  founder_deliberations          0
  founder_nonces                 4
  founder_votes                  0
  meeting_phases                 0
  meetings                       0
  memory_access                 78
  memory_entries             2,447
  memory_fts                 2,447
  memory_fts_config              1
  memory_fts_content         2,447
  memory_fts_data              122
  memory_fts_docsize         2,447
  memory_fts_idx                91
  memory_links                   0
  memory_versions               78
  messages                     391
  migration_audit                0
  migration_ledger               7
  personas                       4
  primary_ideas                  0
  quality_thresholds           155
  reassessments                  0
  runtime_personas               8
  schema_version                 4
  staff_agents               6,925
  staff_runtime_personas       938
  syntheses                      0
  task_audit                     0
  task_autonomy_levels         147
  tasks                      3,251

## 4. Additional observations

-   `tasks`: 3,251 rows; 2,677 pending, 397 in progress, 112 completed,
    61 cancelled, 4 in review.
-   The most frequent task title is `Test Task` (1,065 rows), another
    strong indication of test data in the database.
-   `messages`: 391 rows. Most are between `founder` and `staff-001`;
    there is one Claude-to-Hermes message and one Hermes-to-Claude
    reply.
-   `memory_entries`: 2,447 rows: 1,878 `council_shared`, 491
    `task_history`, 78 `staff_private`.
-   25 `deliverables.content` values are not valid JSON, although the
    schema comment describes this field as a JSON payload. Confirm
    whether the application contract permits plain text.
-   All 4 Founder nonce records are expired at the time of this audit.
    This may be consistent with probabilistic cleanup; no nonce values
    are reproduced here.
-   `PRAGMA schema_version` is SQLite's internal schema-change counter,
    not the application's semantic version. The application's
    `schema_version` table contains 2.0.0, 3.0.0, 4.0.0 and 5.0.0;
    latest recorded version is 5.0.0.

## 5. Recommended order of action

1.  **Preserve this database and its backup. Do not delete records
    yet.**
2.  Reconcile Migration 014: the uploaded database does not show it
    applied. Apply it using the production migration runner only after
    verifying the exact target database and backup.
3.  Produce a non-destructive classification report for apparent
    test/fixture rows in `divisions`, `staff_agents`,
    `division_members`, `staff_runtime_personas`, `tasks`,
    `quality_thresholds`, `task_autonomy_levels`, `messages`, and
    `memory_entries`.
4.  Correct or quarantine invalid `division_members.role` values only
    after classifying their source records.
5.  Review the 70 dangling division-head references and 3 invalid staff
    task assignees.
6.  Confirm whether global quality threshold `80 / review disabled` is
    intentional.
7.  Verify that the application writes `task_audit`, deliverable
    versions, deliverable audit logs, and approval records to the
    intended production database.
8.  Re-run the audit after remediation and compare before/after row
    counts and checksums.

## 6. Scope and limitations

This audit directly opened the uploaded SQLite file in read-only mode
and ran whole-database integrity checks, table counts, schema
inspection, JSON parsing checks on structured fields, FTS consistency
checks, declared foreign-key checks, and application-level reference
checks for key relationships.

It did not modify the database. It did not manually assess the semantic
quality of every free-text payload or prove which process inserted each
test-like row. Those questions require source-code/log correlation and,
for cleanup, a separate reviewed plan.
