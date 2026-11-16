# Agent Registry Audit — Council Bridge
**Generated:** 2026-11-16
**Based on:** DATABASE_AUDIT.md, BACKEND_AUDIT.md
**Database:** `data/council.db` (schema v5.0.0)

---

## Canonical Organizational Registry

### Council Seats (11 Total)

| Seat ID | Name | Status | Is Founder | Persona ID |
|---------|------|--------|------------|------------|
| seat-01 | Steve Jobs | permanent | ✅ | persona-steve-jobs |
| seat-02 | Virgil Abloh | permanent | ✅ | persona-virgil-abloh |
| seat-03 | Shawn Stüssy | permanent | ✅ | persona-shawn-stussy |
| seat-04 | G-Dragon (Kwon Ji-yong) | permanent | ✅ | persona-g-dragon |
| seat-05 | Seat 05 - Vacant | vacant | ❌ | — |
| seat-06 | Seat 06 - Vacant | vacant | ❌ | — |
| seat-07 | Seat 07 - Vacant | vacant | ❌ | — |
| seat-08 | Seat 08 - Vacant | vacant | ❌ | — |
| seat-09 | Seat 09 - Vacant | vacant | ❌ | — |
| seat-10 | Seat 10 - Vacant | vacant | ❌ | — |
| seat-11 | Seat 11 - Vacant | vacant | ❌ | — |

**Invariants:**
- ✅ 4 permanent seats (founding members)
- ✅ 7 vacant/replaceable seats
- ✅ No duplicate seat_ids
- ✅ Status values: permanent, vacant, replaceable

---

### Personas (4 Founding Members)

| Persona ID | Seat ID | Name |
|------------|---------|------|
| persona-steve-jobs | seat-01 | Steve Jobs |
| persona-virgil-abloh | seat-02 | Virgil Abloh |
| persona-shawn-stussy | seat-03 | Shawn Stüssy |
| persona-g-dragon | seat-04 | G-Dragon |

**Note:** Only founding members have personas. Vacant seats have no personas (by design).

---

### Runtime Persona Mappings (8 Total)

| Runtime | Persona ID | Notes |
|---------|------------|-------|
| claude | persona-steve-jobs | |
| hermes | persona-steve-jobs | |
| claude | persona-virgil-abloh | |
| hermes | persona-virgil-abloh | |
| claude | persona-shawn-stussy | |
| hermes | persona-shawn-stussy | |
| claude | persona-g-dragon | |
| hermes | persona-g-dragon | |

**Invariants:**
- ✅ Each founding persona mapped to both runtimes
- ✅ No duplicate (runtime, persona_id) pairs
- ✅ These are **runtime mappings**, not additional organizational identities

---

### Divisions (6 Canonical)

| Division ID | Name | Head Staff ID | Head Name |
|-------------|------|---------------|-----------|
| developer | Developer Division | staff-dev-head-001 | Division Head, Developer Division |
| marketing | Marketing Division | staff-marketing-head-001 | Division Head, Marketing Division |
| finance | Finance Division | staff-finance-head-001 | Division Head, Finance Division |
| creative | Creative Division | staff-creative-head-001 | Division Head, Creative Division |
| research-intelligence | Research & Intelligence Division | staff-research-head-001 | Division Head, Research & Intelligence Division |
| business-operations | Business Operations Division | staff-ops-head-001 | Division Head, Business Operations Division |

**Invariants:**
- ✅ Exactly 6 divisions
- ✅ Each has exactly 1 division head
- ✅ Division heads are **NOT** council voting members

---

### Staff Agents (51 Canonical)

#### Division Heads (6)

| Staff ID | Name | Division ID |
|----------|------|-------------|
| staff-dev-head-001 | Division Head, Developer Division | developer |
| staff-marketing-head-001 | Division Head, Marketing Division | marketing |
| staff-finance-head-001 | Division Head, Finance Division | finance |
| staff-creative-head-001 | Division Head, Creative Division | creative |
| staff-research-head-001 | Division Head, Research & Intelligence Division | research-intelligence |
| staff-ops-head-001 | Division Head, Business Operations Division | business-operations |

#### Developer Division Specialists (9)

| Staff ID | Name | Division |
|----------|------|----------|
| staff-dev-platform-001 | Platform Engineering Lead | developer |
| staff-dev-devops-001 | DevOps/Infrastructure Lead | developer |
| staff-dev-senior-staff-001 | Senior Staff Engineer | developer |
| staff-dev-multiagent-001 | Multi-Agent Systems Lead | developer |
| staff-dev-dx-001 | Developer Experience Lead | developer |
| staff-dev-engmgr-001 | Engineering Manager | developer |
| staff-dev-security-001 | Security Architect | developer |
| staff-dev-data-001 | Data/ML Engineering Lead | developer |
| staff-dev-techwriter-001 | Technical Writer | developer |

#### Marketing Division Specialists (7)

| Staff ID | Name | Division |
|----------|------|----------|
| staff-marketing-growth-001 | Growth/Acquisition Lead | marketing |
| staff-marketing-social-001 | Social/Community Lead | marketing |
| staff-marketing-content-001 | Content/Brand Storyteller | marketing |
| staff-marketing-brand-001 | Brand Strategist (Deputy) | marketing |
| staff-marketing-product-001 | Product Marketing Lead | marketing |

#### Finance Division Specialists (9)

| Staff ID | Name | Division |
|----------|------|----------|
| staff-finance-ar-001 | Accounts Receivable Lead | finance |
| staff-finance-ap-001 | Accounts Payable Lead | finance |
| staff-finance-ir-001 | Investor Relations Lead | finance |
| staff-finance-fpamgr-001 | FP&A Manager | finance |
| staff-finance-treasury-001 | Treasury Lead | finance |
| staff-finance-corpfin-001 | Corporate Finance Lead | finance |
| staff-finance-tax-001 | Tax Specialist | finance |
| staff-finance-invest-001 | Investment Analyst | finance |
| staff-finance-control-001 | Financial Controller | finance |

#### Creative Division Specialists (10)

| Staff ID | Name | Division |
|----------|------|----------|
| staff-creative-lore-001 | Lore Keeper | creative |
| staff-creative-copy-001 | Copywriter | creative |
| staff-creative-ops-001 | Creative Operations Lead | creative |
| staff-creative-fashion-001 | Fashion/Streetwear Designer | creative |
| staff-creative-lore-editor-001 | Lore Editor | creative |
| staff-creative-motion-001 | Motion Designer | creative |
| staff-creative-worldbuilding-001 | Worldbuilding Lead | creative |
| staff-creative-designsys-001 | Design Systems Lead | creative |
| staff-creative-uxr-001 | UX Researcher | creative |
| staff-creative-content-001 | Content Strategist | creative |

#### Research & Intelligence Specialists (5)

| Staff ID | Name | Division |
|----------|------|----------|
| staff-research-compintel-001 | Competitive Intelligence Lead | research-intelligence |
| staff-research-market-001 | Market Research Lead | research-intelligence |
| staff-research-data-001 | Data Analyst | research-intelligence |
| staff-research-osint-001 | OSINT Analyst | research-intelligence |
| staff-research-synthesis-001 | Research Synthesis Lead | research-intelligence |

#### Business Operations Specialists (7)

| Staff ID | Name | Division |
|----------|------|----------|
| staff-ops-facilities-001 | Facilities Manager | business-operations |
| staff-ops-legal-001 | Legal Counsel | business-operations |
| staff-ops-procurement-001 | Procurement Lead | business-operations |
| staff-ops-process-001 | Process Improvement Lead | business-operations |
| staff-ops-program-001 | Program Manager | business-operations |
| staff-ops-creative-001 | Creative Operations Coordinator | business-operations |
| staff-ops-people-001 | People Operations Lead | business-operations |

---

### Division Members (51 Canonical)

Each staff agent has exactly one membership record in `division_members` linking them to their division.

| Staff ID | Division ID | Role |
|----------|-------------|------|
| (All 51 staff_ids above) | (Matching division) | head / specialist |

**Invariants:**
- ✅ 51 division members (1 per staff agent)
- ✅ No duplicate (staff_id, division_id) pairs
- ✅ All division_ids valid

---

### Staff Runtime Personas (102 Canonical Estimated)

Each of the 51 staff agents mapped to both `claude` and `hermes` runtimes.

| Runtime | Staff ID | (51 staff × 2 runtimes = 102 mappings) |
|---------|----------|----------------------------------------|
| claude | staff-dev-head-001 | |
| hermes | staff-dev-head-001 | |
| ... | ... | (all 51 staff agents) |

**Note:** Current DB has 938 entries — 836 are test staff mappings. After cleanup, only 102 canonical mappings should remain.

---

### Runtime Agent Registry (Agents Table)

#### Canonical Agents (Estimated ~11)

| Agent ID | Display Name | Runtime | Purpose |
|----------|--------------|---------|---------|
| founder | Founder | claude | Founder identity |
| claude | Claude Code | claude-code | Claude runtime |
| hermes | Hermes Agent | hermes | Hermes runtime |
| persona-steve-jobs | Steve Jobs | claude | Council persona |
| persona-steve-jobs | Steve Jobs | hermes | Council persona |
| persona-virgil-abloh | Virgil Abloh | claude | Council persona |
| persona-virgil-abloh | Virgil Abloh | hermes | Council persona |
| persona-shawn-stussy | Shawn Stüssy | claude | Council persona |
| persona-shawn-stussy | Shawn Stüssy | hermes | Council persona |
| persona-g-dragon | G-Dragon | claude | Council persona |
| persona-g-dragon | G-Dragon | hermes | Council persona |

#### Test Agents (To Remove — ~150)

| Pattern | Examples |
|---------|----------|
| `new-agent-<timestamp>-<random>` | 100+ auto-generated Hermes agents |
| `test-agent-<num>` | test-agent-1, test-agent-001 |
| Hardcoded test IDs | a1, a2, sender, recipient, agent-1, staff-001, div-001, other-agent |

---

## Identity Count Summary

| Category | Canonical | Test/Archive | Total (Current) |
|----------|-----------|--------------|-----------------|
| Council seats | 11 | 0 | 11 |
| Personas | 4 | 0 | 4 |
| Runtime personas | 8 | 0 | 8 |
| Divisions | 6 | ~4,850 | 5,427 |
| Division heads | 6 | 0 | 6 |
| Specialists | 45 | ~6,095 | 6,925 |
| Division members | 51 | ~5,478 | 5,529 |
| Staff agents | 51 | ~6,095 | 6,925 |
| Staff runtime mappings | 102 | ~836 | 938 |
| Agents (runtime) | ~11 | ~150 | 160 |
| Quality thresholds | 1 | 154 | 155 |
| Task autonomy levels | 3 | 144 | 147 |

**Total Canonical Organizational Identities: 62** (11 seats + 51 staff)
**Total Logical Division Identities: 51** (6 heads + 45 specialists)

---

## Key Invariants Verified

| Invariant | Status | Evidence |
|-----------|--------|----------|
| 11 council seats | ✅ | `council_seats` count = 11 |
| 4 permanent seats | ✅ | 4 seats with `status='permanent', is_founder=1` |
| 7 vacant seats | ✅ | 7 seats with `status='vacant'` |
| 6 divisions | ✅ | 6 divisions with canonical division_ids |
| 6 division heads | ✅ | 6 staff with `division_id` matching, 1 per division |
| 45 specialists | ✅ | 51 total staff - 6 heads = 45 |
| Division heads not council | ✅ | No staff_id in council_seats |
| Specialists not council | ✅ | No staff_id in council_seats |
| 4 founding personas | ✅ | `personas` count = 4 |
| 8 runtime mappings | ✅ | `runtime_personas` count = 8 |
| Constitution v1.0.0 | ✅ | `constitutions` has v1.0.0 |
| No duplicate org identities | ✅ | All canonical IDs unique |

---

## Test Data Patterns (For Cleanup Reference)

### Division Test Patterns
- `Developer-%` — ~4,800 entries (hex suffixes)
- `Division-%` — ~50 entries
- `test-div-%` — ~10 entries
- UUID-like division_ids with non-canonical names

### Staff Test Patterns
- Status: mostly `active` (test data generator sets active)
- Division IDs: reference test divisions above
- Naming: auto-generated role names per test division

### Agent Test Patterns
- `new-agent-<unix-timestamp>-<random>` — bulk Hermes test agents
- `test-agent-<num>` — explicit test agents
- Hardcoded: a1, a2, sender, recipient, agent-1, staff-001, div-001, other-agent

---

## Post-Cleanup Verification Queries

```sql
-- After cleanup, these should return exact canonical counts:

SELECT COUNT(*) FROM council_seats;                    -- 11
SELECT COUNT(*) FROM personas;                         -- 4
SELECT COUNT(*) FROM runtime_personas;                 -- 8
SELECT COUNT(*) FROM divisions;                        -- 6
SELECT COUNT(*) FROM staff_agents;                     -- 51
SELECT COUNT(*) FROM division_members;                 -- 51
SELECT COUNT(*) FROM quality_thresholds;               -- 1
SELECT COUNT(*) FROM task_autonomy_levels;             -- 3
SELECT COUNT(*) FROM agents WHERE agent_id NOT LIKE 'new-agent-%' 
    AND agent_id NOT LIKE 'test-agent-%' 
    AND agent_id NOT IN ('a1','a2','sender','recipient','agent-1','staff-001','div-001','other-agent'); -- ~11
SELECT COUNT(*) FROM staff_runtime_personas;           -- 102
```

---

## Registry Integrity Checks

| Check | Query | Expected |
|-------|-------|----------|
| Division heads exist in staff | `SELECT COUNT(*) FROM divisions d JOIN staff_agents s ON d.head_staff_id = s.staff_id` | 6 |
| All staff have division | `SELECT COUNT(*) FROM staff_agents WHERE division_id IS NULL` | 0 |
| All division members valid | `SELECT COUNT(*) FROM division_members dm JOIN divisions d ON dm.division_id = d.division_id JOIN staff_agents s ON dm.staff_id = s.staff_id` | 51 |
| No orphaned runtime mappings | `SELECT COUNT(*) FROM staff_runtime_personas srp LEFT JOIN staff_agents sa ON srp.staff_id = sa.staff_id WHERE sa.staff_id IS NULL` | 0 |
| Constitution exists | `SELECT COUNT(*) FROM constitutions WHERE version = '1.0.0'` | 1 |

---

*This registry audit establishes the canonical organizational state. All cleanup operations must preserve these 62 identities exactly.*