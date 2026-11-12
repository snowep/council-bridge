# Council Bridge - Phase 1

MCP server for agent-to-agent communication. Provides a message bus where agents can register, send messages, check inboxes, and reply.

## Features

- **Agent Registration**: Register agents with unique IDs, display names, and runtimes
- **Message Sending**: Agents can send messages to other registered agents
- **Inbox Checking**: Agents can check their message inbox
- **Message Replies**: Recipients can reply to messages (maintains reply chain)
- **Message Listing**: List all messages sent/received by an agent
- **Persistence**: Messages stored in SQLite with full history
- **Validation**: All inputs validated with Zod schemas
- **Access Control**: Only registered agents can send/receive; only recipients can reply

## MCP Tools

| Tool | Description |
|------|-------------|
| `register_agent` | Register a new agent |
| `list_agents` | List all registered agents |
| `send_message` | Send a message from one agent to another |
| `check_inbox` | Check messages for an agent |
| `reply_message` | Reply to a specific message |
| `list_messages` | List all messages for an agent |

## Quick Start

```bash
# Install dependencies
npm install

# Run type checking
npm run typecheck

# Run tests
npm test

# Development server (with hot reload)
npm run dev

# Production server
npm start
```

## Configuration

- **Host**: `127.0.0.1` (localhost only)
- **Port**: `3333` (or `PORT` env var)
- **MCP Endpoint**: `http://127.0.0.1:3333/mcp`
- **Health Endpoint**: `http://127.0.0.1:3333/health`
- **Database**: `data/council.db` (SQLite with WAL mode)

## Example Usage

### Initialize MCP Session
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": { "name": "my-client", "version": "1.0.0" }
  }
}
```

### Register Agent
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "register_agent",
    "arguments": {
      "agent_id": "agent-1",
      "display_name": "My Agent",
      "runtime": "node"
    }
  }
}
```

### Send Message
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "send_message",
    "arguments": {
      "sender_id": "agent-1",
      "recipient_id": "agent-2",
      "content": "Hello!"
    }
  }
}
```

### Check Inbox
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "check_inbox",
    "arguments": { "agent_id": "agent-2" }
  }
}
```

### Reply to Message
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "reply_message",
    "arguments": {
      "agent_id": "agent-2",
      "message_id": "<message-uuid>",
      "content": "Hi there!"
    }
  }
}
```

## Project Structure

```
src/
├── server.ts       # Main MCP server with Express + Streamable HTTP
├── database.ts     # SQLite database setup & prepared statements
├── agents.ts       # Agent registration & listing logic
└── messages.ts     # Message sending, inbox, replies, listing

tests/
├── agents.test.ts  # Unit tests for agents & messages
└── server.test.ts  # Integration tests via MCP protocol

data/
└── council.db      # SQLite database (created at runtime)
```

## Architecture

- **Transport**: Streamable HTTP (MCP spec) with SSE support
- **Session Management**: Per-client sessions with UUIDs
- **DNS Rebinding Protection**: Enabled via SDK's Express integration
- **Graceful Shutdown**: SIGINT/SIGTERM handlers close all sessions
- **Health Checks**: `/health` endpoint for monitoring

## Database Schema

```sql
agents (
  id TEXT PRIMARY KEY,           -- UUID
  agent_id TEXT UNIQUE NOT NULL, -- User-facing ID
  display_name TEXT NOT NULL,
  runtime TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

messages (
  id TEXT PRIMARY KEY,           -- UUID
  sender_id TEXT NOT NULL,       -- FK to agents.agent_id
  recipient_id TEXT NOT NULL,    -- FK to agents.agent_id
  content TEXT NOT NULL,
  reply_to TEXT,                 -- FK to messages.id
  created_at TEXT NOT NULL
)
```

Indexes on: `messages(recipient_id)`, `messages(sender_id)`, `messages(reply_to)`, `messages(created_at)`

## License

ISC