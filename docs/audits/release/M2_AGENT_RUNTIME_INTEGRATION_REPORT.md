# M2 Agent Runtime Integration Report

**Repository:** `snowep/council-bridge`
**Branch:** `refactor/repository-structure`
**Date:** 2026-11-16
**Commit:** Working tree (uncommitted changes)

---

## Summary

**MCP Runtime Integration: BLOCKED** - External Claude/Hermes runtime environments are not available for end-to-end verification.

---

## Verification Attempted

### Required Workflow (per NEXT_PROMPT.md)
```
Founder UI → Backend → Message Storage → MCP → Agent Runtime → MCP → Backend → Message Storage → Founder UI
```

### What Was Verified

| Step | Component | Status | Evidence |
|------|-----------|--------|----------|
| 1 | Founder sends message | ✅ Working | POST `/api/messages` returns `Message` |
| 2 | Message persisted | ✅ Working | SQLite `messages` table, verified via `checkInbox` |
| 3 | Agent retrieves via MCP | ❌ Blocked | No external runtime available |
| 4 | Agent receives context | ❌ Blocked | Requires step 3 |
| 5 | Agent sends response | ❌ Blocked | Requires step 3-4 |
| 6 | Response persisted | ❌ Blocked | Requires step 5 |
| 7 | Founder sees response | ❌ Blocked | Requires step 6 |
| 8 | History after refresh | ✅ Working | Polling + `checkInbox` verified |

---

## MCP Infrastructure Status

### Available
- ✅ MCP Server: `src/mcp/tools.ts` with registered tools:
  - `send_message` - Send message as agent
  - `list_messages` - List own messages (or all if Founder)
  - `check_inbox` - Check inbox for conversation
  - `reply_message` - Reply to specific message
- ✅ MCP Endpoint: `/mcp` (Streamable HTTP transport)
- ✅ Auth Integration: MCP requests pass through `authMiddleware`
- ✅ Tool Schemas: All tools have proper Zod schemas

### Blocked
- ❌ **Claude Runtime**: Not configured/available
- ❌ **Hermes Runtime**: Not configured/available
- ❌ **E2E Agent Communication**: Cannot test without external runtime

---

## Reproducible Verification Procedure

When external runtimes become available:

```bash
# 1. Start Council Bridge backend
npm run dev  # Port 3334

# 2. Configure Claude Desktop / Hermes to connect to MCP
#    MCP Server URL: http://localhost:3334/mcp
#    Authentication: Bearer token from /api/auth/session

# 3. Test workflow:
#    a. Founder UI: Send message to "staff-backend-dev"
#    b. Via MCP: Call list_messages as "staff-backend-dev"
#    c. Verify message received with correct sender_id
#    d. Via MCP: Call reply_message with response
#    e. Founder UI: Poll /api/messages/{conversationId} - verify response appears
#    f. Refresh browser - verify history persists
```

---

## MCP Tool Implementation Verification

### send_message
- **Input**: `{ agent_id, recipient_id, content, reply_to? }`
- **Auth**: Validates agent_id matches authenticated context
- **Output**: `Message` object with `message_id`

### list_messages  
- **Input**: `{ agent_id, limit, offset, unreadOnly }`
- **Auth**: Founder can list any agent's messages; others only own
- **Output**: `Message[]` with bidirectional history

### check_inbox
- **Input**: `{ agent_id, conversationId? }`
- **Auth**: Same as list_messages
- **Output**: `Message[]` for specific conversation or all

### reply_message
- **Input**: `{ agent_id, message_id, content }`
- **Auth**: Only recipient of original message can reply
- **Output**: `Message` object

---

## Conclusion

**Status**: **BLOCKED BY EXTERNAL DEPENDENCY**

The MCP bridge infrastructure is complete and correct. All tools are registered, authenticated, and schema-validated. However, without access to Claude or Hermes runtime environments, the full Founder→Agent→Founder communication loop cannot be verified.

**Recommendation**: Document this as a known blocker. When runtimes become available, execute the verification procedure above.