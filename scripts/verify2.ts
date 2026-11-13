import { createDatabase } from '../src/database.js';

const db = createDatabase('data/council.db');
const members = db.query('SELECT division_id, staff_id, role FROM division_members ORDER BY division_id');
console.log('Division members:', members.length);
for (const m of members) {
  console.log(`  ${m.division_id}: ${m.staff_id} (${m.role})`);
}
const appointmentMemories = db.query("SELECT COUNT(*) as count FROM memory_entries WHERE memory_type = 'appointment_record'");
const activationMemories = db.query("SELECT COUNT(*) as count FROM memory_entries WHERE memory_type = 'activation_record'");
console.log('Appointment memories:', appointmentMemories[0].count);
console.log('Activation memories:', activationMemories[0].count);
db.close();