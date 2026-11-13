# Graph Report - council-bridge  (2026-11-13)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 793 nodes · 1725 edges · 46 communities (30 shown, 16 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 41 edges (avg confidence: 0.85)
- Token cost: 24,317 input · 438 output

## Graph Freshness
- Built from commit: `93fbf991`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Crypto Test Fixtures
- Core Council Types
- Agent Messaging System
- Execution Operations
- Council Service Methods
- Project Dependencies
- Council Input Schemas
- Phase 7 Test Utilities
- Memory Access Controls
- Council Domain Entities
- Division Management
- Migration Logging
- Council Database Tables
- Migration Validation
- Phase 6 Migration Tests
- Backup Management
- Memory Operations
- Persona Seat Management
- Council Initialization
- Staff Agent Management
- Migration Registry
- Division Task Setup
- TypeScript Config
- Debug Test Context
- Database Core
- Cross Division Access
- Test Database Setup
- Autonomy Level Tables
- Candidate Management
- Debug Foreign Keys
- Deliverable Management
- Task Management
- Console Logger
- Debug Staff Context
- Evaluation Criteria
- Debug Tables
- Debug Founder Context
- Division Management
- Division Members
- Evaluation Operations
- Founder Approvals
- Meeting Phases
- Execution History
- Global Types

## God Nodes (most connected - your core abstractions)
1. `CouncilService` - 126 edges
2. `MemoryOwnerType` - 53 edges
3. `createDatabase()` - 26 edges
4. `Validator` - 21 edges
5. `BackupManager` - 20 edges
6. `MigrationLedger` - 19 edges
7. `DatabaseInstance` - 16 edges
8. `MigrationRegistry` - 16 edges
9. `StaffAgent` - 14 edges
10. `createCouncilService()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `setupTestDb()` --calls--> `createDatabase()`  [EXTRACTED]
  tests/agents.test.ts → src/database.ts
- `setup()` --calls--> `createDatabase()`  [EXTRACTED]
  tests/service_authorization.test.ts → src/database.ts
- `setupTestDb()` --calls--> `createDatabase()`  [EXTRACTED]
  tests/council.test.ts → src/database.ts
- `setupTestDb()` --calls--> `createDatabase()`  [EXTRACTED]
  tests/phase7_autonomy_execution.test.ts → src/database.ts
- `MigrationExecutionContext` --references--> `Migration`  [EXTRACTED]
  src/migration-runner/executor.ts → src/migration-runner/registry.ts

## Import Cycles
- None detected.

## Communities (46 total, 16 thin omitted)

### Community 0 - "Crypto Test Fixtures"
Cohesion: 0.05
Nodes (66): keyPair, origCanonical, payload, signed, tamperedCanonical, tamperedPayload, valid1, valid2 (+58 more)

### Community 1 - "Core Council Types"
Cohesion: 0.08
Nodes (42): AnonymousEvaluationSchema, BrainstormRecordSchema, CandidateSchema, ChallengeSchema, ConstitutionSchema, CouncilSeatSchema, CrossDivisionShareSchema, Defense (+34 more)

### Community 2 - "Agent Messaging System"
Cohesion: 0.06
Nodes (34): zod, Agent, AgentSchema, AgentService, createAgentService(), createMessageService(), ListMessagesInput, ListMessagesSchema (+26 more)

### Community 3 - "Execution Operations"
Cohesion: 0.11
Nodes (32): approveExecution(), assertTaskAccess(), cancelExecutionRequest(), checkMemoryAccess(), createTaskAutonomyLevel(), executeExecutionRequest(), getExecutionForActor(), getExecutionHistory() (+24 more)

### Community 4 - "Council Service Methods"
Cohesion: 0.06
Nodes (3): Constitution, Meeting, CouncilService

### Community 5 - "Project Dependencies"
Cohesion: 0.05
Nodes (36): author, dependencies, better-sqlite3, commander, express, @modelcontextprotocol/sdk, zod, description (+28 more)

### Community 6 - "Council Input Schemas"
Cohesion: 0.05
Nodes (35): AddDivisionMemberInputSchema, ApproveCrossDivisionAccessInputSchema, AssignDivisionHeadInputSchema, CompleteTaskInputSchema, CreateDeliverableInputSchema, CreateDivisionInputSchema, CreateMemoryInputSchema, CreateTaskInputSchema (+27 more)

### Community 7 - "Phase 7 Test Utilities"
Cohesion: 0.10
Nodes (21): db, db, db, db, TEST_DB_PATH, better-sqlite3, BackupMethod, BackupOptions (+13 more)

### Community 9 - "Memory Access Controls"
Cohesion: 0.09
Nodes (10): MemoryEntry, MemoryOwnerType, CreateMemoryInput, GetRelatedInput, RevokeCrossDivisionAccessInput, SearchMemoryInput, UpdateMemoryInput, OperationContext (+2 more)

### Community 10 - "Council Domain Entities"
Cohesion: 0.07
Nodes (25): AnonymousEvaluation, BrainstormRecord, Challenge, FounderDeliberation, FounderVote, MemoryCategory, MemoryLink, MemoryLinkType (+17 more)

### Community 11 - "Division Management"
Cohesion: 0.11
Nodes (16): createDeliverable(), getDeliverableById(), getDivisionById(), getStaffAgentById(), getTaskById(), listDeliverablesByTask(), normalizeDeliverable(), retireStaffAgent() (+8 more)

### Community 12 - "Migration Logging"
Cohesion: 0.15
Nodes (3): Logger, RollbackEngine, MigrationLedger

### Community 15 - "Phase 6 Migration Tests"
Cohesion: 0.12
Nodes (3): MIGRATION_DIR, MIGRATION_FILES, TestDB

### Community 16 - "Backup Management"
Cohesion: 0.21
Nodes (3): BackupManager, initialize(), MigrationExecutor

### Community 17 - "Memory Operations"
Cohesion: 0.16
Nodes (4): archiveMemory(), getMemoryById(), restoreMemory(), updateMemory()

### Community 19 - "Council Initialization"
Cohesion: 0.22
Nodes (8): createCouncilService(), createDefaultConstitution(), FOUNDING_MEMBERS, initializeCouncil(), RUNTIMES, VACANT_SEATS, founder, setup()

### Community 20 - "Staff Agent Management"
Cohesion: 0.17
Nodes (5): StaffAgent, ListSpecialistsInput, RetireStaffAgentInput, SuspendStaffAgentInput, UpdateStaffPermissionsInput

### Community 22 - "Division Task Setup"
Cohesion: 0.25
Nodes (6): CreateDivisionInput, CreateTaskInput, RegisterStaffAgentInput, UpdateStaffStatusInput, createLevel3Setup(), createTestSetup()

### Community 23 - "TypeScript Config"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+2 more)

### Community 24 - "Debug Test Context"
Cohesion: 0.20
Nodes (7): council, ctx, db, TEST_DB_PATH, council, db, founderCtx

### Community 25 - "Database Core"
Cohesion: 0.20
Nodes (9): close, close(), DATA_DIR, db, DB_PATH, generateId, PreparedStatement, SCHEMA_VERSION (+1 more)

### Community 26 - "Cross Division Access"
Cohesion: 0.22
Nodes (5): CrossDivisionShare, ApproveCrossDivisionAccessInput, GrantCrossDivisionAccessInput, ListPendingCrossDivisionRequestsInput, RequestCrossDivisionAccessInput

### Community 27 - "Test Database Setup"
Cohesion: 0.25
Nodes (6): db, divisionId, createDatabase(), initDb(), setupTestDb(), setupTestDb()

### Community 30 - "Debug Foreign Keys"
Cohesion: 0.29
Nodes (6): db, divInfo, fk, fk2, tables, TEST_DB_PATH

### Community 31 - "Deliverable Management"
Cohesion: 0.29
Nodes (4): Deliverable, CreateDeliverableInput, ListDeliverablesByTaskInput, UpdateDeliverableInput

### Community 32 - "Task Management"
Cohesion: 0.29
Nodes (4): Task, CompleteTaskInput, ListTasksInput, UpdateTaskInput

### Community 34 - "Debug Staff Context"
Cohesion: 0.33
Nodes (5): council, db, division, founderCtx, staff

### Community 36 - "Debug Tables"
Cohesion: 0.40
Nodes (4): db, fk, tables, TEST_DB_PATH

### Community 37 - "Debug Founder Context"
Cohesion: 0.40
Nodes (4): council, db, founderCtx, staffCtx

### Community 38 - "Division Management"
Cohesion: 0.40
Nodes (3): Division, AssignDivisionHeadInput, UpdateDivisionInput

## Knowledge Gaps
- **5 isolated node(s):** `tsx`, `@types/better-sqlite3`, `@types/express`, `@types/node`, `typescript`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 307 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CouncilService` connect `Council Service Methods` to `Memory Access Controls`, `Council Domain Entities`, `Council Database Tables`, `Persona Seat Management`, `Council Initialization`, `Staff Agent Management`, `Division Task Setup`, `Cross Division Access`, `Autonomy Level Tables`, `Candidate Management`, `Deliverable Management`, `Task Management`, `Evaluation Criteria`, `Division Management`, `Division Members`, `Evaluation Operations`, `Founder Approvals`, `Meeting Phases`, `Execution History`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **What connects `tsx`, `@types/better-sqlite3`, `@types/express` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Crypto Test Fixtures` be split into smaller, more focused modules?**
  _Cohesion score 0.05444596443228454 - nodes in this community are weakly interconnected._
- **Why does `better-sqlite3` connect `Phase 7 Test Utilities` to `Database Core`, `Agent Messaging System`, `Project Dependencies`, `Phase 6 Migration Tests`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Should `Core Council Types` be split into smaller, more focused modules?**
  _Cohesion score 0.08139534883720931 - nodes in this community are weakly interconnected._
- **Why does `zod` connect `Agent Messaging System` to `Crypto Test Fixtures`, `Core Council Types`, `Execution Operations`, `Project Dependencies`, `Council Input Schemas`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Should `Agent Messaging System` be split into smaller, more focused modules?**
  _Cohesion score 0.059800664451827246 - nodes in this community are weakly interconnected._