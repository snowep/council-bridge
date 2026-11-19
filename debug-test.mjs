import { validateDatabaseTarget, resolveCanonicalPath } from './src/security/database-seeding-guard.ts';
console.log('resolve:', resolveCanonicalPath('/project/test-dbs/test.db'));
const result = validateDatabaseTarget('/project/test-dbs/test.db', { environment: 'test' });
console.log('allowed:', result.allowed);
console.log('reason:', result.reason);
console.log('targetType:', result.targetType);
console.log('canonicalPath:', result.canonicalPath);