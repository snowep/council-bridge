#!/usr/bin/env npx tsx
/**
 * Phase 9 Population Script
 * Populates the database with all 6 Division Heads and 45 specialists from council-bridge-roster.md
 */

import { createDatabase, DatabaseInstance } from '../src/database.js';
import {
  createDivision,
  registerStaffAgent,
  approveDivisionHead,
  approveSpecialist,
  activateStaffAgent,
  updateStaffAgent,
  addDivisionMember,
} from '../src/council/divisions.js';

const ctx = { owner_type: 'founder', owner_id: 'founder' };

// Division IDs matching the roster
const DIVISIONS = [
  {
    division_id: 'developer',
    name: 'Developer Division',
    description: 'Engineering, platform, infrastructure, and developer experience'
  },
  {
    division_id: 'marketing',
    name: 'Marketing Division',
    description: 'Growth, brand, content, product marketing, events, and analytics'
  },
  {
    division_id: 'finance',
    name: 'Finance Division',
    description: 'FP&A, investor relations, treasury, corporate finance, tax, and accounting'
  },
  {
    division_id: 'creative',
    name: 'Creative Division',
    description: 'Brand storytelling, copy, design systems, motion, UX research, and worldbuilding'
  },
  {
    division_id: 'research-intelligence',
    name: 'Research & Intelligence Division',
    description: 'Competitive intelligence, market research, data analysis, OSINT, and synthesis'
  },
  {
    division_id: 'business-operations',
    name: 'Business Operations Division',
    description: 'Facilities, legal, procurement, process, programs, creative ops, and people operations'
  }
];

// Division Heads from roster
const DIVISION_HEADS = [
  {
    staff_id: 'staff-dev-head-001',
    name: 'Division Head, Developer Division',
    role: 'Division Head, Developer Division',
    division_id: 'developer'
  },
  {
    staff_id: 'staff-marketing-head-001',
    name: 'Division Head, Marketing Division',
    role: 'Division Head, Marketing Division',
    division_id: 'marketing'
  },
  {
    staff_id: 'staff-finance-head-001',
    name: 'Division Head, Finance Division',
    role: 'Division Head, Finance Division',
    division_id: 'finance'
  },
  {
    staff_id: 'staff-creative-head-001',
    name: 'Division Head, Creative Division',
    role: 'Division Head, Creative Division',
    division_id: 'creative'
  },
  {
    staff_id: 'staff-research-head-001',
    name: 'Division Head, Research & Intelligence Division',
    role: 'Division Head, Research & Intelligence Division',
    division_id: 'research-intelligence'
  },
  {
    staff_id: 'staff-ops-head-001',
    name: 'Division Head, Business Operations Division',
    role: 'Division Head, Business Operations Division',
    division_id: 'business-operations'
  }
];

// Specialists from roster (45 total)
const SPECIALISTS = [
  // Developer Division - 9 specialists
  { staff_id: 'staff-dev-platform-001', name: 'Platform Engineering Lead', role: 'Platform Engineering Lead', division_id: 'developer' },
  { staff_id: 'staff-dev-devops-001', name: 'DevOps/Infrastructure Lead', role: 'DevOps/Infrastructure Lead', division_id: 'developer' },
  { staff_id: 'staff-dev-senior-staff-001', name: 'Senior Staff Engineer', role: 'Senior Staff Engineer', division_id: 'developer' },
  { staff_id: 'staff-dev-multiagent-001', name: 'Multi-Agent Systems Lead', role: 'Multi-Agent Systems Lead', division_id: 'developer' },
  { staff_id: 'staff-dev-dx-001', name: 'Developer Experience Lead', role: 'Developer Experience Lead', division_id: 'developer' },
  { staff_id: 'staff-dev-engmgr-001', name: 'Engineering Manager', role: 'Engineering Manager', division_id: 'developer' },
  { staff_id: 'staff-dev-security-001', name: 'Security Architect', role: 'Security Architect', division_id: 'developer' },
  { staff_id: 'staff-dev-data-001', name: 'Data/ML Engineering Lead', role: 'Data/ML Engineering Lead', division_id: 'developer' },
  { staff_id: 'staff-dev-techwriter-001', name: 'Technical Writer', role: 'Technical Writer', division_id: 'developer' },

  // Marketing Division - 7 specialists
  { staff_id: 'staff-marketing-growth-001', name: 'Growth/Acquisition Lead', role: 'Growth/Acquisition Lead', division_id: 'marketing' },
  { staff_id: 'staff-marketing-social-001', name: 'Social/Community Lead', role: 'Social/Community Lead', division_id: 'marketing' },
  { staff_id: 'staff-marketing-content-001', name: 'Content/Brand Storyteller', role: 'Content/Brand Storyteller', division_id: 'marketing' },
  { staff_id: 'staff-marketing-brand-001', name: 'Brand Strategist (Deputy)', role: 'Brand Strategist (Deputy)', division_id: 'marketing' },
  { staff_id: 'staff-marketing-product-001', name: 'Product Marketing Lead', role: 'Product Marketing Lead', division_id: 'marketing' },
  { staff_id: 'staff-marketing-events-001', name: 'Events/Field Marketing Lead', role: 'Events/Field Marketing Lead', division_id: 'marketing' },
  { staff_id: 'staff-marketing-analytics-001', name: 'Marketing Analytics/Attribution', role: 'Marketing Analytics/Attribution', division_id: 'marketing' },

  // Finance Division - 7 specialists
  { staff_id: 'staff-finance-ir-001', name: 'Investor Relations', role: 'Investor Relations', division_id: 'finance' },
  { staff_id: 'staff-finance-fpamgr-001', name: 'Senior FP&A Manager', role: 'Senior FP&A Manager', division_id: 'finance' },
  { staff_id: 'staff-finance-treasury-001', name: 'Treasury/Cash Management', role: 'Treasury/Cash Management', division_id: 'finance' },
  { staff_id: 'staff-finance-corpfin-001', name: 'Corporate Finance/Valuation', role: 'Corporate Finance/Valuation', division_id: 'finance' },
  { staff_id: 'staff-finance-tax-001', name: 'Tax Director', role: 'Tax Director', division_id: 'finance' },
  { staff_id: 'staff-finance-invest-001', name: 'Investment Analyst', role: 'Investment Analyst', division_id: 'finance' },
  { staff_id: 'staff-finance-control-001', name: 'Controller/Accounting Lead', role: 'Controller/Accounting Lead', division_id: 'finance' },

  // Creative Division - 10 specialists
  { staff_id: 'staff-creative-lore-001', name: 'Brand Storyteller/Lore Writer', role: 'Brand Storyteller/Lore Writer', division_id: 'creative' },
  { staff_id: 'staff-creative-copy-001', name: 'Copywriter/Verbal Identity', role: 'Copywriter/Verbal Identity', division_id: 'creative' },
  { staff_id: 'staff-creative-ops-001', name: 'Creative Operations', role: 'Creative Operations', division_id: 'creative' },
  { staff_id: 'staff-creative-fashion-001', name: 'Fashion Copywriter', role: 'Fashion Copywriter', division_id: 'creative' },
  { staff_id: 'staff-creative-lore-editor-001', name: 'Lore Editor/Narrative Editor', role: 'Lore Editor/Narrative Editor', division_id: 'creative' },
  { staff_id: 'staff-creative-motion-001', name: 'Motion/Video Lead', role: 'Motion/Video Lead', division_id: 'creative' },
  { staff_id: 'staff-creative-worldbuilding-001', name: 'Worldbuilding Researcher', role: 'Worldbuilding Researcher', division_id: 'creative' },
  { staff_id: 'staff-creative-designsys-001', name: 'Design Systems Lead', role: 'Design Systems Lead', division_id: 'creative' },
  { staff_id: 'staff-creative-uxr-001', name: 'UX Research Lead', role: 'UX Research Lead', division_id: 'creative' },
  { staff_id: 'staff-creative-content-001', name: 'Creative Content Lead', role: 'Creative Content Lead', division_id: 'creative' },

  // Research & Intelligence Division - 5 specialists
  { staff_id: 'staff-research-compintel-001', name: 'Competitive Intelligence Lead', role: 'Competitive Intelligence Lead', division_id: 'research-intelligence' },
  { staff_id: 'staff-research-market-001', name: 'Market Research Lead', role: 'Market Research Lead', division_id: 'research-intelligence' },
  { staff_id: 'staff-research-data-001', name: 'Data/Quantitative Analyst', role: 'Data/Quantitative Analyst', division_id: 'research-intelligence' },
  { staff_id: 'staff-research-osint-001', name: 'OSINT/Open Source Intelligence', role: 'OSINT/Open Source Intelligence', division_id: 'research-intelligence' },
  { staff_id: 'staff-research-synthesis-001', name: 'Synthesis/Methodology Deputy', role: 'Synthesis/Methodology Deputy', division_id: 'research-intelligence' },

  // Business Operations Division - 7 specialists
  { staff_id: 'staff-ops-facilities-001', name: 'Facilities/Workspace Lead', role: 'Facilities/Workspace Lead', division_id: 'business-operations' },
  { staff_id: 'staff-ops-legal-001', name: 'Legal/Compliance Lead', role: 'Legal/Compliance Lead', division_id: 'business-operations' },
  { staff_id: 'staff-ops-procurement-001', name: 'Procurement/Vendor Lead', role: 'Procurement/Vendor Lead', division_id: 'business-operations' },
  { staff_id: 'staff-ops-process-001', name: 'Operations/Process Lead', role: 'Operations/Process Lead', division_id: 'business-operations' },
  { staff_id: 'staff-ops-program-001', name: 'Senior Program Manager', role: 'Senior Program Manager', division_id: 'business-operations' },
  { staff_id: 'staff-ops-creative-001', name: 'Creative Operations Lead', role: 'Creative Operations Lead', division_id: 'business-operations' },
  { staff_id: 'staff-ops-people-001', name: 'People Operations Lead', role: 'People Operations Lead', division_id: 'business-operations' }
];

async function main() {
  console.log('='.repeat(60));
  console.log('Phase 9 Population Script - Council Bridge Roster');
  console.log('='.repeat(60));

  const dbInstance = createDatabase('data/council.db');

  try {
    // Step 1: Create Divisions
    console.log('\n📁 Step 1: Creating 6 divisions...');
    for (const div of DIVISIONS) {
      try {
        const existing = dbInstance.query('SELECT * FROM divisions WHERE division_id = ?', [div.division_id]);
        if (existing.length > 0) {
          console.log(`  ⏭️  Division "${div.name}" already exists, skipping`);
          continue;
        }
        createDivision(dbInstance, div);
        console.log(`  ✅ Created division: ${div.name} (${div.division_id})`);
      } catch (error: any) {
        if (error.message?.includes('UNIQUE constraint failed') || error.message?.includes('already exists')) {
          console.log(`  ⏭️  Division "${div.name}" already exists, skipping`);
        } else {
          console.error(`  ❌ Error creating division ${div.name}:`, error.message);
        }
      }
    }

    // Step 2: Register Division Heads
    console.log('\n👑 Step 2: Registering 6 Division Heads...');
    for (const head of DIVISION_HEADS) {
      try {
        const existing = dbInstance.query('SELECT * FROM staff_agents WHERE staff_id = ?', [head.staff_id]);
        if (existing.length > 0) {
          console.log(`  ⏭️  Division Head "${head.name}" (${head.staff_id}) already exists, skipping`);
          continue;
        }
        registerStaffAgent(dbInstance, {
          staff_id: head.staff_id,
          name: head.name,
          role: head.role,
          division_id: head.division_id,
          runtime_instances: [],
          permissions: [],
          status: 'inactive'
        });
        console.log(`  ✅ Registered Division Head: ${head.name} (${head.staff_id})`);
      } catch (error: any) {
        if (error.message?.includes('UNIQUE constraint failed') || error.message?.includes('already exists')) {
          console.log(`  ⏭️  Division Head "${head.name}" already exists, skipping`);
        } else {
          console.error(`  ❌ Error registering Division Head ${head.name}:`, error.message);
        }
      }
    }

    // Step 3: Approve Division Heads
    console.log('\n✅ Step 3: Approving 6 Division Heads...');
    for (const head of DIVISION_HEADS) {
      try {
        approveDivisionHead(dbInstance, ctx, {
          division_id: head.division_id,
          staff_id: head.staff_id
        });
        console.log(`  ✅ Approved Division Head: ${head.name} for ${head.division_id}`);
      } catch (error: any) {
        if (error.message?.includes('already the Division Head') || error.message?.includes('already approved')) {
          console.log(`  ⏭️  Division Head "${head.name}" already approved, skipping`);
        } else {
          console.error(`  ❌ Error approving Division Head ${head.name}:`, error.message);
        }
      }
    }

    // Step 4: Set Division Heads status to active (approveDivisionHead doesn't do this)
    console.log('\n🔄 Step 4: Setting Division Heads status to active...');
    for (const head of DIVISION_HEADS) {
      try {
        updateStaffAgent(dbInstance, head.staff_id, {
          staff_id: head.staff_id,
          status: 'active'
        });
        console.log(`  ✅ Set Division Head active: ${head.name}`);
      } catch (error: any) {
        console.error(`  ❌ Error setting Division Head active ${head.name}:`, error.message);
      }
    }

    // Step 4b: Add Division Heads to division_members (approveDivisionHead doesn't do this)
    console.log('\n👥 Step 4b: Adding Division Heads to division_members...');
    for (const head of DIVISION_HEADS) {
      try {
        addDivisionMember(dbInstance, {
          division_id: head.division_id,
          staff_id: head.staff_id,
          role: 'head'
        });
        console.log(`  ✅ Added Division Head to members: ${head.name} (${head.division_id})`);
      } catch (error: any) {
        if (error.message?.includes('UNIQUE') || error.message?.includes('already')) {
          console.log(`  ⏭️  Division Head "${head.name}" already in division_members, skipping`);
        } else {
          console.error(`  ❌ Error adding Division Head to members ${head.name}:`, error.message);
        }
      }
    }

    // Step 5: Register Specialists
    console.log('\n👥 Step 5: Registering 45 Specialists...');
    for (const spec of SPECIALISTS) {
      try {
        const existing = dbInstance.query('SELECT * FROM staff_agents WHERE staff_id = ?', [spec.staff_id]);
        if (existing.length > 0) {
          console.log(`  ⏭️  Specialist "${spec.name}" (${spec.staff_id}) already exists, skipping`);
          continue;
        }
        registerStaffAgent(dbInstance, {
          staff_id: spec.staff_id,
          name: spec.name,
          role: spec.role,
          division_id: spec.division_id,
          runtime_instances: [],
          permissions: [],
          status: 'inactive'
        });
        console.log(`  ✅ Registered Specialist: ${spec.name} (${spec.staff_id})`);
      } catch (error: any) {
        if (error.message?.includes('UNIQUE constraint failed') || error.message?.includes('already exists')) {
          console.log(`  ⏭️  Specialist "${spec.name}" already exists, skipping`);
        } else {
          console.error(`  ❌ Error registering Specialist ${spec.name}:`, error.message);
        }
      }
    }

    // Step 6: Approve Specialists
    console.log('\n✅ Step 6: Approving 45 Specialists...');
    for (const spec of SPECIALISTS) {
      try {
        approveSpecialist(dbInstance, ctx, {
          staff_id: spec.staff_id,
          division_id: spec.division_id
        });
        console.log(`  ✅ Approved Specialist: ${spec.name} for ${spec.division_id}`);
      } catch (error: any) {
        if (error.message?.includes('already active') || error.message?.includes('already approved')) {
          console.log(`  ⏭️  Specialist "${spec.name}" already approved, skipping`);
        } else {
          console.error(`  ❌ Error approving Specialist ${spec.name}:`, error.message);
        }
      }
    }

    // Step 7: Activate Division Heads with both runtimes
    console.log('\n🚀 Step 7: Activating 6 Division Heads with claude + hermes runtimes...');
    for (const head of DIVISION_HEADS) {
      try {
        activateStaffAgent(dbInstance, ctx, {
          staff_id: head.staff_id,
          runtimes: ['claude', 'hermes']
        });
        console.log(`  ✅ Activated Division Head: ${head.name} (claude, hermes)`);
      } catch (error: any) {
        if (error.message?.includes('must be approved before activation')) {
          console.log(`  ⏭️  Division Head "${head.name}" not yet approved, skipping activation`);
        } else if (error.message?.includes('already') || error.message?.includes('Duplicate')) {
          console.log(`  ⏭️  Division Head "${head.name}" already activated, skipping`);
        } else {
          console.error(`  ❌ Error activating Division Head ${head.name}:`, error.message);
        }
      }
    }

    // Step 8: Activate Specialists with both runtimes
    console.log('\n🚀 Step 8: Activating 45 Specialists with claude + hermes runtimes...');
    for (const spec of SPECIALISTS) {
      try {
        activateStaffAgent(dbInstance, ctx, {
          staff_id: spec.staff_id,
          runtimes: ['claude', 'hermes']
        });
        console.log(`  ✅ Activated Specialist: ${spec.name} (claude, hermes)`);
      } catch (error: any) {
        if (error.message?.includes('must be approved before activation')) {
          console.log(`  ⏭️  Specialist "${spec.name}" not yet approved, skipping activation`);
        } else if (error.message?.includes('already') || error.message?.includes('Duplicate')) {
          console.log(`  ⏭️  Specialist "${spec.name}" already activated, skipping`);
        } else {
          console.error(`  ❌ Error activating Specialist ${spec.name}:`, error.message);
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 POPULATION SUMMARY');
    console.log('='.repeat(60));

    const divisionsCount = dbInstance.query('SELECT COUNT(*) as count FROM divisions') as [{ count: number }];
    const divisionHeadsCount = dbInstance.query('SELECT COUNT(*) as count FROM staff_agents WHERE staff_id LIKE ?', ['staff-%-head-%']) as [{ count: number }];
    const specialistsCount = dbInstance.query('SELECT COUNT(*) as count FROM staff_agents WHERE staff_id NOT LIKE ?', ['staff-%-head-%']) as [{ count: number }];
    const activeCount = dbInstance.query('SELECT COUNT(*) as count FROM staff_agents WHERE status = ?', ['active']) as [{ count: number }];

    console.log(`  Divisions created:    ${divisionsCount[0].count}`);
    console.log(`  Division Heads:       ${divisionHeadsCount[0].count}`);
    console.log(`  Specialists:          ${specialistsCount[0].count}`);
    console.log(`  Total staff agents:   ${divisionHeadsCount[0].count + specialistsCount[0].count}`);
    console.log(`  Active agents:        ${activeCount[0].count}`);

    // Division breakdown
    console.log('\n  Division breakdown:');
    for (const div of DIVISIONS) {
      const headCount = dbInstance.query(
        'SELECT COUNT(*) as count FROM staff_agents WHERE division_id = ? AND staff_id LIKE ?',
        [div.division_id, 'staff-%-head-%']
      ) as [{ count: number }];
      const specCount = dbInstance.query(
        'SELECT COUNT(*) as count FROM staff_agents WHERE division_id = ? AND staff_id NOT LIKE ?',
        [div.division_id, 'staff-%-head-%']
      ) as [{ count: number }];
      console.log(`    ${div.name}: ${headCount[0].count} head + ${specCount[0].count} specialists = ${headCount[0].count + specCount[0].count} total`);
    }

    console.log('\n✅ Phase 9 population complete!');

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    dbInstance.close();
  }
}

main();