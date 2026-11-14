import { createDatabase } from '../src/database.js';
import { createDivision, registerStaffAgent, activateStaffAgent, getStaffAgentById } from '../src/council/divisions.js';

const db = createDatabase(':memory:');
const founderCtx = { owner_type: 'founder', owner_id: 'founder' };

// Create division
const division = createDivision(db, {
  division_id: 'Developer Division',
  name: 'Developer'
});
console.log('Division created:', division.division_id);

// Register staff
const staff = registerStaffAgent(db, {
  staff_id: 'staff-dev-platform-001',
  name: 'Platform Engineer',
  role: 'Platform Engineering Lead',
  division_id: 'Developer Division',
  runtime_instances: [],
  permissions: [],
  status: 'active'
});
console.log('Staff registered:', staff.staff_id);

// Activate staff
try {
  const result = activateStaffAgent(db, founderCtx, {
    staff_id: 'staff-dev-platform-001',
    runtimes: ['claude', 'hermes']
  });
  console.log('Activation result:', result.staff_id, result.runtime_instances);
} catch (e) {
  console.log('Error:', e.message);
}

// Check runtime personas
const rp = db.query('SELECT * FROM staff_runtime_personas WHERE staff_id = ?', ['staff-dev-platform-001']);
console.log('Runtime personas:', rp.length);
for (const r of rp) console.log('  ', r.runtime, r.staff_id);

db.close();