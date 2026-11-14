// Task Delegation Service - Phase 9 Batch 3
// Delegation functionality extending basic task management

import { DatabaseInstance } from '../database.js';
import { Task, MemoryOwnerType } from './types.js';
import { OperationContext, requireAuthenticated, requireFounder } from './operations.js';
import { createMemory } from './memory.js';
import { randomUUID } from 'node:crypto';

// Task statuses (matching existing TaskSchema)
export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled';

// Input for delegating a task
export interface DelegateTaskInput {
  task_id: string;
  delegatee_type: 'staff' | 'division';
  delegatee_id: string;
  reason?: string;
  pattern?: 'direct' | 'subtask' | 'parallel' | 'sequential';
}

// Input for accepting a delegated task
export interface AcceptDelegationInput {
  task_id: string;
}

// Input for rejecting a delegated task
export interface RejectDelegationInput {
  task_id: string;
  reason?: string;
}

// Input for submitting a deliverable
export interface SubmitDeliverableInput {
  task_id: string;
  content: string;
  quality_score?: number;
  file_references?: string[];
  task_relationships?: string[];
}

// Input for reviewing a deliverable
export interface ReviewDeliverableInput {
  deliverable_id: string;
  status: 'accepted' | 'rejected' | 'revision_requested';
  quality_score?: number;
  comments?: string;
}

// Helper function to generate unique IDs
function uniqueId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

// Get task by ID with authorization check
export function getDelegationTaskById(db: DatabaseInstance, ctx: OperationContext | null, taskId: string): Task {
  const task = db.query('SELECT * FROM tasks WHERE task_id = ?', [taskId]);
  if (task.length === 0) {
    throw new Error(`Task '${taskId}' not found`);
  }

  const taskRecord = task[0] as Task;

  // If no context, just return the task (for internal use)
  if (!ctx) return taskRecord;

  const identity = requireAuthenticated(ctx);

  // Founder has full access
  if (identity.owner_type === 'founder') return taskRecord;

  // Staff can access their assigned tasks
  if (identity.owner_type === 'staff') {
    if (taskRecord.assigned_to_type === 'staff' && taskRecord.assigned_to_id === identity.owner_id) {
      return taskRecord;
    }
    if (taskRecord.assigned_to_type === 'division') {
      const membership = db.query(
        'SELECT 1 FROM division_members WHERE staff_id = ? AND division_id = ?',
        [identity.owner_id, taskRecord.assigned_to_id]
      );
      if (membership.length > 0) return taskRecord;
    }
    // Check if created by this staff member (as division head)
    const division = db.query(
      'SELECT division_id FROM divisions WHERE head_staff_id = ?',
      [identity.owner_id]
    );
    if (division.length > 0 && taskRecord.assigned_to_type === 'division' && taskRecord.assigned_to_id === division[0].division_id) {
      return taskRecord;
    }
  }

  // Division can access their division tasks
  if (identity.owner_type === 'division') {
    if (taskRecord.assigned_to_type === 'division' && taskRecord.assigned_to_id === identity.owner_id) {
      return taskRecord;
    }
  }

  throw new Error('Authorization denied');
}

// Delegate a task to another agent
export function delegateTask(db: DatabaseInstance, ctx: OperationContext, input: DelegateTaskInput): Task {
  const identity = requireAuthenticated(ctx);

  // Get the original task
  const originalTask = getDelegationTaskById(db, null, input.task_id);

  // Authorization check: only creator (staff or division_head) or founder can delegate
  if (identity.owner_type === 'founder') {
    // Founder can delegate any task
  } else if (originalTask.created_by_type === 'founder') {
    // Only founders created tasks with type 'founder'
    throw new Error('Only the task creator or Founder can delegate this task');
  } else if (originalTask.created_by_type === 'council') {
    if (originalTask.created_by_id !== identity.owner_id) {
      throw new Error('Only the task creator or Founder can delegate this task');
    }
  } else if (originalTask.created_by_type === 'division_head') {
    if (originalTask.created_by_id !== identity.owner_id) {
      throw new Error('Only the task creator or Founder can delegate this task');
    }
  }

  // Cannot delegate to yourself (if delegatee is staff and same as delegator)
  // Founder delegating to 'founder' would be self-delegation check
  if (input.delegatee_type === 'staff' && input.delegatee_id === identity.owner_id) {
    throw new Error('Cannot delegate task to yourself');
  }

  // Validate delegatee exists and is active
  if (input.delegatee_type === 'division') {
    const division = db.query('SELECT * FROM divisions WHERE division_id = ?', [input.delegatee_id]);
    if (division.length === 0) {
      throw new Error(`Division '${input.delegatee_id}' not found`);
    }
  } else if (input.delegatee_type === 'staff') {
    const staff = db.query('SELECT * FROM staff_agents WHERE staff_id = ?', [input.delegatee_id]);
    if (staff.length === 0) {
      throw new Error(`Staff agent '${input.delegatee_id}' not found`);
    }
    if ((staff[0] as any).status !== 'active') {
      throw new Error('Cannot delegate to inactive staff agent');
    }
    // Check division membership if original task is division-bound
    if (originalTask.assigned_to_type === 'division') {
      const membership = db.query(
        'SELECT 1 FROM division_members WHERE staff_id = ? AND division_id = ?',
        [input.delegatee_id, originalTask.assigned_to_id]
      );
      if (membership.length === 0) {
        throw new Error('Delegatee is not a member of the source division');
      }
    }
  }

  // Create delegated task as a subtask
  const subTaskId = uniqueId('task');
  const now = new Date().toISOString();

  // Determine creator type for the delegated task
  const delegatedTaskCreator = identity.owner_type === 'founder'
    ? { type: 'founder' as const, id: 'founder' }
    : identity.owner_type === 'staff'
      ? { type: 'division_head' as const, id: identity.owner_id }
      : { type: 'council' as const, id: identity.owner_id };

  db.runPreparedStatement('insertTask', [
    subTaskId,
    `[Delegated] ${originalTask.title}`,
    input.reason ? `${originalTask.description}\n\nDelegation reason: ${input.reason}` : originalTask.description,
    input.delegatee_type,
    input.delegatee_id,
    delegatedTaskCreator.type,
    delegatedTaskCreator.id,
    'pending',
    'medium',
    0,
    null,
    null,
    now,
    now,
    JSON.stringify([input.task_id]), // dependencies
    null
    // Note: parent_task_id, delegator_type, delegator_id, delegation_chain not in schema yet
  ]);

  // Update original task status to in_progress
  db.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE task_id = ?').run(
    'in_progress', now, input.task_id
  );

  // Create audit memory entry
  const memoryId = uniqueId('mem');
  createMemory(db, {
    memory_id: memoryId,
    owner_type: identity.owner_type as MemoryOwnerType,
    owner_id: identity.owner_id,
    category: 'task_history',
    memory_type: 'delegation_record',
    title: `Task Delegated: ${originalTask.title}`,
    content: JSON.stringify({
      action: 'delegate_task',
      parent_task_id: input.task_id,
      child_task_id: subTaskId,
      delegatee_type: input.delegatee_type,
      delegatee_id: input.delegatee_id,
      delegator_type: identity.owner_type,
      delegator_id: identity.owner_id,
      reason: input.reason,
      pattern: input.pattern || 'direct',
      delegated_at: now
    }),
    tags: ['task', 'delegation', input.task_id],
    confidence: 1.0
  });

  const result = db.query('SELECT * FROM tasks WHERE task_id = ?', [subTaskId]);
  return result[0] as Task;
}

// Accept a delegated task
export function acceptDelegation(db: DatabaseInstance, ctx: OperationContext, input: AcceptDelegationInput): Task {
  const identity = requireAuthenticated(ctx);

  const task = getDelegationTaskById(db, null, input.task_id);

  // Verify this is a delegated task (has parent in dependencies)
  let deps: string[] = [];
  try {
    deps = JSON.parse(task.dependencies || '[]');
  } catch {
    deps = [];
  }
  if (deps.length === 0) {
    throw new Error('This task is not a delegated task');
  }

  // Verify assigned to this agent
  if (task.assigned_to_type !== identity.owner_type) {
    throw new Error('This task is not assigned to you');
  }

  if (task.assigned_to_type === 'staff' && task.assigned_to_id !== identity.owner_id) {
    throw new Error('This task is not assigned to you');
  }

  if (task.assigned_to_type === 'division') {
    const membership = db.query(
      'SELECT 1 FROM division_members WHERE staff_id = ?',
      [identity.owner_id]
    );
    if (membership.length === 0) {
      throw new Error('This task is not assigned to you');
    }
  }

  // Mark as in progress
  const now = new Date().toISOString();
  db.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE task_id = ?').run(
    'in_progress', now, input.task_id
  );

  // Create acceptance memory
  const memoryId = uniqueId('mem');
  createMemory(db, {
    memory_id: memoryId,
    owner_type: identity.owner_type as MemoryOwnerType,
    owner_id: identity.owner_id,
    category: 'task_history',
    memory_type: 'delegation_acceptance',
    title: `Delegation Accepted: ${task.title}`,
    content: JSON.stringify({
      action: 'accept_delegation',
      task_id: input.task_id,
      accepted_by_type: identity.owner_type,
      accepted_by_id: identity.owner_id,
      accepted_at: now
    }),
    tags: ['task', 'delegation', 'acceptance', input.task_id],
    confidence: 1.0
  });

  const result = db.query('SELECT * FROM tasks WHERE task_id = ?', [input.task_id]);
  return result[0] as Task;
}

// Reject a delegated task
export function rejectDelegation(db: DatabaseInstance, ctx: OperationContext, input: RejectDelegationInput): Task {
  const identity = requireAuthenticated(ctx);

  const task = getDelegationTaskById(db, null, input.task_id);

  // Verify this is a delegated task
  let deps: string[] = [];
  try {
    deps = JSON.parse(task.dependencies || '[]');
  } catch {
    deps = [];
  }
  if (deps.length === 0) {
    throw new Error('This task is not a delegated task');
  }

  // Verify assigned to this agent
  if (task.assigned_to_type !== identity.owner_type) {
    throw new Error('This task is not assigned to you');
  }

  if (task.assigned_to_type === 'staff' && task.assigned_to_id !== identity.owner_id) {
    throw new Error('This task is not assigned to you');
  }

  if (task.assigned_to_type === 'division') {
    const membership = db.query(
      'SELECT 1 FROM division_members WHERE staff_id = ?',
      [identity.owner_id]
    );
    if (membership.length === 0) {
      throw new Error('This task is not assigned to you');
    }
  }

  // Mark as cancelled
  const now = new Date().toISOString();
  db.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE task_id = ?').run(
    'cancelled', now, input.task_id
  );

  // Create rejection memory
  const memoryId = uniqueId('mem');
  createMemory(db, {
    memory_id: memoryId,
    owner_type: identity.owner_type as MemoryOwnerType,
    owner_id: identity.owner_id,
    category: 'task_history',
    memory_type: 'delegation_rejection',
    title: `Delegation Rejected: ${task.title}`,
    content: JSON.stringify({
      action: 'reject_delegation',
      task_id: input.task_id,
      rejected_by_type: identity.owner_type,
      rejected_by_id: identity.owner_id,
      reason: input.reason,
      rejected_at: now
    }),
    tags: ['task', 'delegation', 'rejection', input.task_id],
    confidence: 1.0
  });

  const result = db.query('SELECT * FROM tasks WHERE task_id = ?', [input.task_id]);
  return result[0] as Task;
}

// List tasks with filters
export function listDelegationTasks(
  db: DatabaseInstance,
  ctx: OperationContext,
  filters: {
    status?: TaskStatus;
    assignee_type?: 'staff' | 'division';
    assignee_id?: string;
    limit?: number;
    offset?: number;
  }
): Task[] {
  const identity = requireAuthenticated(ctx);
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.assignee_type && filters.assignee_id) {
    conditions.push('assigned_to_type = ? AND assigned_to_id = ?');
    params.push(filters.assignee_type, filters.assignee_id);
  }

  // Founder sees all, others see filtered view
  if (identity.owner_type !== 'founder') {
    if (identity.owner_type === 'staff') {
      // Staff sees their assigned tasks or division tasks
      conditions.push('(assigned_to_type = ? AND assigned_to_id = ? OR assigned_to_type = ? AND assigned_to_id IN (SELECT division_id FROM division_members WHERE staff_id = ?))');
      params.push('staff', identity.owner_id, 'division', identity.owner_id, identity.owner_id);
    }
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const limitClause = filters.limit ? `LIMIT ${filters.limit}` : '';
  const offsetClause = filters.offset ? `OFFSET ${filters.offset}` : '';

  return db.query(
    `SELECT * FROM tasks ${whereClause} ORDER BY created_at DESC ${limitClause} ${offsetClause}`,
    params
  ).map(row => row as Task);
}


// Validation helper functions for boundary tests

export interface TaskAuditEntry {
  audit_id: string;
  task_id: string;
  actor_type: 'founder' | 'staff';
  actor_id: string;
  mutation_type: string;
  details: any;
  created_at: string;
  runtime: string;
}

export interface TaskAuditRecord {
  audit_id: string;
  task_id: string;
  actor_type: string;
  actor_id: string;
  mutation_type: string;
  details: string;
  created_at: string;
  runtime: string;
}

export function validateTaskAccess(db: DatabaseInstance, ctx: OperationContext, taskId: string): Task {
  const identity = requireAuthenticated(ctx);
  const task = db.query('SELECT * FROM tasks WHERE task_id = ?', [taskId]);
  if (task.length === 0) {
    throw new Error(`Task '${taskId}' not found`);
  }
  const taskRecord = task[0] as Task;

  if (identity.owner_type === 'founder') return taskRecord;

  // Division can access their division-assigned tasks
  if (identity.owner_type === 'division') {
    if (taskRecord.assigned_to_type === 'division' && taskRecord.assigned_to_id === identity.owner_id) {
      return taskRecord;
    }
    if (taskRecord.assigned_to_type === 'division' && taskRecord.assigned_to_id !== identity.owner_id) {
      throw new Error('Authorization denied');
    }
  }

  if (identity.owner_type === 'staff') {
    if (taskRecord.assigned_to_type === 'staff' && taskRecord.assigned_to_id === identity.owner_id) {
      return taskRecord;
    }
    if (taskRecord.assigned_to_type === 'division') {
      const membership = db.query(
        'SELECT 1 FROM division_members WHERE staff_id = ? AND division_id = ?',
        [identity.owner_id, taskRecord.assigned_to_id]
      );
      if (membership.length > 0) return taskRecord;
    }
    const division = db.query(
      'SELECT division_id FROM divisions WHERE head_staff_id = ?',
      [identity.owner_id]
    );
    if (division.length > 0 && taskRecord.assigned_to_type === 'division' && taskRecord.assigned_to_id === division[0].division_id) {
      return taskRecord;
    }
  }

  throw new Error('Staff can only request execution for their own tasks');
}

export function validateDivisionHeadAuthority(db: DatabaseInstance, ctx: OperationContext, divisionId: string): void {
  const identity = requireAuthenticated(ctx);

  if (identity.owner_type === 'founder') return;
  if (identity.owner_type === 'division' && identity.owner_id === divisionId) return;

  if (identity.owner_type === 'staff') {
    const division = db.query('SELECT division_id FROM divisions WHERE head_staff_id = ?', [identity.owner_id]);
    if (division.length > 0 && division[0].division_id === divisionId) return;
    throw new Error('Division Head authority required');
  }

  throw new Error('Division Head authority required');
}

export interface StaffAgentRecord {
  staff_id: string;
  status: string;
  runtime_instances: string; // JSON string in database
  division_id: string;
}

export function validateActiveStaffIdentity(db: DatabaseInstance, staffId: string, runtime: string): Omit<StaffAgentRecord, 'runtime_instances'> & { runtime_instances: string[] } {
  const staff = db.query('SELECT * FROM staff_agents WHERE staff_id = ?', [staffId]);
  if (staff.length === 0) {
    throw new Error(`Staff agent '${staffId}' not found`);
  }
  const record = staff[0] as StaffAgentRecord;
  if (record.status !== 'active') {
    throw new Error('Staff agent is not active');
  }
  const instances = (JSON.parse(record.runtime_instances || '[]') as unknown) as string[];
  if (!instances.includes(runtime)) {
    throw new Error(`Staff agent not registered for runtime: ${runtime}`);
  }
  return {
    staff_id: record.staff_id,
    status: record.status,
    runtime_instances: instances,
    division_id: record.division_id
  };
}

export function validateDependenciesAndPreventCycles(db: DatabaseInstance, taskId: string, newDependencies: string[]): void {
  if (newDependencies.includes(taskId)) {
    throw new Error('Circular dependency detected');
  }

  // Check for cycles in the entire dependency graph
  for (const newDep of newDependencies) {
    // If newDep -> ... -> taskId exists, we create a cycle
    if (dependsOn(db, newDep, taskId, new Set())) {
      throw new Error('Circular dependency detected');
    }
    // Check if existing dependencies already depend on newDep
    const task = db.query('SELECT * FROM tasks WHERE task_id = ?', [taskId]);
    if (task.length > 0) {
      const existingDeps = JSON.parse((task[0] as Task).dependencies || '[]');
      for (const existingDep of existingDeps) {
        if (dependsOn(db, existingDep, newDep, new Set())) {
          throw new Error('Circular dependency detected');
        }
      }
    }
  }
}

// Helper function to check if a task depends on another task (transitively)
function dependsOn(db: DatabaseInstance, fromTask: string, toTask: string, visited: Set<string>): boolean {
  if (fromTask === toTask) return true;
  if (visited.has(fromTask)) return false;
  visited.add(fromTask);

  const task = db.query('SELECT * FROM tasks WHERE task_id = ?', [fromTask]);
  if (task.length === 0) return false;

  const deps = JSON.parse((task[0] as Task).dependencies || '[]');
  for (const dep of deps) {
    if (dependsOn(db, dep, toTask, new Set(visited))) return true;
  }
  return false;
}

export function recordTaskMutationAudit(db: DatabaseInstance, ctx: OperationContext, taskId: string, mutationType: string, details: any): void {
  const identity = requireAuthenticated(ctx);
  const memoryId = uniqueId('mem');
  const now = new Date().toISOString();

  createMemory(db, {
    memory_id: memoryId,
    owner_type: identity.owner_type as MemoryOwnerType,
    owner_id: identity.owner_id,
    category: 'task_history',
    memory_type: mutationType,
    title: `Task ${mutationType}: ${taskId}`,
    content: JSON.stringify(details),
    tags: ['task', 'audit', taskId],
    confidence: 1.0
  });
}

export function getTaskAuditTrail(db: DatabaseInstance, taskId: string): TaskAuditEntry[] {
  const entries = db.query(
    "SELECT * FROM memory_entries WHERE tags LIKE ? AND category = 'task_history'",
    [`%${taskId}%`]
  );
  return entries.map(e => ({
    audit_id: e.memory_id,
    task_id: taskId,
    actor_type: e.owner_type,
    actor_id: e.owner_id,
    mutation_type: e.memory_type,
    details: JSON.parse(e.content || '{}'),
    created_at: e.created_at,
    runtime: 'claude'
  })) as TaskAuditEntry[];
}

export function validateCrossDivisionTaskAccess(db: DatabaseInstance, ctx: OperationContext, task: Task): void {
  const identity = requireAuthenticated(ctx);

  if (identity.owner_type === 'founder') return;

  if (task.assigned_to_type === 'division') {
    if (identity.owner_type === 'division' && identity.owner_id === task.assigned_to_id) return;
    if (identity.owner_type === 'staff') {
      const membership = db.query(
        'SELECT 1 FROM division_members WHERE staff_id = ? AND division_id = ?',
        [identity.owner_id, task.assigned_to_id]
      );
      if (membership.length > 0) return;
    }
  }

  throw new Error('Cross-division access denied');
}

// Review a deliverable
export function reviewDeliverable(db: DatabaseInstance, ctx: OperationContext, input: ReviewDeliverableInput): void {
  const identity = requireAuthenticated(ctx);

  // Get the deliverable and associated task
  const deliverable = db.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [input.deliverable_id]);
  if (deliverable.length === 0) {
    throw new Error(`Deliverable '${input.deliverable_id}' not found`);
  }

  const task = db.query('SELECT * FROM tasks WHERE task_id = ?', [deliverable[0].task_id]);
  if (task.length === 0) {
    throw new Error('Associated task not found');
  }

  const taskRecord = task[0] as Task;

  // Authorization: task creator (division_head staff), division head, founder, or any staff with division membership
  let canReview = false;
  if (identity.owner_type === 'founder') {
    canReview = true;
  } else if (identity.owner_type === 'staff') {
    // Check if this staff member is a division head who created the task
    if ((taskRecord.created_by_type === 'division_head' as any) &&
        taskRecord.created_by_id === identity.owner_id) {
      canReview = true;
    } else if (taskRecord.created_by_type === 'founder') {
      // Founder-created tasks can be reviewed by division heads or staff in the assigned division
      const divisionHeadCheck = db.query(
        'SELECT division_id FROM divisions WHERE head_staff_id = ?',
        [identity.owner_id]
      );
      // Division head can review founder-created tasks
      if (divisionHeadCheck.length > 0 && taskRecord.assigned_to_type === 'division' &&
          taskRecord.assigned_to_id === divisionHeadCheck[0].division_id) {
        canReview = true;
      }
      // Staff members in the assigned division can review founder-created staff-assigned tasks
      if (!canReview && taskRecord.assigned_to_type === 'staff' && taskRecord.assigned_to_id) {
        const membership = db.query(
          'SELECT division_id FROM staff_agents WHERE staff_id = ?',
          [taskRecord.assigned_to_id]
        );
        if (membership.length > 0) {
          const staffDivisionId = membership[0].division_id;
          const reviewerMembership = db.query(
            'SELECT 1 FROM division_members WHERE staff_id = ? AND division_id = ?',
            [identity.owner_id, staffDivisionId]
          );
          if (reviewerMembership.length > 0) {
            canReview = true;
          }
        }
      }
    }
    // Check if staff member can review based on assignment type
    if (!canReview) {
      if (taskRecord.assigned_to_type === 'division' && taskRecord.assigned_to_id) {
        const membership = db.query(
          'SELECT 1 FROM division_members WHERE staff_id = ? AND division_id = ?',
          [identity.owner_id, taskRecord.assigned_to_id]
        );
        if (membership.length > 0) {
          canReview = true;
        }
      } else if (taskRecord.assigned_to_type === 'staff' && taskRecord.assigned_to_id === identity.owner_id) {
        // Assigned staff can review their own deliverable
        canReview = true;
      }
    }
  } else if (identity.owner_type === 'division') {
    // Division can review tasks within their division
    if (taskRecord.assigned_to_type === 'division' && taskRecord.assigned_to_id === identity.owner_id) {
      canReview = true;
    }
  }

  if (!canReview) {
    throw new Error('Authorization denied: Only task creator, Division Head, or Founder can review');
  }

  const now = new Date().toISOString();
  db.db.prepare(`
    UPDATE deliverables
    SET status = ?, reviewed_by_type = ?, reviewed_by_id = ?, reviewed_at = ?
    WHERE deliverable_id = ?
  `).run(
    input.status,
    identity.owner_type,
    identity.owner_id,
    now,
    input.deliverable_id
  );
}

// ============================================================
// PHASE 9 BATCH 4: DELIVERABLE WORKFLOW EXTENSIONS
// ============================================================

// Deliverable statuses
export type DeliverableStatus = 'draft' | 'submitted' | 'accepted' | 'rejected' | 'revision_requested';

// Input types for deliverable workflow
export interface CreateDeliverableDraftInput {
  task_id: string;
  content: string;
  quality_score?: number;
}

export interface SubmitDeliverableInput {
  deliverable_id: string;
  quality_score?: number;
}

export interface AssignReviewerInput {
  deliverable_id: string;
  reviewer_type: 'founder' | 'council' | 'division_head';
  reviewer_id: string;
}

export interface RequestRevisionInput {
  deliverable_id: string;
  revision_notes: string;
}

export interface ResubmitDeliverableInput {
  deliverable_id: string;
  content: string;
  quality_score?: number;
}

export interface ApproveDeliverableInput {
  deliverable_id: string;
  quality_score?: number;
  founder_signature?: string;
}

export interface RejectDeliverableInput {
  deliverable_id: string;
  rejection_reason: string;
}

export interface QualityThresholdInput {
  division_id?: string;
  task_type?: string;
  min_quality_score: number;
  requires_review: boolean;
}

// Get quality threshold for a task
export function getQualityThreshold(db: DatabaseInstance, task: Task): { min_quality_score: number; requires_review: boolean } {
  // Try division-specific + task_type
  let threshold = db.query(
    'SELECT * FROM quality_thresholds WHERE division_id = ? AND task_type = ?',
    [task.assigned_to_id, task.title]
  )[0];

  // Try division default
  if (!threshold && task.assigned_to_type === 'division') {
    threshold = db.query(
      'SELECT * FROM quality_thresholds WHERE division_id = ? AND task_type IS NULL',
      [task.assigned_to_id]
    )[0];
  }

  // Try global default
  if (!threshold) {
    threshold = db.query(
      'SELECT * FROM quality_thresholds WHERE division_id IS NULL AND task_type IS NULL'
    )[0];
  }

  return {
    min_quality_score: threshold?.min_quality_score ?? 70,
    requires_review: threshold?.requires_review === 1
  };
}

// Verify Founder signature using Phase 8 infrastructure
export function verifyFounderSignature(db: DatabaseInstance, signature: string, operation: string): boolean {
  try {
    const sigData = JSON.parse(signature);
    // Check nonce exists and not consumed
    const nonce = db.query(
      'SELECT * FROM founder_nonces WHERE key_id = ? AND operation = ? AND nonce = ? AND expires_at > datetime(\'now\')',
      [sigData.key_id, operation, sigData.nonce]
    )[0];
    return !!nonce;
  } catch {
    return false;
  }
}

// Enforce HITL approval based on autonomy level
export function enforceHITLApproval(
  db: DatabaseInstance,
  ctx: OperationContext,
  task: Task,
  qualityScore: number
): { requiresFounderSig: boolean } {
  const identity = requireAuthenticated(ctx);
  const autonomyLevel = db.query(
    'SELECT autonomy_level FROM task_autonomy_levels WHERE task_type = ?',
    [task.title]
  )[0]?.autonomy_level ?? 1;

  const threshold = getQualityThreshold(db, task);

  // Quality gate
  if (qualityScore < threshold.min_quality_score) {
    throw new Error(`Quality score ${qualityScore} below threshold ${threshold.min_quality_score}`);
  }

  switch (autonomyLevel) {
    case 1: // Autonomous - auto-approve if quality passes
      return { requiresFounderSig: false };
    case 2: // Permission check / Division head approval
      if (!isDivisionHead(ctx, task.assigned_to_id, db) && !isFounder(ctx)) {
        throw new Error('Level 2 requires Division Head or Founder approval');
      }
      return { requiresFounderSig: false };
    case 3: // Founder mandatory
      if (!isFounder(ctx)) {
        throw new Error('Level 3 requires Founder approval');
      }
      return { requiresFounderSig: true };
  }

  return { requiresFounderSig: false };
}

// Helper: check if context is division head
export function isDivisionHead(ctx: OperationContext, divisionId: string, db: DatabaseInstance): boolean {
  if (ctx.owner_type === 'founder') return true;
  if (ctx.owner_type === 'division') return ctx.owner_id === divisionId;
  if (ctx.owner_type === 'staff') {
    const division = db.query('SELECT head_staff_id FROM divisions WHERE division_id = ?', [divisionId])[0] as { head_staff_id: string } | undefined;
    return division?.head_staff_id === ctx.owner_id;
  }
  return false;
}

// Helper: check if context is founder
function isFounder(ctx: OperationContext): boolean {
  return ctx.owner_type === 'founder';
}

// Create a deliverable draft
export function createDeliverableDraft(
  db: DatabaseInstance,
  ctx: OperationContext,
  input: CreateDeliverableDraftInput
): { deliverable_id: string; task_id: string; status: string; version: number; created_at: string } {
  const identity = requireAuthenticated(ctx);

  // Verify task exists and user has access
  const task = getDelegationTaskById(db, null, input.task_id);

  // Only task assignee or founder can create draft
  if (identity.owner_type !== 'founder') {
    if (task.assigned_to_type === 'staff' && task.assigned_to_id !== identity.owner_id) {
      throw new Error('Only the assigned staff agent or Founder can create deliverable draft');
    }
    if (task.assigned_to_type === 'division') {
      const membership = db.query(
        'SELECT 1 FROM division_members WHERE staff_id = ? AND division_id = ?',
        [identity.owner_id, task.assigned_to_id]
      );
      if (membership.length === 0) {
        throw new Error('Authorization denied');
      }
    }
  }

  // Validate quality score
  if (input.quality_score !== undefined && (input.quality_score < 0 || input.quality_score > 100)) {
    throw new Error('Quality score must be between 0 and 100');
  }

  const deliverableId = uniqueId('del');
  const now = new Date().toISOString();

  db.runPreparedStatement('insertDeliverable', [
    deliverableId,
    input.task_id,
    identity.owner_type as 'staff' | 'division',
    identity.owner_id,
    input.content,
    'draft',
    null, // reviewed_by_type
    null, // reviewed_by_id
    null, // reviewed_at
    now,  // created_at
    1,    // version
    input.quality_score ?? null,
    null, // reviewer_type
    null, // reviewer_id
    null, // approved_at
    null, // approved_by_type
    null, // approved_by_id
    null, // founder_signature
    null, // founder_signed_at
    null  // revision_notes
  ]);

  return {
    deliverable_id: deliverableId,
    task_id: input.task_id,
    status: 'draft',
    version: 1,
    created_at: now
  };
}

// Submit a deliverable draft for review
export function submitDeliverable(
  db: DatabaseInstance,
  ctx: OperationContext,
  input: SubmitDeliverableInput
): { deliverable_id: string; task_id: string; status: string; version: number; created_at: string } {
  const identity = requireAuthenticated(ctx);

  // Get the draft deliverable
  const draft = db.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [input.deliverable_id]);
  if (draft.length === 0) {
    throw new Error(`Deliverable '${input.deliverable_id}' not found`);
  }
  const deliverable = draft[0] as any;

  // Verify task exists and user has access
  const task = getDelegationTaskById(db, null, deliverable.task_id);

  // Only task assignee or founder can submit
  if (identity.owner_type !== 'founder') {
    if (task.assigned_to_type === 'staff' && task.assigned_to_id !== identity.owner_id) {
      throw new Error('Only the assigned staff agent or Founder can submit deliverable');
    }
    if (task.assigned_to_type === 'division') {
      const membership = db.query(
        'SELECT 1 FROM division_members WHERE staff_id = ? AND division_id = ?',
        [identity.owner_id, task.assigned_to_id]
      );
      if (membership.length === 0) {
        throw new Error('Authorization denied');
      }
    }
  }

  // Validate quality score
  if (input.quality_score !== undefined && (input.quality_score < 0 || input.quality_score > 100)) {
    throw new Error('Quality score must be between 0 and 100');
  }

  const now = new Date().toISOString();

  // Update existing deliverable from draft to submitted
  db.runPreparedStatement('updateDeliverable', [
    deliverable.content,
    'submitted',
    null, // reviewed_by_type
    null, // reviewed_by_id
    null, // reviewed_at
    1,    // version
    input.quality_score ?? deliverable.quality_score ?? null,
    null, // reviewer_type
    null, // reviewer_id
    null, // approved_at
    null, // approved_by_type
    null, // approved_by_id
    null, // founder_signature
    null, // founder_signed_at
    null, // revision_notes
    input.deliverable_id
  ]);

  // Update task status to review
  db.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE task_id = ?').run(
    'review', now, deliverable.task_id
  );

  // Create audit memory entry
  const memoryId = uniqueId('mem');
  createMemory(db, {
    memory_id: memoryId,
    owner_type: identity.owner_type as MemoryOwnerType,
    owner_id: identity.owner_id,
    category: 'task_history',
    memory_type: 'deliverable_submission',
    title: `Deliverable Submitted: ${task.title}`,
    content: JSON.stringify({
      action: 'submit_deliverable',
      task_id: deliverable.task_id,
      deliverable_id: input.deliverable_id,
      submitted_by_type: identity.owner_type,
      submitted_by_id: identity.owner_id,
      quality_score: input.quality_score,
      submitted_at: now
    }),
    tags: ['task', 'deliverable', 'submission', deliverable.task_id],
    confidence: 1.0
  });

  return {
    deliverable_id: input.deliverable_id,
    task_id: deliverable.task_id,
    status: 'submitted',
    version: 1,
    quality_score: input.quality_score ?? deliverable.quality_score ?? null,
    created_at: now
  };
}

// Assign a reviewer to a deliverable
export function assignReviewer(
  db: DatabaseInstance,
  ctx: OperationContext,
  input: AssignReviewerInput
): { deliverable_id: string; reviewer_type: string; reviewer_id: string } {
  const identity = requireAuthenticated(ctx);

  // Get deliverable and task
  const deliverable = db.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [input.deliverable_id]);
  if (deliverable.length === 0) {
    throw new Error(`Deliverable '${input.deliverable_id}' not found`);
  }

  const task = db.query('SELECT * FROM tasks WHERE task_id = ?', [deliverable[0].task_id]);
  if (task.length === 0) {
    throw new Error('Associated task not found');
  }

  const taskRecord = task[0] as Task;

  // Authorization: task creator (division_head), division head, founder
  let canAssign = false;
  if (identity.owner_type === 'founder') {
    canAssign = true;
  } else if (identity.owner_type === 'staff') {
    if ((taskRecord.created_by_type === 'division_head' as any) &&
        taskRecord.created_by_id === identity.owner_id) {
      canAssign = true;
    } else if (taskRecord.created_by_type === 'founder') {
      const divisionHeadCheck = db.query(
        'SELECT division_id FROM divisions WHERE head_staff_id = ?',
        [identity.owner_id]
      );
      if (divisionHeadCheck.length > 0 && taskRecord.assigned_to_type === 'division' &&
          taskRecord.assigned_to_id === divisionHeadCheck[0].division_id) {
        canAssign = true;
      }
    }
  } else if (identity.owner_type === 'division') {
    if (taskRecord.assigned_to_type === 'division' && taskRecord.assigned_to_id === identity.owner_id) {
      canAssign = true;
    }
  }

  if (!canAssign) {
    throw new Error('Authorization denied: Only task creator, Division Head, or Founder can assign reviewer');
  }

  // Validate reviewer exists
  if (input.reviewer_type === 'division_head') {
    const division = db.query('SELECT * FROM divisions WHERE head_staff_id = ? OR division_id = ?', [input.reviewer_id, input.reviewer_id]);
    if (division.length === 0) throw new Error('Reviewer division head not found');
  } else if (input.reviewer_type === 'council') {
    const seat = db.query('SELECT * FROM council_seats WHERE seat_id = ?', [input.reviewer_id]);
    if (seat.length === 0) throw new Error('Reviewer council seat not found');
  } else if (input.reviewer_type === 'founder') {
    if (input.reviewer_id !== 'founder') throw new Error('Founder reviewer_id must be "founder"');
  }

  const now = new Date().toISOString();
  db.runPreparedStatement('updateDeliverable', [
    deliverable[0].content,
    deliverable[0].status,
    deliverable[0].reviewed_by_type,
    deliverable[0].reviewed_by_id,
    deliverable[0].reviewed_at,
    deliverable[0].version,
    deliverable[0].quality_score,
    input.reviewer_type,
    input.reviewer_id,
    deliverable[0].approved_at,
    deliverable[0].approved_by_type,
    deliverable[0].approved_by_id,
    deliverable[0].founder_signature,
    deliverable[0].founder_signed_at,
    deliverable[0].revision_notes,
    input.deliverable_id
  ]);

  return {
    deliverable_id: input.deliverable_id,
    reviewer_type: input.reviewer_type,
    reviewer_id: input.reviewer_id
  };
}

// Request revision on a deliverable
export function requestRevision(
  db: DatabaseInstance,
  ctx: OperationContext,
  input: RequestRevisionInput
): { deliverable_id: string; status: string; revision_notes: string } {
  const identity = requireAuthenticated(ctx);

  // Get deliverable
  const deliverable = db.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [input.deliverable_id]);
  if (deliverable.length === 0) {
    throw new Error(`Deliverable '${input.deliverable_id}' not found`);
  }

  // Only assigned reviewer or founder can request revision
  if (identity.owner_type !== 'founder') {
    // Map owner_type to reviewer_type for comparison
    const expectedReviewerType = identity.owner_type === 'staff' ? 'division_head'
      : identity.owner_type === 'division' ? 'division_head'
      : identity.owner_type; // founder, council

    if (deliverable[0].reviewer_type !== expectedReviewerType ||
        deliverable[0].reviewer_id !== identity.owner_id) {
      throw new Error('Only the assigned reviewer or Founder can request revision');
    }
  }

  const now = new Date().toISOString();

  // Update deliverable to revision_requested (don't archive yet - resubmit will archive)
  db.runPreparedStatement('updateDeliverable', [
    deliverable[0].content,
    'revision_requested',
    deliverable[0].reviewed_by_type,
    deliverable[0].reviewed_by_id,
    deliverable[0].reviewed_at,
    deliverable[0].version,
    deliverable[0].quality_score,
    deliverable[0].reviewer_type,
    deliverable[0].reviewer_id,
    deliverable[0].approved_at,
    deliverable[0].approved_by_type,
    deliverable[0].approved_by_id,
    deliverable[0].founder_signature,
    deliverable[0].founder_signed_at,
    input.revision_notes,
    input.deliverable_id
  ]);

  // Create audit memory entry
  const memoryId = uniqueId('mem');
  createMemory(db, {
    memory_id: memoryId,
    owner_type: identity.owner_type as MemoryOwnerType,
    owner_id: identity.owner_id,
    category: 'task_history',
    memory_type: 'deliverable_revision_requested',
    title: `Revision Requested: ${deliverable[0].deliverable_id}`,
    content: JSON.stringify({
      action: 'request_revision',
      deliverable_id: input.deliverable_id,
      requested_by_type: identity.owner_type,
      requested_by_id: identity.owner_id,
      revision_notes: input.revision_notes,
      requested_at: now
    }),
    tags: ['task', 'deliverable', 'revision', input.deliverable_id],
    confidence: 1.0
  });

  return {
    deliverable_id: input.deliverable_id,
    status: 'revision_requested',
    revision_notes: input.revision_notes
  };
}

// Resubmit a deliverable after revision
export function resubmitDeliverable(
  db: DatabaseInstance,
  ctx: OperationContext,
  input: ResubmitDeliverableInput
): { deliverable_id: string; task_id: string; status: string; version: number; created_at: string } {
  const identity = requireAuthenticated(ctx);

  // Get deliverable
  const deliverable = db.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [input.deliverable_id]);
  if (deliverable.length === 0) {
    throw new Error(`Deliverable '${input.deliverable_id}' not found`);
  }

  // Only original submitter or founder can resubmit
  if (identity.owner_type !== 'founder') {
    if (deliverable[0].submitted_by_type !== identity.owner_type ||
        deliverable[0].submitted_by_id !== identity.owner_id) {
      throw new Error('Only the original submitter or Founder can resubmit deliverable');
    }
  }

  // Must be in revision_requested status
  if (deliverable[0].status !== 'revision_requested') {
    throw new Error('Deliverable is not in revision_requested status');
  }

  // Validate quality score
  if (input.quality_score !== undefined && (input.quality_score < 0 || input.quality_score > 100)) {
    throw new Error('Quality score must be between 0 and 100');
  }

  const now = new Date().toISOString();
  const newVersion = deliverable[0].version + 1;

  // Archive previous version
  db.runPreparedStatement('insertDeliverableVersion', [
    uniqueId('ver'),
    input.deliverable_id,
    deliverable[0].version,
    deliverable[0].content,
    deliverable[0].quality_score,
    deliverable[0].status,
    deliverable[0].submitted_by_type,
    deliverable[0].submitted_by_id,
    deliverable[0].revision_notes,
    deliverable[0].created_at
  ]);

  // Update deliverable with new version
  db.runPreparedStatement('updateDeliverable', [
    input.content,
    'submitted',
    null, // reviewed_by_type
    null, // reviewed_by_id
    null, // reviewed_at
    newVersion,
    input.quality_score ?? null,
    deliverable[0].reviewer_type,
    deliverable[0].reviewer_id,
    null, // approved_at
    null, // approved_by_type
    null, // approved_by_id
    null, // founder_signature
    null, // founder_signed_at
    null, // revision_notes
    input.deliverable_id
  ]);

  // Update task status back to review
  const task = db.query('SELECT * FROM tasks WHERE task_id = ?', [deliverable[0].task_id]);
  if (task.length > 0) {
    db.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE task_id = ?').run(
      'review', now, task[0].task_id
    );
  }

  // Create audit memory entry
  const memoryId = uniqueId('mem');
  createMemory(db, {
    memory_id: memoryId,
    owner_type: identity.owner_type as MemoryOwnerType,
    owner_id: identity.owner_id,
    category: 'task_history',
    memory_type: 'deliverable_resubmission',
    title: `Deliverable Resubmitted: ${input.deliverable_id} v${newVersion}`,
    content: JSON.stringify({
      action: 'resubmit_deliverable',
      deliverable_id: input.deliverable_id,
      task_id: deliverable[0].task_id,
      resubmitted_by_type: identity.owner_type,
      resubmitted_by_id: identity.owner_id,
      new_version: newVersion,
      quality_score: input.quality_score,
      resubmitted_at: now
    }),
    tags: ['task', 'deliverable', 'resubmission', input.deliverable_id],
    confidence: 1.0
  });

  return {
    deliverable_id: input.deliverable_id,
    task_id: deliverable[0].task_id,
    status: 'submitted',
    version: newVersion,
    quality_score: input.quality_score,
    created_at: deliverable[0].created_at
  };
}

// Approve a deliverable with HITL enforcement
export function approveDeliverable(
  db: DatabaseInstance,
  ctx: OperationContext,
  input: ApproveDeliverableInput
): { deliverable_id: string; approved: boolean; requires_founder_sig: boolean } {
  const identity = requireAuthenticated(ctx);

  // Get deliverable and task
  const deliverable = db.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [input.deliverable_id]);
  if (deliverable.length === 0) {
    throw new Error(`Deliverable '${input.deliverable_id}' not found`);
  }

  const task = db.query('SELECT * FROM tasks WHERE task_id = ?', [deliverable[0].task_id]);
  if (task.length === 0) {
    throw new Error('Associated task not found');
  }

  const taskRecord = task[0] as Task;

  // Enforce HITL approval
  const hitlResult = enforceHITLApproval(db, ctx, taskRecord, input.quality_score ?? deliverable[0].quality_score ?? 0);

  // For Level 3, verify founder signature
  if (hitlResult.requiresFounderSig) {
    if (!input.founder_signature) {
      throw new Error('Founder signature required for Level 3 autonomy');
    }
    if (!verifyFounderSignature(db, input.founder_signature, `approve_deliverable_${input.deliverable_id}`)) {
      throw new Error('Invalid or expired Founder signature');
    }
  }

  const now = new Date().toISOString();

  // Archive current version
  db.runPreparedStatement('insertDeliverableVersion', [
    uniqueId('ver'),
    input.deliverable_id,
    deliverable[0].version,
    deliverable[0].content,
    input.quality_score ?? deliverable[0].quality_score,
    deliverable[0].status,
    deliverable[0].submitted_by_type,
    deliverable[0].submitted_by_id,
    deliverable[0].revision_notes,
    deliverable[0].created_at
  ]);

  // Map identity owner_type to approved_by_type
  const approvedByType = identity.owner_type === 'founder' ? 'founder' :
                         identity.owner_type === 'division' ? 'division_head' : 'division_head';

  // Update deliverable to accepted
  db.runPreparedStatement('updateDeliverable', [
    deliverable[0].content,
    'accepted',
    deliverable[0].reviewer_type,
    deliverable[0].reviewer_id,
    deliverable[0].reviewed_at,
    deliverable[0].version,
    input.quality_score ?? deliverable[0].quality_score,
    deliverable[0].reviewer_type,
    deliverable[0].reviewer_id,
    now,  // approved_at
    approvedByType,
    identity.owner_id,
    hitlResult.requiresFounderSig ? input.founder_signature : null,
    hitlResult.requiresFounderSig ? now : null,
    null, // revision_notes
    input.deliverable_id
  ]);

  // Update task status to completed
  db.db.prepare('UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE task_id = ?').run(
    'completed', now, now, taskRecord.task_id
  );

  // Create audit memory entry
  const memoryId = uniqueId('mem');
  createMemory(db, {
    memory_id: memoryId,
    owner_type: identity.owner_type as MemoryOwnerType,
    owner_id: identity.owner_id,
    category: 'task_history',
    memory_type: 'deliverable_approval',
    title: `Deliverable Approved: ${input.deliverable_id}`,
    content: JSON.stringify({
      action: 'approve_deliverable',
      deliverable_id: input.deliverable_id,
      task_id: taskRecord.task_id,
      approved_by_type: identity.owner_type,
      approved_by_id: identity.owner_id,
      quality_score: input.quality_score,
      autonomy_level: db.query('SELECT autonomy_level FROM task_autonomy_levels WHERE task_type = ?', [taskRecord.title])[0]?.autonomy_level ?? 1,
      founder_signature_provided: hitlResult.requiresFounderSig,
      approved_at: now
    }),
    tags: ['task', 'deliverable', 'approval', input.deliverable_id],
    confidence: 1.0
  });

  return {
    deliverable_id: input.deliverable_id,
    approved: true,
    requires_founder_sig: hitlResult.requiresFounderSig
  };
}

// Reject a deliverable
export function rejectDeliverable(
  db: DatabaseInstance,
  ctx: OperationContext,
  input: RejectDeliverableInput
): void {
  const identity = requireAuthenticated(ctx);

  // Get deliverable
  const deliverable = db.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [input.deliverable_id]);
  if (deliverable.length === 0) {
    throw new Error(`Deliverable '${input.deliverable_id}' not found`);
  }

  // Only assigned reviewer, task creator, division head, or founder can reject
  let canReject = false;
  if (identity.owner_type === 'founder') {
    canReject = true;
  } else if (deliverable[0].reviewer_type === identity.owner_type &&
             deliverable[0].reviewer_id === identity.owner_id) {
    canReject = true;
  }

  if (!canReject) {
    throw new Error('Authorization denied: Only assigned reviewer, task creator, Division Head, or Founder can reject');
  }

  const now = new Date().toISOString();

  // Archive current version
  db.runPreparedStatement('insertDeliverableVersion', [
    uniqueId('ver'),
    input.deliverable_id,
    deliverable[0].version,
    deliverable[0].content,
    deliverable[0].quality_score,
    deliverable[0].status,
    deliverable[0].submitted_by_type,
    deliverable[0].submitted_by_id,
    deliverable[0].revision_notes,
    deliverable[0].created_at
  ]);

  // Update deliverable to rejected
  db.runPreparedStatement('updateDeliverable', [
    deliverable[0].content,
    'rejected',
    deliverable[0].reviewer_type,
    deliverable[0].reviewer_id,
    deliverable[0].reviewed_at,
    deliverable[0].version,
    deliverable[0].quality_score,
    deliverable[0].reviewer_type,
    deliverable[0].reviewer_id,
    now,  // approved_at (reuse for rejection timestamp)
    identity.owner_type,
    identity.owner_id,
    null,
    null,
    input.rejection_reason,
    input.deliverable_id
  ]);

  // Create audit memory entry
  const memoryId = uniqueId('mem');
  createMemory(db, {
    memory_id: memoryId,
    owner_type: identity.owner_type as MemoryOwnerType,
    owner_id: identity.owner_id,
    category: 'task_history',
    memory_type: 'deliverable_rejection',
    title: `Deliverable Rejected: ${input.deliverable_id}`,
    content: JSON.stringify({
      action: 'reject_deliverable',
      deliverable_id: input.deliverable_id,
      task_id: deliverable[0].task_id,
      rejected_by_type: identity.owner_type,
      rejected_by_id: identity.owner_id,
      rejection_reason: input.rejection_reason,
      rejected_at: now
    }),
    tags: ['task', 'deliverable', 'rejection', input.deliverable_id],
    confidence: 1.0
  });
}

// Get deliverable version history
export function getDeliverableHistory(
  db: DatabaseInstance,
  ctx: OperationContext,
  deliverableId: string
): any[] {
  const identity = requireAuthenticated(ctx);

  // Get deliverable and verify access
  const deliverable = db.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [deliverableId]);
  if (deliverable.length === 0) {
    throw new Error(`Deliverable '${deliverableId}' not found`);
  }

  const task = db.query('SELECT * FROM tasks WHERE task_id = ?', [deliverable[0].task_id]);
  if (task.length === 0) {
    throw new Error('Associated task not found');
  }

  // Check authorization - same as getDelegationTaskById
  getDelegationTaskById(db, ctx, task[0].task_id);

  // Get version history
  const versions = db.query(
    'SELECT * FROM deliverable_versions WHERE deliverable_id = ? ORDER BY version_num ASC',
    [deliverableId]
  );

  // Also include current version
  const current = {
    version_id: 'current',
    deliverable_id: deliverable[0].deliverable_id,
    version_num: deliverable[0].version,
    content: deliverable[0].content,
    quality_score: deliverable[0].quality_score,
    status: deliverable[0].status,
    submitted_by_type: deliverable[0].submitted_by_type,
    submitted_by_id: deliverable[0].submitted_by_id,
    revision_notes: deliverable[0].revision_notes,
    created_at: deliverable[0].created_at
  };

  return [...versions, current].sort((a, b) => a.version_num - b.version_num);
}

// Set quality threshold (Founder only)
export function setQualityThreshold(
  db: DatabaseInstance,
  ctx: OperationContext,
  input: QualityThresholdInput
): void {
  const identity = requireFounder(ctx);

  // Validate threshold
  if (input.min_quality_score < 0 || input.min_quality_score > 100) {
    throw new Error('Quality score must be between 0 and 100');
  }

  const thresholdId = input.division_id && input.task_type
    ? `${input.division_id}-${input.task_type}`
    : input.division_id
      ? `${input.division_id}-default`
      : input.task_type
        ? `global-${input.task_type}`
        : 'default-global';

  const now = new Date().toISOString();

  const existing = db.query('SELECT * FROM quality_thresholds WHERE threshold_id = ?', [thresholdId]);
  if (existing.length > 0) {
    db.runPreparedStatement('updateQualityThreshold', [
      input.min_quality_score,
      input.requires_review ? 1 : 0,
      thresholdId
    ]);
  } else {
    db.runPreparedStatement('insertQualityThreshold', [
      thresholdId,
      input.division_id ?? null,
      input.task_type ?? null,
      input.min_quality_score,
      input.requires_review ? 1 : 0
    ]);
  }
}

// Get quality threshold (Founder or internal use)
export function getQualityThresholdConfig(
  db: DatabaseInstance,
  ctx: OperationContext,
  divisionId?: string,
  taskType?: string
): { min_quality_score: number; requires_review: boolean } {
  const identity = requireAuthenticated(ctx);

  if (identity.owner_type !== 'founder') {
    throw new Error('Only Founder can view quality threshold configuration');
  }

  let threshold = db.query(
    'SELECT * FROM quality_thresholds WHERE division_id = ? AND task_type = ?',
    [divisionId ?? null, taskType ?? null]
  )[0];

  if (!threshold && divisionId) {
    threshold = db.query(
      'SELECT * FROM quality_thresholds WHERE division_id = ? AND task_type IS NULL',
      [divisionId]
    )[0];
  }

  if (!threshold) {
    threshold = db.query(
      'SELECT * FROM quality_thresholds WHERE division_id IS NULL AND task_type IS NULL'
    )[0];
  }

  return {
    min_quality_score: threshold?.min_quality_score ?? 70,
    requires_review: threshold?.requires_review === 1
  };
}