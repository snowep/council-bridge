# COUNCIL BRIDGE — CLAUDE & HERMES MCP CONNECTIVITY REMEDIATION + LIVE TWO-WAY E2E

## ROLE

Act as the Senior Backend Engineer, MCP Integration Engineer, Security Engineer, and E2E Test Engineer responsible for completing live Claude ↔ Hermes messaging through Council Bridge.

Repository:
`C:\Projects\council-bridge`

GitHub:
`https://github.com/snowep/council-bridge`

Target branch:
`refactor/repository-structure`

Your responsibility is to diagnose the actual environment, fix verified defects, establish authenticated connections, execute real two-way message-delivery tests, and produce an evidence-based final report.

Do not merely write a test plan. Execute the work and tests wherever the available environment permits.

---

# 1. NON-NEGOTIABLE RULES

### Repository safety

- Preserve all existing user changes.
- Inspect Git status and current HEAD before modifying anything.
- Never discard, reset, overwrite, or revert unrelated work.
- Do not use destructive Git commands.
- Do not commit, push, merge, rebase, or rewrite Git history.
- Do not change branches without explicit approval.
- Do not deploy.

### Database safety

- Never modify the production database.
- Never execute bootstrap against `data/council.db`.
- Never run production migrations or database cleanup.
- Never delete existing identities, messages, conversations, or records.
- Use a dedicated disposable E2E database.
- Use the existing migration runner and supported bootstrap workflow.
- Verify database paths before every write operation.
- Stop if an operation could affect production data.

### Security

- Do not disable authentication to make tests pass.
- Do not introduce hardcoded identity fallbacks.
- Do not expose Founder private keys.
- Do not log session tokens, private keys, webhook secrets, or signatures.
- Do not bypass session ownership checks.
- Do not allow Claude to impersonate Hermes or vice versa.
- Preserve production fail-closed authentication.
- Do not make the webhook signature optional merely to make tests pass.
- Do not create an unauthenticated alternative messaging endpoint.

### Testing integrity

- Do not use mocked Claude or Hermes clients for live E2E claims.
- Do not call service functions directly and label the result live E2E.
- Do not treat HTTP 200 as proof of message delivery.
- Do not treat MCP initialization as proof of message delivery.
- Do not treat database persistence alone as proof of agent-to-agent delivery.
- Clearly distinguish unit, integration, adapter, MCP, and live runtime E2E results.
- Never fabricate test results.
- If a runtime is unavailable, report the blocker instead of claiming success.

---

# 2. WAVE 0 — ENVIRONMENT AND REPOSITORY BASELINE

Before implementation, inspect:

1. Git branch, HEAD SHA, and working tree.
2. Node.js and npm versions.
3. Installed dependencies.
4. Council Bridge environment configuration.
5. Current server process and startup logs.
6. Current listening ports.
7. Claude Code installation and MCP configuration.
8. Hermes installation and MCP configuration.
9. Existing E2E scripts and test infrastructure.
10. Current database configuration and migration state.

Run appropriate diagnostics.

Windows PowerShell:

```powershell
git status --short
git branch --show-current
git rev-parse HEAD

node --version
npm --version

Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in 3333,3334 } |
    Format-Table LocalAddress,LocalPort,OwningProcess

claude --version
claude mcp list

hermes --version
hermes mcp --help
```

Inspect the actual Hermes MCP command syntax before using it. Do not assume unsupported CLI commands exist.

Inspect:

- `src/server.ts`
- `src/mcp/tools.ts`
- `src/mcp/hermes-bridge.ts`
- `src/api/routes/hermes-bridge.routes.ts`
- `src/api/middleware/authentication.ts`
- `src/auth/`
- `src/communication/messages.ts`
- `src/communication/agents.ts`
- Database initialization and migration runner.
- Existing bootstrap script.
- Existing E2E tests.
- `package.json`
- Claude MCP configuration.
- Hermes MCP configuration.

Find the actual current MCP endpoint and configured client endpoints.

Expected Council Bridge endpoint:

`http://127.0.0.1:3334/mcp`

Expected health endpoint:

`http://127.0.0.1:3334/health`

Do not assume these are correct until verified against the running server.

### Diagnose ECONNREFUSED

Determine the exact cause for each client independently.

Investigate:

- Incorrect port.
- Stale server process.
- Port conflicts.
- Server startup failure.
- Database initialization failure preventing `app.listen()`.
- Wrong bind address.
- Windows versus WSL versus Docker networking.
- Incorrect MCP URL.
- Incompatible MCP transport configuration.
- Client process startup errors.
- Node.js ESM module caching.
- Incorrect environment variables.

Determine whether Claude, Hermes, and Council Bridge run in the same network environment.

Do not change configuration blindly.

### Wave 0 deliverable

Create:

`docs/reports/LIVE_MCP_E2E_BASELINE.md`

Include:

- Current HEAD SHA.
- Git working-tree state.
- Actual server endpoint.
- Actual listening process and port.
- Health check result.
- Claude configuration and connection status.
- Hermes configuration and connection status.
- Exact ECONNREFUSED root cause for each client.
- Relevant startup errors.
- Environment differences.
- Confirmed blockers.

Do not proceed with live tests until connectivity is established or the blocker is clearly identified.

---

# 3. WAVE 1 — FIX MCP CONNECTIVITY

Fix only verified problems.

### Server

Verify:

- Server initializes the database before listening.
- Server reports startup failures clearly.
- The expected port is used consistently.
- Bind address is compatible with the actual clients.
- `/health` reports the actual server status.
- `/mcp` uses the supported Streamable HTTP transport.
- Graceful shutdown releases the listener and database resources.

Check whether repeated startup or stale processes create port conflicts.

Do not introduce multiple competing server instances.

### Claude Code

Verify the actual Claude MCP configuration.

Requirements:

- Correct Council Bridge endpoint.
- Correct transport.
- Valid authentication mechanism.
- Successful MCP initialization.
- Successful tool discovery.
- No stale port 3333 configuration if the actual server uses 3334.

Verify the client using the installed Claude Code CLI.

Do not overwrite unrelated MCP configurations.

### Hermes

Verify the actual Hermes MCP configuration and adapter.

Requirements:

- Correct Council Bridge endpoint.
- Correct transport or adapter protocol.
- Valid authentication.
- Successful connection.
- Successful tool discovery.
- Successful Hermes webhook registration if the adapter requires it.
- Successful message retrieval.

Preserve the existing working Hermes Bridge adapter.

Do not duplicate its functionality.

### ESM caching

Investigate the previously reported ESM caching issue.

Verify:

- Which module was stale.
- Whether a process restart resolves it.
- Whether runtime route registration is deterministic.
- Whether imports capture stale database instances.
- Whether the server requires a full restart after route or adapter changes.

Do not introduce arbitrary cache-busting imports.

### Wave 1 acceptance

- Council Bridge starts successfully.
- Health endpoint returns HTTP 200.
- Claude establishes MCP connection.
- Hermes establishes its intended authenticated connection.
- Both clients discover the expected tools.
- No ECONNREFUSED.
- No authentication bypass.

Document all changes.

---

# 4. WAVE 2 — AUTHENTICATION AND IDENTITY REMEDIATION

Previous repository review identified concerns in:

`src/api/routes/hermes-bridge.routes.ts`

Reported concerns:

1. `POST /api/hermes/webhook` accepts requests without a signature in some configurations.
2. `POST /api/hermes/session` has no authentication middleware.
3. `GET /api/hermes/agents` returns placeholder information instead of actual agent records.
4. The route imports authentication middleware but does not consistently apply it.

Inspect the latest source before changing anything.

These findings must be resolved with the existing security architecture.

### Hermes webhook authentication

Implement or correct:

- Mandatory authentication in production.
- Cryptographic signature validation.
- Constant-time signature comparison.
- Timestamp validation and replay protection where the protocol supports it.
- Payload integrity validation.
- Clear rejection of invalid or missing signatures.
- Safe secret handling.
- Test-only credentials isolated from production credentials.

If the current adapter uses a different authenticated protocol, preserve that protocol and document it.

### Hermes session provisioning

Verify:

- Session creation uses the existing authentication architecture.
- Identity is validated against the authoritative registry.
- Runtime identity is validated.
- Expiration is enforced.
- Session tokens cannot be reused after revocation.
- Invalid or inactive identities are rejected.
- Founder signature requirements remain intact in production.

Do not automatically authorize arbitrary Hermes session IDs.

### Agent identity

The test must use two independent logical communication identities.

For example:

- `e2e-claude-agent`
- `e2e-hermes-agent`

Use stable test-only identities.

Verify both identities exist in the authoritative `agents` registry.

Verify their runtime assignments.

Verify that Claude cannot send as Hermes and Hermes cannot send as Claude.

Do not treat Founder mode as proof of independent agent authentication.

Founder mode may be used for administrative provisioning if permitted, but actual message-delivery tests must use separate authenticated agent sessions.

### Authorization tests

Verify:

1. Missing credentials are rejected.
2. Invalid credentials are rejected.
3. Expired credentials are rejected.
4. Revoked credentials are rejected.
5. Wrong runtime is rejected.
6. Sender identity spoofing is rejected.
7. Unauthorized recipient access is rejected.
8. Cross-agent message access is rejected.
9. Invalid webhook signatures are rejected.
10. Replay attempts are rejected.

Preserve existing production authentication behavior.

### Agent listing

Implement the Hermes agent listing route using the actual registry service if it is intended to expose that information.

Apply appropriate authentication and authorization.

Do not return private session information.

---

# 5. WAVE 3 — MESSAGE DELIVERY AND CONVERSATION CORRECTNESS

Inspect:

- `src/mcp/tools.ts`
- `src/mcp/hermes-bridge.ts`
- `src/communication/messages.ts`
- `src/communication/agents.ts`
- Database message schema.
- Message and inbox queries.

Verify the following contracts.

### Message persistence

Every successful send must produce:

- Unique message ID.
- Correct sender ID.
- Correct recipient ID.
- Message content.
- Creation timestamp.
- Correct optional reply relationship.
- Correct read state.

The response must contain the real persisted message ID.

### Message direction

Verify both:

`sender = Claude AND recipient = Hermes`

and:

`sender = Hermes AND recipient = Claude`

Do not assume the existing adapter's protocol translation is correct simply because it returns success.

### Message ordering

Conversation history must be chronological:

- Oldest message first.
- Newest message last.

Verify that pagination does not reverse the conversation or omit older records.

### Pagination

Previous review found 500-message caps in:

- `checkInbox()`
- `listConversations()`

Inspect the current source.

Remove inappropriate hard caps or replace them with correct SQL pagination.

Do not retrieve all historical messages into memory unnecessarily.

Verify:

- Limit.
- Offset.
- Conversation filtering.
- Unread filtering.
- Total counts.
- Stable chronological ordering.

### Replies

A reply must:

- Reference the original message ID.
- Be sent by the original recipient.
- Return to the original sender.
- Preserve the relationship in SQLite.
- Appear in both agents' conversation histories.

Reject unauthorized replies.

### Read state

Verify that only the intended recipient can mark a message as read.

Verify that unread counts change correctly.

### Identity registry synchronization

Inspect whether the existing identity synchronization is actually invoked.

Verify:

- Agent records exist before messaging.
- Registration is idempotent.
- Runtime mappings are correct.
- Existing identities are not overwritten.
- No duplicate identities are created.

Do not expand permissions as a side effect of synchronization.

---

# 6. WAVE 4 — BUILD THE LIVE E2E TEST SUITE

Create a dedicated E2E suite.

Suggested file:

`tests/e2e/live-claude-hermes-messaging.e2e.test.ts`

Use the project's existing testing conventions.

If the test needs supporting scripts, place them under:

`scripts/e2e/`

Add an appropriate npm script, for example:

```json
{
  "scripts": {
    "test:e2e:messaging": "..."
  }
}
```

Adapt the actual command to the existing project tooling.

### Isolated database

Create a unique temporary SQLite database.

Requirements:

- Never point to `data/council.db`.
- Apply required migrations.
- Bootstrap only the identities and records needed for E2E.
- Use test-only keys and credentials.
- Verify database location before every write.
- Clean up only test-owned temporary data.
- Do not delete production records.
- Do not reuse stale test databases without explicit validation.

The test must fail closed if it detects a production database path.

### Actual client requirements

The test must use:

- Actual Claude Code MCP client.
- Actual Hermes runtime or its real Bridge adapter.
- Actual running Council Bridge HTTP/MCP server.
- Actual authentication and session mechanisms.
- Actual SQLite persistence.

Do not replace either runtime with a mock.

If the installed clients cannot be programmatically controlled through their public interfaces, use their real CLI/runtime processes and automate supported interaction methods.

Do not fabricate a simulated client and call it live E2E.

### Test 1 — Claude to Hermes

1. Start Council Bridge.
2. Authenticate Claude as `e2e-claude-agent`.
3. Authenticate Hermes as `e2e-hermes-agent`.
4. Verify both session identities.
5. Verify MCP initialization.
6. Discover communication tools.
7. Generate a unique test correlation ID.
8. Claude sends a message to Hermes through its actual MCP client.
9. Capture the returned message ID.
10. Hermes retrieves the message through its actual integration.
11. Verify exact content.
12. Verify sender and recipient.
13. Verify message ID and timestamp.
14. Verify persisted database record.

### Test 2 — Hermes to Claude

1. Hermes sends a unique message through its actual Bridge adapter.
2. Capture the persisted message ID.
3. Claude retrieves it through MCP.
4. Verify exact content.
5. Verify sender and recipient.
6. Verify database persistence.

### Test 3 — Hermes replies to Claude

1. Hermes replies to the original Claude message.
2. Verify the reply references the original message ID.
3. Verify the reply sender is Hermes.
4. Verify the recipient is Claude.
5. Verify Claude retrieves the reply.
6. Verify the reply appears in conversation history.

### Test 4 — Claude replies to Hermes

1. Claude replies to the original Hermes message.
2. Verify the reply references the correct original message.
3. Verify Hermes retrieves the reply.
4. Verify database relationships.

### Test 5 — Conversation history

Verify both agents see the same conversation.

Expected order:

1. Claude initial message.
2. Hermes reply.
3. Hermes initial message.
4. Claude reply.

Use the actual timestamps and message IDs to establish ordering.

Verify pagination does not omit messages.

### Test 6 — Authentication isolation

Attempt:

- Claude using Hermes identity.
- Hermes using Claude identity.
- Invalid token.
- Expired token.
- Revoked token.
- Unauthorized inbox retrieval.
- Unauthorized reply.

Every attempt must produce the appropriate rejection.

No test should succeed through Founder fallback.

### Test 7 — Read state

1. Deliver a message to Hermes.
2. Confirm unread state.
3. Mark it read through Hermes.
4. Confirm read timestamp.
5. Confirm Claude cannot alter Hermes's read state.

### Test 8 — Persistence after restart

1. Complete message exchange.
2. Stop Council Bridge gracefully.
3. Restart Council Bridge using the same E2E database.
4. Reconnect Claude.
5. Reconnect Hermes.
6. Retrieve conversation history.
7. Verify all messages and replies remain.
8. Verify IDs and relationships are unchanged.

Do not restart or alter the production server.

---

# 7. WAVE 5 — OBSERVABILITY AND DIAGNOSTICS

Provide structured test diagnostics.

Capture:

- Server startup and shutdown status.
- Actual endpoint.
- MCP initialization result.
- Tool discovery result.
- Authenticated logical identity.
- Runtime identity.
- Message IDs.
- Correlation IDs.
- Message timestamps.
- Reply relationships.
- Database verification results.
- HTTP response status.
- MCP error details.
- Connection failures.
- Restart persistence results.

Never log secrets or complete tokens.

Add useful error messages where missing.

Do not add unnecessary infrastructure or Redis.

---

# 8. WAVE 6 — REGRESSION AND QUALITY AUDITS

Run relevant checks:

1. Backend TypeScript compilation.
2. Backend unit tests.
3. Authentication tests.
4. Hermes adapter tests.
5. MCP integration tests.
6. Message service tests.
7. Migration tests.
8. Live Claude/Hermes E2E tests.
9. Frontend TypeScript compilation.
10. Frontend production build.
11. Existing frontend E2E tests.

Run the repository's actual scripts rather than inventing commands.

### Ponytail backend audit

Run the installed Ponytail backend audit workflow if available.

Inspect:

- Authentication boundaries.
- Error handling.
- SQL correctness.
- Resource lifecycle.
- Session management.
- Concurrency.
- Data integrity.
- Test quality.

### Impeccable frontend audit

Only if frontend files changed.

Inspect:

- MUI component consistency.
- Accessibility.
- Responsive behavior.
- Existing design system compliance.

Do not redesign unrelated UI.

### Regression handling

For every failing test:

- Record the exact test.
- Record the error.
- Identify whether it was introduced by this work.
- Compare with the baseline.
- Fix failures caused by this implementation.
- Do not silently skip existing failures.
- Do not call a failure pre-existing without baseline evidence.

---

# 9. DOCUMENTATION

Create:

`docs/reports/LIVE_MCP_E2E_FINAL_REPORT.md`

Include:

## A. Environment

- OS.
- Node.js version.
- npm version.
- Claude Code version.
- Hermes version.
- Council Bridge commit SHA.
- Actual server endpoint.
- Database type and isolated database location.

## B. Root cause

Document the actual cause of Claude connectivity failures and Hermes connectivity failures separately.

## C. Implementation changes

List each changed file and explain the change.

## D. Authentication

Show evidence of independent authentication for both identities.

Never include secrets.

## E. Delivery results

Include a table:

| Test | Direction | Result | Message ID | Evidence |
|---|---|---|---|---|
| Initial delivery | Claude → Hermes | | | |
| Initial delivery | Hermes → Claude | | | |
| Reply | Hermes → Claude | | | |
| Reply | Claude → Hermes | | | |
| History | Both | | | |
| Read state | Both | | | |
| Restart persistence | Both | | | |
| Identity isolation | Both | | | |

## F. Test summary

Report:

- Total tests.
- Passed.
- Failed.
- Skipped.
- Blocked.
- TypeScript status.
- Production build status.
- Security test status.
- Live E2E status.

## G. Outstanding issues

List every unresolved issue.

## H. Acceptance recommendation

Choose one:

- READY FOR FOUNDER REVIEW.
- READY WITH DOCUMENTED NON-BLOCKING ISSUES.
- NOT READY — REMEDIATION REQUIRED.
- BLOCKED — LIVE RUNTIME UNAVAILABLE.

Do not formally accept the milestone on behalf of the Founder.

---

# 10. EXECUTION MANAGEMENT

Work in controlled waves.

After each wave:

1. Report completed work.
2. Report test results.
3. Report unresolved issues.
4. Preserve the working tree.
5. Continue if safe.

Do not stop after discovering the first problem. Diagnose and fix all issues within the authorized scope.

However, stop immediately if:

- Production database modification is required.
- Production private keys are needed.
- Authentication must be weakened.
- Existing data could be destroyed.
- A destructive Git operation appears necessary.
- The runtime cannot be started without external authorization.
- An external service or account approval is required.

In those situations, explain the exact blocker and the minimum Founder action required.

Do not substitute mocked tests for unavailable live runtimes.

---

# 11. FINAL ACCEPTANCE CRITERIA

The work is ready for Founder review only when all of the following are demonstrated:

- [ ] Council Bridge starts reliably.
- [ ] Correct MCP endpoint is verified.
- [ ] Claude MCP connection succeeds.
- [ ] Hermes connection succeeds.
- [ ] Both agents authenticate independently.
- [ ] Both discover communication tools.
- [ ] Claude → Hermes delivery succeeds.
- [ ] Hermes → Claude delivery succeeds.
- [ ] Hermes → Claude reply succeeds.
- [ ] Claude → Hermes reply succeeds.
- [ ] Correct sender and recipient are preserved.
- [ ] Reply relationships are correct.
- [ ] Conversation history is chronological.
- [ ] Pagination works correctly.
- [ ] Read state is correct.
- [ ] Unauthorized identity access is rejected.
- [ ] Message records persist in SQLite.
- [ ] History survives Bridge restart.
- [ ] Backend regression tests pass.
- [ ] TypeScript compilation passes.
- [ ] No production database changes occurred.
- [ ] No unauthorized Git operations occurred.
- [ ] Final report contains reproducible evidence.

A successful REST webhook test is not sufficient.

A successful MCP connection is not sufficient.

A successful message insertion is not sufficient.

The actual Claude and Hermes runtimes must exchange and retrieve messages through Council Bridge.

**Begin with Wave 0. Inspect the current environment and repository before changing any files. Execute the complete workflow and produce the final report.**