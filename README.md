# Council Bridge

MCP server and REST API for structured multi-agent collaboration. Provides a message bus, council meetings, task delegation, approvals, and memory management with founder-signed authorization.

## Architecture

**Backend**: Express 5 + MCP SDK 1.32 + SQLite (better-sqlite3)
- Session-based authentication with JWT-style tokens
- Founder signature verification (Ed25519) for privileged operations
- Local single-user Founder mode with loopback restriction
- MCP endpoint at `/mcp` (Streamable HTTP)
- REST API routes in `src/api/routes/`
- Database layer in `src/infrastructure/database/`

**Frontend**: React 19 + Vite + MUI 9 (Material UI)
- Located in `frontend/`
- Communicates with backend via REST API

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

| Setting | Value |
|---------|-------|
| Host | `127.0.0.1` (localhost only in local mode) |
| Port | `3334` (or `PORT` env var) |
| MCP Endpoint | `http://127.0.0.1:3334/mcp` |
| Health Endpoint | `http://127.0.0.1:3334/health` |
| Database | `data/council.db` (SQLite with WAL mode) |
| Local Bind | `127.0.0.1` (loopback only in local mode) |

### Environment Variables

```bash
PORT=3334                    # Server port (default: 3334)
NODE_ENV=development         # production | development
DATABASE_PATH=data/council.db  # SQLite database path
AUTH_MODE=local              # local | production
FOUNDER_PUBLIC_KEY=...       # Base64 Ed25519 public key
FOUNDER_PRIVATE_KEY=...      # Base64 Ed25519 private key (dev only)
SESSION_TIMEOUT_MS=1800000   # 30 minutes
ALLOW_HARDCODED_FALLBACK=true # Dev only: allow fallback auth
```

## Authentication

### Session Authentication
- Bearer token in `Authorization` header
- Tokens created via `POST /api/auth/session`
- Validates identity against database

### Founder Signature Verification
Required for privileged operations in production:
- RSA-2048 signatures over canonical JSON
- Timestamp (5 min window), nonce (replay protection), key ID
- Endpoints: `/api/task-autonomy`, `/api/auth/session` (production)

### Local Single-User Mode (Founder Mode)
- `AUTH_MODE=local` enables
- Binds to `127.0.0.1` only (loopback restriction)
- No founder signature required for session creation
- Simplified auth for development

## REST API Structure

```
GET    /health                    # Health check
POST   /api/auth/session          # Create session
DELETE /api/auth/session          # Revoke session
GET    /api/auth/status           # Session status
GET    /api/auth/founder/public-key  # Founder public key

POST   /api/task-autonomy         # Create autonomy level (founder)
GET    /api/task-autonomy         # List autonomy levels

GET    /api/messages              # List messages
POST   /api/messages              # Send message
GET    /api/messages/:id          # Get message
GET    /api/messages/inbox/:owner  # Get inbox

GET    /api/meetings              # List meetings
POST   /api/meetings              # Create meeting
GET    /api/meetings/:id          # Get meeting
POST   /api/meetings/:id/start    # Start meeting
POST   /api/meetings/:id/end      # End meeting

GET    /api/council               # Council operations
POST   /api/council/delegate      # Delegate task

GET    /api/memory                # Memory entries
POST   /api/memory                # Create memory

GET    /api/divisions             # List divisions
POST   /api/divisions             # Create division

GET    /api/staff                 # List staff
POST   /api/staff                 # Create staff

GET    /api/tasks                 # List tasks
POST   /api/tasks                 # Create task
GET    /api/tasks/:id             # Get task
POST   /api/tasks/:id/approve     # Approve task
POST   /api/tasks/:id/reject      # Reject task

GET    /api/executions            # List executions
POST   /api/executions            # Request execution
GET    /api/executions/:id        # Get execution
POST   /api/executions/:id/approve # Approve execution
POST   /api/executions/:id/cancel  # Cancel execution

GET    /api/approvals             # List approvals
GET    /api/approvals/pending     # Pending approvals

GET    /api/deliverables          # List deliverables
POST   /api/deliverables          # Create deliverable
GET    /api/deliverables/:id      # Get deliverable

GET    /api/quality-thresholds    # Quality thresholds
POST   /api/quality-thresholds    # Create threshold
```

## MCP Tools

The `/mcp` endpoint exposes tools for agent-to-agent communication:
- `register_agent`, `list_agents`
- `send_message`, `check_inbox`, `reply_message`, `list_messages`
- Council operations, meeting management, task delegation

## Database

Located in `src/infrastructure/database/database.ts`:
- SQLite with WAL mode for concurrency
- Foreign keys enabled
- Migrations in `migrations/` directory
- Schema managed by migration runner

## Migration Runner CLI

Located in `src/migration-runner/cli.ts`:

```bash
# Show migration status
npx tsx src/migration-runner/cli.ts status

# Run pending migrations
npx tsx src/migration-runner/cli.ts run

# Dry run (validate only)
npx tsx src/migration-runner/cli.ts run --dry-run

# Run specific migrations
npx tsx src/migration-runner/cli.ts run 001 002

# Rollback last migration
npx tsx src/migration-runner/cli.ts rollback

# Rollback N migrations
npx tsx src/migration-runner/cli.ts rollback 3

# Rollback all
npx tsx src/migration-runner/cli.ts rollback --all

# Rollback to before specific migration
npx tsx src/migration-runner/cli.ts rollback --to 010

# Validate migrations
npx tsx src/migration-runner/cli.ts validate

# Create backup
npx tsx src/migration-runner/cli.ts backup

# Restore from backup
npx tsx src/migration-runner/cli.ts restore council-20240101-120000.db

# Verify founder authorization package
npx tsx src/migration-runner/cli.ts check-authorization

# Compute checksums
npx tsx src/migration-runner/cli.ts compute-checksums

# Verify ledger checksums
npx tsx src/migration-runner/cli.ts verify-ledger
```

## Backup / Restore

```bash
# Binary backup (fast, exact copy)
npx tsx src/migration-runner/cli.ts backup --method binary

# Schema + data dump (portable)
npx tsx src/migration-runner/cli.ts backup --method full_dump

# Schema only
npx tsx src/migration-runner/cli.ts backup --method schema_dump

# Restore
npx tsx src/migration-runner/cli.ts restore <backup-file>
```

## Testing

```bash
# All tests
npm test

# Unit tests only
tsx --test tests/unit/**/*.test.ts

# Integration tests only
tsx --test tests/integration/**/*.test.ts

# Security tests
tsx --test tests/security/**/*.test.ts

# Migration tests
tsx --test tests/migrations/**/*.test.ts
```

## Repository Structure

```
council-bridge/
├── src/
│   ├── server.ts                      # Express + MCP server entry
│   ├── database.ts                    # Database factory (legacy compat)
│   ├── mcp/
│   │   └── tools.ts                   # MCP tool registration
│   ├── auth/
│   │   ├── index.ts                   # Auth config & modes
│   │   ├── session.ts                 # Session token management
│   │   ├── founder.ts                 # Founder Ed25519 verification
│   │   └── middleware.ts              # Auth middleware
│   ├── api/
│   │   ├── middleware/
│   │   │   ├── authentication.ts      # Auth middleware + local mode
│   │   │   └── error-handler.ts       # Global error handler
│   │   ├── routes/                    # REST API routes (12 modules)
│   │   └── schemas/                   # Zod request/response schemas
│   ├── council/                       # Council domain logic
│   │   ├── operations.ts              # Task autonomy, executions
│   │   ├── meetings.ts                # Meeting lifecycle
│   │   ├── memory.ts                  # Memory management
│   │   ├── divisions.ts               # Division management
│   │   ├── task-delegation.ts         # Task delegation
│   │   └── types.ts                   # Domain types & Zod schemas
│   ├── communication/
│   │   ├── agents.ts                  # Agent registry
│   │   └── messages.ts                # Message bus
│   ├── infrastructure/
│   │   └── database/
│   │       └── database.ts            # Database layer (WAL, FK, migrations)
│   └── migration-runner/
│       ├── cli.ts                     # CLI entry point
│       ├── registry.ts                # Migration file registry
│       ├── ledger.ts                  # Applied migrations ledger
│       ├── executor.ts                # Migration execution engine
│       ├── rollback.ts                # Rollback engine
│       ├── backup.ts                  # Backup/restore manager
│       └── validator.ts               # Pre/post migration validation
├── migrations/                        # SQL migration files (001-015)
├── frontend/                          # React 19 + Vite + MUI 9 app
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── tests/
│   ├── unit/                          # Unit tests
│   ├── integration/                   # Integration tests
│   ├── security/                      # Security tests
│   ├── migrations/                    # Migration tests
│   └── helpers/                       # Test helpers
├── data/                              # SQLite database (gitignored)
├── docs/                              # Documentation
├── .env.example                       # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## License

ISC