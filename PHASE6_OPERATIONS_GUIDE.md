# Phase 6 Operations Guide

**Repository**: `snowep/council-bridge`  
**Base Commit**: `d1c1712f8a3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d`  
**Date**: 2026-11-13  
**Audience**: Founder (Primary Operator)  
**Status**: **PREPARATION COMPLETE — AWAITING FOUNDER AUTHORIZATION**

---

## 1. Starting and Stopping the Bridge

| Operation | Command | Notes |
|-----------|---------|-------|
| Start Bridge | `mcp__council-bridge__start` | Initializes both Claude Code and Hermes runtimes |
| Stop Bridge | `mcp__council-bridge__stop` | Gracefully terminates both runtimes |
| Check Status | `mcp__council-bridge__check_inbox` | Confirms active runtimes and agent registration |

---

## 2. Agent Registration

| Operation | Command | Prerequisites |
|-----------|---------|---------------|
| Register Agent | `register_agent(staff_id, name, role, division_id)` | Division exists, Founder approved appointment |
| Verify Registration | `check_inbox` | Agent must be registered |

**Runtime Instances**: Tracked via `runtime_instances` JSON field (e.g., `['claude', 'hermes']`)

---

## 3. Runtime Connection

- **Dual-Runtime Identity**: Each agent has one `staff_id` across both runtimes
- **Connection**: Agents connect via `check_inbox` to confirm active runtimes
- **Offline Behavior**: Messages queue per runtime and deliver when available
- **Runtime Status**: Viewable in `staff_agents.runtime_instances`

---

## 4. Division Operations

| Operation | Command | Authority |
|-----------|---------|-----------|
| Create Division | `create_division(name, description, budget_limit)` | **Founder only** |
| Update Division | `update_division(division_id, fields)` | **Founder only** |
| List Divisions | `list_divisions()` | All seats |
| Assign Division Head | `assign_division_head(division_id, staff_id)` | **Founder only** |
| Assign Specialist | `assign_specialist(staff_id, division_id)` | **Division Head** (their division) |
| List Specialists | `list_specialists(division_id)` | Division Head / Founder |

---

## 5. Staff Lifecycle

| State Transition | Command | Authority |
|------------------|---------|-----------|
| Appoint (inactive) | Founder records approval in `council_shared` memory | **Founder** |
| Activate | `update_staff_status(staff_id, 'active')` | **Founder** (after approval) |
| Suspend | `update_staff_status(staff_id, 'inactive')` | Division Head / Founder |
| Retire | `update_staff_status(staff_id, 'terminated')` | **Founder only** |

**Default Status**: `'inactive'` (enforced by Migration 001)

---

## 6. Task Delegation

| Operation | Command | Authority |
|-----------|---------|-----------|
| Create Task | `create_task(title, description, assigned_to_type, assigned_to_id, priority, due_at)` | Division Head / Founder |
| Update Task | `update_task(task_id, status, priority, due_at)` | Division Head (their tasks) |
| List Tasks | `list_tasks(filters)` | Division Head / Founder |
| Complete Task | `update_task(task_id, 'completed')` | Assigned specialist / Division Head |

**Status Flow**: `pending` → `in_progress` → `review` → `completed` / `cancelled`

**Dependencies**: Tracked via `dependencies` JSON array of `task_id`s

---

## 7. Deliverable Review

| Operation | Command | Authority |
|-----------|---------|-----------|
| Create Deliverable | `create_deliverable(task_id, content, submitted_by_type, submitted_by_id)` | Specialist / Division Head |
| Update Deliverable | `update_deliverable(deliverable_id, status, reviewed_by_type, reviewed_by_id)` | Founder / Council / Division Head |
| List Deliverables | `list_deliverables_by_task(task_id)` | All |

**Audit Log**: All status changes tracked in `deliverables.audit_log` (append-only JSON)

---

## 8. Cross-Division Requests

| Operation | Command | Authority |
|-----------|---------|-----------|
| Request Access | `request_cross_division_access(from_division, to_division, justification, priority, deadline)` | **Division Head** |
| Approve Request | `approve_cross_division_access(request_id)` | **Founder only** |
| Revoke Access | `revoke_cross_division_access(request_id)` | **Founder only** |
| List Pending | `list_pending_cross_division_requests()` | **Founder** |

**Request Types**: `task_delegate`, `deliverable_share`, `memory_access`, `resource_request`

---

## 9. Permission Management

| Role | Can Perform |
|------|-------------|
| **Founder** | All operations, grant/revoke cross-division access, appoint/activate agents |
| **Division Head** | Manage division tasks/specialists, request cross-division access |
| **Specialist** | Execute assigned tasks, create deliverables, request access via Division Head |

**Key Rule**: Division Heads and specialists **cannot grant themselves permissions**. All cross-division grants require Founder approval.

---

## 10. Troubleshooting

| Issue | Diagnosis | Resolution |
|-------|-----------|------------|
| Agent not receiving messages | `check_inbox` shows offline runtimes | Verify `runtime_instances` |
| Permission denied | `staff_id` or `division_id` mismatch | Verify `division_members` and `staff_agents` |
| Task dependency cycle | `dependencies` creates cycle | Detect via `list_tasks` and resolve |
| Cross-division grant rejected | `granted_by_type` not `'founder'` | Ensure Founder uses `approve_cross_division_access` |

---

## 11. Logging

| Log Type | Location | Purpose |
|----------|----------|---------|
| Audit Log | `deliverables.audit_log` (JSON) | All deliverable status changes |
| Migration Audit | `migration_audit` table | Legacy cross-division grant revocation |
| Memory Access | `memory_access` table | All memory read/write operations |
| Message Log | `messages` table | All agent communications |

---

## 12. Backup and Recovery

| Operation | Command | Notes |
|-----------|---------|-------|
| Backup Database | `backup_database` | Exports all tables (binary + CSV) |
| Restore Database | `restore_database(backup_path)` | Recovers from backup |
| Verify Backup | `PRAGMA foreign_key_check` | Run after restore |

**Pre-Migration Backup Required**: Binary backup (`.backup`), schema dump (`.schema`), CSV exports

---

## 13. Common Failure Scenarios

| Scenario | Prevention | Recovery |
|----------|------------|----------|
| Duplicate `staff_id` | Unique constraint | Check before registration |
| Permission misconfiguration | Founder approval required for grants | Audit `cross_division_shares` |
| Data loss during migration | Pre-migration backup + test suite | `.restore` from backup |
| Agent runtime desync | Single `staff_id` across runtimes | Verify `runtime_instances` |

---

*Document generated: 2026-11-13*  
*Base commit: d1c1712*