#!/usr/bin/env npx tsx
// Database Bootstrap Script - Requires Founder Signature for Production
// Usage: npx tsx scripts/bootstrap-database.ts --database <path> --signature <sig> --timestamp <ts> --nonce <nonce>
// In dev mode, just runs without signature validation
//
// SECURITY: Production seeding requires external founder signature via environment variables.
// The signature is verified BEFORE any database access.

import { createDatabase } from '../src/database.js';
import { initializeCouncil, createDefaultConstitution } from './seed/initialize-council.js';
import {
  verifyFounderRequest,
  loadFounderPublicKey,
  setDatabaseInstance,
  checkAndConsumeNonceFile
} from '../src/auth/founder.js';
import { validateSeedDatabasePath } from '../src/security/database-seeding-guard.js';

interface BootstrapOptions {
  database: string;
  signature?: string;
  timestamp?: number;
  nonce?: string;
  keyId?: string;
}

function parseArgs(): BootstrapOptions {
  const args = process.argv.slice(2);
  // Prefer --database argument, then DATABASE_PATH env var, then default to :memory:
  const opts: Partial<BootstrapOptions> = { database: process.env.DATABASE_PATH || ':memory:' };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--database' && i + 1 < args.length) {
      opts.database = args[++i];
    } else if (args[i] === '--signature' && i + 1 < args.length) {
      opts.signature = args[++i];
    } else if (args[i] === '--timestamp' && i + 1 < args.length) {
      opts.timestamp = parseInt(args[++i], 10);
    } else if (args[i] === '--nonce' && i + 1 < args.length) {
      opts.nonce = args[++i];
    } else if (args[i] === '--key-id' && i + 1 < args.length) {
      opts.keyId = args[++i];
    }
  }

  return opts as BootstrapOptions;
}

async function bootstrapDatabase(opts: BootstrapOptions) {
  console.log('Starting Database Bootstrap...');
  console.log(`Database path: ${opts.database === ':memory:' ? 'memory' : opts.database}`);

  // Determine environment
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  // SECURITY: Validate database path BEFORE any operations
  // This validates the path is safe but doesn't authorize production seeding
  try {
    const canonicalPath = validateSeedDatabasePath(opts.database, {
      allowedDevPaths: opts.database === ':memory:' || isTest ? [] : ['data'],
      allowedProdPaths: isProduction ? (process.env.PROD_DATABASE_PATH ? [process.env.PROD_DATABASE_PATH] : []) : [],
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

  // Validate founder signature if provided (production mode)
  // Use file-based nonce store for replay protection BEFORE database initialization
  if (opts.signature && opts.timestamp && opts.nonce && opts.keyId) {
    console.log('Validating founder signature (pre-bootstrap)...');

    // SECURITY: Load public key only - never private key for verification
    const publicKeyInfo = loadFounderPublicKey();
    if (!publicKeyInfo) {
      console.error('Founder public key not found');
      process.exit(1);
    }

    // Verify key ID matches
    if (opts.keyId !== publicKeyInfo.key_id) {
      console.error('Key ID mismatch');
      process.exit(1);
    }

    // SECURITY: Verify signature BEFORE any database operations
    const signatureValid = verifyFounderRequest(
      'bootstrap_database',
      { database_path: opts.database },
      opts.timestamp!,
      opts.nonce!,
      opts.signature!,
      publicKeyInfo.public_key,
      opts.keyId
    );

    if (!signatureValid) {
      console.error('Founder signature validation failed');
      process.exit(1);
    }

    // SECURITY: Consume nonce for replay protection BEFORE database creation
    // This ensures the nonce is reserved in the file-based store
    const nonceConsumed = checkAndConsumeNonceFile(opts.keyId, 'bootstrap_database', opts.nonce!, Date.now());
    if (!nonceConsumed) {
      console.error('Nonce already consumed or invalid');
      process.exit(1);
    }

    console.log('Founder signature verified and nonce reserved');

    // Create database AFTER signature verification and nonce reservation
    db = createDatabase(opts.database);
    setDatabaseInstance(db);
    console.log('Database created after authorization');
  } else if (isProduction) {
    console.error('PRODUCTION ERROR: Founder signature required for database seeding');
    console.error('   Provide: --signature <sig> --timestamp <ms> --nonce <64bytes> --key-id <id>');
    process.exit(1);
  } else {
    console.log('Running in development mode (no founder signature required)');

    // Create database in dev/test mode
    db = createDatabase(opts.database);
    setDatabaseInstance(db);
  }

  console.log('Initializing council...');
  const council = initializeCouncil(db);

  console.log('Creating constitution...');
  const version = createDefaultConstitution(db);
  console.log(`Constitution created: v${version}`);

  // Count results using database methods
  const seats = db.stmt.listSeats.all() as any[];
  const personas = db.stmt.listAllPersonas?.all() as any[] || [];
  const claudePersonas = db.stmt.getRuntimePersonas?.all('claude') as any[] || [];
  const hermesPersonas = db.stmt.getRuntimePersonas?.all('hermes') as any[] || [];
  const totalRuntimePersonas = claudePersonas.length + hermesPersonas.length;

  console.log('\nBootstrap Results:');
  console.log(`   Council Seats: ${seats.length}`);
  console.log(`   Personas: ${personas.length}`);
  console.log(`   Runtime Personas: ${totalRuntimePersonas} (Claude: ${claudePersonas.length}, Hermes: ${hermesPersonas.length})`);

  db.close();
  console.log('\nDatabase bootstrap complete!');
}

bootstrapDatabase(parseArgs()).catch(error => {
  console.error('Bootstrap failed:', error);
  process.exit(1);
});