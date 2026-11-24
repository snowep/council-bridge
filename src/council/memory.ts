// Memory Operations
// Extracted from council.ts for modularization

import { DatabaseInstance } from '../database.js';
import {
  MemoryEntry,
  MemoryVersion,
  MemoryLink,
  MemoryAccess,
  CrossDivisionShare,
  MemoryCategory,
  MemoryLinkType,
  MemoryOwnerType
} from './types.js';

// --- Memory Operations ---

export function createMemory(
  db: DatabaseInstance,
  input: {
    memory_id: string;
    owner_type: MemoryOwnerType;
    owner_id: string;
    category: MemoryCategory;
    memory_type: string;
    title: string;
    content: string;
    tags?: string[];
    confidence?: number;
    supersedes_id?: string;
    meeting_id?: string;
    division_id?: string;
    task_id?: string;
  }
): MemoryEntry {
  const now = new Date().toISOString();
  db.runPreparedStatement('insertMemory', [
    input.memory_id,
    input.owner_type,
    input.owner_id,
    input.category,
    input.memory_type,
    input.title,
    input.content,
    JSON.stringify(input.tags || []),
    input.confidence ?? 1.0,
    1,
    input.supersedes_id ?? null,
    input.meeting_id ?? null,
    input.division_id ?? null,
    input.task_id ?? null,
    null,
    now,
    now
  ]);

  const result = db.query('SELECT * FROM memory_entries WHERE memory_id = ?', [input.memory_id]);
  return result[0] as MemoryEntry;
}

export function getMemoryById(
  db: DatabaseInstance,
  memoryId: string
): MemoryEntry | null {
  const result = db.query('SELECT * FROM memory_entries WHERE memory_id = ?', [memoryId]);
  return result.length > 0 ? result[0] as MemoryEntry : null;
}

export function updateMemory(
  db: DatabaseInstance,
  memoryId: string,
  updates: Partial<Pick<MemoryEntry, 'title' | 'content' | 'tags' | 'confidence' | 'archived_at' | 'division_id' | 'task_id'>>
): MemoryEntry {
  const existing = getMemoryById(db, memoryId);
  if (!existing) throw new Error(`Memory '${memoryId}' not found`);

  const now = new Date().toISOString();
  db.runPreparedStatement('updateMemory', [
    updates.title ?? existing.title,
    updates.content ?? existing.content,
    JSON.stringify(updates.tags ?? JSON.parse(existing.tags)),
    updates.confidence ?? existing.confidence,
    updates.archived_at ?? existing.archived_at,
    now,
    memoryId
  ]);

  const result = db.query('SELECT * FROM memory_entries WHERE memory_id = ?', [memoryId]);
  return result[0] as MemoryEntry;
}

export function archiveMemory(
  db: DatabaseInstance,
  memoryId: string
): MemoryEntry {
  return updateMemory(db, memoryId, { archived_at: new Date().toISOString() });
}

export function restoreMemory(
  db: DatabaseInstance,
  memoryId: string
): MemoryEntry {
  return updateMemory(db, memoryId, { archived_at: null });
}

export function createMemoryVersion(
  db: DatabaseInstance,
  input: {
    version_id: string;
    memory_id: string;
    version_num: number;
    title: string;
    content: string;
    tags: string[];
    confidence: number;
    changed_by_owner_type: MemoryOwnerType;
    changed_by_owner_id: string;
    changed_by_runtime: 'claude' | 'hermes';
    change_summary?: string;
  }
): MemoryVersion {
  const now = new Date().toISOString();
  db.runPreparedStatement('insertMemoryVersion', [
    input.version_id,
    input.memory_id,
    input.version_num,
    input.title,
    input.content,
    JSON.stringify(input.tags),
    input.confidence,
    input.changed_by_owner_type,
    input.changed_by_owner_id,
    input.changed_by_runtime,
    input.change_summary ?? '',
    now
  ]);

  const result = db.query('SELECT * FROM memory_versions WHERE version_id = ?', [input.version_id]);
  return result[0] as MemoryVersion;
}

export function getMemoryVersions(
  db: DatabaseInstance,
  memoryId: string
): MemoryVersion[] {
  const result = db.query('SELECT * FROM memory_versions WHERE memory_id = ? ORDER BY version_num', [memoryId]);
  return result as MemoryVersion[];
}

export function createMemoryLink(
  db: DatabaseInstance,
  input: {
    link_id: string;
    source_memory_id: string;
    target_memory_id: string;
    link_type: MemoryLinkType;
    strength?: number;
    notes?: string;
    created_by_owner_type: MemoryOwnerType;
    created_by_owner_id: string;
    created_by_runtime: 'claude' | 'hermes';
  }
): MemoryLink {
  const now = new Date().toISOString();
  db.runPreparedStatement('insertMemoryLink', [
    input.link_id,
    input.source_memory_id,
    input.target_memory_id,
    input.link_type,
    input.strength ?? 1.0,
    input.notes ?? '',
    input.created_by_owner_type,
    input.created_by_owner_id,
    input.created_by_runtime,
    now
  ]);

  const result = db.query('SELECT * FROM memory_links WHERE link_id = ?', [input.link_id]);
  return result[0] as MemoryLink;
}

export function logMemoryAccess(
  db: DatabaseInstance,
  input: {
    access_id: string;
    memory_id: string;
    version_accessed: number | null;
    accessor_type: MemoryOwnerType;
    accessor_id: string;
    accessor_runtime: 'claude' | 'hermes';
    access_type: 'create' | 'read' | 'update' | 'link' | 'search';
  }
): void {
  db.runPreparedStatement('insertMemoryAccess', [
    input.access_id,
    input.memory_id,
    input.version_accessed ?? null,
    input.accessor_type,
    input.accessor_id,
    input.accessor_runtime,
    input.access_type,
    new Date().toISOString()
  ]);
}

// --- Cross-Division Share Operations ---

export function createCrossDivisionShare(
  db: DatabaseInstance,
  input: {
    share_id: string;
    memory_id: string;
    division_id: string;
    granted_by_type: 'division' | 'founder';
    granted_by_id: string;
    request_type?: 'task_delegate' | 'deliverable_share' | 'memory_access' | 'resource_request';
    status?: 'pending' | 'approved' | 'rejected';
    justification?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    deadline?: string;
  }
): CrossDivisionShare {
  const now = new Date().toISOString();
  db.runPreparedStatement('insertCrossDivisionShare', [
    input.share_id,
    input.memory_id,
    input.division_id,
    input.granted_by_type,
    input.granted_by_id,
    now,
    null,
    input.request_type ?? null,
    input.status ?? 'pending',
    input.justification ?? null,
    input.priority ?? null,
    input.deadline ?? null,
    null, null, null, null
  ]);

  const result = db.query('SELECT * FROM cross_division_shares WHERE share_id = ?', [input.share_id]);
  return result[0] as CrossDivisionShare;
}

export function getCrossDivisionShares(
  db: DatabaseInstance,
  memoryId: string
): CrossDivisionShare[] {
  const result = db.query('SELECT * FROM cross_division_shares WHERE memory_id = ?', [memoryId]);
  return result as CrossDivisionShare[];
}

export function getSharesByDivision(
  db: DatabaseInstance,
  divisionId: string
): CrossDivisionShare[] {
  const result = db.query('SELECT * FROM cross_division_shares WHERE division_id = ?', [divisionId]);
  return result as CrossDivisionShare[];
}

export function listMemoryEntries(
  db: DatabaseInstance,
  ctx: { owner_type: string; owner_id: string },
  filters: {
    owner_type?: string;
    owner_id?: string;
    category?: string;
    archived?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }
): MemoryEntry[] {
  const whereClauses: string[] = [];
  const params: any[] = [];

  // Founder sees all, others filtered by owner
  if (ctx.owner_type !== 'founder') {
    whereClauses.push('(owner_type = ? AND owner_id = ?)');
    params.push(ctx.owner_type, ctx.owner_id);
  } else if (filters.owner_type && filters.owner_id) {
    whereClauses.push('owner_type = ? AND owner_id = ?');
    params.push(filters.owner_type, filters.owner_id);
  } else if (filters.owner_type) {
    whereClauses.push('owner_type = ?');
    params.push(filters.owner_type);
  }

  if (filters.category) {
    whereClauses.push('category = ?');
    params.push(filters.category);
  }

  if (filters.archived === true) {
    whereClauses.push('archived_at IS NOT NULL');
  } else if (filters.archived === false) {
    whereClauses.push('archived_at IS NULL');
  }

  if (filters.search) {
    whereClauses.push('(title LIKE ? OR content LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const where = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  params.push(limit, offset);

  const result = db.query(`SELECT * FROM memory_entries ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`, params);
  return result as MemoryEntry[];
}

export function updateCrossDivisionShare(
  db: DatabaseInstance,
  shareId: string,
  updates: Partial<Pick<CrossDivisionShare, 'status' | 'revoked_at' | 'approved_by_type' | 'approved_by_id' | 'approved_at'>>
): CrossDivisionShare {
  const existing = db.query('SELECT * FROM cross_division_shares WHERE share_id = ?', [shareId])[0] as CrossDivisionShare;
  if (!existing) throw new Error(`Cross-division share '${shareId}' not found`);

  const now = new Date().toISOString();
  db.runPreparedStatement('updateCrossDivisionShare', [
    updates.status ?? existing.status,
    updates.revoked_at ?? existing.revoked_at,
    updates.approved_by_type ?? existing.approved_by_type,
    updates.approved_by_id ?? existing.approved_by_id,
    updates.approved_at ?? existing.approved_at,
    shareId
  ]);

  const result = db.query('SELECT * FROM cross_division_shares WHERE share_id = ?', [shareId]);
  return result[0] as CrossDivisionShare;
}

// --- Activity Operations ---

export interface ActivityItem {
  id: string;
  title: string;
  time: string;
  type: 'task' | 'deliverable' | 'staff' | 'division' | 'approval' | 'execution' | 'message' | 'meeting';
  href?: string;
  metadata?: Record<string, any>;
}

// Helper: Check if task belongs to owner context
function taskBelongsToOwner(db: DatabaseInstance, taskId: string, ownerType: string, ownerId: string): boolean {
  const task = db.query('SELECT assigned_to_type, assigned_to_id, created_by_type, created_by_id FROM tasks WHERE task_id = ?', [taskId]);
  if (task.length === 0) return false;
  const t = task[0];
  // Founder sees all, others must own the task
  if (ownerType === 'founder') return true;
  return t.assigned_to_type === ownerType && t.assigned_to_id === ownerId;
}

export function listActivity(
  db: DatabaseInstance,
  ctx: { owner_type: string; owner_id: string },
  options: { limit: number; offset: number }
): ActivityItem[] {
  const items: ActivityItem[] = [];
  const isFounder = ctx.owner_type === 'founder';
  const batchSize = Math.ceil(options.limit / 3);

  // 1. Task audit entries (recent task changes) - FILTERED BY AUTHORIZATION
  // Founder sees all, others only see their tasks
  let taskAudit: any[];
  if (isFounder) {
    taskAudit = db.query(`
      SELECT audit_id, task_id, mutation_type, details, actor_type, actor_id, runtime, created_at
      FROM task_audit
      ORDER BY created_at DESC
      LIMIT ?
    `, [batchSize]);
  } else {
    taskAudit = db.query(`
      SELECT ta.audit_id, ta.task_id, ta.mutation_type, ta.details, ta.actor_type, ta.actor_id, ta.runtime, ta.created_at
      FROM task_audit ta
      JOIN tasks t ON ta.task_id = t.task_id
      WHERE (t.assigned_to_type = ? AND t.assigned_to_id = ?) OR (t.created_by_type = ? AND t.created_by_id = ?)
      ORDER BY ta.created_at DESC
      LIMIT ?
    `, [ctx.owner_type, ctx.owner_id, ctx.owner_type, ctx.owner_id, batchSize]);
  }

  for (const audit of taskAudit) {
    items.push({
      id: `task-${audit.audit_id}`,
      title: `Task ${audit.mutation_type}: ${audit.task_id}`,
      time: audit.created_at,
      type: 'task',
      href: `/tasks?task=${audit.task_id}`,
      metadata: {
        mutation_type: audit.mutation_type,
        actor_type: audit.actor_type,
        actor_id: audit.actor_id,
        details: audit.details,
      },
    });
  }

  // 2. Memory entries (recent task/deliverable history) - FILTERED BY AUTHORIZATION
  // Memory visibility follows checkMemoryAccess logic from operations.ts
  // Founder: all memories; Staff/Division: only their own (plus shared access)
  if (isFounder) {
    var memories = db.query(`
      SELECT memory_id, title, memory_type, category, owner_type, owner_id, created_at, updated_at
      FROM memory_entries
      WHERE archived_at IS NULL
      ORDER BY updated_at DESC
      LIMIT ?
    `, [batchSize]);
  } else {
    // Non-Founder: Only show memories they have access to
    // This includes: owned memories, division_shared (their division), cross_division (shared with their division)
    // For staff: also shared with their divisions via division_members
    // Build recipient divisions list based on authenticated context
    if (ctx.owner_type === 'division') {
      // Division: their own division membership
      var memories = db.query(`
        SELECT m.memory_id, m.title, m.memory_type, m.category, m.owner_type, m.owner_id, m.created_at, m.updated_at
        FROM memory_entries m
        WHERE m.archived_at IS NULL
          AND (
            m.category IN ('council_shared', 'decision_resolution', 'lesson_learned', 'business_context', 'idea_proposal', 'research_evidence', 'unresolved_question')
            OR (m.owner_type = 'division' AND m.owner_id = ? AND m.category IN ('division_shared', 'division_private'))
            OR (m.category = 'division_shared' AND m.division_id = ?)
            OR (m.category = 'cross_division' AND EXISTS (
              SELECT 1 FROM cross_division_shares
              WHERE memory_id = m.memory_id
                AND status = 'approved'
                AND revoked_at IS NULL
                AND division_id = ?
            ))
            OR (m.category = 'task_history' AND m.task_id IN (
              SELECT task_id FROM tasks WHERE (assigned_to_type = 'division' AND assigned_to_id = ?) OR (created_by_type = 'division_head' AND created_by_id = ?)
            ))
            OR (m.owner_type = ? AND m.owner_id = ?)
          )
        ORDER BY m.updated_at DESC
        LIMIT ?
      `, [ctx.owner_id, ctx.owner_id, ctx.owner_id, ctx.owner_type, ctx.owner_id, batchSize]);
    } else if (ctx.owner_type === 'staff') {
      // Staff: member of their divisions via division_members
      var memories = db.query(`
        SELECT m.memory_id, m.title, m.memory_type, m.category, m.owner_type, m.owner_id, m.created_at, m.updated_at
        FROM memory_entries m
        WHERE m.archived_at IS NULL
          AND (
            m.category IN ('council_shared', 'decision_resolution', 'lesson_learned', 'business_context', 'idea_proposal', 'research_evidence', 'unresolved_question')
            OR (m.owner_type = 'staff' AND m.owner_id = ? AND m.category = 'staff_private')
            OR (m.category = 'division_shared' AND m.division_id IN (SELECT division_id FROM division_members WHERE staff_id = ?))
            OR (m.category = 'cross_division' AND EXISTS (
              SELECT 1 FROM cross_division_shares
              WHERE memory_id = m.memory_id
                AND status = 'approved'
                AND revoked_at IS NULL
                AND division_id IN (SELECT division_id FROM division_members WHERE staff_id = ?)
            ))
            OR (m.category = 'task_history' AND m.task_id IN (
              SELECT task_id FROM tasks WHERE assigned_to_type = 'staff' AND assigned_to_id = ?
            ))
            OR (m.owner_type = ? AND m.owner_id = ?)
          )
        ORDER BY m.updated_at DESC
        LIMIT ?
      `, [ctx.owner_id, ctx.owner_id, ctx.owner_id, ctx.owner_type, ctx.owner_id, batchSize]);
    } else {
      throw new Error('Unsupported owner type for activity query');
    }
  }

  for (const mem of memories) {
    const typeMap: Record<string, ActivityItem['type']> = {
      task_created: 'task',
      task_updated: 'task',
      task_completed: 'task',
      deliverable_submitted: 'deliverable',
      deliverable_approved: 'deliverable',
      deliverable_rejected: 'deliverable',
      execution_requested: 'execution',
      execution_approved: 'execution',
      execution_completed: 'execution',
      meeting_phase: 'meeting',
      council_decision: 'approval',
      staff_appointed: 'staff',
    };
    const type = typeMap[mem.memory_type] || 'task';
    items.push({
      id: `memory-${mem.memory_id}`,
      title: mem.title,
      time: mem.updated_at,
      type,
      href: `/memory?entry=${mem.memory_id}`,
      metadata: {
        memory_type: mem.memory_type,
        category: mem.category,
        owner_type: mem.owner_type,
        owner_id: mem.owner_id,
      },
    });
  }

  // 3. Recent messages (new conversations) - FILTERED BY PARTICIPATION
  if (isFounder) {
    var messages = db.query(`
      SELECT m.id, m.sender_id, m.recipient_id, m.content, m.created_at
      FROM messages m
      ORDER BY m.created_at DESC
      LIMIT ?
    `, [batchSize]);
  } else {
    var messages = db.query(`
      SELECT m.id, m.sender_id, m.recipient_id, m.content, m.created_at
      FROM messages m
      WHERE m.sender_id = ? OR m.recipient_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `, [ctx.owner_id, ctx.owner_id, batchSize]);
  }

  for (const msg of messages) {
    items.push({
      id: `message-${msg.id}`,
      title: msg.content.length > 80 ? msg.content.substring(0, 80) + '...' : msg.content,
      time: msg.created_at,
      type: 'message',
      href: `/chat?conversation=${msg.sender_id === ctx.owner_id ? msg.recipient_id : msg.sender_id}`,
      metadata: {
        sender_id: msg.sender_id,
        recipient_id: msg.recipient_id,
      },
    });
  }

  // Sort all by time descending
  items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  // Apply pagination
  return items.slice(options.offset, options.offset + options.limit);
}