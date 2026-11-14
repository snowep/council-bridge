# Phase 9 Gate 3 Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two security findings: (1) Restore all 6 original Phase 1 MCP communication tools, (2) Secure production session issuance with Founder signature verification

**Architecture:** Add 3 missing MCP tools (register_agent, check_inbox, reply_message, list_messages - 4 tools total since check_inbox differs from get_messages) to tools.ts using existing agentService/messageService. Secure /api/auth/session by requiring Founder-signed requests for production mode, validating identity against database before token issuance.

**Tech Stack:** TypeScript, Express, MCP SDK, Zod v4, better-sqlite3, RSA-2048 signatures

**Spec:** Gate 3 requirements from pasted_content

## Global Constraints

- Preserve existing Phase 7/9 tools intact
- Use existing createAgentService() and createMessageService() implementations
- Apply authenticated identity checks to every operation
- Prevent callers from registering/sending as another identity
- Preserve Founder access per existing authorization model
- Use Zod v4 validation throughout
- Production must fail closed when provisioning auth is missing/invalid/expired/replayed/unauthorized
- Keep dev/test auth isolated from production behavior
- Do not invent permanent identity-provisioning policy if not in Phase 8 docs

## Review Focus

1. **Missing Phase 1 tools** — verify all 6 original tool names present in tools/list with exact schemas
2. **Identity substitution** — verify send_message rejects sender_id != authenticated identity (except founder)
3. **Inbox isolation** — verify check_inbox/list_messages only return authenticated agent's messages
4. **Reply enforcement** — verify reply_message only works for intended recipient of parent message
5. **Session impersonation** — verify POST /api/auth/session rejects arbitrary owner_type/owner_id in production
6. **Founder signature binding** — verify signature covers operation, payload, timestamp, nonce, key_id
7. **Database validation** — verify staff/division/seat exist and are active before token issuance
8. **Replay protection** — verify expired/nonced signatures rejected

---

### Task 1: Add Missing Phase 1 MCP Tool Schemas and Registration

**Files:**
- Modify: `src/mcp/tools.ts` (add schemas and tool registrations)
- Test: `tests/mcp-tools.test.ts` (add tests for new tools)

**Interfaces:**
- Consumes: createAgentService(db), createMessageService(db, agentService) from agents.ts/messages.ts
- Produces: 4 new tool registrations (register_agent, check_inbox, reply_message, list_messages)

- [ ] **Step 1: Write failing tests for 4 missing tools**

```typescript
// Test register_agent tool exists in tools/list
// Test register_agent works for authorized identity (founder)
// Test duplicate registration rejected
// Test check_inbox returns only authenticated agent's inbox
// Test reply_message works only for intended recipient
// Test list_messages respects identity boundaries and limits
// Test all 6 Phase 1 tool names present: register_agent, list_agents, send_message, check_inbox, reply_message, list_messages
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/mcp-tools.test.ts`
Expected: FAIL - tools not registered

- [ ] **Step 3: Add Zod schemas for missing tools in tools.ts**

```typescript
// Add to tools.ts after line 41:
const RegisterAgentSchema = z.object({
  agent_id: z.string().min(1).max(255).describe('Unique agent identifier'),
  display_name: z.string().min(1).max(255).describe('Display name for the agent'),
  runtime: z.string().min(1).max(255).describe('Runtime identifier (claude/hermes)'),
});

const CheckInboxSchema = z.object({
  agent_id: z.string().min(1).max(255).describe('ID of the agent to check inbox for'),
});

const ReplyMessageSchema = z.object({
  agent_id: z.string().min(1).max(255).describe('ID of the replying agent'),
  message_id: z.string().uuid().describe('UUID of message being replied to'),
  content: z.string().min(1).describe('Reply content'),
});

const ListMessagesSchema = z.object({
  agent_id: z.string().min(1).max(255).describe('ID of the agent to list messages for'),
  limit: z.number().int().positive().max(100).default(50).optional().describe('Maximum messages to return'),
});
```

- [ ] **Step 4: Register 4 new tools in registerMcpTools()**

```typescript
// After list_agents tool (around line 198), add:

// register_agent - Founder only
mcpServer.tool(
  'register_agent',
  'Register a new agent',
  RegisterAgentSchema.shape,
  createToolHandler(db, getAuthContext, async (db, ctx, args) => {
    if (ctx.owner_type !== 'founder') {
      throw new Error('Only Founder can register agents');
    }
    return agentService.registerAgent(args);
  })
);

// check_inbox - agent can only check own inbox
mcpServer.tool(
  'check_inbox',
  'Check inbox for an agent',
  CheckInboxSchema.shape,
  createToolHandler(db, getAuthContext, async (db, ctx, args) => {
    if (ctx.owner_type !== 'founder' && args.agent_id !== ctx.owner_id) {
      throw new Error('Can only check inbox for authenticated agent');
    }
    return messageService.checkInbox(args.agent_id);
  })
);

// reply_message - only intended recipient can reply
mcpServer.tool(
  'reply_message',
  'Reply to a message',
  ReplyMessageSchema.shape,
  createToolHandler(db, getAuthContext, async (db, ctx, args) => {
    if (ctx.owner_type !== 'founder' && args.agent_id !== ctx.owner_id) {
      throw new Error('Can only reply as authenticated agent');
    }
    return messageService.replyMessage(args);
  })
);

// list_messages - agent can only list own messages
mcpServer.tool(
  'list_messages',
  'List messages for an agent',
  ListMessagesSchema.shape,
  createToolHandler(db, getAuthContext, async (db, ctx, args) => {
    if (ctx.owner_type !== 'founder' && args.agent_id !== ctx.owner_id) {
      throw new Error('Can only list messages for authenticated agent');
    }
    return messageService.listMessages(args);
  })
);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/mcp-tools.test.ts`
Expected: PASS - all 6 Phase 1 tools registered and working

- [ ] **Step 6: Commit**

```bash
git add src/mcp/tools.ts tests/mcp-tools.test.ts
git commit -m "feat: restore all 6 Phase 1 MCP communication tools"
```

---

### Task 2: Secure Production Session Issuance with Founder Signatures

**Files:**
- Modify: `src/server.ts` (secure /api/auth/session endpoint)
- Modify: `src/auth/session.ts` (add database validation helper if needed)
- Test: `tests/phase8_auth.test.ts` (add session security tests)

**Interfaces:**
- Consumes: verifyFounderOperation from founder.ts, database queries for staff/division/seat validation
- Produces: Secured POST /api/auth/session requiring Founder signature in production

- [ ] **Step 1: Write failing tests for session security**

```typescript
// Test unauthenticated production session creation rejected (403)
// Test arbitrary staff identity impersonation rejected
// Test arbitrary division identity impersonation rejected
// Test invalid Founder signature rejected
// Test missing signature fields rejected
// Test expired signatures rejected
// Test replayed nonces rejected
// Test invalid key_ids rejected
// Test inactive staff cannot receive sessions
// Test unregistered staff runtimes cannot receive sessions
// Test valid authorized provisioning succeeds
// Test dev/test behavior remains isolated
// Test existing Phase 8 auth tests still pass
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/phase8_auth.test.ts`
Expected: FAIL - endpoint still accepts caller-supplied identity

- [ ] **Step 3: Modify /api/auth/session endpoint in server.ts**

```typescript
// Replace lines 340-374 with secured version:

app.post('/api/auth/session', async (req, res) => {
  try {
    const { owner_type, owner_id, runtime } = req.body;

    if (!owner_type || !owner_id || !runtime) {
      return res.status(400).json({ error: 'owner_type, owner_id, and runtime required' });
    }

    if (!['founder', 'staff', 'division', 'seat'].includes(owner_type)) {
      return res.status(400).json({ error: 'Invalid owner_type' });
    }

    if (!['claude', 'hermes'].includes(runtime)) {
      return res.status(400).json({ error: 'Invalid runtime' });
    }

    // PRODUCTION: Require Founder signature for ALL session provisioning
    if (PRODUCTION_MODE) {
      const { founder_signature, founder_timestamp, founder_nonce, founder_key_id } = req.body;

      if (!founder_signature || !founder_timestamp || !founder_nonce || !founder_key_id) {
        return res.status(403).json({
          error: 'Founder signature required for session provisioning in production',
          code: 'FOUNDER_SIGNATURE_REQUIRED',
          required_fields: ['founder_signature', 'founder_timestamp', 'founder_nonce', 'founder_key_id']
        });
      }

      // Verify operation-bound signature
      const body = { ...req.body };
      delete body.founder_signature;
      delete body.founder_timestamp;
      delete body.founder_nonce;
      delete body.founder_key_id;

      const valid = verifyFounderOperation(
        'create_session',
        body,
        founder_signature,
        founder_timestamp,
        founder_nonce,
        founder_key_id
      );

      if (!valid) {
        return res.status(403).json({
          error: 'Invalid founder signature for session provisioning',
          code: 'FOUNDER_SIGNATURE_INVALID'
        });
      }

      // Validate requested identity against database
      const identityValid = await validateIdentityForSession(db, owner_type, owner_id, runtime);
      if (!identityValid) {
        return res.status(403).json({
          error: 'Invalid or inactive identity for session provisioning',
          code: 'INVALID_IDENTITY'
        });
      }
    } else {
      // DEVELOPMENT: Allow without signature but validate identity exists
      const identityValid = await validateIdentityForSession(db, owner_type, owner_id, runtime);
      if (!identityValid) {
        return res.status(400).json({ error: 'Invalid identity for session provisioning' });
      }
    }

    const { generateSessionToken } = await import('./auth/session.js');
    const token = generateSessionToken({
      owner_type,
      owner_id,
      runtime,
      client_ip: req.ip,
      user_agent: req.get('user-agent')
    });

    res.json({ session_token: token });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Helper function to validate identity against database
async function validateIdentityForSession(db: DatabaseInstance, owner_type: string, owner_id: string, runtime: string): Promise<boolean> {
  switch (owner_type) {
    case 'founder':
      return owner_id === 'founder';
    case 'staff': {
      const staff = db.stmt.getStaffAgentById.get(owner_id);
      return !!staff && staff.active === 1 && staff.runtime === runtime;
    }
    case 'division': {
      const division = db.stmt.getDivisionById.get(owner_id);
      return !!division;
    }
    case 'seat': {
      const seat = db.stmt.getSeatById.get(owner_id);
      return !!seat && seat.status === 'active';
    }
    default:
      return false;
  }
}
```

- [ ] **Step 4: Add Founder signature config for 'create_session' operation**

```typescript
// In auth/index.ts config, add 'create_session' to require_founder_signature_for array
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/phase8_auth.test.ts`
Expected: PASS - production session issuance secured

- [ ] **Step 6: Run full test suite for regressions**

Run: `npm test`
Expected: All tests pass (pre-existing failures documented separately)

- [ ] **Step 7: Commit**

```bash
git add src/server.ts src/auth/index.ts tests/phase8_auth.test.ts
git commit -m "feat: secure production session issuance with Founder signatures"
```

---

### Task 3: Create Gate 3 Reports

**Files:**
- Create: `.superpowers/sdd/2026-11-14-phase9-pre-batch3-gate3-remediation/GATE3_SECURITY_FINDINGS.md`
- Create: `.superpowers/sdd/2026-11-14-phase9-pre-batch3-gate3-remediation/GATE3_IMPLEMENTATION_REPORT.md`
- Create: `.superpowers/sdd/2026-11-14-phase9-pre-batch3-gate3-remediation/GATE3_MCP_COMPATIBILITY_REPORT.md`
- Create: `.superpowers/sdd/2026-11-14-phase9-pre-batch3-gate3-remediation/GATE3_SESSION_SECURITY_REPORT.md`
- Create: `.superpowers/sdd/2026-11-14-phase9-pre-batch3-gate3-remediation/GATE3_TEST_REPORT.md`
- Create: `.superpowers/sdd/2026-11-14-phase9-pre-batch3-gate3-remediation/GATE3_FINAL_AUDIT.md`

- [ ] **Step 1: Create report directory**

```bash
mkdir -p .superpowers/sdd/2026-11-14-phase9-pre-batch3-gate3-remediation
```

- [ ] **Step 2: Write each report with findings, implementation details, test evidence**

- [ ] **Step 3: Run final verification**

```bash
npm test
npx tsc --noEmit
# SQLite integrity check
```

- [ ] **Step 4: Commit and push**

```bash
git add .superpowers/sdd/2026-11-14-phase9-pre-batch3-gate3-remediation/
git commit -m "docs: Gate 3 remediation reports"
git push origin master
```

- [ ] **Step 5: Report final commit SHA and results**