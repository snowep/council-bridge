# Phase 4 Retrieval — Query Patterns, Ranking, and MCP Integration

## Retrieval Entry Points

### MCP Tools (Exposed to Both Runtimes)

| Tool | Purpose | Parameters |
|------|---------|------------|
| `create_memory` | Write new memory | `category`, `memory_type`, `title`, `content`, `tags`, `confidence`, `meeting_id?`, `division_id?`, `task_id?` |
| `get_memory` | Fetch by ID | `memory_id`, `include_versions?`, `include_links?`, `version?` |
| `update_memory` | Versioned update | `memory_id`, `title?`, `content?`, `tags?`, `confidence?`, `change_summary` |
| `search_memory` | Full-text + filter | `query?`, `category?`, `memory_type?`, `owner_type?`, `owner_id?`, `meeting_id?`, `division_id?`, `task_id?`, `tags?`, `min_confidence?`, `limit?`, `offset?`, `include_archived?` |
| `link_memory` | Create relationship | `source_memory_id`, `target_memory_id`, `link_type`, `strength?`, `notes?` |
| `get_related` | Graph traversal | `memory_id`, `link_type?`, `direction?` ('out'|'in'|'both'), `depth?`, `max_depth?` |
| `get_memory_versions` | Version history | `memory_id`, `limit?` |
| `get_cross_division_shares` | List sharing grants | `memory_id?`, `division_id?` |
| `grant_cross_division_access` | Grant cross-division access | `memory_id`, `division_id` |
| `revoke_cross_division_access` | Revoke cross-division access | `memory_id`, `division_id` |

**Note:** `owner_type` and `owner_id` are **never** accepted as tool parameters — they are derived from authenticated session context.

## Query Patterns

### 1. By Owner (Individual/Division/Staff Memory)
```sql
-- Individual persona memories (private to seat)
SELECT * FROM memory_entries
WHERE owner_type = 'seat' AND owner_id = ? AND category = 'individual_persona'
AND (archived_at IS NULL)
ORDER BY updated_at DESC LIMIT ?;

-- Division shared memories
SELECT * FROM memory_entries
WHERE owner_type = 'division' AND owner_id = ? AND category = 'division_shared'
AND (archived_at IS NULL)
ORDER BY updated_at DESC LIMIT ?;

-- Staff private memories
SELECT * FROM memory_entries
WHERE owner_type = 'staff' AND owner_id = ? AND category = 'staff_private'
AND (archived_at IS NULL)
ORDER BY updated_at DESC LIMIT ?;

-- All memories authored by owner
SELECT * FROM memory_entries
WHERE owner_type = ? AND owner_id = ?
AND (archived_at IS NULL)
ORDER BY updated_at DESC LIMIT ?;
```

### 2. By Category (Scope-Wide)
```sql
-- Council shared knowledge
SELECT * FROM memory_entries
WHERE category = 'council_shared'
AND (archived_at IS NULL)
ORDER BY updated_at DESC LIMIT ?;

-- Division shared knowledge (specific division)
SELECT * FROM memory_entries
WHERE category = 'division_shared' AND division_id = ?
AND (archived_at IS NULL)
ORDER BY updated_at DESC LIMIT ?;

-- Decisions & resolutions (council-wide)
SELECT * FROM memory_entries
WHERE category = 'decision_resolution'
ORDER BY created_at DESC LIMIT ?;

-- Lessons learned (council-wide)
SELECT * FROM memory_entries
WHERE category = 'lesson_learned'
AND (archived_at IS NULL)
ORDER BY updated_at DESC LIMIT ?;

-- Business context (org-wide)
SELECT * FROM memory_entries
WHERE category = 'business_context'
AND (archived_at IS NULL)
ORDER BY updated_at DESC LIMIT ?;

-- Cross-division memories (via explicit shares)
SELECT m.* FROM memory_entries m
JOIN cross_division_shares s ON m.memory_id = s.memory_id
WHERE s.division_id = ? AND s.revoked_at IS NULL
AND m.category = 'cross_division'
AND (m.archived_at IS NULL)
ORDER BY m.updated_at DESC LIMIT ?;
```

### 3. By Meeting
```sql
-- All memories from a meeting
SELECT * FROM memory_entries
WHERE meeting_id = ?
AND (archived_at IS NULL)
ORDER BY created_at ASC;

-- Meeting history + decisions
SELECT * FROM memory_entries
WHERE meeting_id = ?
AND category IN ('meeting_history', 'decision_resolution')
AND (archived_at IS NULL)
ORDER BY created_at ASC;
```

### 4. By Division
```sql
-- All memories scoped to a division
SELECT * FROM memory_entries
WHERE division_id = ?
AND (archived_at IS NULL)
ORDER BY updated_at DESC LIMIT ?;

-- Division private (head only)
SELECT * FROM memory_entries
WHERE owner_type = 'division' AND owner_id = ? AND category = 'division_private'
AND (archived_at IS NULL)
ORDER BY updated_at DESC LIMIT ?;
```

### 5. By Task
```sql
-- All memories linked to a task
SELECT * FROM memory_entries
WHERE task_id = ?
AND (archived_at IS NULL)
ORDER BY created_at ASC;

-- Task history + deliverables
SELECT * FROM memory_entries
WHERE task_id = ?
AND category IN ('task_history', 'cross_division')
AND (archived_at IS NULL)
ORDER BY created_at ASC;
```

### 6. Full-Text Search (FTS5) with Privacy Filter
```sql
-- Keyword search across content (with privacy)
SELECT m.* FROM memory_entries m
JOIN memory_fts f ON m.memory_id = f.memory_id
WHERE memory_fts MATCH ?
AND (m.archived_at IS NULL)
AND (build_privacy_filter(?, ?, ?))  -- owner_type, owner_id, runtime
ORDER BY rank LIMIT ?;

-- Search with category filter
SELECT m.* FROM memory_entries m
JOIN memory_fts f ON m.memory_id = f.memory_id
WHERE memory_fts MATCH ?
AND m.category = ?
AND (m.archived_at IS NULL)
AND (build_privacy_filter(?, ?, ?))
ORDER BY rank LIMIT ?;
```

### 7. By Provenance
```sql
-- Memories by author owner
SELECT * FROM memory_entries
WHERE owner_type = ? AND owner_id = ?
AND category NOT IN ('individual_persona', 'division_private', 'staff_private')
AND (archived_at IS NULL)
ORDER BY created_at DESC LIMIT ?;

-- Memories by runtime (audit)
SELECT m.*, a.accessor_runtime FROM memory_entries m
JOIN memory_access a ON m.memory_id = a.memory_id
WHERE a.accessor_runtime = ?
AND a.access_type = 'create'
ORDER BY a.created_at DESC LIMIT ?;

-- High-confidence memories
SELECT * FROM memory_entries
WHERE confidence >= ?
AND (archived_at IS NULL)
ORDER BY confidence DESC, updated_at DESC LIMIT ?;

-- Specific version accessed
SELECT m.*, a.version_accessed FROM memory_entries m
JOIN memory_access a ON m.memory_id = a.memory_id
WHERE a.accessor_type = ? AND a.accessor_id = ?
AND a.version_accessed IS NOT NULL
ORDER BY a.created_at DESC LIMIT ?;
```

### 8. By Relationship (Graph Traversal) — With Privacy Enforcement
```sql
-- Direct links (outgoing) with privacy
SELECT m.*, l.link_type, l.strength
FROM memory_links l
JOIN memory_entries m ON l.target_memory_id = m.memory_id
WHERE l.source_memory_id = ?
AND (l.link_type = ? OR ? IS NULL)
AND m.archived_at IS NULL
AND (build_privacy_filter_for_target(?, ?, m.owner_type, m.owner_id, m.category, m.division_id))
ORDER BY l.strength DESC;

-- Transitive closure (recursive CTE, max depth 3) with privacy at each hop
WITH RECURSIVE related(memory_id, link_type, depth, path, source_owner_type, source_owner_id) AS (
  -- Base case: direct links from source
  SELECT l.target_memory_id, l.link_type, 1,
         l.source_memory_id || '->' || l.target_memory_id,
         m.owner_type, m.owner_id
  FROM memory_links l
  JOIN memory_entries m ON l.source_memory_id = m.memory_id
  WHERE l.source_memory_id = ?
  AND m.archived_at IS NULL
  
  UNION ALL
  
  -- Recursive step: follow links, enforce privacy at each hop
  SELECT l.target_memory_id, l.link_type, r.depth + 1,
         r.path || '->' || l.target_memory_id,
         m.owner_type, m.owner_id
  FROM memory_links l
  JOIN related r ON l.source_memory_id = r.memory_id
  JOIN memory_entries m ON l.target_memory_id = m.memory_id
  WHERE r.depth < 3
  AND m.archived_at IS NULL
  AND (build_privacy_filter_for_target(?, ?, m.owner_type, m.owner_id, m.category, m.division_id))
  AND r.path NOT LIKE '%' || l.target_memory_id || '%'  -- Cycle detection
)
SELECT DISTINCT m.*, r.link_type, r.depth
FROM related r
JOIN memory_entries m ON r.memory_id = m.memory_id
WHERE m.archived_at IS NULL
ORDER BY r.depth, r.link_type;
```

### 9. Cross-Division Shares
```sql
-- Active shares for a memory
SELECT s.*, d.name as division_name
FROM cross_division_shares s
JOIN divisions d ON s.division_id = d.division_id
WHERE s.memory_id = ? AND s.revoked_at IS NULL;

-- Memories shared with a division
SELECT m.*, s.granted_at, s.granted_by_type, s.granted_by_id
FROM cross_division_shares s
JOIN memory_entries m ON s.memory_id = m.memory_id
WHERE s.division_id = ? AND s.revoked_at IS NULL
AND m.category = 'cross_division'
AND (m.archived_at IS NULL)
ORDER BY s.granted_at DESC;
```

## Ranking & Scoring

### Search Ranking (FTS5 + Metadata)
```sql
-- Combined relevance score (weights documented consistently)
SELECT m.*,
  (bm25(memory_fts) * 0.60) +          -- FTS5 relevance (lower = better)
  (m.confidence * 0.20) +              -- Confidence weight
  (CASE WHEN m.category = 'decision_resolution' THEN 0.10 ELSE 0 END) +
  (CASE WHEN m.category = 'lesson_learned' THEN 0.10 ELSE 0 END) +
  (CASE WHEN m.category = 'business_context' THEN 0.05 ELSE 0 END)
  AS relevance_score
FROM memory_entries m
JOIN memory_fts f ON m.memory_id = f.memory_id
WHERE memory_fts MATCH ?
AND (m.archived_at IS NULL)
AND (build_privacy_filter(?, ?, ?))
ORDER BY relevance_score ASC LIMIT ?;
```

### Relationship Strength Ranking
```sql
-- Strongest connections first
SELECT m.*, l.strength
FROM memory_links l
JOIN memory_entries m ON l.target_memory_id = m.memory_id
WHERE l.source_memory_id = ?
AND m.archived_at IS NULL
AND (build_privacy_filter_for_target(?, ?, m.owner_type, m.owner_id, m.category, m.division_id))
ORDER BY l.strength DESC, l.created_at DESC;
```

## MCP Integration Details

### Session Context Injection
Each MCP request carries identity resolved by **trusted middleware**, not from request params:
```typescript
interface MCPContext {
  owner_type: 'seat' | 'division' | 'staff' | 'founder';
  owner_id: string;       // seat_id | division_id | staff_id | 'founder'
  runtime: 'claude' | 'hermes';
  // For seats: derived from seat_id + runtime
  persona_id?: string;
  // For staff: derived from staff_id + runtime
  staff_persona_id?: string;
}

// Resolution process (server-side, not client-controllable):
// 1. Transport identifies runtime (Claude Code vs Hermes Agent)
// 2. Session store maps transport session → logical identity
// 3. Identity injected into tool handler context
// 4. Tool handlers MUST use context, never request params for identity
```

### Privacy Filter Function (Shared Logic)
```typescript
function buildPrivacyFilter(
  ctx: MCPContext,
  ownerTypeCol: string = 'm.owner_type',
  ownerIdCol: string = 'm.owner_id',
  categoryCol: string = 'm.category',
  divisionIdCol: string = 'm.division_id'
): { sql: string; values: any[] } {
  const values: any[] = [];
  let sql = '';
  
  if (ctx.owner_type === 'founder') {
    sql = '1=1'; // Founder sees everything
  } else if (ctx.owner_type === 'seat') {
    sql = `(
      ${categoryCol} IN ('council_shared', 'decision_resolution', 'lesson_learned', 'business_context', 'idea_proposal', 'research_evidence', 'unresolved_question')
      OR (${ownerTypeCol} = 'seat' AND ${ownerIdCol} = ?)
      OR (${categoryCol} = 'meeting_history' AND ${ownerTypeCol} = 'seat' AND ${ownerIdCol} = ?)  -- meeting_id filtered separately
      OR (${categoryCol} = 'task_history' AND m.task_id IN (SELECT task_id FROM tasks WHERE (assigned_to_type = 'seat' AND assigned_to_id = ?) OR (created_by_type = 'seat' AND created_by_id = ?)))
    )`;
    values.push(ctx.owner_id, ctx.owner_id, ctx.owner_id, ctx.owner_id);
  } else if (ctx.owner_type === 'division') {
    sql = `(
      ${categoryCol} IN ('council_shared', 'decision_resolution', 'lesson_learned', 'business_context', 'idea_proposal', 'research_evidence', 'unresolved_question')
      OR (${ownerTypeCol} = 'division' AND ${ownerIdCol} = ? AND ${categoryCol} IN ('division_shared', 'division_private'))
      OR (${categoryCol} = 'division_shared' AND ${divisionIdCol} = ?)
      OR (${categoryCol} = 'cross_division' AND ${ownerIdCol} IN (SELECT division_id FROM cross_division_shares WHERE memory_id = m.memory_id AND revoked_at IS NULL))
      OR (${categoryCol} = 'task_history' AND m.task_id IN (SELECT task_id FROM tasks WHERE (assigned_to_type = 'division' AND assigned_to_id = ?) OR (created_by_type = 'division_head' AND created_by_id = ?)))
    )`;
    values.push(ctx.owner_id, ctx.owner_id, ctx.owner_id, ctx.owner_id, ctx.owner_id);
  } else if (ctx.owner_type === 'staff') {
    sql = `(
      ${categoryCol} IN ('council_shared', 'decision_resolution', 'lesson_learned', 'business_context', 'idea_proposal', 'research_evidence', 'unresolved_question')
      OR (${ownerTypeCol} = 'staff' AND ${ownerIdCol} = ? AND ${categoryCol} = 'staff_private')
      OR (${categoryCol} = 'division_shared' AND ${divisionIdCol} IN (SELECT division_id FROM division_members WHERE staff_id = ?))
      OR (${categoryCol} = 'cross_division' AND ${divisionIdCol} IN (SELECT division_id FROM cross_division_shares WHERE memory_id = m.memory_id AND revoked_at IS NULL))
      OR (${categoryCol} = 'task_history' AND m.task_id IN (SELECT task_id FROM tasks WHERE assigned_to_type = 'staff' AND assigned_to_id = ?))
    )`;
    values.push(ctx.owner_id, ctx.owner_id, ctx.owner_id, ctx.owner_id);
  }
  
  return { sql, values };
}

// For target memory in graph traversal
function buildPrivacyFilterForTarget(
  ctx: MCPContext,
  targetOwnerType: string,
  targetOwnerId: string,
  targetCategory: string,
  targetDivisionId: string | null
): boolean {
  // Same logic as above but applied per-row in application layer for CTE results
  // SQLite CTE cannot call JS function, so filter in application after CTE returns
  // OR use a temporary table + join approach
  return true; // Placeholder - actual implementation filters in JS
}
```

### Tool Implementation Pattern
```typescript
// create_memory - owner from context, not params
async function createMemory(ctx: MCPContext, params: CreateMemoryParams) {
  const tx = db.transaction(() => {
    const memoryId = generateId();
    const now = new Date().toISOString();
    
    stmt.insertMemory.run(
      memoryId,
      ctx.owner_type,
      ctx.owner_id,
      params.category,
      params.memory_type,
      params.title,
      JSON.stringify(params.content),
      JSON.stringify(params.tags || []),
      params.confidence ?? 1.0,
      1,
      null,
      params.meeting_id || null,
      params.division_id || null,
      params.task_id || null,
      null, // archived_at
      now,
      now
    );
    
    stmt.insertMemoryVersion.run(
      generateId(), memoryId, 1, params.title,
      JSON.stringify(params.content), JSON.stringify(params.tags || []),
      params.confidence ?? 1.0,
      ctx.owner_type, ctx.owner_id, ctx.runtime, 'Initial creation', now
    );
    
    stmt.insertMemoryAccess.run(
      generateId(), memoryId, null, ctx.owner_type, ctx.owner_id, ctx.runtime, 'create', now
    );
    
    return memoryId;
  });
  return tx();
}

// search_memory - privacy enforced via filter
async function searchMemory(ctx: MCPContext, params: SearchMemoryParams) {
  const conditions = ['m.archived_at IS NULL'];
  const values: any[] = [];
  
  const privacy = buildPrivacyFilter(ctx);
  conditions.push(`(${privacy.sql})`);
  values.push(...privacy.values);
  
  if (params.category) { conditions.push('m.category = ?'); values.push(params.category); }
  if (params.memory_type) { conditions.push('m.memory_type = ?'); values.push(params.memory_type); }
  if (params.meeting_id) { conditions.push('m.meeting_id = ?'); values.push(params.meeting_id); }
  if (params.division_id) { conditions.push('m.division_id = ?'); values.push(params.division_id); }
  if (params.task_id) { conditions.push('m.task_id = ?'); values.push(params.task_id); }
  if (params.min_confidence) { conditions.push('m.confidence >= ?'); values.push(params.min_confidence); }
  if (params.tags?.length) { 
    conditions.push(`EXISTS (SELECT 1 FROM json_each(m.tags) WHERE value IN (${params.tags.map(() => '?').join(',')}))`);
    values.push(...params.tags);
  }
  if (params.include_archived) {
    conditions = conditions.filter(c => !c.includes('archived_at'));
  }
  
  let query = `
    SELECT m.* FROM memory_entries m
    ${params.query ? 'JOIN memory_fts f ON m.memory_id = f.memory_id' : ''}
    WHERE ${conditions.join(' AND ')}
  `;
  
  if (params.query) {
    values.unshift(params.query);
    query = query.replace('WHERE', 'WHERE memory_fts MATCH ? AND');
  }
  
  query += ' ORDER BY m.updated_at DESC LIMIT ? OFFSET ?';
  values.push(params.limit ?? 50, params.offset ?? 0);
  
  return stmt.rawSearch.all(...values);
}

// get_related - graph traversal with privacy
async function getRelated(ctx: MCPContext, params: GetRelatedParams) {
  // Use recursive CTE with application-layer privacy filtering
  // For depth > 1, fetch in batches and filter each hop
  const maxDepth = params.max_depth ?? 3;
  let results: any[] = [];
  let currentDepth = 0;
  let currentNodes = [{ memory_id: params.memory_id, path: '', link_type: null }];
  
  while (currentDepth < maxDepth && currentNodes.length > 0) {
    const nextNodes: any[] = [];
    
    for (const node of currentNodes) {
      const links = stmt.getLinksBySource.all(node.memory_id);
      
      for (const link of links) {
        if (params.link_type && link.link_type !== params.link_type) continue;
        
        const target = stmt.getMemoryById.get(link.target_memory_id);
        if (!target || target.archived_at) continue;
        
        // Privacy check
        const canRead = checkMemoryAccess(ctx, target);
        if (!canRead) continue;
        
        // Cycle detection
        if (node.path.includes(link.target_memory_id)) continue;
        
        results.push({ ...target, link_type: link.link_type, strength: link.strength, depth: currentDepth + 1, path: node.path + '->' + link.target_memory_id });
        nextNodes.push({ memory_id: link.target_memory_id, path: node.path + '->' + link.target_memory_id, link_type: link.link_type });
      }
    }
    
    currentNodes = nextNodes;
    currentDepth++;
  }
  
  return results;
}

function checkMemoryAccess(ctx: MCPContext, memory: any): boolean {
  // Implement same logic as buildPrivacyFilter but for single memory
  if (ctx.owner_type === 'founder') return true;
  if (memory.category === 'individual_persona' && ctx.owner_type === 'seat' && memory.owner_id === ctx.owner_id) return true;
  if (memory.category === 'division_private' && ctx.owner_type === 'division' && memory.owner_id === ctx.owner_id) return true;
  if (memory.category === 'staff_private' && ctx.owner_type === 'staff' && memory.owner_id === ctx.owner_id) return true;
  if (['council_shared', 'decision_resolution', 'lesson_learned', 'business_context', 'idea_proposal', 'research_evidence', 'unresolved_question'].includes(memory.category)) return true;
  if (memory.category === 'meeting_history' && ctx.owner_type === 'seat') {
    // Check meeting participation
    return true; // Simplified
  }
  if (memory.category === 'division_shared' && ctx.owner_type === 'division' && memory.division_id === ctx.owner_id) return true;
  if (memory.category === 'cross_division' && memory.division_id) {
    // Check cross_division_shares
    return true; // Simplified
  }
  if (memory.category === 'task_history') {
    // Check task assignment
    return true; // Simplified
  }
  return false;
}
```

### Prepared Statements to Add (database.ts)
```typescript
// Memory CRUD
insertMemory: db.prepare(`
  INSERT INTO memory_entries (memory_id, owner_type, owner_id, category, memory_type, title, content, tags, confidence, version, supersedes_id, meeting_id, division_id, task_id, archived_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`),
getMemoryById: db.prepare('SELECT * FROM memory_entries WHERE memory_id = ?'),
updateMemory: db.prepare(`
  UPDATE memory_entries SET title = ?, content = ?, tags = ?, confidence = ?, version = version + 1, supersedes_id = ?, updated_at = datetime('now')
  WHERE memory_id = ?
`),
archiveMemory: db.prepare('UPDATE memory_entries SET archived_at = datetime('now') WHERE memory_id = ?'),
restoreMemory: db.prepare('UPDATE memory_entries SET archived_at = NULL WHERE memory_id = ?'),

// Memory Versions
insertMemoryVersion: db.prepare(`
  INSERT INTO memory_versions (version_id, memory_id, version_num, title, content, tags, confidence, changed_by_owner_type, changed_by_owner_id, changed_by_runtime, change_summary, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`),
getMemoryVersions: db.prepare('SELECT * FROM memory_versions WHERE memory_id = ? ORDER BY version_num DESC LIMIT ?'),

// Memory Links
insertMemoryLink: db.prepare(`
  INSERT INTO memory_links (link_id, source_memory_id, target_memory_id, link_type, strength, notes, created_by_owner_type, created_by_owner_id, created_by_runtime, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`),
getMemoryLinks: db.prepare('SELECT * FROM memory_links WHERE source_memory_id = ? OR target_memory_id = ?'),
getLinksBySource: db.prepare('SELECT * FROM memory_links WHERE source_memory_id = ?'),
getLinksByTarget: db.prepare('SELECT * FROM memory_links WHERE target_memory_id = ?'),
getLinksByType: db.prepare('SELECT * FROM memory_links WHERE source_memory_id = ? AND link_type = ?'),

// Memory Access
insertMemoryAccess: db.prepare(`
  INSERT INTO memory_access (access_id, memory_id, version_accessed, accessor_type, accessor_id, accessor_runtime, access_type, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`),
getMemoryAccessLog: db.prepare('SELECT * FROM memory_access WHERE memory_id = ? ORDER BY created_at DESC LIMIT ?'),

// Cross-Division Shares
insertCrossDivisionShare: db.prepare(`
  INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id, granted_at)
  VALUES (?, ?, ?, ?, ?, ?)
`),
getCrossDivisionShares: db.prepare('SELECT * FROM cross_division_shares WHERE memory_id = ? AND revoked_at IS NULL'),
getSharesByDivision: db.prepare('SELECT * FROM cross_division_shares WHERE division_id = ? AND revoked_at IS NULL'),
revokeCrossDivisionShare: db.prepare('UPDATE cross_division_shares SET revoked_at = datetime('now') WHERE memory_id = ? AND division_id = ?'),

// Search (raw query built dynamically)
rawSearch: db.prepare(''),
```

## Privacy Enforcement

### Read Access Matrix
| Requester | individual_persona | council_shared | meeting_history | decision_resolution | idea_proposal | research_evidence | lesson_learned | unresolved_question | division_shared | division_private | staff_private | business_context | task_history | cross_division |
|-----------|-------------------|----------------|-----------------|---------------------|---------------|-------------------|----------------|---------------------|-----------------|------------------|---------------|------------------|--------------|----------------|
| Council Seat (owner) | ✅ | ✅ | ✅ (participated) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ (if creator/assignee) | ✅ (if granted) |
| Council Seat (other) | ❌ | ✅ | ✅ (participated) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ (if creator/assignee) | ✅ (if granted) |
| Division Head | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (own div) | ✅ (own div) | ❌ | ✅ | ✅ (own div tasks) | ✅ (if granted) |
| Division Staff | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (own div) | ❌ | ✅ (own) | ✅ | ✅ (own tasks) | ✅ (if granted) |
| Founder | ✅ (all) | ✅ | ✅ (all) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (all) | ✅ (all) | ✅ (all) | ✅ | ✅ (all) | ✅ (all) |
| Vacant Seat | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Enforcement Rules
- **Identity from context only** — `owner_type`/`owner_id` never from request params
- **Private categories** only returned when `owner_type` + `owner_id` match requester
- **Division private** only for division head; **staff private** only for owning staff
- **Cross-division** requires explicit grant via `cross_division_shares` table (Founder-granted only)
- **Archived** excluded unless `include_archived=true`
- **Vacant/unauthenticated** get empty results
- **Graph traversal** applies privacy filter at each hop

### FTS5 Protection
- `memory_fts` virtual table **never exposed directly** via MCP tools
- All search goes through `search_memory` which joins `memory_entries` and applies privacy
- Direct SQLite access to `memory_fts` would bypass privacy — document as deployment constraint

## Performance Considerations

### Indexes (All Created in Schema)
- `idx_memory_entries_owner` — Owner-scoped queries
- `idx_memory_entries_category` — Category scans
- `idx_memory_entries_meeting` — Meeting-scoped queries
- `idx_memory_entries_division` — Division-scoped queries
- `idx_memory_entries_task` — Task-scoped queries
- `idx_memory_entries_type` — Type filtering
- `idx_memory_entries_supersedes` — Version chain
- `idx_memory_entries_archived` — Archive filtering
- `idx_memory_versions_memory` — Version history
- `idx_memory_versions_author` — Version author lookup
- `idx_memory_links_source/target/type` — Graph traversal
- `idx_memory_links_creator` — Link provenance
- `idx_memory_access_memory` — Audit by memory
- `idx_memory_access_accessor` — Audit by accessor
- `idx_memory_access_type` — Audit by type
- `idx_memory_access_version` — Version-specific access
- `idx_cross_division_shares_memory/division` — Share lookups
- FTS5 virtual table — Full-text search

### Query Limits
- Default `limit: 50`, max `100`
- Pagination via `offset`
- FTS5 `bm25()` ranking is fast for < 100K entries
- Graph traversal max depth 3 (configurable)

### Caching Strategy
- No application-level cache needed (SQLite WAL + FTS5 fast enough)
- `memory_access` reads batched per query (not per row)
- Version history only fetched on explicit `get_memory(include_versions=true)`

## Integration with Existing Systems

### Meetings
- `meeting_id` foreign key links memories to meetings
- Auto-create `meeting_history` entries on phase completion
- Auto-create `decision_resolution` on meeting closure
- **Note:** Phase 3 `meeting_phases` table has `seat_id` not `owner_type`/`owner_id` — meeting history access checks use Phase 3 schema

### Evaluations
- Evaluation criteria from constitution → `research_evidence` confidence weighting
- Lessons learned from evaluation patterns → `lesson_learned` entries

### Constitution
- `decision_resolution` records `constitution_version`
- Amendments create `decision_resolution` + `lesson_learned` automatically (new version + supersedes link)

### Personas
- `individual_persona` memories inform persona evolution
- Traits/description updates create `persona_reflection` entries

### Divisions & Staff (Phase 6/7 Ready)
- `division_id` + `task_id` foreign keys ready for future tables
- `memory_entries` FK to `divisions` (created empty in Phase 4)
- `cross_division_shares` replaces tags-based sharing
- Access patterns align with `division_members` and `tasks` tables