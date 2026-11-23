// Database Bootstrap Script - Runs with founder authorization
// This script populates the database with canonical council identity data
// SECURITY: Signature verification occurs BEFORE database access in production
// In production, an EXTERNAL founder signature must be provided via environment variables

import { createDatabase } from '../src/database.js';
import { initializeCouncil, createDefaultConstitution } from './seed/initialize-council.js';
import { verifyFounderOperationBeforeBootstrap, initializeFounderKeys, loadFounderPublicKey } from '../src/auth/founder.js';
import { setDatabaseInstance } from '../src/database.js';
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
const founderKeyId = process.env.FOUNDER_KEY_ID;

async function bootstrapDatabase() {
  console.log('Starting Database Bootstrap...');
  console.log(`Database path: ${DATABASE_PATH}`);

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
    console.error('Database path validation failed:', error.message);
    process.exit(1);
  }

  // Declare db variable in outer scope for use after conditional blocks
  let db: ReturnType<typeof createDatabase>;

  // SECURITY: In production, verify founder signature BEFORE database access
  // Validate external founder signature BEFORE opening, creating, migrating, or writing to database
  if (isProduction) {
    if (!founderSignature || !founderTimestamp || !founderNonce || !founderKeyId) {
      console.error('PRODUCTION ERROR: External founder signature required for database seeding');
      console.error('   Required: FOUNDER_SIGNATURE, FOUNDER_TIMESTAMP, FOUNDER_NONCE, FOUNDER_KEY_ID');
      process.exit(1);
    }

    console.log('\nVerifying founder signature BEFORE database access in production...');

    // SECURITY: Load public key only - never private key for verification
    const publicKeyInfo = loadFounderPublicKey();
    if (!publicKeyInfo) {
      console.error('Founder public key not found');
      process.exit(1);
    }

    const verification = verifyFounderOperationBeforeBootstrap(
      'bootstrap_database',
      { database_path: DATABASE_PATH },
      founderSignature,
      founderTimestamp,
      founderNonce,
      founderKeyId
    );

    if (!verification.valid) {
      console.error('Founder signature verification failed:', verification.error);
      process.exit(1);
    }
    console.log('Founder signature verified - authorization granted');

    // Create database AFTER signature verification in production
    db = createDatabase(DATABASE_PATH);
    setDatabaseInstance(db);
    console.log('Database created after authorization');
  } else {
    console.log('Running in development mode (no founder signature required)');

    // Create database in dev/test mode
    db = createDatabase(DATABASE_PATH);
    setDatabaseInstance(db);
    initializeFounderKeys();
  }

  // Initialize council
  const council = initializeCouncil(db);

  // Create constitution
  const version = createDefaultConstitution(db);
  console.log(`Constitution created: v${version}`);

  // Count results using database methods
  const seatsResult = db.stmt.listSeats.all();
  const personasResult = db.stmt.listAllPersonas?.all() as any[] || [];
  const runtimesResult = db.stmt.getRuntimePersonas?.all('claude') as any[] || [];

  db.close();
  console.log('\nDatabase bootstrap complete!');
}

// Run
bootstrapDatabase().catch(error => {
  console.error(error);
  process.exit(1);
});