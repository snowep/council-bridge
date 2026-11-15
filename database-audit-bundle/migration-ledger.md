# Migration Ledger

| Version | Applied At |
|---------|------------|
| 2.0.0 | 2026-11-12 09:57:46 |
| 3.0.0 | 2026-11-12 10:16:40 |
| 4.0.0 | 2026-11-12 12:51:16 |
| 5.0.0 | 2026-11-14 03:40:43 |

### Migration Audit
(No migration audit records found)

### Migration Ledger (from migration_ledger table)
| Migration ID | Filename | Checksum | Checksum Algo | Applied At | Applied By | Duration MS | Status | Backup Path | Notes |
|--------------|----------|----------|---------------|------------|------------|-------------|--------|-------------|-------|
| 001 | 001_staff_agents_default_inactive.sql | c883b981aab62b3ddaf5e39a5731f3d59d3226dbc74bf4d61467160afaef8c52 | sha256 | 2026-11-13 06:09:40 | system | 203 | success | data\backups\council_pre_001_2026-11-13_06-09-40.db | {"targetTables":[]} |
| 002 | 002_cross_division_shares_founder_only.sql | 9833f7b44a5018086770e410ca3f6c4af5ee6d2eaf098f45eeddb5faf02405e5 | sha256 | 2026-11-13 06:09:40 | system | 206 | success | data\backups\council_pre_002_2026-11-13_06-09-40.db | {"targetTables":[]} |
| 003 | 003_tasks_add_columns.sql | 93068cffabab528155c2cbc9130b43ea51e9d580a99e2e49cdc6ec5e25bb14e7 | sha256 | 2026-11-13 06:09:40 | system | 182 | success | data\backups\council_pre_003_2026-11-13_06-09-40.db | {"targetTables":[]} |
| 004 | 004_deliverables_add_columns.sql | 66d3f9d68b68feb4ac2aa2be4a6f8976d465627c487138acb746627c757ce1c0 | sha256 | 2026-11-13 06:09:41 | system | 224 | success | data\backups\council_pre_004_2026-11-13_06-09-40.db | {"targetTables":[]} |
| 005 | 005_cross_division_shares_stage7.sql | 264d2d33c66f87e0131d9ac709b2e376e690eb66f47f18f8ec77cbaf00fb00a5 | sha256 | 2026-11-13 06:09:41 | system | 154 | success | data\backups\council_pre_005_2026-11-13_06-09-41.db | {"targetTables":[]} |
| 006 | 006_phase7_autonomy_execution.sql | 67311590f1aeed8c5011812b912ff9dc8da1ae0d9b57adda5eadbb5aec53e937 | sha256 | 2026-11-13 06:55:48 | system | 188 | success | data\backups\council_pre_006_2026-11-13_06-55-48.db | {"targetTables":[]} |
| 013 | 013_deliverable_workflow.sql | df3cea22d73c60b5db7d14fbd41b40625767b372d9fa08124c0054b36b568ebe | sha256 | 2026-11-14 20:23:12 | system |  | success | data\backups\council_pre_013_2026-11-14_20-22-59.db | {"targetTables":["deliverables","deliverable_versions","quality_thresholds"]} |
