# Phase 9 Pre-Batch 3 Gate 2 Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve four critical blockers before Phase 9 Batch 3: (1) Persistent database configuration with production fail-closed behavior, (2) Secure MCP endpoint with Phase 8 authentication, (3) MCP tool registration and integration, (4) React 19.3.1 dashboard location/upgrade or explicit missing report, plus establish Task Delegation service boundary and run full verification suite.

**Architecture:** The plan addresses six workstreams in parallel where possible: database startup validation, MCP authentication wrapper, MCP tool registration audit, dashboard discovery/report, task delegation boundary hardening, and comprehensive verification. All changes preserve existing database records, runtime identities, and Phase 8 fail-closed authentication.

**Tech Stack:** TypeScript, Express, Better-SQLite3, @modelcontextprotocol/sdk, Zod v4, tsx test runner. Target: React 19.3.1 if dashboard source found.

**Spec:** `PHASE9_PRE_BATCH3_GATE2_AUDIT.md` (user-provided spec in conversation)

## Global Constraints

- Production MUST never silently default to `:memory:` database — explicit `DATABASE_PATH` required
- `:memory:` available ONLY to isolated tests
- Validate database path before startup; ensure directory creation, initialization, migrations complete before accepting requests
- Startup tests proving production fails closed when database path missing
- Verify restart persistence using actual database records
- Apply Phase 8 authentication to ALL MCP requests (initialization, notifications, subsequent requests)
- Fail-closed behavior in production for MCP
- No hardcoded identity fallbacks in production
- Preserve Founder signature requirements for privileged MCP operations
- Bind authenticated identity to MCP request context — prevent caller override
- Validate session identity, runtime identity, and staff identity against actual database records
- Apply per-tool authorization, not merely endpoint authentication
- Preserve Streamable HTTP behavior and existing Claude Code/Hermes compatibility
- Do not weaken Phase 8 security
- Identify authoritative MCP server instance; register Phase 1 communication tools
- Preserve Phase 7 and Phase 9 operations where intended MCP-accessible
- No duplicate tool registration; no unprotected database CRUD exposure
- Use Zod input schemas; apply authenticated actor context and service-layer authorization
- Return structured, predictable MCP errors
- Test actual MCP client connections and tool discovery
- Test calling tools using Claude Code and Hermes-compatible MCP clients
- Verify `tools/list` matches documented tool inventory
- Do not create second competing MCP server
- If dashboard exists: upgrade to React 19.3.1, TypeScript, compatible tooling, preserve functionality, update lockfiles, run frontend tests/typecheck/production build
- If no dashboard: Do NOT create duplicate frontend; produce clear report identifying missing repository/directory; document React 19.3.1 as required version; report implementation blocked
- Task Delegation boundary: authenticated actor context required for task mutations; validate division membership and Division Head authority; validate task ownership/assignment permissions; validate active staff identities; enforce cross-division restrictions; validate dependencies and prevent cycles; record all mutations in audit trail; prevent direct unprotected database CRUD through MCP
- Do NOT implement complete delegation engine in this gate
- Full test suite must pass; TypeScript must be clean
- Run: MCP initialization/tool discovery, authenticated/unauthenticated MCP requests, MCP authorization tests, production database config tests, database restart persistence test, SQLite foreign_key_check, SQLite integrity_check, Phase 1-8 regression tests, dashboard tests/build if source available

## Review Focus

1. **Missing DATABASE_PATH in production** — Server must exit(1) with clear error, not silently use `:memory:`
2. **MCP endpoint without auth** — All MCP requests must pass through Phase 8 auth middleware before reaching MCP transport
3. **MCP tool registration gaps** — Tools that should be MCP-accessible but aren't registered; tools registered without proper auth/authorization
4. **Dashboard source location unknown** — If no React app found in repo/workspace, must report honestly, not claim implementation
5. **Task Delegation boundary incomplete** — Direct database CRUD exposed via MCP without service-layer authorization checks
6. **Restart persistence unverified** — No test proving data survives server restart with persistent database

---

### Task 1: Persistent Database Configuration — Production Fail-Closed

**Files:**
- Modify: `src/database.ts:211-242` (createDatabase function)
- Modify: `src/server.ts:70-73` (initDb function)
- Create: `tests/database-persistence.test.ts`
- Create: `tests/database-production-config.test.ts`

**Interfaces:**
- Consumes: `createDatabase(dbPath: string): DatabaseInstance`
- Produces: Validated `DatabaseInstance` with guaranteed persistent path (or test-only `:memory:`)

- [ ] **Step 1: Write failing test for production mode without DATABASE_PATH**

```typescript
// tests/database-production-config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Production Database Configuration', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalDbPath = process.env.DATABASE_PATH;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_PATH;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalDbPath) process.env.DATABASE_PATH = originalDbPath;
    else delete process.env.DATABASE_PATH;
  });

  it('should exit(1) when DATABASE_PATH not set in production', () => {
    const serverPath = path.resolve('dist/server.js');
    expect(() => {
      execSync(`node ${serverPath}`, { timeout: 5000, stdio: 'pipe' });
    }).toThrow(); // Process should exit with code 1
  });
});
```

- [ ] **Step 2: Run test to verify it fails**  
  Run: `npm run test -- tests/database-production-config.test.ts`  
  Expected: FAIL (server starts with `:memory:` currently)

- [ ] **Step 3: Implement production validation in `createDatabase()`**

```typescript
// src/database.ts:211-242 — modify createDatabase()
function createDatabase(dbPath: string): DatabaseInstance {
  // PRODUCTION: Reject :memory: and empty/undefined paths
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  const isMemory = dbPath === ':memory:';
  
  if (!isTest && (isMemory || !dbPath || dbPath.trim() === '')) {
    throw new Error('DATABASE_PATH must be explicitly set to a persistent path in production');
  }
  
  // DEVELOPMENT: Default to documented persistent local path
  if (!isTest && !isMemory && (!dbPath || dbPath.trim() === '')) {
    dbPath = path.join(process.cwd(), 'data', 'council.db');
  }
  
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // ... rest of existing createDatabase logic
}
```

- [ ] **Step 4: Update `initDb()` in server.ts to handle validation errors**

```typescript
// src/server.ts:70-73
async function initDb() {
  const dbPath = process.env.DATABASE_PATH;
  if (!dbPath && process.env.NODE_ENV === 'production') {
    console.error('❌ DATABASE_PATH environment variable is required in production');
    process.exit(1);
  }
  db = await createDatabase(dbPath || (process.env.NODE_ENV === 'test' ? ':memory:' : path.join(process.cwd(), 'data', 'council.db')));
}
```

- [ ] **Step 5: Write restart persistence test**

```typescript
// tests/database-persistence.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../src/database.js';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

describe('Database Restart Persistence', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test-persistence.db');
  
  afterEach(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`);
    if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`);
  });

  it('should persist data across database instance restarts', () => {
    // Create first instance and insert data
    const db1 = createDatabase(testDbPath);
    const agentId = randomUUID();
    db1.stmt.insertAgent.run(agentId, 'test-agent', 'Test Agent', 'claude');
    closeDatabase(); // Close first instance
    
    // Create second instance (simulating restart)
    const db2 = createDatabase(testDbPath);
    const agent = db2.stmt.getAgentById.get('test-agent');
    
    expect(agent).toBeDefined();
    expect(agent.agent_id).toBe('test-agent');
    expect(agent.display_name).toBe('Test Agent');
    closeDatabase();
  });
});
```

- [ ] **Step 6: Run persistence test**  
  Run: `npm run test -- tests/database-persistence.test.ts`  
  Expected: PASS

- [ ] **Step 7: Commit**  
  `git add src/database.ts src/server.ts tests/database-production-config.test.ts tests/database-persistence.test.ts`  
  `git commit -m "feat: production database config with fail-closed validation and restart persistence tests"`

---

### Task 2: Secure MCP Endpoint — Phase 8 Authentication

**Files:**
- Modify: `src/server.ts:467-475` (MCP endpoint)
- Create: `tests/mcp-auth.test.ts`

**Interfaces:**
- Consumes: `authMiddleware`, `founderSignatureMiddleware`, `getAuthContext`
- Produces: MCP requests with authenticated `req.authContext` bound to request

- [ ] **Step 1: Write failing test for unauthenticated MCP request**

```typescript
// tests/mcp-auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('MCP Authentication', () => {
  let app: express.Express;
  let server: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_PATH = ':memory:';
    const { default: serverModule } = await import('../src/server.js');
    app = serverModule;
    server = app.listen(0);
  });

  afterAll(() => {
    server.close();
  });

  it('should reject MCP requests without authentication in production', async () => {
    const response = await request(server)
      .post('/mcp')
      .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
      .set('Content-Type', 'application/json');
    
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
    expect(response.body.code).toBe('AUTH_REQUIRED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**  
  Run: `npm run test -- tests/mcp-auth.test.ts`  
  Expected: FAIL (MCP endpoint currently has no auth middleware)

- [ ] **Step 3: Apply auth middleware to MCP endpoint**

```typescript
// src/server.ts:467-475 — replace current MCP endpoint
// MCP Streamable HTTP endpoint with authentication
const mcpServer = new McpServer({ name: 'council-bridge', version: '1.0.0' }, { capabilities: { tools: {} } });
const mcpTransport = new StreamableHTTPServerTransport();

await mcpServer.connect(mcpTransport);

// Apply auth middleware to ALL MCP requests (initialization, notifications, tools)
app.all('/mcp', authMiddleware, async (req, res) => {
  // Bind authenticated identity to MCP request context
  // Prevent caller from supplying/overriding trusted identity
  const authContext = getAuthContext(req);
  (req as any).mcpAuthContext = authContext;
  
  await mcpTransport.handleRequest(req, res, req.body);
});
```

- [ ] **Step 4: Add per-tool authorization wrapper for MCP tools**  
  (After Task 3 registers tools, this step wraps each tool handler with authorization)

- [ ] **Step 5: Run MCP auth test**  
  Run: `npm run test -- tests/mcp-auth.test.ts`  
  Expected: PASS

- [ ] **Step 6: Commit**  
  `git add src/server.ts tests/mcp-auth.test.ts`  
  `git commit -m "feat: apply Phase 8 auth middleware to MCP endpoint with fail-closed production behavior"`

---

### Task 3: MCP Tool Registration and Integration Audit

**Files:**
- Create: `src/mcp/tools.ts` (new — authoritative tool registration)
- Modify: `src/server.ts:467-475` (import and register tools)
- Create: `tests/mcp-tools.test.ts`

**Interfaces:**
- Consumes: `mcpServer` instance, service-layer functions from `operations.ts`, `divisions.ts`, auth context
- Produces: Registered MCP tools with Zod schemas, authenticated actor context, service-layer authorization

- [ ] **Step 1: Write failing test for tool discovery**

```typescript
// tests/mcp-tools.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('MCP Tool Registration', () => {
  let app: express.Express;
  let server: any;
  let authToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_PATH = ':memory:';
    const { default: serverModule } = await import('../src/server.js');
    app = serverModule;
    server = app.listen(0);
    
    // Create valid session for testing
    const sessionRes = await request(server)
      .post('/api/auth/session')
      .send({ owner_type: 'founder', owner_id: 'founder', runtime: 'claude' });
    authToken = sessionRes.body.session_token;
  });

  afterAll(() => { server.close(); });

  it('should return registered tools via tools/list', async () => {
    const response = await request(server)
      .post('/mcp')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
      .set('Content-Type', 'application/json');
    
    expect(response.status).toBe(200);
    expect(response.body.result.tools).toBeDefined();
    expect(Array.isArray(response.body.result.tools)).toBe(true);
    expect(response.body.result.tools.length).toBeGreaterThan(0);
  });

  it('should register Phase 1 communication tools', async () => {
    const response = await request(server)
      .post('/mcp')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
      .set('Content-Type', 'application/json');
    
    const toolNames = response.body.result.tools.map((t: any) => t.name);
    expect(toolNames).toContain('send_message');
    expect(toolNames).toContain('get_messages');
    expect(toolNames).toContain('list_agents');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**  
  Run: `npm run test -- tests/mcp-tools.test.ts`  
  Expected: FAIL (no tools registered)

- [ ] **Step 3: Create authoritative MCP tool registration module**

```typescript
// src/mcp/tools.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { DatabaseInstance } from '../database.js';
import { OperationContext } from '../council/operations.js';
import {
  sendMessage, getMessages, listAgents, getAgentById,
  // Phase 7/9 operations intended for MCP access
  requestExecution, approveExecution, getExecutionRequest,
  listExecutionRequests, listApprovalRequests, getExecutionHistory,
  executeExecutionRequest, cancelExecutionRequest,
  createTaskAutonomyLevel, listTaskAutonomyLevels,
  approveDivisionHead, approveSpecialist, activateStaffAgent
} from '../council/operations.js'; // Adjust imports as needed

// Tool input schemas (Zod v4)
const SendMessageSchema = z.object({
  sender_id: z.string(),
  recipient_id: z.string(),
  content: z.string(),
  reply_to: z.string().optional()
});

const GetMessagesSchema = z.object({
  agent_id: z.string(),
  limit: z.number().int().positive().optional()
});

// ... define all tool schemas

export function registerMcpTools(
  mcpServer: McpServer,
  db: DatabaseInstance,
  getAuthContext: (req: any) => OperationContext
): void {
  // Phase 1: Communication tools
  mcpServer.tool('send_message', 'Send a message to another agent', SendMessageSchema.shape, async (args, extra) => {
    const ctx = getAuthContext(extra.request);
    // Service-layer authorization via sendMessage operation
    const result = await sendMessage(db, ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });

  mcpServer.tool('get_messages', 'Get messages for an agent', GetMessagesSchema.shape, async (args, extra) => {
    const ctx = getAuthContext(extra.request);
    const result = await getMessages(db, ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });

  mcpServer.tool('list_agents', 'List all registered agents', {}, async (args, extra) => {
    const ctx = getAuthContext(extra.request);
    const result = await listAgents(db, ctx);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });

  // Phase 7/9: Execution and Autonomy tools
  mcpServer.tool('request_execution', 'Request task execution', RequestExecutionSchema.shape, async (args, extra) => {
    const ctx = getAuthContext(extra.request);
    const result = await requestExecution(db, ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });

  // ... register remaining tools with proper schemas and authorization
  // DO NOT register raw database CRUD — only service-layer operations
}
```

- [ ] **Step 4: Integrate tool registration in server.ts**

```typescript
// src/server.ts:467-475 — import and call registerMcpTools
import { registerMcpTools } from './mcp/tools.js';

// ... after mcpServer.connect(mcpTransport)
registerMcpTools(mcpServer, db, getAuthContext);
```

- [ ] **Step 5: Run MCP tools test**  
  Run: `npm run test -- tests/mcp-tools.test.ts`  
  Expected: PASS

- [ ] **Step 6: Test with actual MCP client (Claude Code/Hermes)**  
  Manual verification: Connect MCP client, verify tool discovery and execution

- [ ] **Step 7: Commit**  
  `git add src/mcp/tools.ts src/server.ts tests/mcp-tools.test.ts`  
  `git commit -m "feat: MCP tool registration with Zod schemas, auth context binding, service-layer authorization"`

---

### Task 4: React Dashboard — Location Discovery and Report

**Files:**
- Create: `PHASE9_PRE_BATCH3_GATE2_DASHBOARD_REPORT.md`

**Interfaces:**
- Consumes: Repository search results, workspace scan
- Produces: Clear report on dashboard existence, location, and React version status

- [ ] **Step 1: Search entire repository and workspace for React/dashboard**

```bash
# Run these searches
find . -name "package.json" -exec grep -l "react" {} \;
find . -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" | xargs grep -l "react" 2>/dev/null | head -20
ls -la ../  # Check parent directory for sibling repos
```

- [ ] **Step 2: Document findings in report**

```markdown
# PHASE9_PRE_BATCH3_GATE2_DASHBOARD_REPORT.md

## Dashboard Discovery Results

### Repository Search
- React dependencies in package.json: [YES/NO]
- React source files (*.tsx, *.jsx): [LIST or NONE]
- Dashboard directory: [PATH or NOT FOUND]

### Workspace Search
- Sibling directories checked: [LIST]
- Dashboard source found: [YES/NO]
- Location: [PATH or NOT FOUND]

### React Version Status
- Current version in package.json (if found): [VERSION]
- Required version: 19.3.1
- Upgrade needed: [YES/NO/NA]

## Conclusion
[One of:]
- Dashboard source found at [PATH]. Upgrade to React 19.3.1 in progress.
- No dashboard source found in this repository or available workspace.
  React 19.3.1 documented as required frontend version.
  Dashboard implementation BLOCKED pending access to actual source.
```

- [ ] **Step 3: If dashboard found — upgrade to React 19.3.1**

```bash
cd [DASHBOARD_PATH]
npm install react@19.3.1 react-dom@19.3.1
npm install --save-dev @types/react@19 @types/react-dom@19
# Run typecheck, tests, production build
npm run typecheck && npm run test && npm run build
```

- [ ] **Step 4: If dashboard NOT found — finalize report as blocked**

- [ ] **Step 5: Commit report**  
  `git add PHASE9_PRE_BATCH3_GATE2_DASHBOARD_REPORT.md`  
  `git commit -m "docs: dashboard discovery report — [found/blocked] React 19.3.1"`

---

### Task 5: Task Delegation Service Boundary Hardening

**Files:**
- Modify: `src/council/operations.ts` (add task delegation authorization functions)
- Create: `src/council/task-delegation.ts` (new — boundary layer)
- Create: `tests/task-delegation-boundary.test.ts`

**Interfaces:**
- Consumes: `OperationContext`, `DatabaseInstance`, task/division/staff data
- Produces: Authorization functions for task mutations; audit trail recording

- [ ] **Step 1: Write failing test for task mutation authorization**

```typescript
// tests/task-delegation-boundary.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase } from '../src/database.js';
import { assertTaskAccess, validateDivisionHead, validateTaskOwnership } from '../src/council/task-delegation.js';

describe('Task Delegation Service Boundary', () => {
  let db: any;
  let divisionHeadCtx: any;
  let staffCtx: any;
  let otherStaffCtx: any;
  let divisionId: string;
  let staffId: string;
  let otherStaffId: string;
  let taskId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    divisionId = 'div-test';
    staffId = 'staff-001';
    otherStaffId = 'staff-002';
    
    // Setup division, staff, task...
    
    divisionHeadCtx = { owner_type: 'division', owner_id: divisionId, runtime: 'claude' };
    staffCtx = { owner_type: 'staff', owner_id: staffId, runtime: 'claude' };
    otherStaffCtx = { owner_type: 'staff', owner_id: otherStaffId, runtime: 'claude' };
  });

  it('should allow division head to mutate division-assigned tasks', () => {
    const task = assertTaskAccess(db, divisionHeadCtx, taskId);
    expect(task.task_id).toBe(taskId);
  });

  it('should allow staff to mutate their own assigned tasks', () => {
    const task = assertTaskAccess(db, staffCtx, taskId);
    expect(task.task_id).toBe(taskId);
  });

  it('should reject staff mutating another staff member task', () => {
    expect(() => assertTaskAccess(db, otherStaffCtx, taskId))
      .toThrow('Staff can only request execution for their own tasks');
  });

  it('should enforce cross-division restrictions', () => {
    // Staff from different division cannot access task
    expect(() => assertTaskAccess(db, otherStaffCtx, taskId))
      .toThrow('Authorization denied');
  });

  it('should validate dependencies and prevent cycles', () => {
    // Create task A -> depends on B, B -> depends on A
    expect(() => validateDependencies(db, taskA, taskB))
      .toThrow('Circular dependency detected');
  });

  it('should record all mutations in audit trail', () => {
    // Mutate task
    // Verify audit entry created
    const audit = db.query('SELECT * FROM task_audit WHERE task_id = ?', [taskId]);
    expect(audit.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**  
  Run: `npm run test -- tests/task-delegation-boundary.test.ts`  
  Expected: FAIL (boundary functions don't exist yet)

- [ ] **Step 3: Implement task delegation boundary layer**

```typescript
// src/council/task-delegation.ts
import { DatabaseInstance } from '../database.js';
import { OperationContext, Task, Division, StaffAgent } from './types.js';
import { requireAuthenticated, isDivisionMember, validateDivisionHead } from './operations.js';

export function validateTaskOwnership(
  db: DatabaseInstance,
  ctx: OperationContext,
  taskId: string
): Task {
  const task = db.query('SELECT * FROM tasks WHERE task_id = ?', [taskId])[0] as Task | undefined;
  if (!task) throw new Error(`Task '${taskId}' not found`);
  
  const identity = requireAuthenticated(ctx);
  
  if (identity.owner_type === 'founder') return task;
  
  if (identity.owner_type === 'staff') {
    if (task.assigned_to_type === 'staff' && task.assigned_to_id !== identity.owner_id) {
      throw new Error('Staff can only access their own assigned tasks');
    }
    if (task.assigned_to_type === 'division') {
      const membership = db.query(
        'SELECT 1 FROM division_members WHERE division_id = ? AND staff_id = ?',
        [task.assigned_to_id, identity.owner_id]
      );
      if (membership.length === 0) throw new Error('Authorization denied');
    }
    return task;
  }
  
  if (identity.owner_type === 'division') {
    if (task.assigned_to_type === 'division' && task.assigned_to_id === identity.owner_id) return task;
    if (task.created_by_type === 'division_head' && task.created_by_id === identity.owner_id) return task;
    if (task.assigned_to_type === 'staff') {
      const staff = db.query(
        'SELECT 1 FROM staff_agents WHERE staff_id = ? AND division_id = ?',
        [task.assigned_to_id, identity.owner_id]
      );
      if (staff.length > 0) return task;
    }
  }
  
  throw new Error('Authorization denied');
}

export function validateDivisionHeadAuthority(
  db: DatabaseInstance,
  ctx: OperationContext,
  divisionId: string
): void {
  const identity = requireAuthenticated(ctx);
  if (identity.owner_type === 'founder') return;
  if (identity.owner_type === 'division' && identity.owner_id === divisionId) return;
  if (identity.owner_type === 'staff') {
    const isHead = validateDivisionHead(identity.owner_id, divisionId, db);
    if (isHead) return;
  }
  throw new Error('Division Head authority required');
}

export function validateActiveStaffIdentity(
  db: DatabaseInstance,
  staffId: string,
  runtime: 'claude' | 'hermes'
): StaffAgent {
  const staff = db.query('SELECT * FROM staff_agents WHERE staff_id = ?', [staffId])[0] as StaffAgent | undefined;
  if (!staff) throw new Error(`Staff agent '${staffId}' not found`);
  if (staff.status !== 'active') throw new Error('Staff agent is not active');
  
  let runtimes: string[];
  try { runtimes = JSON.parse(staff.runtime_instances); }
  catch { throw new Error('Invalid staff runtime configuration'); }
  
  if (!runtimes.includes(runtime)) {
    throw new Error(`Staff agent not registered for runtime: ${runtime}`);
  }
  return staff;
}

export function validateDependenciesAndPreventCycles(
  db: DatabaseInstance,
  taskId: string,
  newDependencies: string[]
): void {
  // Build dependency graph and check for cycles
  const visited = new Set<string>();
  const recStack = new Set<string>();
  
  function hasCycle(currentId: string): boolean {
    if (recStack.has(currentId)) return true;
    if (visited.has(currentId)) return false;
    
    visited.add(currentId);
    recStack.add(currentId);
    
    const task = db.query('SELECT dependencies FROM tasks WHERE task_id = ?', [currentId])[0] as Task | undefined;
    if (task) {
      let deps: string[] = [];
      try { deps = JSON.parse(task.dependencies); } catch {}
      for (const dep of deps) {
        if (hasCycle(dep)) return true;
      }
    }
    
    recStack.delete(currentId);
    return false;
  }
  
  // Temporarily add new dependencies and check
  for (const dep of newDependencies) {
    if (hasCycle(dep)) {
      throw new Error('Circular dependency detected');
    }
  }
}

export function recordTaskMutationAudit(
  db: DatabaseInstance,
  ctx: OperationContext,
  taskId: string,
  mutationType: 'create' | 'update' | 'assign' | 'status_change' | 'dependency_change' | 'cancel',
  details: Record<string, any>
): void {
  const auditId = db.generateId();
  const now = new Date().toISOString();
  const identity = requireAuthenticated(ctx);
  
  db.runPreparedStatement('insertTaskAudit', [
    auditId, taskId, mutationType, JSON.stringify(details),
    identity.owner_type, identity.owner_id, identity.runtime, now
  ]);
}
```

- [ ] **Step 4: Add audit table to database schema**  
  (Add `task_audit` table in `createDatabase()` — migration handled by schema version bump)

- [ ] **Step 5: Run boundary tests**  
  Run: `npm run test -- tests/task-delegation-boundary.test.ts`  
  Expected: PASS

- [ ] **Step 6: Commit**  
  `git add src/council/task-delegation.ts src/database.ts tests/task-delegation-boundary.test.ts`  
  `git commit -m "feat: task delegation service boundary with authorization, cycle prevention, audit trail"`

---

### Task 6: Comprehensive Verification Suite

**Files:**
- Create: `PHASE9_PRE_BATCH3_GATE2_AUDIT.md`
- Create: `PHASE9_PRE_BATCH3_GATE2_DATABASE_REPORT.md`
- Create: `PHASE9_PRE_BATCH3_GATE2_MCP_SECURITY_REPORT.md`
- Create: `PHASE9_PRE_BATCH3_GATE2_MCP_INTEGRATION_REPORT.md`
- Create: `PHASE9_PRE_BATCH3_GATE2_REGRESSION_REPORT.md`

**Interfaces:**
- Consumes: All test results, verification outputs
- Produces: Six required reports with evidence

- [ ] **Step 1: Run full test suite**  
  Run: `npm run test`  
  Expected: All 244+ tests pass

- [ ] **Step 2: Run TypeScript typecheck**  
  Run: `npm run typecheck`  
  Expected: Clean (no errors)

- [ ] **Step 3: Run MCP initialization and tool discovery test**  
  Run: `npm run test -- tests/mcp-tools.test.ts`  
  Expected: PASS

- [ ] **Step 4: Run MCP authenticated/unauthenticated request tests**  
  Run: `npm run test -- tests/mcp-auth.test.ts`  
  Expected: PASS

- [ ] **Step 5: Run MCP authorization tests**  
  Run: `npm run test -- tests/service_authorization.test.ts`  
  Expected: PASS

- [ ] **Step 6: Run production database configuration tests**  
  Run: `npm run test -- tests/database-production-config.test.ts`  
  Expected: PASS

- [ ] **Step 7: Run database restart persistence test**  
  Run: `npm run test -- tests/database-persistence.test.ts`  
  Expected: PASS

- [ ] **Step 8: Run SQLite integrity checks**

```bash
# Foreign key check
sqlite3 data/council.db "PRAGMA foreign_key_check;"

# Integrity check
sqlite3 data/council.db "PRAGMA integrity_check;"
```

  Expected: No errors / "ok"

- [ ] **Step 9: Run Phase 1-8 regression tests**  
  Run: `npm run test -- tests/council.test.ts tests/phase7_autonomy_execution.test.ts tests/phase8_*.test.ts`  
  Expected: All pass

- [ ] **Step 10: Run dashboard tests and build (if source available)**  
  If dashboard found in Task 4: `cd [DASHBOARD_PATH] && npm run test && npm run typecheck && npm run build`

- [ ] **Step 11: Generate all six required reports**  
  Each report documents: what was tested, results, evidence, any findings

- [ ] **Step 12: Commit all reports**  
  `git add PHASE9_PRE_BATCH3_GATE2_*.md`  
  `git commit -m "docs: complete Gate 2 verification reports"`

---

### Task 7: Final Commit and Push

**Files:**
- All modified/added files from Tasks 1-6

**Interfaces:**
- Consumes: Complete verified implementation
- Produces: Clean commit on origin/master with full verification

- [ ] **Step 1: Verify all tests pass one final time**  
  Run: `npm run test && npm run typecheck`

- [ ] **Step 2: Commit all changes**  
  `git add -A`  
  `git commit -m "feat: Phase 9 Pre-Batch 3 Gate 2 remediation complete — persistent DB config, MCP auth, tool registration, task delegation boundary, verification reports"`

- [ ] **Step 3: Push to origin/master**  
  `git push origin master`

- [ ] **Step 4: Report commit SHA and verification results**  
  `git rev-parse HEAD` → provide SHA  
  Summarize all verification results in final message

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-11-14-phase9-pre-batch3-gate2-remediation.md`. Please review the plan. Which execution approach would you prefer?**

- **Subagent-driven** — A fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native** — I implement every task myself in this session, the way this harness runs work, then one fresh reviewer on the most capable model checks the whole branch. Cheapest and fastest; no independent review until the end. Runs well with a mid-tier session model, since the plan carries the design.

**For this plan I recommend Subagent-driven**, because the six workstreams (database, MCP auth, MCP tools, dashboard, task boundary, verification) have independent file touches and interfaces — parallel execution with independent review per task catches integration issues early, and the security-critical MCP auth/database changes warrant fresh-eyes verification before the full regression suite runs.

**Does the plan capture what you want, and which approach should we use?**