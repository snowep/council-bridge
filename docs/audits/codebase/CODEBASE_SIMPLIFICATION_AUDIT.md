# Codebase Simplification & Refactoring Audit

## 1. Repository Architecture Overview

**Core Layers:**
- `src/database.ts` - SQLite schema, prepared statements, migrations
- `src/council.ts` - Business logic, authorization, service layer
- `src/server.ts` - MCP tool registration, HTTP handlers

**Test Structure:**
- `tests/*.test.ts` - Unit tests per feature domain
- `migrations/*.sql` - Database migrations (5 completed)

**Key Types:**
- `DatabaseInstance` - SQLite connection wrapper
- `CouncilService` - Main service factory
- `MemoryOwnerType` - 'founder' | 'staff' | 'division' | 'seat'

## 2. Largest Files Ranked by Line Count

| File | Lines | Description |
|------|-------|-------------|
| src/council.ts | ~4,100 | Main service layer (ALL business logic) |
| src/server.ts | ~1,200 | MCP tool definitions and handlers |
| src/database.ts | ~780 | Schema, prepared statements |
| tests/phase7_autonomy_execution.test.ts | ~650 | Phase 7 integration tests |
| tests/phase6_migration_verification.test.ts | ~600 | Migration tests |

## 3. council.ts Responsibility Breakdown

**Current state: Single 4,100-line monolith with mixed responsibilities**

### Responsibilities by feature phase:
- **Phase 1-2**: Agent types, memory types, base schemas
- **Phase 3**: Council seats, votes, meetings, evaluations
- **Phase 4**: Memory CRUD operations
- **Phase 5**: Dashboards
- **Phase 6**: Divisions, staff agents, cross-division shares
- **Phase 7**: Autonomy levels, execution workflow

### Logical modules needed:

| Module | Functions | Lines (estimated) |
|--------|-----------|-------------------|
| `council.types.ts` | Schema definitions, type helpers, mappers (toX functions) | ~300 |
| `council/division.ts` | Division/StaffAgent CRUD, role management | ~350 |
| `council/meeting.ts` | Meetings, phases, ideas, challenges, syntheses | ~400 |
| `council/voting.ts` | Votes, deliberations, seat management | ~400 |
| `council/memory.ts` | Memory CRUD, search, version control | ~500 |
| `council/evaluation.ts` | Evaluation, criteria | ~300 |
| `council/execution.ts` | Autonomy levels, execution requests, approvals, history | ~600 |
| `council/core.ts` | Authorization helpers, service factory, base queries | ~300 |

**Total after split: 7 modules × ~400 lines = ~2,800 lines** (vs 4,100)

## 4. Other Files Requiring Modularization

### src/server.ts (~1,200 lines)
**Current responsibilities:**
- MCP tool schemas (Zod)
- Tool handlers (business logic delegates to council.ts)
- REST API endpoints

**Proposed split:**
- `server/tools.ts` - Tool registration, schema definitions
- Keep handlers in server.ts (thin delegation to council.ts)

## 5. Confirmed Duplicate Functions

| Pattern | File(s) | Count | Risk |
|---------|---------|-------|------|
| Status-to-icon mapping | server.ts, council.ts | 2x | Low |
| Founder check pattern | council.ts (isFounder calls) | 50+ uses | N/A (intentional helper) |
| Division member check | council.ts | 5+ uses | N/A |
| Memory access logging | council.ts | scattered | N/A |

**No significant code duplication found.** Repeated patterns are authorization helpers intentionally used throughout.

## 6. Confirmed Dead Code

| Item | Location | Status |
|------|----------|--------|
| Unused imports in council.ts | Various | Some unused destructuring |
| Commented SQL queries | council.ts | At end of file - debugging artifact |
| TODO comments without followup | Multiple | Low priority |

No truly dead functions found. All exports are used by tests or MCP registration.

## 7. Dependency and Coupling Findings

### Tight Couplings:
1. **server.ts → council.ts** - 100% (all handlers call council service)
2. **tests → council.ts** - All test helpers use council export

### Circular Dependencies: NONE

### Database Coupling:
- `council.ts` directly uses `DatabaseInstance` with prepared statements
- Business logic embedded in SQL strings in database.ts

### Permission Scattered:
Authorization checks distributed across 60% of council.ts functions rather than centralized.

### Recommended Improvements:
1. Create `council/permissions.ts` for centralized checks
2. Create `council/validators.ts` for input validation
3. Separate database queries from business logic

## 8. Proposed Target Directory Structure

```
src/
├── database.ts              # Schema + prepared statements (unchanged)
├── server.ts                # MCP registration only
├── council/
│   ├── index.ts             # Factory, service types, mappers
│   ├── types.ts             # Schemas, Zod validations, type definitions
│   ├── core.ts              # Authorization, base queries, service factory
│   ├── division.ts          # Division, staff_agent, division_members
│   ├── meeting.ts           # Meetings, phases, ideas, challenges, syntheses
│   ├── voting.ts            # Votes, deliberations, council seats
│   ├── memory.ts            # Memory CRUD, search, links, versions, access
│   ├── evaluation.ts        # Evaluation, criteria, dashboards
│   └── execution.ts         # Autonomy, execution requests, approvals, history
server/
├── tools.ts                 # MCP tool schemas and registration
```

## 9. Prioritized Refactoring Roadmap

### Phase 1: Extract Types (P2)
- Move all Zod schemas to `council/types.ts`
- Move mapper functions (toX) to `council/index.ts`
- Update imports in server.ts and council.ts

### Phase 2: Core Services (P1)
- Extract authorization helpers to `council/core.ts`
- Create `CouncilService` as composition of modular services
- Update all callers

### Phase 3: Feature Modules (P1)
- Extract Phase 6: division.ts (staff agents, divisions)
- Extract Phase 7: execution.ts (autonomy, execution flow)
- Each module gets its own test file

### Phase 4: Server Split (P2)
- Move Zod schemas to `server/tools.ts`
- server.ts becomes thin delegation layer

### Phase 5: Permission Centralization (P2)
- Create `council/permissions.ts`
- Standardize authorization patterns
- Add permission composition helpers

## 10. Regression Risks and Verification Requirements

| Risk | Mitigation |
|------|------------|
| MCP tool contract changes | Keep all tool names/schemas identical |
| Database query changes | Run full test suite (152 tests) |
| Authorization logic changes | Compare pre/post isFounder/divisionHead behavior |
| Memory access patterns | Verify all insertMemoryAccess calls still work |
| FK constraints | Run migration verification tests |

**Required verification for each phase:**
1. TypeScript compile (`npx tsc --noEmit`)
2. Full test suite (`npm test`)
3. MCP tool registration test

## 11. Estimated Implementation Scope

| Phase | Files Changed | Lines Added | Lines Removed | Effort |
|-------|--------------|-------------|-----------------|--------|
| Types extraction | 2 | +200 | +100 (inline) | 2-3 hours |
| Core services | 1 → 2 | +100 | +50 | 3-4 hours |
| Division module | 1 → 2 | +50 | +50 | 2 hours |
| Execution module | 1 → 2 | +100 | +100 | 3 hours |
| Server split | 1 → 2 | +50 | +50 | 2 hours |
| **Totals** | **6 → 11** | **+450** | **+350 (net)** | **12-15 hours** |

## 12. Smallest Safe Starting Sequence

1. **Extract types.ts** - No behavior change, cleaner imports
2. **Extract division.ts** - Clear boundary (Phase 6)
3. **Extract execution.ts** - Phase 7 isolation  
4. **Split server.ts** - Clean separation

**Avoid:**
- Merging phases (intertwined code)
- Changing function signatures
- Modifying test files
- Database/migration changes

## Conclusion

The primary target for simplification is `council.ts` (~4,100 lines). A modular structure of 7-8 focused files would reduce complexity while preserving all existing functionality. The codebase has good separation between MCP tools (server.ts) and business logic (council.ts) but internal structure needs organization.

Priority should be on Phase 7 extraction first (it's actively developed), then work backward through the feature phases. All 152 tests provide excellent regression coverage for the refactoring process.