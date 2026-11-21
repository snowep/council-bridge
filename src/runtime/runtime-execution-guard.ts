// Runtime Execution Guard for MCP Tool Execution
// Phase 10: Protect against TOCTOU (time-of-check/time-of-use) race conditions
// at the MCP tool execution boundary using atomic SQLite transactions

import { DatabaseInstance } from '../database.js';
import { AuthContext } from '../auth/index.js';
import { randomUUID } from 'node:crypto';
import { parseUnixMs } from './lifecycle.js';

export type RuntimeId = 'claude' | 'hermes';

export interface RuntimeExecutionContext {
  runtimeId: RuntimeId;
  sessionId: string;
  executionId: string;
}

export type RuntimeToolExecutor<T> = (context: RuntimeExecutionContext) => Promise<T>;

export interface ExecutionGuardResult<T> {
  success: boolean;
  result?: T;
  error?: {
    code: string;
    message: string;
    activeRuntime?: RuntimeId;
  };
}

/**
 * Creates an execution guard that authenticates the runtime, validates the session,
 * validates the lease, acquires an execution permit via atomic transaction,
 * executes the MCP tool callback, and releases the permit in a finally block.
 */
export function createRuntimeExecutionGuard(db: DatabaseInstance) {
  const EXECUTION_PERMIT_DURATION_MS = 30 * 1000; // 30 seconds max execution time

  /**
   * Acquires an execution permit via atomic SQLite transaction
   * Returns execution context or error
   */
  async function acquireExecutionPermit(
    authContext: AuthContext
  ): Promise<{ success: boolean; context?: RuntimeExecutionContext; error?: { code: string; message: string; activeRuntime?: RuntimeId } }> {
    const { runtime: requestRuntime, session_id: requestSessionId } = authContext;

    if (!requestSessionId) {
      return { success: false, error: { code: 'SESSION_ID_REQUIRED', message: 'Missing session identity in authentication context' } };
    }

    const executionId = randomUUID();
    const now = Date.now();
    const expiresAt = now + EXECUTION_PERMIT_DURATION_MS;

    try {
      // Begin IMMEDIATE transaction for atomic ownership verification and permit acquisition
      db.runPreparedStatement('beginTransaction', []);

      // 1. Resolve authenticated runtime session
      const sessionRow = db.stmt.getRuntimeSessionBySession.get(requestSessionId) as
        | { runtime: RuntimeId; session_id: string; connection_status: string; lease_expires_at: string | null }
        | undefined;

      if (!sessionRow || sessionRow.session_id !== requestSessionId) {
        db.runPreparedStatement('rollbackTransaction', []);
        return { success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' } };
      }

      // 2. Confirm it is the active connected session
      const activeSession = db.stmt.getActiveRuntimeSession.get() as
        | { runtime: RuntimeId; session_id: string; connection_status: string; lease_expires_at: string | null }
        | undefined;

      if (!activeSession || activeSession.connection_status !== 'connected') {
        db.runPreparedStatement('rollbackTransaction', []);
        return { success: false, error: { code: 'NO_ACTIVE_SESSION', message: 'No active runtime session' } };
      }

      // 3. Verify the session ID matches
      if (activeSession.session_id !== requestSessionId) {
        db.runPreparedStatement('rollbackTransaction', []);
        return {
          success: false,
          error: {
            code: 'RUNTIME_NOT_ACTIVE',
            message: `This runtime does not own the active Council Bridge session. Active runtime: ${activeSession.runtime}`,
            activeRuntime: activeSession.runtime
          }
        };
      }

      // 4. Verify the runtime matches
      if (activeSession.runtime !== requestRuntime) {
        db.runPreparedStatement('rollbackTransaction', []);
        return {
          success: false,
          error: {
            code: 'RUNTIME_MISMATCH',
            message: `Runtime mismatch: authorized as ${requestRuntime}, but active session belongs to ${activeSession.runtime}`,
            activeRuntime: activeSession.runtime
          }
        };
      }

      // 5. Verify lease is valid - FAIL-CLOSED: reject on any invalid/missing/ expired lease
      const leaseExpires = activeSession.lease_expires_at;
      const leaseExpiresMs = parseUnixMs(leaseExpires);

      if (leaseExpiresMs === null) {
        db.runPreparedStatement('rollbackTransaction', []);
        return {
          success: false,
          error: { code: 'INVALID_SESSION_LEASE', message: 'Runtime session has an invalid or missing lease timestamp' }
        };
      }

      if (leaseExpiresMs <= now) {
        db.runPreparedStatement('rollbackTransaction', []);
        return { success: false, error: { code: 'SESSION_EXPIRED', message: 'Session lease has expired' } };
      }

      // 6. Check if there's already an active execution for this session (prevent concurrent executions)
      const existingExecution = db.stmt.getExecutionRecordBySession.get(requestSessionId) as
        | { id: string; completed: number; expires_at: number }
        | undefined;

      if (existingExecution && existingExecution.completed === 0 && existingExecution.expires_at > now) {
        db.runPreparedStatement('rollbackTransaction', []);
        return { success: false, error: { code: 'EXECUTION_IN_PROGRESS', message: 'Another tool execution is already in progress for this session' } };
      }

      // 7. Insert execution record bound to exact session (atomic within transaction)
      db.stmt.insertExecutionRecord.run(executionId, requestSessionId, requestRuntime, now, expiresAt);

      // 8. Commit transaction
      db.runPreparedStatement('commitTransaction', []);

      // Return execution context
      return {
        success: true,
        context: {
          runtimeId: requestRuntime,
          sessionId: requestSessionId,
          executionId
        }
      };
    } catch (error) {
      // Rollback on any error (ignore rollback errors when DB is closed)
      try {
        db.runPreparedStatement('rollbackTransaction', []);
      } catch {
        // Ignore rollback errors when database is closed
      }
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to acquire execution permit'
        }
      };
    }
  }

  /**
   * Releases the execution permit (marks as completed)
   */
  async function releaseExecutionPermit(executionId: string): Promise<void> {
    try {
      db.stmt.completeExecutionRecord.run(executionId);
    } catch {
      // Ignore cleanup errors - permit will expire automatically
    }
  }

  /**
   * Main execution guard function that wraps MCP tool execution
   */
  async function executeWithGuard<T>(
    authContext: AuthContext,
    toolExecutor: RuntimeToolExecutor<T>
  ): Promise<ExecutionGuardResult<T>> {
    // Step 1: Acquire execution permit
    const permitResult = await acquireExecutionPermit(authContext);

    if (!permitResult.success || !permitResult.context) {
      return {
        success: false,
        error: permitResult.error || { code: 'UNKNOWN_ERROR', message: 'Failed to acquire execution permit' }
      };
    }

    const context = permitResult.context;

    try {
      // Step 2: Execute the MCP tool callback
      const result = await toolExecutor(context);

      // Step 3: Release permit on success
      await releaseExecutionPermit(context.executionId);

      return { success: true, result };
    } catch (error) {
      // Step 4: Release permit on error (finally block semantics)
      await releaseExecutionPermit(context.executionId);

      return {
        success: false,
        error: {
          code: 'TOOL_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Tool execution failed'
        }
      };
    }
  }

  return {
    executeWithGuard,
    acquireExecutionPermit,
    releaseExecutionPermit
  };
}

/**
 * Clean up expired execution records (can be called periodically)
 */
export function cleanupExpiredExecutionRecords(db: DatabaseInstance): number {
  const now = Date.now();
  try {
    const result = db.stmt.cleanupExpiredExecutionRecords.run(now);
    return (result as any).changes || 0;
  } catch {
    return 0;
  }
}