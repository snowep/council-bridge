// Database Bootstrap Script - Runs with founder authorization
// This script populates the database with canonical council identity data
// SECURITY: Signature verification occurs BEFORE database access

import { createDatabase } from '../src/database.js';
import { initializeCouncil, createDefaultConstitution } from './seed/initialize-council.js';
import { signFounderRequest, verifyFounderOperation, getFounderKeyId, loadFounderKeyPair, setDatabaseInstance, initializeFounderKeys } from '../src/auth/founder.js';
import { validateSeedDatabasePath } from '../src/security/database-seeding-guard.js';

const DATABASE_PATH = process.env.DATABASE_PATH || ':memory:';
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// SECURITY: Determine allowed production paths from environment
const allowedProdPaths = isProduction ? (process.env.PROD_DATABASE_PATH ? [process.env.PROD_DATABASE_PATH] : []) : [];

async function bootstrapDatabase() {
  console.log('🔧 Starting Database Bootstrap...');
  console.log(`📁 Database path: ${DATABASE_PATH}`);
  console.log(`🔑 Founder Key ID: ${getFounderKeyId()}`);

  // SECURITY: Validate database path BEFORE any operations
  // This validates the path is safe but doesn't authorize production seeding
  try {
    const canonicalPath = validateSeedDatabasePath(DATABASE_PATH, {
      allowedDevPaths: DATABASE_PATH === ':memory:' || isTest ? [] : ['data'],
      allowedProdPaths: allowedProdPaths,
      allowedTestPaths: isTest ? ['test-dbs', 'test-dbs-e2e', 'test-data', 'test-dbs-guard', 'test-db'] : ['test-dbs', 'test-dbs-e2e', 'test-data', 'test-dbs-guard'],
      environment: isProduction ? 'production' : (isTest ? 'test' : 'development')
    });
    console.log(`   Path validated: ${canonicalPath}`);
  } catch (error: any) {
    console.error('❌ Database path validation failed:', error.message);
    process.exit(1);
  }

  // Ensure founder keys exist and can be loaded (needed for signature operations)
  initializeFounderKeys();

  // Create founder signature for bootstrap_database operation
  console.log('\n🔐 Generating founder signature for bootstrap_database operation...');

  const keyPair = loadFounderKeyPair();
  if (!keyPair) {
    console.error('❌ Founder keys not found');
    process.exit(1);
  }

  const signature = signFounderRequest(
    'bootstrap_database',
    { database_path: DATABASE_PATH },
    keyPair.private_key_pem,
    keyPair.key_id
  );

  console.log(`   Signature: ${signature.signature.substring(0, 50)}...`);
  console.log(`   Timestamp: ${signature.timestamp}`);
  console.log(`   Nonce: ${signature.nonce}`);

  // Create database - pass :memory: directly to createDatabase
  const db = createDatabase(DATABASE_PATH);

  // Set database instance for founder operations (nonce store)
  setDatabaseInstance(db);

  // Verify the signature
  const verification = verifyFounderOperation(
    'bootstrap_database',
    { database_path: DATABASE_PATH },
    signature.signature,
    signature.timestamp,
    signature.nonce,
    signature.key_id
  );

  if (!verification.valid) {
    console.error('❌ Signature verification failed:', verification.error);
    process.exit(1);
  }
  console.log('✅ Signature verified');

  // Initialize council
  const council = initializeCouncil(db);

  // Create constitution
  const version = createDefaultConstitution(db);
  console.log(`📜 Constitution created: v${version}`);

  // Count results using database methods
  const seatsResult = db.stmt.listSeats.all();
  const personasResult = db.stmt.listAllPersonas?.all() as any[] || [];
  const runtimesResult = db.stmt.getRuntimePersonas?.all('claude') as any[] || [];

  db.close();
  console.log('\n✅ Database bootstrap complete!');
}

// Run
bootstrapDatabase().catch(console.error);