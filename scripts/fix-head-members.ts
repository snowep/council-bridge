import { createDatabase } from '../src/database.js';
import { addDivisionMember } from '../src/council/divisions.js';

const db = createDatabase('data/council.db');
const heads = [
  { division_id: 'developer', staff_id: 'staff-dev-head-001' },
  { division_id: 'marketing', staff_id: 'staff-marketing-head-001' },
  { division_id: 'finance', staff_id: 'staff-finance-head-001' },
  { division_id: 'creative', staff_id: 'staff-creative-head-001' },
  { division_id: 'research-intelligence', staff_id: 'staff-research-head-001' },
  { division_id: 'business-operations', staff_id: 'staff-ops-head-001' }
];

for (const head of heads) {
  try {
    addDivisionMember(db, {
      division_id: head.division_id,
      staff_id: head.staff_id,
      role: 'head'
    });
    console.log(`Added Division Head member: ${head.staff_id} to ${head.division_id}`);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE') || e.message?.includes('already')) {
      console.log(`Already exists: ${head.staff_id} in ${head.division_id}`);
    } else {
      console.error(`Error: ${e.message}`);
    }
  }
}

const headMembers = db.query("SELECT division_id, staff_id, role FROM division_members WHERE staff_id LIKE 'staff-%-head-%'");
console.log('\nDivision Head members after fix:', headMembers.length);
for (const m of headMembers) {
  console.log(`  ${m.division_id}: ${m.staff_id} (${m.role})`);
}
db.close();