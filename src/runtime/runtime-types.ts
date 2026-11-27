// Runtime Types - Phase 10 Loop 2: Authoritative Runtime Lifecycle
// Shared types used across runtime lifecycle, ownership guard, and execution guard

export type RuntimeId = 'claude' | 'hermes';

// Database row type for runtime_sessions table
export interface RuntimeSessionRow {
  runtime: RuntimeId;
  session_id: string;
  connection_status: 'connected' | 'disconnected' | 'connecting' | 'disconnecting' | 'switching' | 'error';
  connected_at: string;               // Unix milliseconds
  last_heartbeat_at: string;          // Unix milliseconds
  lease_expires_at: string;           // Unix milliseconds
  client_ip: string | null;
  user_agent: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  generation: number;                 // Added for generation-based execution fencing
  credential_id: string | null;       // Workstream A-R1: link session to validated credential
}

// In-memory session type for API use
export interface RuntimeSession {
  sessionId: string;
  runtimeId: RuntimeId;
  generation: number;
  connectionStatus:
    | 'connected'
    | 'disconnected'
    | 'connecting'
    | 'disconnecting'
    | 'switching'
    | 'error';
  leaseExpiresAt: number;           // Unix milliseconds
  connectedAt: number;              // Unix milliseconds
  lastHeartbeatAt: number | null;   // Unix milliseconds
  disconnectedAt: number | null;    // Unix milliseconds
  lastError: string | null;
}

export interface ConnectRuntimeOptions {
  runtime: RuntimeId;
  sessionId?: string;
  clientIp?: string;
  userAgent?: string;
}

export interface DisconnectRuntimeOptions {
  sessionId: string;
}

export interface SwitchRuntimeOptions {
  newRuntime: RuntimeId;
  sessionId?: string;
  clientIp?: string;
  userAgent?: string;
  credentialId?: string;  // P2-03: bind target session to credential
}

export interface HeartbeatOptions {
  sessionId: string;
}

export interface StaleSessionRecoveryOptions {
  onlyExpired?: boolean;
  force?: boolean;
}

export interface IdleHeartbeatController {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}

export interface StaleSessionRecoveryResult {
  recovered: number;
  errors: string[];
}