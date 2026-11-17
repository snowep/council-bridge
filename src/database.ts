// Compatibility facade - re-exports from infrastructure/database
export {
  createDatabase,
  databaseInstance,
  getDatabaseInstance,
  db,
  stmt,
  generateId,
  closeDatabase,
  getDatabase
} from './infrastructure/database/database.js';
export type { DatabaseInstance } from './infrastructure/database/database.js';
