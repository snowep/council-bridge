import { validateDatabaseTarget, resolveCanonicalPath } from './src/security/database-seeding-guard.ts';
console.log('resolve:', resolveCanonicalPath('data/council.db'));
const result = validateDatabaseTarget('data/council.db', { environment: 'development' });
console.log('allowed:', result.allowed);
console.log('reason:', result.reason);
console.log('targetType:', result.targetType);
console.log('canonicalPath:', result.canonicalPath);