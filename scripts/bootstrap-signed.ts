// Database Bootstrap Script - Requires Founder Signature
// This script populates the database with canonical council identity data

import { createDatabase, getDatabaseInstance } from '../src/database.js';
import { initializeCouncil, createDefaultConstitution } from './seed/initialize-council.js';
import { verifyFounderOperation, getFounderPublicKey, getFounderKeyId } from '../src/auth/founder.js';
import { getAuthConfig } from '../src/auth/index.js';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), '.secrets');
const DATABASE_PATH = process.env.DATABASE_PATH || ':memory:';

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

  // Create database
  const db = createDatabase(DATABASE_PATH === ':memory:' ? undefined : DATABASE_PATH);

  // Initialize council
  const council = initializeCouncil(db);

  // Create constitution
  const version = createDefaultConstitution(db);
  console.log(`📜 Constitution created: v${version}`);

  // Count results
  const seats = db.prepare('SELECT COUNT(*) as count FROM council_seats').get();
  const personas = db.prepare('SELECT COUNT(*) as count FROM personas').get();
  const runtimes = db.prepare('SELECT COUNT(*) as count FROM runtime_personas').get();
  const constitutions = db.prepare('SELECT COUNT(*) as count FROM constitutions').get();

  console.log('\n📊 Bootstrap Results:');
  console.log(`   Council Seats: ${seats.count}`);
  console.log(`   Personas: ${personas.count}`);
  console.log(`   Runtime Personas: ${runtimes.count}`);
  console.log(`   Constitutions: ${constitutions.count}`);

  db.close();
  console.log('\n✅ Database bootstrap complete!');
}

// Run if called directly
bootstrapDatabaseWithSignature().catch(console.error);