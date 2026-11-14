# Task 2 Brief: Secure MCP Endpoint — Phase 8 Authentication

## Task Context
Part of Phase 9 Pre-Batch 3 Gate 2 remediation. Resolves blocker #2: current `/mcp` route does not visibly apply authentication middleware.

## Requirements (verbatim from spec)
- Apply Phase 8 authentication to MCP requests
- Enforce fail-closed behavior in production
- Do not introduce hardcoded identity fallbacks
- Preserve Founder signature requirements for privileged operations
- Bind the authenticated identity to the MCP request context
- Prevent callers from supplying or overriding their own trusted identity
- Ensure session identity, runtime identity, and staff identity are validated against actual database records
- Apply per-tool authorization, not merely endpoint authentication
- Protect initialization, notifications, and subsequent MCP requests consistently
- Preserve Streamable HTTP behavior and existing Claude Code/Hermes compatibility
- Do not weaken Phase 8 security

## Files to Modify/Create
- Modify: `src/server.ts:467-475` (MCP endpoint - apply auth middleware)
- Create: `tests/mcp-auth.test.ts`

## Interfaces
- Consumes: `authMiddleware`, `founderSignatureMiddleware`, `getAuthContext`
- Produces: MCP requests with authenticated `req.authContext` bound to request

## Global Constraints (binding)
- Apply Phase 8 authentication to ALL MCP requests (initialization, notifications, tools)
- Fail-closed behavior in production for MCP
- No hardcoded identity fallbacks in production
- Preserve Founder signature requirements for privileged MCP operations
- Bind authenticated identity to MCP request context — prevent caller override
- Validate session identity, runtime identity, and staff identity against actual database records
- Apply per-tool authorization, not merely endpoint authentication
- Preserve Streamable HTTP behavior and existing Claude Code/Hermes compatibility

## Test Requirements (exact from plan)
1. **Unauthenticated MCP request test**: Rejected with 401 in production
2. **Authenticated MCP request test**: Accepted with valid session
3. **Founder signature test**: Required for privileged operations

## Implementation Approach
- Wrap `app.all('/mcp', ...)` with `authMiddleware`
- Bind `req.authContext` to MCP request context
- Prevent caller from supplying/overriding trusted identity
- Per-tool authorization will be added in Task 3

## Report File
Write full report to `.superpowers/sdd/2026-11-14-phase9-pre-batch3-gate2-remediation/task-2-report.md`