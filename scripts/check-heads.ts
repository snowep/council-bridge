import { createDatabase } from '../src/database.js';

const db = createDatabase('data/council.db');
const heads = db.query("SELECT staff_id, name, status FROM staff_agents WHERE staff_id LIKE 'staff-%-head-%'");
console.log('Division Heads status:', heads);
db.close();