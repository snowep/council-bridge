import { createDatabase } from '../src/database.js';

const db = createDatabase('data/council.db');
const headMembers = db.query("SELECT division_id, staff_id, role FROM division_members WHERE staff_id LIKE 'staff-%-head-%'");
console.log('Division Head members:', headMembers.length);
for (const m of headMembers) {
  console.log(`  ${m.division_id}: ${m.staff_id} (${m.role})`);
}
const runtimes = db.query("SELECT runtime, persona_id FROM runtime_personas WHERE persona_id LIKE 'staff-%' ORDER BY persona_id");
console.log('\nRuntime personas:', runtimes.length);
const byRuntime = { claude: 0, hermes: 0 };
for (const r of runtimes) {
  byRuntime[r.runtime as keyof typeof byRuntime]++;
}
console.log('  claude:', byRuntime.claude);
console.log('  hermes:', byRuntime.hermes);
db.close();