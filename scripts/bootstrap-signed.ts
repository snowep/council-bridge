// Database Bootstrap Script - Requires Founder Signature
// This script populates the database with canonical council identity data

import { createDatabase, getDatabaseInstance } from '../src/database.js';
import { initializeCouncil, createDefaultConstitution } from './seed/initialize-council.js';
import { verifyFounderOperation, getFounderPublicKey, getFounderKeyId } from '../src/auth/founder.js';
import { getAuthConfig } from '../src/auth/index.js';
import { guardDatabaseAccess } from '../src/security/database-seeding-guard.js';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), '.secrets');
const DATABASE_PATH = process.env.DATABASE_PATH || ':memory:';

// Invoke centralized database seeding guard BEFORE any database access
guardDatabaseAccess(DATABASE_PATH, {
  allowedDevPaths: DATABASE_PATH === ':memory:' ? [] : ['data']
});

async function bootstrapDatabaseWithSignature() {
  console.log('🔧 Starting Database Bootstrap with Founder Signature...');
  console.log(`📁 Database path: ${DATABASE_PATH}`);
  console.log(`🔑 Founder Key ID: ${getFounderKeyId()}`);

  // Check for founder signature in environment or arguments
  const founderSignature = process.env.FOUNDER_SIGNATURE;
  const founderTimestamp = process.env.FOUNDER_TIMESTAMP;
  const founderNonce = process.env.FOUNDER_NONCE;

  if (founderSignature && founderTimestamp && founderNonce) {
    console.log('✅ Founder signature provided, validating...');

    const result = verifyFounderOperation(
      'bootstrap_database',
      { database_path: DATABASE_PATH },
      founderSignature,
      founderTimestamp,
      founderNonce,
      getFounderKeyId()
    );

    if (!result.valid) {
      console.error('❌ Founder signature validation failed:', result.error);
      process.exit(1);
    }
    console.log('✅ Founder signature validated');
  } else {
    console.log('⚠️  No founder signature provided - running in development mode');
    console.log('   To run with founder authorization, set FOUNDER_SIGNATURE, FOUNDER_TIMESTAMP, and FOUNDER_NONCE');
  }

  // Create database - pass :memory: directly to createDatabase
  const db = createDatabase(DATABASE_PATH);

  // Initialize council
  const council = initializeCouncil(db);

  // Create constitution
  const version = createDefaultConstitution(db);
  console.log(`📜 Constitution created: v${version}`);

  // Count results using database methods
  const seatsResult = db.stmt.listSeats.all();
  const personasResult = db.stmt.listAllPersonas.all();
  const runtimesResult = db.stmt.getRuntimePersonas.all('claude').length + db.stmt.getRuntimePersonas.all('hermes').length;
  const constitutionsResult = db.stmt.listConstitutions.all();

  const seats = Array.isArray(seatsResult) ? seatsResult.length : 0;
  const personas = Array.isArray(personasResult) ? personasResult.length : 0;
  const constitutions = Array.isArray(constitutionsResult) ? constitutionsResult.length : 0;

  console.log('\n📊 Bootstrap Results:');
  console.log(`   Council Seats: ${seats}`);
  console.log(`   Personas: ${personas}`);
  console.log(`   Runtime Personas: ${runtimesResult}`);
  console.log(`   Constitutions: ${constitutions}`);

  db.close();
  console.log('\n✅ Database bootstrap complete!');
}

// Run if called directly
bootstrapDatabaseWithSignature().catch(console.error);