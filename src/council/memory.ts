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

export function listMemoryEntries(
  db: DatabaseInstance,
  filters?: { owner_type?: MemoryOwnerType; owner_id?: string; category?: MemoryCategory; archived?: boolean; limit?: number; offset?: number }
): MemoryEntry[] {
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (filters?.owner_type) {
    whereClauses.push('owner_type = ?');
    params.push(filters.owner_type);
  }
  if (filters?.owner_id) {
    whereClauses.push('owner_id = ?');
    params.push(filters.owner_id);
  }
  if (filters?.category) {
    whereClauses.push('category = ?');
    params.push(filters.category);
  }
  if (filters?.archived === false) {
    whereClauses.push('archived_at IS NULL');
  } else if (filters?.archived === true) {
    whereClauses.push('archived_at IS NOT NULL');
  }

  const where = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  const result = db.query(
    `SELECT * FROM memory_entries ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return result as MemoryEntry[];
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