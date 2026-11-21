// Simple worker for runtime concurrency tests (CommonJS version)
// Used with child_process.fork for cross-process testing
const path = require('path');
const { RuntimeLifecycleManager } = require(path.join(__dirname, '..', 'src', 'runtime', 'lifecycle.js'));
const { createDatabase } = require(path.join(__dirname, '..', 'src', 'database.js'));

let db = null;
let lifecycle = null;
let sessionId = null;
let currentRuntime = null;

function initialize(dbPath) {
  db = createDatabase(dbPath);
  lifecycle = new RuntimeLifecycleManager(db);
}

function sendReady() {
  if (process.send) {
    process.send({ id: 'ready', type: 'ready', success: true, result: { workerId: `worker-${process.pid}` } });
  }
}

process.on('message', (msg) => {
  const response = { id: msg.id, success: false };

  try {
    switch (msg.type) {
      case 'init':
        initialize(msg.payload.dbPath);
        response.success = true;
        response.result = { initialized: true };
        sendReady();
        break;

      case 'connect': {
        const result = lifecycle.connect(msg.payload);
        response.success = result.success;
        response.result = result;
        if (result.success) {
          sessionId = result.state?.sessionId || null;
          currentRuntime = result.state?.activeRuntime || null;
        }
        break;
      }

      case 'disconnect': {
        if (!sessionId) {
          response.error = 'No active session to disconnect';
          break;
        }
        const result = lifecycle.disconnect({ sessionId });
        response.success = result.success;
        response.result = result;
        if (result.success) {
          sessionId = null;
          currentRuntime = null;
        }
        break;
      }

      case 'switch': {
        const result = lifecycle.switch(msg.payload);
        response.success = result.success;
        response.result = result;
        if (result.success) {
          sessionId = result.state?.sessionId || null;
          currentRuntime = result.state?.activeRuntime || null;
        }
        break;
      }

      case 'heartbeat': {
        if (!sessionId) {
          response.error = 'No active session for heartbeat';
          break;
        }
        const result = lifecycle.heartbeat({ sessionId: msg.payload.sessionId || sessionId });
        response.success = result.success;
        response.result = result;
        break;
      }

      case 'recoverStale': {
        const result = lifecycle.recoverStaleSessions();
        response.success = true;
        response.result = result;
        break;
      }

      case 'getState': {
        const state = lifecycle.getState();
        response.success = true;
        response.result = state;
        break;
      }

      case 'ping': {
        response.success = true;
        response.result = { pong: true };
        break;
      }

      default:
        response.error = 'Unknown type: ' + msg.type;
    }
  } catch (e) {
    response.error = e.message;
  }

  process.send(response);
});

// Send ready signal if not already sent via init
sendReady();