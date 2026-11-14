// Task Delegation Service - Phase 9 Batch 3
// Delegation functionality extending basic task management

import { DatabaseInstance } from '../database.js';
import { Task, MemoryOwnerType } from './types.js';
import { OperationContext, requireAuthenticated } from './operations.js';
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

// Submit a deliverable for a task
export function submitDeliverable(db: DatabaseInstance, ctx: OperationContext, input: SubmitDeliverableInput): { deliverable_id: string; task_id: string; status: string; created_at: string } {
  const identity = requireAuthenticated(ctx);

  // Verify task exists and user has access
  const task = getDelegationTaskById(db, null, input.task_id);

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

  const deliverableId = uniqueId('del');
  const now = new Date().toISOString();

  db.runPreparedStatement('insertDeliverable', [
    deliverableId,
    input.task_id,
    identity.owner_type as 'staff' | 'division',
    identity.owner_id,
    input.content,
    'submitted',
    null, // reviewed_by_type
    null, // reviewed_by_id
    null, // reviewed_at
    now   // created_at
  ]);

  // Update task status
  db.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE task_id = ?').run(
    'completed', now, input.task_id
  );

  return {
    deliverable_id: deliverableId,
    task_id: input.task_id,
    status: 'submitted',
    created_at: now
  };
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
  runtime_instances: string[];
  division_id: string;
}

export function validateActiveStaffIdentity(db: DatabaseInstance, staffId: string, runtime: string): StaffAgentRecord {
  const staff = db.query('SELECT * FROM staff_agents WHERE staff_id = ?', [staffId]);
  if (staff.length === 0) {
    throw new Error(`Staff agent '${staffId}' not found`);
  }
  const record = staff[0] as StaffAgentRecord;
  if (record.status !== 'active') {
    throw new Error('Staff agent is not active');
  }
  const instances = JSON.parse(record.runtime_instances || '[]');
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