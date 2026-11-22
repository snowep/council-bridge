# MCP Client Configuration Fix

## VERIFIED: Server is working correctly ✅

Tested with curl:
- ✅ GET `/mcp` with `Accept: text/event-stream` → 200 OK, SSE streaming
- ❌ GET `/mcp` without `Accept: text/event-stream` → 406 "Not Acceptable: Client must accept text/event-stream"

## ROOT CAUSE

Claude Code's MCP plugin client MUST send `Accept: text/event-stream` header for GET requests to `/mcp`. This is a protocol requirement from the MCP SDK v1.32.2's Streamable HTTP transport specification.

## Server Configuration (Already Applied)

CORS headers allow the necessary headers:
- `methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']`
- `allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Encoding', 'Accept-Language']`

## Required Client Configuration

**Option A: Claude Code MCP Plugin Configuration**

1. Open Claude Code settings
2. Navigate to MCP Servers configuration
3. Add a new MCP server:
   - **Name:** `council-bridge`
   - **URL:** `http://localhost:3334/mcp`
   - **Transport:** Streamable HTTP (SSE)

**OR Option B: Manual Server Connection**

If using a configuration file (`~/.claude/mcp.json`):

```json
{
  "mcpServers": {
    "council-bridge": {
      "url": "http://localhost:3334/mcp",
      "transport": "streamable-http"
    }
  }
}
```

## Authentication

The server runs in **Development Mode** with hardcoded credentials:
- Use any valid session token in the format: `test|test-session|claude|founder|staff|test|1234567890|1234567890|`
- No real authentication required for local development

## Starting the MCP Server

```bash
# Start server (default port 3334)
npm run start

# Server will auto-detect development mode and enable local authentication
```

## Troubleshooting

If you see "Not Acceptable: Client must accept text/event-stream":

1. **The client must send `Accept: text/event-stream`** - This is automatic for MCP SDK clients
2. **Verify client configuration** - Ensure MCP server is set to use Streamable HTTP transport
3. **Restart Claude Code** after any configuration changes
4. **Check network connectivity** - Server binds to 127.0.0.1 only in local mode

## Architecture Notes

The MCP endpoint (`/mcp`):
- Requires `Accept: text/event-stream` for GET (SSE streaming)
- Requires `Content-Type: application/json` for POST
- Authentication via Authorization header (session token)
- Single session per runtime enforcement (Claude or Hermes)
- Integrated with execution guard for TOCTOU protection