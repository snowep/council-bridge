// Database operations extracted for modularization
// Phase 7: Task Autonomy Levels, Execution Requests, Approvals, History

import { DatabaseInstance } from '../database.js';
import {
  AutonomyLevel,
  TaskAutonomyLevel,
  ExecutionRequest,
  ApprovalRequest,
  ExecutionHistory,
  CreateTaskAutonomyLevelInput,
  RequestExecutionInput,
  ApproveExecutionInput,
  GetExecutionRequestInput,
  ListExecutionRequestsInput,
  ListApprovalRequestsInput,
  GetExecutionHistoryInput,
  isAutonomyLevel,
  isExecutionStatus
} from './types.js';

// Task Autonomy Level Operations
export async function createTaskAutonomyLevel(
  db: DatabaseInstance,
  input: CreateTaskAutonomyLevelInput
): Promise<TaskAutonomyLevel> {
  const result = await db.runPreparedStatement(
    'createTaskAutonomyLevel',
    [input.task_type, input.autonomy_level, input.description || '']
  );

  return {
    task_type: input.task_type,
    autonomy_level: input.autonomy_level,
    description: input.description || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export async function getTaskAutonomyLevel(
  db: DatabaseInstance,
  taskType: string
): Promise<TaskAutonomyLevel | null> {
  const result = await db.query(
    'SELECT * FROM task_autonomy_levels WHERE task_type = ?',
    [taskType]
  );
  return result.length > 0 ? result[0] as TaskAutonomyLevel : null;
}

export async function listTaskAutonomyLevels(
  db: DatabaseInstance
): Promise<TaskAutonomyLevel[]> {
  const result = await db.query('SELECT * FROM task_autonomy_levels ORDER BY created_at DESC');
  return result as TaskAutonomyLevel[];
}

// Execution Request Operations
export async function requestExecution(
  db: DatabaseInstance,
  input: RequestExecutionInput,
  requestedByType: 'staff' | 'division' | 'founder',
  requestedById: string
): Promise<ExecutionRequest> {
  // Get autonomy level if not specified
  const level = input.autonomy_level ?? (await getTaskAutonomyLevel(db, input.task_id))?.autonomy_level ?? 1;

  if (!isAutonomyLevel(level)) {
    throw new Error(`Invalid autonomy level: ${level}`);
  }

  const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  // For Level 3, need founder approval - start approval request
  let approvalRequestId: string | undefined;
  let status: 'proposed' | 'approval_required' = 'proposed';

  if (level === 3) {
    approvalRequestId = `appr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    status = 'approval_required';

    await db.runPreparedStatement('createApprovalRequest', [
      approvalRequestId,
      executionId,
      requestedByType,
      requestedById,
      input.action_description,
      input.action_payload,
      'Approval required for Level 3 autonomous execution',
      'medium'
    ]);
  }

  const request: ExecutionRequest = {
    execution_id: executionId,
    task_id: input.task_id,
    requested_by_type: requestedByType,
    requested_by_id: requestedById,
    autonomy_level: level,
    action_description: input.action_description,
    action_payload: input.action_payload,
    status,
    approval_request_id: approvalRequestId,
    approval_id: undefined,
    permission_grants: [],
    error_message: undefined,
    result_payload: undefined,
    started_at: undefined,
    completed_at: undefined,
    created_at: now,
    updated_at: now
  };

  await db.runPreparedStatement('insertExecutionRequest', Object.values(request));
  return request;
}

export async function getExecutionRequest(
  db: DatabaseInstance,
  input: GetExecutionRequestInput
): Promise<ExecutionRequest | null> {
  const result = await db.query(
    'SELECT * FROM execution_requests WHERE execution_id = ?',
    [input.execution_id]
  );
  return result.length > 0 ? result[0] as ExecutionRequest : null;
}

export async function approveExecution(
  db: DatabaseInstance,
  input: ApproveExecutionInput,
  approvedByType: 'staff' | 'division' | 'founder',
  approvedById: string
): Promise<ExecutionRequest> {
  const existing = await getExecutionRequest(db, { execution_id: input.approval_request_id.replace('appr-', 'exec-') });
  if (!existing) {
    throw new Error('Execution request not found');
  }

  // Validation order matters: Level 3 check first
  if (existing.autonomy_level !== 3) {
    throw new Error('Only Level 3 executions require approval');
  }

  if (existing.status !== 'approval_required') {
    throw new Error(`Execution not in approval_required state (current: ${existing.status})`);
  }

  const now = new Date().toISOString();
  const newStatus = input.approved ? 'approved' : 'rejected';

  const updateResult = await db.runPreparedStatement('updateExecutionRequest', [
    input.approved ? '' : input.rejection_reason,
    newStatus,
    approvedByType,
    approvedById,
    now,
    existing.execution_id
  ]);

  // Record execution history
  await db.runPreparedStatement('insertExecutionHistory', [
    crypto.randomUUID(),
    existing.execution_id,
    existing.task_id,
    existing.requested_by_type,
    existing.requested_by_id,
    existing.autonomy_level,
    existing.action_description,
    existing.action_payload,
    'approval_required',
    newStatus,
    input.approved ? existing.approval_request_id : undefined,
    [],
    existing.result_payload,
    existing.error_message,
    input.approved ? approvedByType : undefined,
    input.approved ? approvedById : undefined,
    now,
    now
  ]);

  const updated = await getExecutionRequest(db, { execution_id: existing.execution_id });
  if (!updated) throw new Error('Execution request not found after update');
  return updated;
}

// Execution History Operations
export async function getExecutionHistory(
  db: DatabaseInstance,
  input: GetExecutionHistoryInput
): Promise<ExecutionHistory[]> {
  const result = await db.query(
    'SELECT * FROM execution_history WHERE execution_id = ? ORDER BY recorded_at',
    [input.execution_id]
  );
  return result as ExecutionHistory[];
}

// Listing operations
export async function listExecutionRequests(
  db: DatabaseInstance,
  input: ListExecutionRequestsInput
): Promise<{ requests: ExecutionRequest[]; total: number }> {
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (input.status) {
    whereClauses.push('status = ?');
    params.push(input.status);
  }
  if (input.autonomy_level !== undefined) {
    whereClauses.push('autonomy_level = ?');
    params.push(input.autonomy_level);
  }
  if (input.requested_by_type) {
    whereClauses.push('requested_by_type = ?');
    params.push(input.requested_by_type);
  }
  if (input.requested_by_id) {
    whereClauses.push('requested_by_id = ?');
    params.push(input.requested_by_id);
  }
  if (input.task_id) {
    whereClauses.push('task_id = ?');
    params.push(input.task_id);
  }

  const where = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const requests = await db.query(
    `SELECT * FROM execution_requests ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, input.limit, input.offset]
  );

  const countResult = await db.query(
    `SELECT COUNT(*) as count FROM execution_requests ${where}`,
    params
  );

  return {
    requests: requests as ExecutionRequest[],
    total: countResult[0]?.count || 0
  };
}

export async function listApprovalRequests(
  db: DatabaseInstance,
  input: ListApprovalRequestsInput
): Promise<{ requests: ApprovalRequest[]; total: number }> {
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (input.status) {
    whereClauses.push('status = ?');
    params.push(input.status);
  }
  if (input.requested_by_type) {
    whereClauses.push('requested_by_type = ?');
    params.push(input.requested_by_type);
  }
  if (input.requested_by_id) {
    whereClauses.push('requested_by_id = ?');
    params.push(input.requested_by_id);
  }

  const where = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const requests = await db.query(
    `SELECT * FROM approval_requests ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, input.limit, input.offset]
  );

  const countResult = await db.query(
    `SELECT COUNT(*) as count FROM approval_requests ${where}`,
    params
  );

  return {
    requests: requests as ApprovalRequest[],
    total: countResult[0]?.count || 0
  };
}

// Utility - will be injected at runtime
let crypto: typeof import('crypto');
export function setCryptoModule(cryptoModule: typeof import('crypto')) {
  crypto = cryptoModule;
}