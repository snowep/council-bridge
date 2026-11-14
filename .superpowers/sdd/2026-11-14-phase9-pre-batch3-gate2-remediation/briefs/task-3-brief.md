# Task 3 Brief: MCP Tool Registration and Integration

## Task Context
Part of Phase 9 Pre-Batch 3 Gate 2 remediation. Resolves blocker #3: inspect repository for all MCP tool registration code.

## Requirements (verbatim from spec)
- Identify the authoritative MCP server instance
- Register existing Phase 1 communication tools
- Preserve existing Phase 7 and Phase 9 operations where they are intended to be MCP-accessible
- Do not register duplicate tools
- Do not expose unprotected database CRUD functions
- Use Zod input schemas
- Apply authenticated actor context and service-layer authorization
- Return structured, predictable MCP errors
- Test actual MCP client connections and tool discovery
- Test calling tools using Claude Code and Hermes-compatible MCP clients
- Verify the tools returned by `tools/list` match the documented tool inventory
- If existing tool registration is genuinely missing, implement it using the existing architecture
- Do not create a second competing MCP server

## Files to Modify/Create
- Create: `src/mcp/tools.ts` (new — authoritative tool registration)
- Modify: `src/server.ts` (import and register tools after mcpServer.connect)
- Create: `tests/mcp-tools.test.ts`

## Interfaces
- Consumes: `mcpServer` instance, service-layer functions from `operations.ts`, `divisions.ts`, auth context
- Produces: Registered MCP tools with Zod schemas, authenticated actor context, service-layer authorization

## Global Constraints (binding)
- Identify authoritative MCP server instance
- Register Phase 1 communication tools (send_message, get_messages, list_agents)
- Preserve Phase 7/9 operations where intended MCP-accessible
- No duplicate tool registration
- No unprotected database CRUD exposure
- Use Zod input schemas
- Apply authenticated actor context and service-layer authorization
- Return structured, predictable MCP errors
- Test actual MCP client connections and tool discovery
- Test calling tools with Claude Code and Hermes-compatible MCP clients
- Verify `tools/list` matches documented tool inventory
- Do not create second competing MCP server

## Test Requirements (exact from plan)
1. **Tool discovery test**: `tools/list` returns registered tools
2. **Phase 1 tools test**: send_message, get_messages, list_agents registered
3. **Tool execution test**: Can call tools via MCP with auth
4. **Authorization test**: Per-tool authorization enforced

## Implementation Approach
- Create `src/mcp/tools.ts` with `registerMcpTools()` function
- Register Phase 1 communication tools using service-layer functions
- Register Phase 7/9 operations (execution requests, approvals, task autonomy)
- Use Zod v4 schemas for all tool inputs
- Bind authenticated context from `req.authContext` to each tool call
- Call service-layer functions (not raw database CRUD)
- Import and call `registerMcpTools(mcpServer, db, getAuthContext)` in server.ts

## Report File
Write full report to `.superpowers/sdd/2026-11-14-phase9-pre-batch3-gate2-remediation/task-3-report.md`