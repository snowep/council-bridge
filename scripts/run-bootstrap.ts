// Database Bootstrap Script - Runs with founder authorization
// This script populates the database with canonical council identity data

import { createDatabase } from '../src/database.js';
import { initializeCouncil, createDefaultConstitution } from './seed/initialize-council.js';
import { generateFounderSignature, verifyFounderOperation, getFounderKeyId } from '../src/auth/founder.js';
import { getAuthConfig } from '../src/auth/index.js';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), '.secrets');
const DATABASE_PATH = process.env.DATABASE_PATH || ':memory:';

async function bootstrapDatabase() {
  console.log('🔧 Starting Database Bootstrap...');
  console.log(`📁 Database path: ${DATABASE_PATH}`);
  console.log(`🔑 Founder Key ID: ${getFounderKeyId()}`);

  // Create founder signature for bootstrap_database operation
  console.log('\n🔐 Generating founder signature for bootstrap_database operation...');

  const signature = generateFounderSignature(
    'bootstrap_database',
    { database_path: DATABASE_PATH },
    Date.now()
  );

  console.log(`   Signature: ${signature.signature.substring(0, 50)}...`);
  console.log(`   Timestamp: ${signature.timestamp}`);
  console.log(`   Nonce: ${signature.nonce}`);

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

// Run
bootstrapDatabase().catch(console.error);