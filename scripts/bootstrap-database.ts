#!/usr/bin/env npx tsx
// Database Bootstrap Script - Requires Founder Signature for Production
// Usage: npx tsx scripts/bootstrap-database.ts --database <path> --signature <sig> --timestamp <ts> --nonce <nonce>
// In dev mode, just runs without signature validation

import { createDatabase, getDatabaseInstance } from '../src/database.js';
import { initializeCouncil, createDefaultConstitution } from './seed/initialize-council.js';
import { signFounderRequest, loadFounderKeyPair, verifyFounderRequest } from '../src/auth/founder.js';
import { setDatabaseInstance } from '../src/auth/founder.js';
import * as fs from 'fs';
import * as path from 'path';

interface BootstrapOptions {
  database: string;
  signature?: string;
  timestamp?: number;
  nonce?: string;
  keyId?: string;
}

function parseArgs(): BootstrapOptions {
  const args = process.argv.slice(2);
  const opts: Partial<BootstrapOptions> = { database: ':memory:' };

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
  console.log('🔧 Starting Database Bootstrap...');
  console.log(`📁 Database path: ${opts.database === ':memory:' ? 'memory' : opts.database}`);

  // Validate founder signature if provided (production mode)
  if (opts.signature && opts.timestamp && opts.nonce && opts.keyId) {
    console.log('🔐 Validating founder signature...');

    const keyPair = loadFounderKeyPair();
    if (!keyPair) {
      console.error('❌ Founder keys not found');
      process.exit(1);
    }

    const valid = verifyFounderRequest(
      'bootstrap_database',
      { database_path: opts.database },
      opts.timestamp,
      opts.nonce,
      opts.signature,
      keyPair.public_key,
      opts.keyId
    );

    if (!valid) {
      console.error('❌ Founder signature validation failed');
      process.exit(1);
    }
    console.log('✅ Founder signature verified');
  } else if (process.env.NODE_ENV === 'production') {
    console.error('⚠️  Production mode requires founder signature');
    console.error('   Provide: --signature <sig> --timestamp <ms> --nonce <64bytes> --key-id <id>');
    process.exit(1);
  } else {
    console.log('⚠️  Running in development mode (no founder signature required)');
  }

  // Create database
  const dbPath = opts.database === ':memory:' ? undefined : opts.database;
  const db = createDatabase(dbPath);
  setDatabaseInstance(db);

  console.log('🔐 Initializing council...');
  const council = initializeCouncil(db);

  console.log('📜 Creating constitution...');
  const version = createDefaultConstitution(db);
  console.log(`   Constitution version: v${version}`);

  // Count results using database methods
  const seats = db.stmt.listSeats.all() as any[];
  const personas = db.stmt.listPersonas.all() as any[];
  const runtimePersonas = db.stmt.listRuntimePersonas?.all() as any[] || [];

  console.log('\n📊 Bootstrap Results:');
  console.log(`   Council Seats: ${seats.length}`);
  console.log(`   Personas: ${personas.length}`);
  console.log(`   Runtime Personas: ${runtimePersonas.length}`);

  db.close();
  console.log('\n✅ Database bootstrap complete!');
}

bootstrapDatabase(parseArgs()).catch(error => {
  console.error('❌ Bootstrap failed:', error);
  process.exit(1);
});