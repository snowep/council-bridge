import { createDatabase } from './src/database.js';

const db = createDatabase();
const now = new Date().toISOString();
db.runPreparedStatement('insertConstitution', ['1.0.0', 'Council Bridge Constitution v1.0.0\n\nThis constitution governs the operations of the Council Bridge system.', 'active', 1]);
console.log('Constitution inserted');