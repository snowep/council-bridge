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
  isExecutionStatus,
  MemoryOwnerType,
  MemoryEntry,
  CrossDivisionShare,
  Division,
  DivisionMember,
  StaffAgent,
  Task,
  Deliverable,
  Meeting,
  MemoryCategory,
  MemoryLinkType
} from './types.js';
import { z } from 'zod';

export interface OperationContext {
  owner_type: MemoryOwnerType;
  owner_id: string;
  runtime: 'claude' | 'hermes';
  permissions?: string[];
  founder_signed?: boolean;
}

export function requireAuthenticated(ctx: OperationContext | null | undefined): OperationContext {
  if (!ctx || !ctx.owner_type || !ctx.owner_id || !ctx.runtime) {
    throw new Error('Authentication required');
  }
  if (ctx.owner_type === 'founder' && ctx.owner_id !== 'founder') {
    throw new Error('Authorization denied');
  }
  return ctx;
}

function requireFounderContext(
  ctx: OperationContext | null | undefined,
  message = 'Founder authorization required'
): OperationContext {
  const identity = requireAuthenticated(ctx);
  if (!isFounder(identity)) throw new Error(message);
  return identity;
}

function getTaskForActor(
  db: DatabaseInstance,
  ctx: OperationContext,
  taskId: string
): Task {
  const task = db.query('SELECT * FROM tasks WHERE task_id = ?', [taskId])[0] as Task | undefined;
  if (!task) throw new Error(`Task '${taskId}' not found`);
  if (ctx.owner_type === 'founder') return task;

  if (ctx.owner_type === 'staff') {
    const staff = db.query('SELECT * FROM staff_agents WHERE staff_id = ?', [ctx.owner_id])[0] as StaffAgent | undefined;
    if (!staff || staff.status !== 'active') throw new Error('Authorization denied');
    let runtimes: string[];
    try {
      runtimes = JSON.parse(staff.runtime_instances);
    } catch {
      throw new Error('Authorization denied');
    }
    if (!runtimes.includes(ctx.runtime)) throw new Error('Authorization denied');

    if (task.assigned_to_type === 'staff' && task.assigned_to_id !== ctx.owner_id) {
      throw new Error('Staff can only request execution for their own tasks');
    }
    if (task.assigned_to_type === 'division') {
      const membership = db.query(
        'SELECT 1 FROM division_members WHERE division_id = ? AND staff_id = ?',
        [task.assigned_to_id, ctx.owner_id]
      );
      if (membership.length === 0) throw new Error('Authorization denied');
    }
    return task;
  }

  if (ctx.owner_type === 'division') {
    const division = db.query('SELECT division_id FROM divisions WHERE division_id = ?', [ctx.owner_id]);
    if (division.length === 0) throw new Error('Authorization denied');
    if ((task.assigned_to_type === 'division' && task.assigned_to_id === ctx.owner_id) ||
        (task.created_by_type === 'division_head' && task.created_by_id === ctx.owner_id)) return task;
    if (task.assigned_to_type === 'staff') {
      const staff = db.query(
        'SELECT 1 FROM staff_agents WHERE staff_id = ? AND division_id = ?',
        [task.assigned_to_id, ctx.owner_id]
      );
      if (staff.length > 0) return task;
    }
  }

  throw new Error('Authorization denied');
}

export function assertTaskAccess(
  db: DatabaseInstance,
  ctx: OperationContext,
  taskId: string
): Task {
  return getTaskForActor(db, requireAuthenticated(ctx), taskId);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return value == null ? fallback : value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toExecutionRequest(row: Record<string, any>): ExecutionRequest {
  return {
    execution_id: row.execution_id,
    task_id: row.task_id,
    requested_by_type: row.requested_by_type,
    requested_by_id: row.requested_by_id,
    autonomy_level: row.autonomy_level,
    action_description: row.action_description,
    action_payload: parseJson(row.action_payload, {}),
    status: row.status,
    approval_request_id: row.approval_request_id ?? undefined,
    approval_id: row.approval_id ?? undefined,
    permission_grants: parseJson(row.permission_grants, []),
    error_message: row.error_message ?? undefined,
    result_payload: row.result_payload == null ? undefined : parseJson(row.result_payload, {}),
    started_at: row.started_at ?? undefined,
    completed_at: row.completed_at ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  } as ExecutionRequest;
}

function getExecutionForActor(
  db: DatabaseInstance,
  ctx: OperationContext,
  executionId: string
): ExecutionRequest {
  const row = db.query('SELECT * FROM execution_requests WHERE execution_id = ?', [executionId])[0] as Record<string, any> | undefined;
  if (!row) throw new Error('Execution request not found');
  const request = toExecutionRequest(row);
  if (ctx.owner_type === 'founder') return request;
  const canAccess = request.requested_by_type === 'staff'
    ? ctx.owner_type === 'staff' && request.requested_by_id === ctx.owner_id
    : request.requested_by_type === 'division' &&
      isDivisionMember(ctx, request.requested_by_id, db);
  if (canAccess) return request;
  throw new Error('Access denied to execution request');
}

// --- Authorization Helper Functions ---

export function isFounder(ctx: { owner_type: MemoryOwnerType; owner_id: string }): boolean {
  return ctx.owner_type === 'founder';
}

export function isDivisionHead(ctx: { owner_type: MemoryOwnerType; owner_id: string }, divisionId: string): boolean {
  if (ctx.owner_type !== 'division') return false;
  return ctx.owner_id === divisionId;
}

export function isDivisionMember(
  ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
  divisionId: string,
  db: DatabaseInstance
): boolean {
  if (ctx.owner_type === 'founder') return true;
  if (ctx.owner_type === 'division') return ctx.owner_id === divisionId;
  if (ctx.owner_type === 'staff') {
    const members = db.query('SELECT staff_id FROM division_members WHERE division_id = ?', [divisionId]) as DivisionMember[];
    return members.some((m) => m.staff_id === ctx.owner_id);
  }
  return false;
}

export function isStaffAgent(
  ctx: { owner_type: MemoryOwnerType; owner_id: string },
  staffId: string
): boolean {
  if (ctx.owner_type === 'founder') return true;
  return ctx.owner_type === 'staff' && ctx.owner_id === staffId;
}

export function validateDivisionHead(staffId: string, divisionId: string, db: DatabaseInstance): boolean {
  const division = db.query('SELECT head_staff_id FROM divisions WHERE division_id = ?', [divisionId])[0] as Division | undefined;
  return division?.head_staff_id === staffId;
}

// --- Memory Access Control ---

export function checkMemoryAccess(
  ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
  memory: MemoryEntry,
  db: DatabaseInstance
): boolean {
  if (ctx.owner_type === 'founder') return true;

  const publicCategories = [
    'council_shared', 'decision_resolution', 'lesson_learned',
    'business_context', 'idea_proposal', 'research_evidence', 'unresolved_question'
  ];

  if (publicCategories.includes(memory.category)) return true;

  if (memory.category === 'individual_persona' &&
      ctx.owner_type === 'seat' && memory.owner_id === ctx.owner_id) return true;

  if (memory.category === 'division_private' &&
      ctx.owner_type === 'division' && memory.owner_id === ctx.owner_id) return true;

  if (memory.category === 'staff_private' &&
      ctx.owner_type === 'staff' && memory.owner_id === ctx.owner_id) return true;

  if (memory.category === 'meeting_history' && ctx.owner_type === 'seat' && memory.meeting_id) {
    const participants = db.query(
      'SELECT DISTINCT seat_id FROM primary_ideas WHERE meeting_id = ?',
      [memory.meeting_id]
    ) as { seat_id: string }[];
    return participants.some(p => p.seat_id === ctx.owner_id);
  }

  if (memory.category === 'division_shared' &&
      ctx.owner_type === 'division' && memory.division_id === ctx.owner_id) return true;

  if (memory.category === 'cross_division' && memory.division_id) {
    if (memory.owner_type === ctx.owner_type && memory.owner_id === ctx.owner_id) return true;
    const shares = db.query('SELECT division_id FROM cross_division_shares WHERE memory_id = ? AND revoked_at IS NULL', [memory.memory_id]) as CrossDivisionShare[];
    const targetDivisionId = ctx.owner_type === 'division' ? ctx.owner_id : memory.division_id;
    return shares.some(s => s.division_id === targetDivisionId);
  }

  if (memory.category === 'task_history') {
    if (!memory.task_id) return false;
    try {
      getTaskForActor(db, requireAuthenticated(ctx), memory.task_id);
      return true;
    } catch (error) {
      if (error instanceof Error && (error.message === 'Authorization denied' ||
          error.message === `Task '${memory.task_id}' not found` ||
          error.message === 'Authentication required')) return false;
      throw error;
    }
  }

  return false;
}

export function buildPrivacyFilter(
  ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }
): { sql: string; values: any[] } {
  const values: any[] = [];
  let sql = '';

  if (ctx.owner_type === 'founder') {
    sql = '1=1';
  } else if (ctx.owner_type === 'seat') {
    sql = `(
      m.category IN ('council_shared', 'decision_resolution', 'lesson_learned', 'business_context', 'idea_proposal', 'research_evidence', 'unresolved_question')
      OR (m.owner_type = 'seat' AND m.owner_id = ? AND m.category = 'individual_persona')
      OR (m.category = 'meeting_history' AND m.meeting_id IN (
        SELECT DISTINCT meeting_id FROM primary_ideas WHERE seat_id = ?
      ))
      OR (m.category = 'task_history' AND m.task_id IN (
        SELECT task_id FROM tasks WHERE (assigned_to_type = 'seat' AND assigned_to_id = ?) OR (created_by_type = 'seat' AND created_by_id = ?)
      ))
    )`;
    values.push(ctx.owner_id, ctx.owner_id, ctx.owner_id, ctx.owner_id);
  } else if (ctx.owner_type === 'division') {
    sql = `(
      m.category IN ('council_shared', 'decision_resolution', 'lesson_learned', 'business_context', 'idea_proposal', 'research_evidence', 'unresolved_question')
      OR (m.owner_type = 'division' AND m.owner_id = ? AND m.category IN ('division_shared', 'division_private'))
      OR (m.category = 'division_shared' AND m.division_id = ?)
      OR (m.category = 'cross_division' AND m.division_id IN (
        SELECT division_id FROM cross_division_shares WHERE memory_id = m.memory_id AND revoked_at IS NULL
      ))
      OR (m.category = 'task_history' AND m.task_id IN (
        SELECT task_id FROM tasks WHERE (assigned_to_type = 'division' AND assigned_to_id = ?) OR (created_by_type = 'division_head' AND created_by_id = ?)
      ))
    )`;
    values.push(ctx.owner_id, ctx.owner_id, ctx.owner_id, ctx.owner_id);
  } else if (ctx.owner_type === 'staff') {
    sql = `(
      m.category IN ('council_shared', 'decision_resolution', 'lesson_learned', 'business_context', 'idea_proposal', 'research_evidence', 'unresolved_question')
      OR (m.owner_type = 'staff' AND m.owner_id = ? AND m.category = 'staff_private')
      OR (m.category = 'division_shared' AND m.division_id IN (
        SELECT division_id FROM division_members WHERE staff_id = ?
      ))
      OR (m.category = 'cross_division' AND m.division_id IN (
        SELECT division_id FROM cross_division_shares WHERE memory_id = m.memory_id AND revoked_at IS NULL
      ))
      OR (m.category = 'task_history' AND m.task_id IN (
        SELECT task_id FROM tasks WHERE assigned_to_type = 'staff' AND assigned_to_id = ?
      ))
    )`;
    values.push(ctx.owner_id, ctx.owner_id, ctx.owner_id);
  }

  return { sql, values };
}

// --- Transaction Support ---

export function beginTransaction(db: DatabaseInstance): void {
  db.runPreparedStatement('beginTransaction', []);
}

export function commitTransaction(db: DatabaseInstance): void {
  db.runPreparedStatement('commitTransaction', []);
}

export function rollbackTransaction(db: DatabaseInstance): void {
  db.runPreparedStatement('rollbackTransaction', []);
}

// --- Type guards for context validation ---

export function requireFounder(ctx: { owner_type: MemoryOwnerType; owner_id: string }): void {
  if (!isFounder(ctx)) {
    throw new Error('Operation requires Founder authorization');
  }
}

export function requireDivisionHead(ctx: { owner_type: MemoryOwnerType; owner_id: string }, divisionId: string): void {
  if (!isDivisionHead(ctx, divisionId) && !isFounder(ctx)) {
    throw new Error('Operation requires Division Head authorization');
  }
}

export function requireDivisionMember(
  ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
  divisionId: string,
  db: DatabaseInstance
): void {
  if (!isDivisionMember(ctx, divisionId, db) && !isFounder(ctx)) {
    throw new Error('Operation requires Division membership');
  }
}

export function requireStaffAgent(ctx: { owner_type: MemoryOwnerType; owner_id: string }, staffId: string): void {
  if (!isStaffAgent(ctx, staffId) && !isFounder(ctx)) {
    throw new Error('Operation requires Staff Agent authorization');
  }
}

// Task Autonomy Level Operations
export function createTaskAutonomyLevel(
  db: DatabaseInstance,
  ctx: OperationContext,
  input: CreateTaskAutonomyLevelInput
): TaskAutonomyLevel {
  const identity = requireAuthenticated(ctx);
  if (!isFounder(identity)) throw new Error('Only Founder can define task autonomy levels');
  if (getTaskAutonomyLevel(db, input.task_type)) {
    throw new Error(`Task autonomy level for '${input.task_type}' already exists`);
  }
  db.runPreparedStatement(
    'insertTaskAutonomyLevel',
    [input.task_type, input.autonomy_level, input.description || '']
  );
  return db.query('SELECT * FROM task_autonomy_levels WHERE task_type = ?', [input.task_type])[0] as TaskAutonomyLevel;
}

export function getTaskAutonomyLevel(
  db: DatabaseInstance,
  taskType: string
): TaskAutonomyLevel | undefined {
  const result = db.query(
    'SELECT * FROM task_autonomy_levels WHERE task_type = ?',
    [taskType]
  );
  return result.length > 0 ? result[0] as TaskAutonomyLevel : undefined;
}

export function updateTaskAutonomyLevel(
  db: DatabaseInstance,
  ctx: OperationContext,
  taskType: string,
  autonomyLevel: AutonomyLevel,
  description?: string
): TaskAutonomyLevel {
  requireFounderContext(ctx);
  const existing = getTaskAutonomyLevel(db, taskType);
  if (!existing) throw new Error(`Task autonomy level for '${taskType}' not found`);
  db.db.prepare(
    'UPDATE task_autonomy_levels SET autonomy_level = ?, description = ?, updated_at = datetime(?) WHERE task_type = ?'
  ).run(autonomyLevel, description ?? existing.description, new Date().toISOString(), taskType);
  const updated = getTaskAutonomyLevel(db, taskType);
  if (!updated) throw new Error(`Task autonomy level for '${taskType}' not found after update`);
  return updated;
}
export function listTaskAutonomyLevels(
  db: DatabaseInstance
): TaskAutonomyLevel[] {
  const result = db.query('SELECT * FROM task_autonomy_levels ORDER BY created_at DESC');
  return result as TaskAutonomyLevel[];
}

// Execution Request Operations
export function requestExecution(
  db: DatabaseInstance,
  ctx: OperationContext,
  input: RequestExecutionInput
): ExecutionRequest {
  const identity = requireAuthenticated(ctx);
  const task = getTaskForActor(db, identity, input.task_id);
  const level = input.autonomy_level ??
    getTaskAutonomyLevel(db, task.title)?.autonomy_level ?? 1;

  if (!isAutonomyLevel(level)) {
    throw new Error(`Invalid autonomy level: ${level}`);
  }

  const executionId = db.generateId();
  const now = new Date().toISOString();
  let approvalRequestId: string | undefined;
  const status: ExecutionRequest['status'] =
    level === 1 ? 'queued' : level === 2 ? 'permission_check' : 'approval_required';
  if (level === 3) approvalRequestId = db.generateId();

  const request: ExecutionRequest = {
    execution_id: executionId,
    task_id: input.task_id,
    requested_by_type: identity.owner_type as 'staff' | 'division' | 'founder',
    requested_by_id: identity.owner_id,
    autonomy_level: level,
    action_description: input.action_description,
    action_payload: input.action_payload ?? {},
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

  db.runPreparedStatement('beginTransaction', []);
  try {
    db.runPreparedStatement('insertExecutionRequest', [
      request.execution_id, request.task_id, request.requested_by_type,
      request.requested_by_id, request.autonomy_level, request.action_description,
      JSON.stringify(request.action_payload), request.status, approvalRequestId ?? null,
      null, JSON.stringify(request.permission_grants), null, null, null, null,
    ]);

    if (approvalRequestId) {
      db.runPreparedStatement('insertApprovalRequest', [
        approvalRequestId, executionId, request.requested_by_type,
        request.requested_by_id, request.action_description,
        JSON.stringify(request.action_payload),
        'Approval required for Level 3 autonomous execution', 'medium',
        null, 'pending', null, null, null, null,
      ]);
    }

    db.runPreparedStatement('insertExecutionHistory', [
      db.generateId(), executionId, request.task_id, request.requested_by_type,
      request.requested_by_id, request.autonomy_level, request.action_description,
      JSON.stringify(request.action_payload), 'proposed', request.status,
      approvalRequestId ?? null, JSON.stringify(request.permission_grants),
      null, null, request.requested_by_type, request.requested_by_id, null, null,
    ]);
    db.runPreparedStatement('commitTransaction', []);
  } catch (error) {
    db.runPreparedStatement('rollbackTransaction', []);
    throw error;
  }

  return request;
}

export function getExecutionRequest(
  db: DatabaseInstance,
  ctx: OperationContext,
  input: GetExecutionRequestInput
): ExecutionRequest {
  return getExecutionForActor(db, requireAuthenticated(ctx), input.execution_id);
}

export function approveExecution(
  db: DatabaseInstance,
  ctx: OperationContext,
  input: ApproveExecutionInput,
): { success: boolean; approval_request_id: string; status: string; execution_id?: string } {
  const identity = requireFounderContext(ctx, 'Only Founder can approve execution requests');
  const approval = db.query(
    'SELECT * FROM approval_requests WHERE approval_request_id = ?',
    [input.approval_request_id]
  )[0] as ApprovalRequest | undefined;
  if (!approval) throw new Error(`Approval request '${input.approval_request_id}' not found`);
  const existing = getExecutionForActor(db, identity, approval.execution_id);
  if (existing.autonomy_level !== 3) {
    throw new Error('Only Level 3 executions require approval');
  }
  if (existing.status !== 'approval_required' || approval.status !== 'pending') {
    throw new Error(`Execution not in approval_required state (current: ${existing.status})`);
  }
  if (existing.requested_by_type === identity.owner_type && existing.requested_by_id === identity.owner_id) {
    throw new Error('Founder cannot approve their own execution request');
  }
  const now = new Date().toISOString();
  const newStatus = input.approved ? 'approved' : 'rejected';
  db.runPreparedStatement('beginTransaction', []);
  try {
    db.runPreparedStatement('updateExecutionRequest', [
      existing.task_id, existing.requested_by_type, existing.requested_by_id,
      existing.autonomy_level, existing.action_description, JSON.stringify(existing.action_payload),
      newStatus, existing.approval_request_id ?? null, existing.approval_id ?? null,
      JSON.stringify(existing.permission_grants), input.approved ? null : input.rejection_reason ?? null,
      existing.result_payload == null ? null : JSON.stringify(existing.result_payload),
      existing.started_at ?? null, existing.completed_at ?? null, existing.execution_id,
    ]);
    db.runPreparedStatement('updateApprovalRequest', [
      approval.execution_id, approval.requested_by_type, approval.requested_by_id,
      approval.action_description, JSON.stringify(approval.action_payload),
      approval.justification, approval.priority, approval.deadline ?? null, newStatus,
      identity.owner_type, identity.owner_id, now,
      input.approved ? null : input.rejection_reason ?? null, approval.approval_request_id,
    ]);
    db.runPreparedStatement('insertExecutionHistory', [
      db.generateId(), existing.execution_id, existing.task_id, existing.requested_by_type,
      existing.requested_by_id, existing.autonomy_level, existing.action_description,
      JSON.stringify(existing.action_payload), 'approval_required', newStatus,
      approval.approval_request_id, JSON.stringify(existing.permission_grants),
      existing.result_payload == null ? null : JSON.stringify(existing.result_payload),
      input.approved ? null : input.rejection_reason ?? null, identity.owner_type,
      identity.owner_id, existing.started_at ?? null, now,
    ]);
    db.runPreparedStatement('commitTransaction', []);
  } catch (error) {
    db.runPreparedStatement('rollbackTransaction', []);
    throw error;
  }
  return {
    success: true,
    approval_request_id: approval.approval_request_id,
    status: newStatus,
    execution_id: existing.execution_id,
  };
}

// Execution History Operations
export function getExecutionHistory(
  db: DatabaseInstance,
  ctx: OperationContext,
  input: GetExecutionHistoryInput
): ExecutionHistory[] {
  getExecutionForActor(db, requireAuthenticated(ctx), input.execution_id);
  return db.query(
    'SELECT * FROM execution_history WHERE execution_id = ? ORDER BY recorded_at',
    [input.execution_id]
  ).map((row: Record<string, any>): ExecutionHistory => ({
    history_id: row.history_id,
    execution_id: row.execution_id,
    task_id: row.task_id,
    requested_by_type: row.requested_by_type,
    requested_by_id: row.requested_by_id,
    autonomy_level: row.autonomy_level,
    action_description: row.action_description,
    action_payload: parseJson(row.action_payload, {}),
    status_before: row.status_before,
    status_after: row.status_after,
    approval_reference: row.approval_reference ?? undefined,
    permission_grants: parseJson(row.permission_grants, []),
    result_payload: row.result_payload == null ? undefined : parseJson(row.result_payload, {}),
    error_message: row.error_message ?? undefined,
    executed_by_type: row.executed_by_type ?? undefined,
    executed_by_id: row.executed_by_id ?? undefined,
    started_at: row.started_at ?? undefined,
    completed_at: row.completed_at ?? undefined,
    recorded_at: row.recorded_at,
  }));
}

// Listing operations
export function listExecutionRequests(
  db: DatabaseInstance,
  ctx: OperationContext,
  input: ListExecutionRequestsInput
): ExecutionRequest[] {
  const identity = requireAuthenticated(ctx);
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

  const rows = db.query(
    `SELECT * FROM execution_requests ${where} ORDER BY created_at DESC`,
    params
  ) as Record<string, any>[];
  const visible = rows.map(toExecutionRequest).filter((request) => {
    try {
      getExecutionForActor(db, identity, request.execution_id);
      return true;
    } catch (error) {
      if (error instanceof Error &&
          (error.message === 'Execution request not found' || error.message === 'Access denied to execution request')) return false;
      throw error;
    }
  });
  return visible.slice(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 50));
}

export function listApprovalRequests(
  db: DatabaseInstance,
  ctx: OperationContext,
  input: ListApprovalRequestsInput
): ApprovalRequest[] {
  requireFounderContext(ctx, 'Only Founder can list approval requests');
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

  const requests = db.query(
    `SELECT * FROM approval_requests ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, input.limit ?? 50, input.offset ?? 0]
  ) as Record<string, any>[];
  return requests.map((row) => ({
    ...row,
    action_payload: parseJson(row.action_payload, {}),
  })) as ApprovalRequest[];
}

function writeExecutionHistory(
  db: DatabaseInstance,
  request: ExecutionRequest,
  statusBefore: string,
  statusAfter: string,
  options: {
    resultPayload?: Record<string, any>;
    errorMessage?: string;
    actor?: OperationContext;
    startedAt?: string;
    completedAt?: string;
  } = {}
): void {
  db.runPreparedStatement('insertExecutionHistory', [
    db.generateId(), request.execution_id, request.task_id, request.requested_by_type,
    request.requested_by_id, request.autonomy_level, request.action_description,
    JSON.stringify(request.action_payload), statusBefore, statusAfter,
    request.approval_request_id ?? null, JSON.stringify(request.permission_grants),
    options.resultPayload == null ? null : JSON.stringify(options.resultPayload),
    options.errorMessage ?? null, options.actor?.owner_type ?? null,
    options.actor?.owner_id ?? null, options.startedAt ?? null, options.completedAt ?? null,
  ]);
}

export function executeExecutionRequest(
  db: DatabaseInstance,
  ctx: OperationContext,
  executionId: string,
  resultPayload: Record<string, any> = {}
): ExecutionRequest {
  const identity = requireAuthenticated(ctx);
  const existing = getExecutionForActor(db, identity, executionId);
  const isRequester = existing.requested_by_type === identity.owner_type &&
    existing.requested_by_id === identity.owner_id;
  if (identity.owner_type !== 'founder' && !isRequester) {
    throw new Error('Only the requester or Founder can execute this request');
  }
  if (existing.autonomy_level === 3 && existing.status !== 'approved') {
    throw new Error('Level 3 execution requires Founder approval');
  }
  if (existing.status !== 'queued' && existing.status !== 'approved') {
    throw new Error(`Cannot execute execution with status: ${existing.status}`);
  }

  const now = new Date().toISOString();
  const executionResult = { success: true, ...resultPayload };
  db.runPreparedStatement('beginTransaction', []);
  try {
    db.runPreparedStatement('updateExecutionRequest', [
      existing.task_id, existing.requested_by_type, existing.requested_by_id,
      existing.autonomy_level, existing.action_description, JSON.stringify(existing.action_payload),
      'running', existing.approval_request_id ?? null, existing.approval_id ?? null,
      JSON.stringify(existing.permission_grants), null,
      existing.result_payload == null ? null : JSON.stringify(existing.result_payload),
      now, null, executionId,
    ]);
    writeExecutionHistory(db, existing, existing.status, 'running', { actor: identity, startedAt: now });
    db.runPreparedStatement('updateExecutionRequest', [
      existing.task_id, existing.requested_by_type, existing.requested_by_id,
      existing.autonomy_level, existing.action_description, JSON.stringify(existing.action_payload),
      'completed', existing.approval_request_id ?? null, existing.approval_id ?? null,
      JSON.stringify(existing.permission_grants), null, JSON.stringify(executionResult),
      now, now, executionId,
    ]);
    writeExecutionHistory(db, existing, 'running', 'completed', {
      resultPayload: executionResult, actor: identity, startedAt: now, completedAt: now,
    });
    db.runPreparedStatement('commitTransaction', []);
  } catch (error) {
    db.runPreparedStatement('rollbackTransaction', []);
    throw error;
  }

  return getExecutionForActor(db, identity, executionId);
}

export function cancelExecutionRequest(
  db: DatabaseInstance,
  ctx: OperationContext,
  executionId: string,
  errorMessage: string = 'Cancelled by user'
): ExecutionRequest {
  const identity = requireAuthenticated(ctx);
  const existing = getExecutionForActor(db, identity, executionId);
  const isAuthorizedRequester = existing.requested_by_type === 'staff'
    ? identity.owner_type === 'staff' && existing.requested_by_id === identity.owner_id
    : identity.owner_type === 'division' && existing.requested_by_id === identity.owner_id;
  if (identity.owner_type !== 'founder' && !isAuthorizedRequester) {
    throw new Error('Only the requester or Founder can cancel execution');
  }
  if (['completed', 'failed', 'cancelled'].includes(existing.status)) {
    throw new Error(`Cannot cancel execution with status: ${existing.status}`);
  }

  const now = new Date().toISOString();
  db.runPreparedStatement('beginTransaction', []);
  try {
    db.runPreparedStatement('updateExecutionRequest', [
      existing.task_id, existing.requested_by_type, existing.requested_by_id,
      existing.autonomy_level, existing.action_description, JSON.stringify(existing.action_payload),
      'cancelled', existing.approval_request_id ?? null, existing.approval_id ?? null,
      JSON.stringify(existing.permission_grants), errorMessage,
      existing.result_payload == null ? null : JSON.stringify(existing.result_payload),
      existing.started_at ?? null, now, executionId,
    ]);
    writeExecutionHistory(db, existing, existing.status, 'cancelled', {
      errorMessage, actor: identity, startedAt: existing.started_at, completedAt: now,
    });
    db.runPreparedStatement('commitTransaction', []);
  } catch (error) {
    db.runPreparedStatement('rollbackTransaction', []);
    throw error;
  }

  return getExecutionForActor(db, identity, executionId);
}

export function setCryptoModule(cryptoModule: typeof import('crypto')) {
  void cryptoModule;
}

