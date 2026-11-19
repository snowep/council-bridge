// Database Bootstrap Script - Runs with founder authorization
// This script populates the database with canonical council identity data

import { createDatabase } from '../src/database.js';
import { initializeCouncil, createDefaultConstitution } from './seed/initialize-council.js';
import { signFounderRequest, verifyFounderOperation, getFounderKeyId, loadFounderKeyPair, setDatabaseInstance } from '../src/auth/founder.js';
import { guardDatabaseAccess } from '../src/security/database-seeding-guard.js';

const DATABASE_PATH = process.env.DATABASE_PATH || ':memory:';

// Invoke centralized database seeding guard BEFORE any database access
guardDatabaseAccess(DATABASE_PATH, {
  allowedDevPaths: DATABASE_PATH === ':memory:' ? [] : ['data']
});

async function bootstrapDatabase() {
  console.log('🔧 Starting Database Bootstrap...');
  console.log(`📁 Database path: ${DATABASE_PATH}`);
  console.log(`🔑 Founder Key ID: ${getFounderKeyId()}`);

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

// Run
bootstrapDatabase().catch(console.error);