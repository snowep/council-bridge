# Task 3 Report: MCP Tool Registration and Integration

## Summary
Successfully implemented authoritative MCP tool registration module (`src/mcp/tools.ts`) that registers Phase 1 communication tools and Phase 7/9 operations with Zod v4 schemas, authenticated actor context binding, service-layer authorization, and structured error responses. Modified `src/server.ts` to import and register tools with stateless per-request MCP server/transport. Created comprehensive test suite in `tests/mcp-tools.test.ts` (23 tests, all passing).

## Files Created/Modified

### Created: `src/mcp/tools.ts` (345 lines)
Authoritative tool registration module with:
- **15 tools registered**:
  - Phase 1 Communication: `send_message`, `get_messages`, `list_agents`
  - Task Autonomy Levels: `create_task_autonomy_level`, `update_task_autonomy_level`, `get_task_autonomy_level`, `list_task_autonomy_levels`
  - Execution Requests: `request_execution`, `get_execution_request`, `list_execution_requests`, `execute_execution_request`, `cancel_execution_request`
  - Approvals (Founder only): `approve_execution`, `list_approval_requests`
  - History: `get_execution_history`
- **Zod v4 schemas** for all tool inputs with descriptions
- **`createToolHandler` wrapper** for auth context extraction, validation, and error handling
- **Service-layer function calls** (not raw database CRUD)
- **Structured MCP errors** returning `CallToolResult` format with `content`, `isError`, and error codes

### Modified: `src/server.ts`
- Removed global MCP server/transport initialization
- Created new MCP server + transport **per request** for stateless operation (matches test pattern)
- Imported and call `registerMcpTools(requestMcpServer, db, () => authContext)` inside `/mcp` handler
- Auth context passed via closure `() => authContext` for proper binding in tool handlers

### Created: `tests/mcp-tools.test.ts` (560 lines, 23 tests)
Test coverage:
- **Tool Discovery** (2 tests): `tools/list` returns 15 registered tools
- **Phase 1 Tools** (3 tests): All 3 communication tools registered
- **Phase 7/9 Tools** (4 tests): All 12 operation tools registered
- **Tool Execution with Auth** (3 tests): Authenticated calls succeed, unauthenticated rejected
- **Authorization** (6 tests): Founder-only enforcement, staff/division permissions, founder access
- **Structured Errors** (2 tests): Error format with code/message
- **Schema Validation** (2 tests): All tools have proper schemas, Phase 1 specific properties
- **No Duplicates** (1 test): Unique tool names

### Fixed: `src/council/task-delegation.ts`
- Corrected import: `OperationContext` now imported from `operations.ts` (not `types.ts`)

## Key Technical Decisions

### 1. Stateless MCP Transport
StreamableHTTPServerTransport is stateful and fails on 2nd+ request. Fixed by creating fresh `McpServer` + `StreamableHTTPServerTransport` per request (matching test pattern and working example in tests).

### 2. Auth Context Binding
Used closure `() => authContext` instead of `getAuthContext(req)` because tool handlers execute outside request context. The auth context is captured at request time and passed to service-layer functions.

### 3. Zod v4 Schema Handling
MCP SDK expects `ZodRawShapeCompat` (raw shape object). Used `.shape` property of Zod v4 schemas for compatibility.

### 4. Error Response Format
Return `CallToolResult` type from `@modelcontextprotocol/sdk/types.js` with:
```typescript
{
  content: [{ type: 'text', text: JSON.stringify({ error, code }) }],
  isError: true
}
```

### 5. Service-Layer Authorization
All tools call service-layer functions from `operations.ts` (e.g., `createTaskAutonomyLevel`, `requestExecution`, `approveExecution`) which enforce authorization internally. No raw database CRUD exposed.

## Test Results
All 23 MCP tool tests **PASS**:
```
✔ Tool Discovery (2 tests)
✔ Phase 1 Communication Tools (3 tests)
✔ Phase 7/9 Operation Tools (4 tests)
✔ Tool Execution with Auth (3 tests)
✔ Authorization Tests (6 tests)
✔ Structured Error Responses (2 tests)
✔ Tool Schema Validation (2 tests)
✔ No Duplicate Tool Registration (1 test)
```

Plus:
- 19 MCP auth tests **PASS**
- 94 Phase 7/8 tests **PASS**
- 136 total tests pass (some unrelated pre-existing failures in other test suites)

## TypeScript Compilation
Clean compilation: `npx tsc --noEmit` passes with no errors.

## Requirements Verification

| Requirement | Status |
|-------------|--------|
| Identify authoritative MCP server instance | ✅ Per-request in `/mcp` handler |
| Register Phase 1 communication tools | ✅ send_message, get_messages, list_agents |
| Preserve Phase 7/9 operations | ✅ All 12 execution/approval/autonomy tools |
| No duplicate tools | ✅ Verified by test |
| No unprotected database CRUD | ✅ Service-layer only |
| Zod input schemas | ✅ Zod v4 with `.shape` |
| Authenticated actor context | ✅ Closure binding |
| Service-layer authorization | ✅ Operations enforce permissions |
| Structured MCP errors | ✅ CallToolResult format |
| Test tool discovery | ✅ 2 tests |
| Test Phase 1 tools registered | ✅ 3 tests |
| Test tool execution with auth | ✅ 3 tests |
| Test per-tool authorization | ✅ 6 tests |

## Risk Assessment
- **Low risk**: All functional requirements verified by passing tests
- **No breaking changes**: Existing REST API endpoints unchanged
- **Stateless design**: No session persistence issues
- **Type-safe**: Clean TypeScript compilation

## Next Steps
Task 3 complete. Ready for Task 4 (Task Delegation Service Boundary) and Task 5 (if any remaining).