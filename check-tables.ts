import Database from 'better-sqlite3';
const db = new Database('./data/council.db');
console.log('Tables:', db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(t => t.name));