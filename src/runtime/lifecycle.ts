// Runtime Lifecycle Manager - Single Active Runtime Enforcement
// Phase 10: Enables runtime switching with shared persistent intelligence

import { DatabaseInstance } from '../database.js';
import { randomUUID } from 'node:crypto';

export type RuntimeType = 'claude' | 'hermes';

export interface RuntimeConnectionState {
  activeRuntime: RuntimeType | null;
  connectionStatus:
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'disconnecting'
    | 'switching'
    | 'error';
  sessionId: string | null;
  connectedAt: string | null;
  lastHeartbeatAt: string | null;
  leaseExpiresAt: string | null;
  lastError: string | null;
}

export interface ConnectRuntimeOptions {
  runtime: RuntimeType;
  sessionId?: string;
  clientIp?: string;
  userAgent?: string;
}

export interface DisconnectRuntimeOptions {
  sessionId: string;
}

export interface SwitchRuntimeOptions {
  newRuntime: RuntimeType;
  sessionId?: string;
  clientIp?: string;
  userAgent?: string;
}

export interface HeartbeatOptions {
  sessionId: string;
}

interface RuntimeSessionRow {
  runtime: RuntimeType;
  session_id: string;
  connection_status: string;
  connected_at: string | null;
  last_heartbeat_at: string | null;
  lease_expires_at: string | null;
  client_ip: string | null;
  user_agent: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

const LEASE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

function getCurrentTimestamp(): string {
  return String(Date.now());
}

function addMillisecondsToISO(msString: string, ms: number): string {
  const date = new Date(parseInt(msString));
  date.setTime(date.getTime() + ms);
  return date.toISOString();
}

function parseISO(s: string | null): number | null {
  if (!s) return null;
  const ms = parseInt(s);
  return isNaN(ms) ? null : ms;
}

export class RuntimeLifecycleManager {
  constructor(private db: DatabaseInstance) {}

  getState(): RuntimeConnectionState {
    const session = this.getActiveSession();
    if (!session) {
      return {
        activeRuntime: null,
        connectionStatus: 'disconnected',
        sessionId: null,
        connectedAt: null,
        lastHeartbeatAt: null,
        leaseExpiresAt: null,
        lastError: null
      };
    }

    return {
      activeRuntime: session.runtime,
      connectionStatus: this.parseConnectionStatus(session.connection_status),
      sessionId: session.session_id,
      connectedAt: session.connected_at,
      lastHeartbeatAt: session.last_heartbeat_at,
      leaseExpiresAt: session.lease_expires_at,
      lastError: session.last_error
    };
  }

  checkOwnership(sessionId: string): boolean {
    const row = this.db.stmt.getRuntimeSessionBySession.get(sessionId) as RuntimeSessionRow | undefined;
    return row !== undefined && row.session_id === sessionId;
  }

  getSessionOwnership(sessionId: string): { runtime: RuntimeType | null; isOwner: boolean } {
    const row = this.db.stmt.getRuntimeSessionBySession.get(sessionId) as RuntimeSessionRow | undefined;
    if (!row || row.session_id !== sessionId) {
      return { runtime: null, isOwner: false };
    }
    return { runtime: row.runtime, isOwner: true };
  }

  connect(options: ConnectRuntimeOptions): { success: boolean; state?: RuntimeConnectionState; error?: string } {
    const { runtime, sessionId, clientIp, userAgent } = options;

    // Validate runtime
    if (runtime !== 'claude' && runtime !== 'hermes') {
      return { success: false, error: 'Invalid runtime identifier' };
    }

    const newSessionId = sessionId || randomUUID();
    const now = getCurrentTimestamp(); // Unix milliseconds string
    const leaseExpires = String(Number(now) + LEASE_DURATION_MS);

    try {
      this.db.runPreparedStatement('beginTransaction', []);

      // Check for existing active session
      const existing = this.db.stmt.getRuntimeSessionByRuntime.get(runtime) as RuntimeSessionRow | undefined;
      const active = this.db.stmt.getActiveRuntimeSession.get() as RuntimeSessionRow | undefined;

      // If same runtime already active with same session, be idempotent
      if (existing && existing.session_id === newSessionId) {
        this.db.runPreparedStatement('commitTransaction', []);
        const state = this.getState();
        return { success: true, state };
      }

      // If another runtime is active, reject
      if (active && active.runtime !== runtime) {
        this.db.runPreparedStatement('rollbackTransaction', []);
        return {
          success: false,
          error: `Runtime already active: ${active.runtime} owns the connection. Disconnect or switch first.`
        };
      }

      // Insert or replace the session
      this.db.stmt.upsertRuntimeSession.run(
        runtime,
        newSessionId,
        'connected',
        now,
        now,
        leaseExpires,
        clientIp || null,
        userAgent || null,
        null,
        now,
        now
      );

      this.db.runPreparedStatement('commitTransaction', []);

      const newState = this.getState();
      return { success: true, state: newState };
    } catch (error) {
      this.db.runPreparedStatement('rollbackTransaction', []);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect runtime'
      };
    }
  }

  disconnect(options: DisconnectRuntimeOptions): { success: boolean; state?: RuntimeConnectionState; error?: string } {
    const { sessionId } = options;

    if (!sessionId) {
      return { success: false, error: 'Session ID required' };
    }

    // Verify ownership
    const session = this.db.stmt.getRuntimeSessionBySession.get(sessionId) as RuntimeSessionRow | undefined;
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Check if already disconnected
    if (session.connection_status === 'disconnected') {
      const state = this.getState();
      return { success: true, state };
    }

    try {
      this.db.runPreparedStatement('beginTransaction', []);

      this.db.stmt.updateRuntimeSessionStatus.run(
        'disconnected',
        null,
        session.session_id
      );

      this.db.runPreparedStatement('commitTransaction', []);
      const newState = this.getState();
      return { success: true, state: newState };
    } catch (error) {
      this.db.runPreparedStatement('rollbackTransaction', []);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disconnect runtime'
      };
    }
  }

  switch(options: SwitchRuntimeOptions): { success: boolean; state?: RuntimeConnectionState; error?: string } {
    const { newRuntime, sessionId, clientIp, userAgent } = options;

    // Validate runtime
    if (newRuntime !== 'claude' && newRuntime !== 'hermes') {
      return { success: false, error: 'Invalid runtime identifier' };
    }

    const newSessionId = sessionId || randomUUID();
    const now = getCurrentTimestamp();
    const leaseExpires = addMillisecondsToISO(now, LEASE_DURATION_MS);

    try {
      this.db.runPreparedStatement('beginTransaction', []);

      // Get current active session
      const currentActive = this.db.stmt.getActiveRuntimeSession.get() as RuntimeSessionRow | undefined;

      // Check if already active with same session
      if (currentActive && currentActive.runtime === newRuntime && currentActive.session_id === newSessionId) {
        this.db.runPreparedStatement('commitTransaction', []);
        const state = this.getState();
        return { success: true, state };
      }

      // If another runtime is active, disconnect it first
      if (currentActive && currentActive.runtime !== newRuntime) {
        // Verify session ownership if provided
        if (sessionId && currentActive.session_id !== sessionId) {
          this.db.runPreparedStatement('rollbackTransaction', []);
          return {
            success: false,
            error: 'Session ownership mismatch: you cannot switch away from another session'
          };
        }

        // Mark current session as switching then disconnected
        this.db.stmt.updateRuntimeSessionStatus.run(
          'disconnecting',
          null,
          currentActive.session_id
        );
      }

      // Insert new session
      this.db.stmt.upsertRuntimeSession.run(
        newRuntime,
        newSessionId,
        'connected',
        now,
        now,
        leaseExpires,
        clientIp || null,
        userAgent || null,
        null,
        now,
        now
      );

      this.db.runPreparedStatement('commitTransaction', []);

      const newState = this.getState();
      return { success: true, state: newState };
    } catch (error) {
      this.db.runPreparedStatement('rollbackTransaction', []);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to switch runtime'
      };
    }
  }

  heartbeat(options: HeartbeatOptions): { success: boolean; state?: RuntimeConnectionState; error?: string } {
    const { sessionId } = options;

    if (!sessionId) {
      return { success: false, error: 'Session ID required' };
    }

    const session = this.db.stmt.getRuntimeSessionBySession.get(sessionId) as RuntimeSessionRow | undefined;
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Check if already expired - lease_expires_at is Unix milliseconds
    const leaseExpires = parseISO(session.lease_expires_at);
    const now = Date.now();
    if (leaseExpires !== null && leaseExpires < now) {
      return { success: false, error: 'Session expired' };
    }

    const newLeaseExpires = String(now + LEASE_DURATION_MS);

    try {
      this.db.stmt.updateRuntimeSessionHeartbeat.run(
        String(now),
        newLeaseExpires,
        sessionId
      );

      const newState = this.getState();
      return { success: true, state: newState };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update heartbeat'
      };
    }
  }

  recoverStaleSessions(): { recovered: number; errors: string[] } {
    // Use Unix milliseconds for consistent comparison
    const now = Date.now();
    let recovered = 0;
    const errors: string[] = [];

    try {
      // Find expired sessions
      const sessions = this.db.stmt.getRuntimeSessionsExpiring.all(String(now)) as RuntimeSessionRow[];

      this.db.runPreparedStatement('beginTransaction', []);

      for (const session of sessions) {
        if (session.connection_status === 'connected') {
          try {
            this.db.stmt.updateRuntimeSessionStatus.run(
              'disconnected',
              null,
              session.session_id
            );
            recovered++;
          } catch (e) {
            errors.push(`Failed to recover session ${session.session_id}: ${e}`);
          }
        }
      }

      this.db.runPreparedStatement('commitTransaction', []);
    } catch (error) {
      this.db.runPreparedStatement('rollbackTransaction', []);
      errors.push(error instanceof Error ? error.message : 'Recovery failed');
    }

    return { recovered, errors };
  }

  private getActiveSession(): RuntimeSessionRow | undefined {
    // First check if there's an active session
    let session = this.db.stmt.getActiveRuntimeSession.get() as RuntimeSessionRow | undefined;

    // If no active session found, try connected sessions fallback
    if (!session) {
      session = this.db.stmt.getConnectedRuntimeSession.get() as RuntimeSessionRow | undefined;
    }

    return session;
  }

  private parseConnectionStatus(status: string): RuntimeConnectionState['connectionStatus'] {
    const validStatuses: RuntimeConnectionState['connectionStatus'][] = [
      'disconnected', 'connecting', 'connected', 'disconnecting', 'switching', 'error'
    ];
    return validStatuses.includes(status as RuntimeConnectionState['connectionStatus'])
      ? (status as RuntimeConnectionState['connectionStatus'])
      : 'disconnected';
  }
}

// Singleton instance
let _instance: RuntimeLifecycleManager | null = null;

export function getRuntimeLifecycleManager(db: DatabaseInstance): RuntimeLifecycleManager {
  if (!_instance) {
    _instance = new RuntimeLifecycleManager(db);
  }
  return _instance;
}

export function resetRuntimeLifecycleManager(): void {
  _instance = null;
}