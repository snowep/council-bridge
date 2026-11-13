import { createDatabase } from '../src/database.js';
import { getStaffAgentById } from '../src/council/divisions.js';

const db = createDatabase('data/council.db');
const heads = ['staff-dev-head-001', 'staff-marketing-head-001', 'staff-finance-head-001', 'staff-creative-head-001', 'staff-research-head-001', 'staff-ops-head-001'];

for (const id of heads) {
  const staff = getStaffAgentById(db, id);
  console.log(`${id}: division_id=${staff?.division_id}, status=${staff?.status}`);
}

db.close();