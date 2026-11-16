# Codebase Simplification Report

**Date:** 2026-11-13  
**Commit:** 93fbf99  
**Branch:** master

---

## Executive Summary

Phase 8 introduced authentication hardening and council modularization. The codebase grew by ~3,461 lines (new auth modules, tests, modularized council files) while preserving the legacy `council.ts` facade. Net simplification requires converting the facade to re-exports and completing the `operations.ts` parity work.

---

## Line Count Analysis

| Category | Before (Phase 7) | After (Phase 8) | Delta |
|----------|------------------|-----------------|-------|
| `src/council.ts` (legacy) | 4,172 | 4,172 | 0 |
| `src/council/core-types.ts` | 0 | 438 | +438 |
| `src/council/inputs.ts` | 0 | 241 | +241 |
| `src/council/types.ts` | 0 | 159 | +159 |
| `src/council/operations.ts` | 0 | 290 | +290 |
| `src/council/index.ts` | 0 | 5 | +5 |
| `src/auth/` (4 files) | 0 | ~1,800 | +1,800 |
| Tests (Phase 8) | 0 | ~3,000 | +3,000 |
| **Total** | **~4,172** | **~10,105** | **+5,933** |

---

## Duplication Status

| File | Duplicated In | Lines Duplicated |
|------|---------------|------------------|
| `src/council.ts:4-361` | `core-types.ts` | 358 |
| `src/council.ts:360-649` | `inputs.ts` | 290 |
| `src/council.ts:652-793` | `types.ts` + `inputs.ts` | 142 |
| `src/council.ts:3639-4169` | `operations.ts` | ~530 (logic, not exact) |

**Total duplicated:** ~1,320 lines (31% of legacy council.ts)

---

## What Was Simplified

### Authentication (New - No Prior Equivalent)
- `src/auth/config.ts` - Explicit auth modes, configuration
- `src/auth/session.ts` - Crypto-secure session tokens
- `src/auth/founder.ts` - Operation-bound founder signatures
- `src/auth/index.ts` - Unified auth exports + helpers

### Modularized Council Structure
- Separated types from operations
- Separated schemas from implementations
- Created clear module boundaries

---

## What Was NOT Simplified (Technical Debt)

### 1. Legacy Facade Not Converted
`src/council.ts` still contains all 4,172 lines. Should be converted to:
```typescript
export * from './council/index.js';
```
**Risk:** Drift between facade and modules.

### 2. Operations.ts Incomplete
Missing from modularized operations:
- Transaction support
- Authorization checks (`isFounder`, `isDivisionHead`, `validateDivisionHead`, etc.)
- Privacy filtering (`checkMemoryAccess`, `buildPrivacyFilter`)
- Memory CRUD operations
- Division/Staff/Task/Deliverable operations
- Cross-division request workflow
- Meeting/evaluation operations

**Only implemented:** Phase 7 autonomy/execution operations (~290 lines vs ~3,000 in legacy)

### 3. Consumers Still Use Legacy Facade
- `src/init-council.ts`
- `src/ui.ts`
- `tests/council.test.ts`
- `tests/phase6_migration_verification.test.ts`

### 4. Debug/Test Files Accumulated
Untracked files in repo root:
- `debug*.ts` (5 files)
- `check-*.ts` (3 files)
- `PHASE8_AUTH_STATE.md`

---

## Simplification Opportunities

| Opportunity | Effort | Impact |
|-------------|--------|--------|
| Convert `council.ts` to re-export facade | Low | Eliminates 3,039 duplicate lines |
| Complete `operations.ts` parity | High | Enables full migration |
| Migrate consumers to modular imports | Medium | Removes legacy coupling |
| Clean up debug files | Low | Reduces repo noise |
| Delete unused exports from legacy | Low | Reduces surface area |

---

## Recommended Incremental Approach

### Batch 3A: Facade Conversion (Safe)
1. Replace `council.ts` body with `export * from './council/index.js';`
2. Run full test suite - verify no breaks
3. If breaks, identify exact dependencies

### Batch 3B: Operations Parity (Core Work)
1. Extract `checkMemoryAccess`, `buildPrivacyFilter` → `memory-ops.ts`
2. Extract authorization helpers → `auth-ops.ts`
3. Extract division/staff/task/deliverable ops → `division-ops.ts`
4. Add transaction support to `operations.ts`
5. Test each extraction independently

### Batch 3C: Consumer Migration (Optional)
1. Update `init-council.ts` to use modular imports
2. Update `ui.ts`
3. Update tests

---

## Verification

| Check | Result |
|-------|--------|
| All tests pass | ✅ 216/216 |
| TypeScript clean | ✅ 0 errors |
| Server starts (dev) | ✅ |
| Server starts (prod) | ✅ |
| Legacy facade works | ✅ |
| No circular deps | ✅ |

---

## Remaining Line Count

| File | Lines |
|------|-------|
| `src/council.ts` | 4,172 |
| `src/council/core-types.ts` | 438 |
| `src/council/inputs.ts` | 241 |
| `src/council/types.ts` | 159 |
| `src/council/operations.ts` | 290 |

**Legacy council.ts remains the largest file at 4,172 lines (41% of src/)**