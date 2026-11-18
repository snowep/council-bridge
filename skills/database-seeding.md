---
name: database-seeding
description: Database seeding operations for Council Bridge development databases only
trigger: /seed-db
---

# Database Seeding Skill for Council Bridge

## ⚠️ CRITICAL SECURITY NOTICE

**This skill is for development and testing environments only.**

- **NEVER run on production databases**
- **NEVER use on operational databases containing live data**
- **Always verify the database path before executing any seeding operation**

## When to Run

Run only in these circumstances:
1. Setting up a new development or test database
2. Re-seeding an isolated test environment
3. CI/CD pipeline with explicitly set test database path

## Prerequisites

Before running any seeding command:

1. **Database Path Verification**
   ```bash
   # Check current working directory
   pwd
   
   # Verify database file location
   ls -la data/council.db
   
   # Check database type (must be isolated test DB)
   ```

2. **Explicit Database Path Required**
   ```bash
   # Set database path explicitly (never use default in operations)
   export DATABASE_PATH="/path/to/isolated/test/council.db"
   ```

3. **Production Protection Guards**
   ```bash
   # Verify NOT pointing to production
   if [ "$DATABASE_PATH" = "/path/to/production/council.db" ]; then
     echo "ERROR: Aborting - production database detected"
     exit 1
   fi
   ```

## Workflow

### Step 1: Verify Isolated Environment
```bash
# Confirm DATABASE_PATH is set and points to test environment
echo "Using database: $DATABASE_PATH"
[[ "$DATABASE_PATH" == *"test"* ]] || [[ "$DATABASE_PATH" == *"dev"* ]] || { echo "ERROR: Database must be in test/dev environment"; exit 1; }
```

### Step 2: Create Backup (if authorized)
```bash
# Only if explicitly authorized by Founder
if [ "$CREATE_BACKUP" = "true" ]; then
  cp "$DATABASE_PATH" "${DATABASE_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
  echo "Backup created"
fi
```

### Step 3: Execute Seeding (Development/Test Only)
```bash
# Run in isolated environment only
npx tsx scripts/seed-organization-full.ts --db-path="$DATABASE_PATH"
```

## Safety Protections

### Prohibited Operations
❌ `DELETE FROM` operational tables during normal operation
❌ `INSERT OR REPLACE` on production tables
❌ Automatic cleanup of any production records
❌ Hardcoded database paths in scripts

### Required Protections
✅ Explicit `--db-path` argument required
✅ Environment verification before execution
✅ Production path rejection (fail-fast)
✅ Backup verification when `--create-backup` flag used

## Script Location

The actual seeding scripts are located at:
- `scripts/seed-organization-full.ts`

## Script Requirements

The seeding script MUST implement:

1. **Environment Guard**
   ```typescript
   if (!process.env.DATABASE_PATH?.includes('test') && !process.env.DATABASE_PATH?.includes('dev')) {
     throw new Error('Database seeding only allowed in test/dev environments');
   }
   ```

2. **Explicit Path Verification**
   ```typescript
   const dbPath = process.env.DATABASE_PATH;
   if (!dbPath) {
     throw new Error('DATABASE_PATH environment variable must be set');
   }
   if (dbPath.includes('production')) {
     throw new Error('Production database seeding is prohibited');
   }
   ```

3. **Idempotent Operations**
   - Use `INSERT ... ON CONFLICT DO NOTHING` instead of `INSERT OR REPLACE`
   - Verify data exists before insertion
   - Never overwrite existing operational data

4. **No Destructive Cleanup**
   - Do not delete tasks, deliverables, approvals, or other operational data
   - Only seed foundational organizational data
   - Clear operations should be manual and explicitly authorized

## Foundational Data Only

This skill seeds ONLY:
- Divisions (foundational structure)
- Staff agents (foundational roles)
- Seed data for development environment

It does NOT:
- Delete production records
- Modify operational data
- Seed production with test identities

## Verification Steps

After seeding:

1. Confirm 6 divisions exist:
   ```sql
   SELECT COUNT(*) FROM divisions;
   ```
   Expected: 6

2. Confirm staff agents:
   ```sql
   SELECT COUNT(*) FROM staff_agents WHERE role != 'e2e-agent';
   ```
   Expected: 51 (6 division heads + 45 specialists)

3. Verify division heads assigned:
   ```sql
   SELECT d.name, s.name as head 
   FROM divisions d 
   LEFT JOIN staff_agents s ON d.head_staff_id = s.staff_id;
   ```
   Expected: All divisions should have a head

## Production Safety Checklist

✅ DATABASE_PATH explicitly set to test/dev location
✅ Production database NOT in path
✅ Backup strategy in place (if required)
✅ Explicit Founder authorization obtained (if modifying production data)
✅ No sensitive data exposed in logs
✅ No hardcoded secrets or credentials

## Related Skills
- `mui-standardization` - Component standards
- `layout-customization` - UI navigation

## Commands

| Purpose | Command |
|---------|---------|
| Seed organization | `npx tsx scripts/seed-organization-full.ts --db-path=$DATABASE_PATH` |
| Verify divisions | `node -e "const db = require('better-sqlite3')('$DATABASE_PATH'); console.log('Divisions:', db.prepare('SELECT COUNT(*) FROM divisions').all()[0]['COUNT(*)'])"` |
| Verify staff | `node -e "const db = require('better-sqlite3')('$DATABASE_PATH'); console.log('Staff:', db.prepare('SELECT COUNT(*) FROM staff_agents').all()[0]['COUNT(*)'])"` |

## ⚠️ FINAL WARNING

**By executing any command in this skill, you confirm:**

1. The target database is a development or test database
2. No production or operational data will be affected
3. You have proper authorization for any data operation
4. You understand the difference between seeding and production operations

**If you cannot confirm these requirements, DO NOT run any seeding commands.**

Contact your Founder for clarification on production data operations.