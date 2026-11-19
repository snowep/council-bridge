// Database Bootstrap Script - Runs with founder authorization
// This script populates the database with canonical council identity data
// SECURITY: Signature verification occurs BEFORE database access in production
// In production, an EXTERNAL founder signature must be provided via environment variables

import { createDatabase } from '../src/database.js';
import { initializeCouncil, createDefaultConstitution } from './seed/initialize-council.js';
import { verifyFounderOperation, getFounderKeyId, loadFounderKeyPair, setDatabaseInstance, initializeFounderKeys } from '../src/auth/founder.js';
import { validateSeedDatabasePath } from '../src/security/database-seeding-guard.js';

const DATABASE_PATH = process.env.DATABASE_PATH || ':memory:';
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// SECURITY: Determine allowed production paths from environment
const allowedProdPaths = isProduction ? (process.env.PROD_DATABASE_PATH ? [process.env.PROD_DATABASE_PATH] : []) : [];

// Founder signature from external source (required in production)
const founderSignature = process.env.FOUNDER_SIGNATURE;
const founderTimestamp = process.env.FOUNDER_TIMESTAMP ? parseInt(process.env.FOUNDER_TIMESTAMP, 10) : undefined;
const founderNonce = process.env.FOUNDER_NONCE;

async function bootstrapDatabase() {
  console.log('🔧 Starting Database Bootstrap...');
  console.log(`📁 Database path: ${DATABASE_PATH}`);
  console.log(`🔑 Founder Key ID: ${getFounderKeyId()}`);

  // SECURITY: Validate database path BEFORE any operations
  // This validates the path is safe but doesn't authorize production seeding
  try {
    const canonicalPath = validateSeedDatabasePath(DATABASE_PATH, {
      allowedDevPaths: ['data'],
      allowedProdPaths: allowedProdPaths,
      allowedTestPaths: isTest ? ['test-dbs', 'test-dbs-e2e', 'test-data', 'test-dbs-guard', 'test-db'] : ['test-dbs', 'test-dbs-e2e', 'test-data', 'test-dbs-guard'],
      environment: isProduction ? 'production' : (isTest ? 'test' : 'development')
    });
    console.log(`   Path validated: ${canonicalPath}`);
  } catch (error: any) {
    console.error('❌ Database path validation failed:', error.message);
    process.exit(1);
  }

  // SECURITY: In production, verify founder signature BEFORE database access
  // Validate external founder signature BEFORE opening, creating, migrating, or writing to database
  if (isProduction) {
    if (!founderSignature || !founderTimestamp || !founderNonce) {
      console.error('❌ PRODUCTION ERROR: External founder signature required for database seeding');
      console.error('   Required: FOUNDER_SIGNATURE, FOUNDER_TIMESTAMP, FOUNDER_NONCE');
      process.exit(1);
    }

    console.log('\n🔐 Verifying founder signature BEFORE database access in production...');

    const keyPair = loadFounderKeyPair();
    if (!keyPair) {
      console.error('❌ Founder keys not found');
      process.exit(1);
    }

    const verification = verifyFounderOperation(
      'bootstrap_database',
      { database_path: DATABASE_PATH },
      founderSignature,
      founderTimestamp,
      founderNonce,
      keyPair.key_id
    );

    if (!verification.valid) {
      console.error('❌ Founder signature verification failed:', verification.error);
      process.exit(1);
    }
    console.log('✅ Founder signature verified - authorization granted');
  } else {
    console.log('⚠️  Running in development mode (no founder signature required)');
  }

  // Create database AFTER signature verification in production, or at start in dev/test
  const db = createDatabase(DATABASE_PATH);

  // Set database instance for founder operations (nonce store)
  setDatabaseInstance(db);

  // Ensure founder keys exist for initialization (needed for nonce store)
  initializeFounderKeys();

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
bootstrapDatabase().catch(error => {
  console.error(error);
  process.exit(1);
});