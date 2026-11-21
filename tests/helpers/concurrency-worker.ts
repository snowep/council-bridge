// Concurrency Worker for Runtime Integration Tests
// This worker can be forked as a child process to perform independent runtime operations
// against a shared SQLite database file for concurrent testing.
//
// Usage: spawn this worker with the database path as argument
//   process.send() is used for IPC communication with the parent test

import { parentPort, workerData, execArgv } from 'worker_threads';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';

// Import the runtime lifecycle manager
import { RuntimeLifecycleManager, RuntimeConnectionState } from '../../src/runtime/lifecycle.js';
import { createDatabase, DatabaseInstance } from '../../src/database.js';

const LEASE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

type RuntimeType = 'claude' | 'hermes';

interface OperationResult {
  operation: string;
  success: boolean;
  sessionId?: string | null;
  runtime?: RuntimeType;
  error?: string;
  timestamp: number;
}

interface WorkerResult {
  results: OperationResult[];
  finalSessionId: string | null;
  finalRuntime: RuntimeType | null;
}

interface WorkerMessage {
  id: string;
  type: 'connect' | 'disconnect' | 'switch' | 'heartbeat' | 'getState' | 'recoverStale' | 'ping';
  payload?: any;
}

interface WorkerResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

// Worker process entry point
function runWorker(dbPath: string, workerId: string) {
  let db: DatabaseInstance;
  let lifecycle: RuntimeLifecycleManager;
  const results: OperationResult[] = [];
  let sessionId: string | null = null;
  let currentRuntime: RuntimeType | null = null;

  try {
    // Initialize database and lifecycle manager
    db = createDatabase(dbPath);
    lifecycle = new RuntimeLifecycleManager(db);
  } catch (error) {
    if (parentPort) {
      parentPort.postMessage({
        id: 'init-error',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      } as WorkerResponse);
    }
    process.exit(1);
  }

  // Get current state helper
  function getState(): RuntimeConnectionState {
    return lifecycle.getState();
  }

  // Process message handler
  function handleMessage(message: WorkerMessage): WorkerResponse {
    const response: WorkerResponse = { id: message.id, success: false };

    try {
      switch (message.type) {
        case 'connect': {
          const result = lifecycle.connect(message.payload);
          if (result.success) {
            sessionId = result.state?.sessionId || null;
            currentRuntime = result.state?.activeRuntime || null;
            results.push({
              operation: `connect:${message.payload.runtime}`,
              success: true,
              sessionId,
              runtime: message.payload.runtime,
              timestamp: Date.now(),
            });
          } else {
            results.push({
              operation: `connect:${message.payload.runtime}`,
              success: false,
              error: result.error,
              timestamp: Date.now(),
            });
          }
          response.success = result.success;
          response.result = result;
          break;
        }

        case 'disconnect': {
          if (!sessionId) {
            response.error = 'No active session to disconnect';
            break;
          }
          const result = lifecycle.disconnect({ sessionId });
          if (result.success) {
            sessionId = null;
            currentRuntime = null;
            results.push({ operation: 'disconnect', success: true, timestamp: Date.now() });
          } else {
            results.push({ operation: 'disconnect', success: false, error: result.error, timestamp: Date.now() });
          }
          response.success = result.success;
          response.result = result;
          break;
        }

        case 'switch': {
          const result = lifecycle.switch(message.payload);
          if (result.success) {
            sessionId = result.state?.sessionId || null;
            currentRuntime = result.state?.activeRuntime || null;
            results.push({
              operation: `switch:${message.payload.newRuntime}`,
              success: true,
              sessionId,
              runtime: message.payload.newRuntime,
              timestamp: Date.now(),
            });
          } else {
            results.push({
              operation: `switch:${message.payload.newRuntime}`,
              success: false,
              error: result.error,
              timestamp: Date.now(),
            });
          }
          response.success = result.success;
          response.result = result;
          break;
        }

        case 'heartbeat': {
          if (!sessionId) {
            response.error = 'No active session for heartbeat';
            break;
          }
          const result = lifecycle.heartbeat({ sessionId: message.payload.sessionId || sessionId });
          if (result.success) {
            results.push({ operation: 'heartbeat', success: true, sessionId, timestamp: Date.now() });
          } else {
            results.push({ operation: 'heartbeat', success: false, error: result.error, timestamp: Date.now() });
          }
          response.success = result.success;
          response.result = result;
          break;
        }

        case 'getState': {
          const state = lifecycle.getState();
          response.success = true;
          response.result = state;
          break;
        }

        case 'recoverStale': {
          const result = lifecycle.recoverStaleSessions();
          results.push({
            operation: 'recoverStale',
            success: result.errors.length === 0,
            error: result.errors.join(', ') || undefined,
            timestamp: Date.now(),
          });
          response.success = true;
          response.result = result;
          break;
        }

        case 'ping': {
          response.success = true;
          response.result = { pong: true };
          break;
        }

        default:
          response.error = `Unknown message type: ${message.type}`;
      }
    } catch (error) {
      response.success = false;
      response.error = error instanceof Error ? error.message : String(error);
    }

    return response;
  }

  // Handle uncaught errors
  process.on('uncaughtException', (error: Error) => {
    console.error(`Worker ${workerId} uncaught exception:`, error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any) => {
    console.error(`Worker ${workerId} unhandled rejection:`, reason);
    process.exit(1);
  });

  // Listen for messages if using worker_threads
  if (parentPort) {
    parentPort.on('message', (message: WorkerMessage) => {
      const response = handleMessage(message);
      if (response.id !== 'ping') {
        parentPort!.postMessage(response);
      }
    });

    // Signal ready
    parentPort.postMessage({ id: 'ready', type: 'ready', success: true, result: { workerId } } as WorkerResponse);
  } else {
    // For child_process.fork compatibility, use process.send
    process.on('message', (message: WorkerMessage) => {
      const response = handleMessage(message);
      if (process.send) {
        process.send(response);
      }
    });

    // Signal ready
    if (process.send) {
      process.send({ id: 'ready', type: 'ready', success: true, result: { workerId } });
    }
  }
}

// Entry point
const args = process.argv.slice(2);
const dbPath = args[0];
const workerId = args[1] || `worker-${process.pid}`;

if (!dbPath) {
  console.error('Usage: tsx concurrency-worker.ts <dbPath> [workerId]');
  process.exit(1);
}

runWorker(dbPath, workerId);