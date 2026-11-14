// Division and Staff Operations
// Extracted from council.ts for modularization

import { DatabaseInstance } from '../database.js';
import {
  Division,
  StaffAgent,
  DivisionMember,
  Task,
  Deliverable
} from './types.js';
import {
  CreateDivisionInput,
  UpdateDivisionInput,
  RegisterStaffAgentInput,
  UpdateStaffAgentInput,
  AddDivisionMemberInput,
  CreateTaskInput,
  UpdateTaskInput,
  CreateDeliverableInput,
  UpdateDeliverableInput,
  ApproveDivisionHeadInput,
  ApproveSpecialistInput,
  ActivateStaffAgentInput
} from './inputs.js';
import { createMemory } from './memory.js';

// --- Division Operations ---

export function createDivision(
  db: DatabaseInstance,
  input: CreateDivisionInput
): Division {
  const divisionId = input.division_id ?? db.generateId();
  db.runPreparedStatement('insertDivision', [
    divisionId,
    input.name,
    input.description ?? '',
    input.head_staff_id ?? null,
    input.budget_limit ?? 0,
    JSON.stringify(input.permissions ?? []),
    JSON.stringify(input.strategic_objectives ?? [])
  ]);

  const result = db.query('SELECT * FROM divisions WHERE division_id = ?', [divisionId]);
  return result[0] as Division;
}

export function getDivisionById(
  db: DatabaseInstance,
  divisionId: string
): Division | null {
  const result = db.query('SELECT * FROM divisions WHERE division_id = ?', [divisionId]);
  return result.length > 0 ? result[0] as Division : null;
}

export function listDivisions(
  db: DatabaseInstance
): Division[] {
  const result = db.query('SELECT * FROM divisions ORDER BY created_at DESC');
  return result as Division[];
}

export function updateDivision(
  db: DatabaseInstance,
  divisionId: string,
  updates: UpdateDivisionInput
): Division {
  const existing = getDivisionById(db, divisionId);
  if (!existing) throw new Error(`Division '${divisionId}' not found`);

  db.runPreparedStatement('updateDivision', [
    updates.name ?? existing.name,
    updates.description ?? existing.description,
    updates.head_staff_id ?? existing.head_staff_id,
    updates.budget_limit ?? existing.budget_limit,
    JSON.stringify(updates.permissions ?? JSON.parse(existing.permissions)),
    JSON.stringify(updates.strategic_objectives ?? JSON.parse(existing.strategic_objectives)),
    divisionId
  ]);

  const result = db.query('SELECT * FROM divisions WHERE division_id = ?', [divisionId]);
  return result[0] as Division;
}

// --- Staff Operations ---

export function registerStaffAgent(
  db: DatabaseInstance,
  input: RegisterStaffAgentInput
): StaffAgent {
  db.runPreparedStatement('insertStaffAgent', [
    input.staff_id,
    input.name,
    input.role,
    input.division_id,
    JSON.stringify(input.runtime_instances ?? []),
    JSON.stringify(input.permissions ?? []),
    input.status ?? 'inactive'
  ]);

  const result = db.query('SELECT * FROM staff_agents WHERE staff_id = ?', [input.staff_id]);
  return result[0] as StaffAgent;
}

export function getStaffAgentById(
  db: DatabaseInstance,
  staffId: string
): StaffAgent | null {
  const result = db.query('SELECT * FROM staff_agents WHERE staff_id = ?', [staffId]);
  return result.length > 0 ? result[0] as StaffAgent : null;
}

export function listStaffAgents(
  db: DatabaseInstance,
  filters?: { division_id?: string; status?: string }
): StaffAgent[] {
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (filters?.division_id) {
    whereClauses.push('division_id = ?');
    params.push(filters.division_id);
  }
  if (filters?.status) {
    whereClauses.push('status = ?');
    params.push(filters.status);
  }

  const where = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
  const result = db.query(`SELECT * FROM staff_agents ${where} ORDER BY created_at DESC`, params);
  return result as StaffAgent[];
}

export function updateStaffAgent(
  db: DatabaseInstance,
  staffId: string,
  updates: UpdateStaffAgentInput
): StaffAgent {
  const existing = getStaffAgentById(db, staffId);
  if (!existing) throw new Error(`Staff agent '${staffId}' not found`);

  db.runPreparedStatement('updateStaffAgent', [
    updates.name ?? existing.name,
    updates.role ?? existing.role,
    updates.division_id ?? existing.division_id,
    JSON.stringify(updates.runtime_instances ?? JSON.parse(existing.runtime_instances)),
    JSON.stringify(updates.permissions ?? JSON.parse(existing.permissions)),
    updates.status ?? existing.status,
    staffId
  ]);

  const result = db.query('SELECT * FROM staff_agents WHERE staff_id = ?', [staffId]);
  return result[0] as StaffAgent;
}

export function updateStaffStatus(
  db: DatabaseInstance,
  input: { staff_id: string; status: 'active' | 'inactive' | 'terminated' }
): StaffAgent {
  return updateStaffAgent(db, input.staff_id, { staff_id: input.staff_id, status: input.status });
}

export function suspendStaffAgent(
  db: DatabaseInstance,
  input: { staff_id: string }
): StaffAgent {
  return updateStaffAgent(db, input.staff_id, { staff_id: input.staff_id, status: 'inactive' });
}

export function retireStaffAgent(
  db: DatabaseInstance,
  input: { staff_id: string }
): StaffAgent {
  return updateStaffAgent(db, input.staff_id, { staff_id: input.staff_id, status: 'terminated' });
}

// --- Division Member Operations ---

export function addDivisionMember(
  db: DatabaseInstance,
  input: AddDivisionMemberInput
): DivisionMember {
  const role = input.role ?? 'specialist';
  db.runPreparedStatement('insertDivisionMember', [
    input.division_id,
    input.staff_id,
    role
  ]);

  const result = db.query(
    'SELECT * FROM division_members WHERE division_id = ? AND staff_id = ?',
    [input.division_id, input.staff_id]
  );
  return result[0] as DivisionMember;
}

export function getDivisionMembers(
  db: DatabaseInstance,
  divisionId: string
): DivisionMember[] {
  const result = db.query('SELECT * FROM division_members WHERE division_id = ?', [divisionId]);
  return result as DivisionMember[];
}

export function getStaffDivisions(
  db: DatabaseInstance,
  staffId: string
): DivisionMember[] {
  const result = db.query('SELECT * FROM division_members WHERE staff_id = ?', [staffId]);
  return result as DivisionMember[];
}

// --- Task Operations ---

export function createTask(
  db: DatabaseInstance,
  input: CreateTaskInput
): Task {
  const now = new Date().toISOString();
  const taskId = db.generateId();
  db.runPreparedStatement('insertTask', [
    taskId,
    input.title,
    input.description ?? '',
    input.assigned_to_type,
    input.assigned_to_id,
    input.created_by_type,
    input.created_by_id,
    input.status ?? 'pending',
    input.priority ?? 'medium',
    input.budget_allocated ?? 0,
    input.due_at ?? null,
    null,
    now,
    now,
    JSON.stringify(input.dependencies ?? []),
    input.deliverable_id ?? null
  ]);

  const result = db.query('SELECT * FROM tasks WHERE task_id = ?', [taskId]);
  return result[0] as Task;
}

export function getTaskById(
  db: DatabaseInstance,
  taskId: string
): Task | null {
  const result = db.query('SELECT * FROM tasks WHERE task_id = ?', [taskId]);
  return result.length > 0 ? result[0] as Task : null;
}

export function listTasks(
  db: DatabaseInstance,
  filters?: { assigned_to_type?: 'division' | 'staff'; assigned_to_id?: string; status?: string }
): Task[] {
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (filters?.assigned_to_type) {
    whereClauses.push('assigned_to_type = ?');
    params.push(filters.assigned_to_type);
  }
  if (filters?.assigned_to_id) {
    whereClauses.push('assigned_to_id = ?');
    params.push(filters.assigned_to_id);
  }
  if (filters?.status) {
    whereClauses.push('status = ?');
    params.push(filters.status);
  }

  const where = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
  const result = db.query(`SELECT * FROM tasks ${where} ORDER BY created_at DESC`, params);
  return result as Task[];
}

export function updateTask(
  db: DatabaseInstance,
  taskId: string,
  updates: UpdateTaskInput
): Task {
  const existing = getTaskById(db, taskId);
  if (!existing) throw new Error(`Task '${taskId}' not found`);

  const now = new Date().toISOString();
  db.runPreparedStatement('updateTask', [
    updates.title ?? existing.title,
    updates.description ?? existing.description,
    updates.assigned_to_type ?? existing.assigned_to_type,
    updates.assigned_to_id ?? existing.assigned_to_id,
    updates.status ?? existing.status,
    updates.priority ?? existing.priority,
    updates.budget_allocated ?? existing.budget_allocated,
    updates.due_at ?? existing.due_at,
    updates.completed_at ?? existing.completed_at,
    JSON.stringify(updates.dependencies ?? JSON.parse(existing.dependencies)),
    updates.deliverable_id ?? existing.deliverable_id,
    now,
    taskId
  ]);

  const result = db.query('SELECT * FROM tasks WHERE task_id = ?', [taskId]);
  return result[0] as Task;
}

// --- Deliverable Operations ---

export function createDeliverable(
  db: DatabaseInstance,
  input: CreateDeliverableInput
): Deliverable {
  const now = new Date().toISOString();
  const columns = db.query('PRAGMA table_info(deliverables)') as Array<{ name: string }>;
  const hasBatch4Fields = columns.some((column) => column.name === 'version');

  if (hasBatch4Fields) {
    // Batch 4 schema with version, quality_score, reviewer fields, etc.
    db.runPreparedStatement('insertDeliverable', [
      input.deliverable_id,
      input.task_id,
      input.submitted_by_type,
      input.submitted_by_id,
      input.content,
      input.status ?? 'submitted',
      input.reviewed_by_type ?? null,
      input.reviewed_by_id ?? null,
      null,  // reviewed_at
      now,   // created_at
      1,     // version
      null,  // quality_score
      null,  // reviewer_type
      null,  // reviewer_id
      null,  // approved_at
      null,  // approved_by_type
      null,  // approved_by_id
      null,  // founder_signature
      null,  // founder_signed_at
      null   // revision_notes
    ]);
  } else {
    // Legacy schema (with or without migration 004 fields)
    const hasExtendedFields = ['file_references', 'task_relationships', 'audit_log']
      .every((name) => columns.some((column) => column.name === name));
    const hasExtensionInput = Boolean(
      input.file_references?.length || input.task_relationships?.length || input.audit_log?.length
    );
    if (hasExtendedFields) {
      db.db.prepare(`
        INSERT INTO deliverables (deliverable_id, task_id, submitted_by_type, submitted_by_id, content, status, reviewed_by_type, reviewed_by_id, reviewed_at, file_references, task_relationships, audit_log, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.deliverable_id,
        input.task_id,
        input.submitted_by_type,
        input.submitted_by_id,
        input.content,
        input.status ?? 'submitted',
        input.reviewed_by_type ?? null,
        input.reviewed_by_id ?? null,
        null,
        JSON.stringify(input.file_references ?? []),
        JSON.stringify(input.task_relationships ?? []),
        JSON.stringify(input.audit_log ?? []),
        now
      );
    } else {
      if (hasExtensionInput) throw new Error('Deliverable extension fields require migration 004');
      db.db.prepare(`
        INSERT INTO deliverables (deliverable_id, task_id, submitted_by_type, submitted_by_id, content, status, reviewed_by_type, reviewed_by_id, reviewed_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.deliverable_id,
        input.task_id,
        input.submitted_by_type,
        input.submitted_by_id,
        input.content,
        input.status ?? 'submitted',
        input.reviewed_by_type ?? null,
        input.reviewed_by_id ?? null,
        null,
        now
      );
    }
  }

  const result = db.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [input.deliverable_id]);
  return normalizeDeliverable(result[0] as Record<string, any>);
}

function normalizeDeliverable(row: Record<string, any>): Deliverable {
  return {
    ...row,
    file_references: row.file_references ?? '[]',
    task_relationships: row.task_relationships ?? '[]',
    audit_log: row.audit_log ?? '[]',
    updated_at: row.updated_at ?? row.created_at,
  } as Deliverable;
}

export function getDeliverableById(
  db: DatabaseInstance,
  deliverableId: string
): Deliverable | null {
  const result = db.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [deliverableId]);
  return result.length > 0 ? normalizeDeliverable(result[0] as Record<string, any>) : null;
}

export function listDeliverablesByTask(
  db: DatabaseInstance,
  taskId: string
): Deliverable[] {
  const result = db.query('SELECT * FROM deliverables WHERE task_id = ? ORDER BY created_at DESC', [taskId]);
  return (result as Record<string, any>[]).map(normalizeDeliverable);
}

export function updateDeliverable(
  db: DatabaseInstance,
  deliverableId: string,
  updates: UpdateDeliverableInput
): Deliverable {
  const existing = getDeliverableById(db, deliverableId);
  if (!existing) throw new Error(`Deliverable '${deliverableId}' not found`);

  const now = new Date().toISOString();
  const columns = db.query('PRAGMA table_info(deliverables)') as Array<{ name: string }>;
  const hasExtendedFields = ['file_references', 'task_relationships', 'audit_log']
    .every((name) => columns.some((column) => column.name === name));
  if (hasExtendedFields) {
    db.db.prepare(`
      UPDATE deliverables SET content = ?, status = ?, reviewed_by_type = ?, reviewed_by_id = ?, reviewed_at = ?, file_references = ?, task_relationships = ?, audit_log = ?
      WHERE deliverable_id = ?
    `).run(
      updates.content ?? existing.content,
      updates.status ?? existing.status,
      updates.reviewed_by_type ?? existing.reviewed_by_type,
      updates.reviewed_by_id ?? existing.reviewed_by_id,
      updates.reviewed_by_id ? now : existing.reviewed_at ?? null,
      JSON.stringify(updates.file_references ?? JSON.parse(existing.file_references)),
      JSON.stringify(updates.task_relationships ?? JSON.parse(existing.task_relationships)),
      JSON.stringify(updates.audit_log ?? JSON.parse(existing.audit_log)),
      deliverableId
    );
  } else {
    if (updates.file_references || updates.task_relationships || updates.audit_log) {
      throw new Error('Deliverable extension fields require migration 004');
    }
    db.runPreparedStatement('updateDeliverable', [
      updates.content ?? existing.content,
      updates.status ?? existing.status,
      updates.reviewed_by_type ?? existing.reviewed_by_type,
      updates.reviewed_by_id ?? existing.reviewed_by_id,
      updates.reviewed_by_id ? now : existing.reviewed_at ?? null,
      deliverableId
    ]);
  }

  const result = db.query('SELECT * FROM deliverables WHERE deliverable_id = ?', [deliverableId]);
  return normalizeDeliverable(result[0] as Record<string, any>);
}

// --- Phase 9: Appointment Ceremony Operations ---

export function approveDivisionHead(
  db: DatabaseInstance,
  ctx: { owner_type: string; owner_id: string },
  input: ApproveDivisionHeadInput
): Division {
  if (ctx.owner_type !== 'founder') {
    throw new Error('Only Founder can approve Division Head appointments');
  }

  const division = getDivisionById(db, input.division_id);
  if (!division) throw new Error(`Division '${input.division_id}' not found`);

  const staff = getStaffAgentById(db, input.staff_id);
  if (!staff) throw new Error(`Staff agent '${input.staff_id}' not found`);

  if (staff.division_id !== input.division_id) {
    throw new Error(`Staff agent '${input.staff_id}' is not a member of division '${input.division_id}'`);
  }

  if (division.head_staff_id === input.staff_id) {
    throw new Error(`Staff agent '${input.staff_id}' is already the Division Head of '${input.division_id}'`);
  }

  const updatedDivision = updateDivision(db, input.division_id, {
    division_id: input.division_id,
    head_staff_id: input.staff_id
  });

  // Add to division members if not already present
  const existingMember = db.query(
    'SELECT * FROM division_members WHERE division_id = ? AND staff_id = ?',
    [input.division_id, input.staff_id]
  );
  if (existingMember.length === 0) {
    addDivisionMember(db, {
      division_id: input.division_id,
      staff_id: input.staff_id,
      role: 'head'
    });
  }

  // Create audit memory entry
  const memoryId = db.generateId();
  createMemory(db, {
    memory_id: memoryId,
    owner_type: 'founder',
    owner_id: 'founder',
    category: 'council_shared',
    memory_type: 'appointment_record',
    title: `Division Head Appointed: ${staff.name} for ${division.name}`,
    content: JSON.stringify({
      action: 'approve_division_head',
      division_id: input.division_id,
      staff_id: input.staff_id,
      staff_name: staff.name,
      appointed_at: new Date().toISOString()
    }),
    tags: ['appointment', 'division_head', input.division_id.toLowerCase().replace(/\s+/g, '-')],
    confidence: 1.0
  });

  return updatedDivision;
}

export function approveSpecialist(
  db: DatabaseInstance,
  ctx: { owner_type: string; owner_id: string },
  input: ApproveSpecialistInput
): StaffAgent {
  if (ctx.owner_type !== 'founder') {
    throw new Error('Only Founder can approve specialist appointments');
  }

  const staff = getStaffAgentById(db, input.staff_id);
  if (!staff) throw new Error(`Staff agent '${input.staff_id}' not found`);

  const division = getDivisionById(db, input.division_id);
  if (!division) throw new Error(`Division '${input.division_id}' not found`);

  if (staff.division_id !== input.division_id) {
    throw new Error(`Staff agent '${input.staff_id}' is not registered to division '${input.division_id}'`);
  }

  // Approval does NOT activate - it only records the appointment approval
  // Activation is a separate step via activateStaffAgent()

  // Add to division members if not already present
  const existingMember = db.query(
    'SELECT * FROM division_members WHERE division_id = ? AND staff_id = ?',
    [input.division_id, input.staff_id]
  );
  if (existingMember.length === 0) {
    addDivisionMember(db, {
      division_id: input.division_id,
      staff_id: input.staff_id,
      role: 'specialist'
    });
  }

  // Create audit memory entry
  const memoryId = db.generateId();
  createMemory(db, {
    memory_id: memoryId,
    owner_type: 'founder',
    owner_id: 'founder',
    category: 'council_shared',
    memory_type: 'appointment_record',
    title: `Specialist Approved: ${staff.name} for ${division.name}`,
    content: JSON.stringify({
      action: 'approve_specialist',
      division_id: input.division_id,
      staff_id: input.staff_id,
      staff_name: staff.name,
      role: staff.role,
      approved_at: new Date().toISOString()
    }),
    tags: ['appointment', 'specialist', input.division_id.toLowerCase().replace(/\s+/g, '-')],
    confidence: 1.0
  });

  return staff; // Return unmodified staff (status remains unchanged)
}

export function activateStaffAgent(
  db: DatabaseInstance,
  ctx: { owner_type: string; owner_id: string },
  input: ActivateStaffAgentInput
): StaffAgent {
  if (ctx.owner_type !== 'founder') {
    throw new Error('Only Founder can activate staff agents');
  }

  const staff = getStaffAgentById(db, input.staff_id);
  if (!staff) throw new Error(`Staff agent '${input.staff_id}' not found`);

  // Check if staff has been approved (has division membership)
  const membership = db.query(
    'SELECT * FROM division_members WHERE staff_id = ?',
    [input.staff_id]
  );
  if (membership.length === 0) {
    throw new Error(`Staff agent '${input.staff_id}' must be approved before activation`);
  }

  // Assign runtime personas using dedicated staff_runtime_personas table
  const existingRuntimes: ('claude' | 'hermes')[] = [];
  try {
    const parsed = JSON.parse(staff.runtime_instances);
    existingRuntimes.push(...parsed);
  } catch {
    // Empty or invalid, start fresh
  }

  const newRuntimes: ('claude' | 'hermes')[] = [...new Set([...existingRuntimes, ...input.runtimes])];

  // Insert into staff_runtime_personas (FK to staff_agents, no FK disable needed)
  for (const runtime of input.runtimes) {
    if (!existingRuntimes.includes(runtime)) {
      db.runPreparedStatement('insertStaffRuntimePersona', [runtime, input.staff_id]);
    }
  }

  const updatedStaff = updateStaffAgent(db, input.staff_id, {
    runtime_instances: newRuntimes,
    status: 'active'
  });

  // Create audit memory entry
  const memoryId = db.generateId();
  createMemory(db, {
    memory_id: memoryId,
    owner_type: 'founder',
    owner_id: 'founder',
    category: 'council_shared',
    memory_type: 'activation_record',
    title: `Staff Agent Activated: ${staff.name} (${input.runtimes.join(', ')})`,
    content: JSON.stringify({
      action: 'activate_staff_agent',
      staff_id: input.staff_id,
      staff_name: staff.name,
      runtimes: input.runtimes,
      activated_at: new Date().toISOString()
    }),
    tags: ['activation', input.staff_id],
    confidence: 1.0
  });

  return updatedStaff;
}