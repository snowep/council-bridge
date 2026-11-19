// Database Bootstrap Script - Requires Founder Signature for Production
// This script populates the database with canonical council identity data
// SECURITY: Signature verification occurs BEFORE database access in production

import { createDatabase, getDatabaseInstance } from '../src/database.js';
import { initializeCouncil, createDefaultConstitution } from './seed/initialize-council.js';
import { verifyFounderOperation, getFounderPublicKey, getFounderKeyId, setDatabaseInstance, loadFounderKeyPair } from '../src/auth/founder.js';
import { getAuthConfig } from '../src/auth/index.js';
import { validateSeedDatabasePath } from '../src/security/database-seeding-guard.js';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), '.secrets');
const DATABASE_PATH = process.env.DATABASE_PATH || ':memory:';
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// SECURITY: Determine allowed production paths from environment
const allowedProdPaths = isProduction ? (process.env.PROD_DATABASE_PATH ? [process.env.PROD_DATABASE_PATH] : []) : [];

async function bootstrapDatabaseWithSignature() {
  console.log('🔧 Starting Database Bootstrap with Founder Signature...');
  console.log(`📁 Database path: ${DATABASE_PATH}`);
  console.log(`🔑 Founder Key ID: ${getFounderKeyId()}`);

  // Check for founder signature in environment or arguments
  const founderSignature = process.env.FOUNDER_SIGNATURE;
  const founderTimestamp = process.env.FOUNDER_TIMESTAMP;
  const founderNonce = process.env.FOUNDER_NONCE;

  // In production: REJECT if no signature provided - fail-closed
  if (isProduction && (!founderSignature || !founderTimestamp || !founderNonce)) {
    console.error('❌ PRODUCTION ERROR: Founder signature required for database seeding');
    console.error('   Required: FOUNDER_SIGNATURE, FOUNDER_TIMESTAMP, FOUNDER_NONCE');
    process.exit(1);
  }

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

  // Verify founder signature BEFORE database access in production
  // This prevents database modification without proper authorization
  if (isProduction && founderSignature && founderTimestamp && founderNonce) {
    console.log('✅ Founder signature provided, validating BEFORE database access...');

    const keyPair = loadFounderKeyPair();
    if (!keyPair) {
      console.error('❌ Founder keys not found');
      process.exit(1);
    }

    const result = verifyFounderOperation(
      'bootstrap_database',
      { database_path: DATABASE_PATH },
      founderSignature,
      parseInt(founderTimestamp, 10),
      founderNonce,
      keyPair.key_id
    );

    if (!result.valid) {
      console.error('❌ Founder signature validation failed:', result.error);
      process.exit(1);
    }
    console.log('✅ Founder signature validated');
  } else if (isProduction) {
    // Should not reach here - already checked at function start
    console.error('❌ PRODUCTION ERROR: Founder signature verification requires all three: signature, timestamp, nonce');
    process.exit(1);
  } else {
    console.log('⚠️  No founder signature provided - running in development mode');
  }

  // Create database AFTER signature verification (production) or at start (dev/test)
  const db = createDatabase(DATABASE_PATH);
  setDatabaseInstance(db);

  console.log('🔐 Initializing council...');
  const council = initializeCouncil(db);

  console.log('📜 Creating constitution...');
  const version = createDefaultConstitution(db);
  console.log(`   Constitution version: v${version}`);

  // Count results using database methods
  const seatsResult = db.stmt.listSeats.all();
  const personasResult = db.stmt.listAllPersonas?.all() as any[] || [];
  const runtimesResult = db.stmt.getRuntimePersonas?.all('claude') as any[] || [];

  db.close();
  console.log('\n✅ Database bootstrap complete!');
}

// Run if called directly
bootstrapDatabaseWithSignature().catch(console.error);