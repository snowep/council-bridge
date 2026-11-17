# Known Limitations

## M2 - Chat Integration

### Blocked by Unavailable Runtime

1. **E2E Claude Connectivity**
   - Status: BLOCKED
   - Reason: Claude runtime not accessible in this environment
   - Requirement: Actual Claude agent with MCP transport access
   - Workaround: Manual verification steps in NEXT_PROMPT.md

2. **E2E Hermes Connectivity**
   - Status: BLOCKED
   - Reason: Hermes agent not running/accessible
   - Requirement: Running Hermes agent with MCP connectivity
   - Workaround: Manual verification steps in NEXT_PROMPT.md

3. **Offline Agent Messaging**
   - Status: PARTIAL
   - Messages persist in database
   - Agent retrieval depends on agent polling
   - No push notification mechanism

## M3 - Dashboard Completion

### Implemented (Not Fully Verified)

1. **Runtime Presence**
   - Status: NOT IMPLEMENTED
   - Requirement: Heartbeat/check-in mechanism
   - Current: Placeholder display only

2. **Settings/Profile Actions**
   - Status: Coming Soon
   - Menu items labeled but not functional
   - No backend implementation required

3. **Create Division Quick Action**
   - Status: Coming Soon
   - Navigates to Organization page
   - No creation workflow implemented

4. **Invite Staff Quick Action**
   - Status: Coming Soon
   - Navigates to Staff tab
   - No onboarding workflow implemented

## Pre-existing Compilation Errors

### migration-runner/rollback.ts

These errors existed before this implementation and are out of scope:

```
error TS2339: Property 'verifyBackupExists' does not exist on type 'BackupManager'
error TS2801: This condition will always return true since this 'Promise<void>' is always defined
error TS2345: Argument of type 'Database' is not assignable to parameter of type 'string'
```

### frontend/src/shared/theme/use-theme-store.tsx

**Fixed Issue:** Subscription cleanup bug on line 63-64. The original code:
```typescript
state.listeners.delete(() => forceUpdate(n => n + 1));
```
This creates a new function reference each time, preventing proper cleanup. **Fixed** to use a named listener variable.

## Browser Console Issues

### Identified at Runtime
- None confirmed (Playwright MCP unavailable for live inspection)

### Potential Console Warnings (Static Analysis)
- MUI theme provider subscription now properly cleaned up
- Axios timeout set to 30000ms - appropriate for network requests
- localStorage access wrapped in try/catch - handles private browsing mode

## E2E Test Limitations

All E2E scenarios requiring actual agent runtimes are blocked:

- Scenario A (Founder → Claude)
- Scenario B (Founder → Hermes)
- Scenario C (Offline agent)
- Scenario D (Failed send retry - network simulation)

These require running MCP-connected agents.

## TypeScript Errors (Excluded)

The `rollback.ts` errors above are:
- Pre-existing
- Not related to M2/M3 implementation
- In migration rollback utility (out of scope)

All other TypeScript compilation passes.