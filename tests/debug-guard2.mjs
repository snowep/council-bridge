import { resolve, isAbsolute, dirname } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';

const dbPath = 'data/council.db';
const baseDir = process.cwd();
console.log('baseDir:', baseDir);

// Step 1: resolvePathWithSymlinkValidation
let normalizedPath = dbPath;
if (!isAbsolute(dbPath)) {
  normalizedPath = resolve(baseDir, dbPath);
}
console.log('After resolve:', normalizedPath);

const parts = normalizedPath.split(/[/\\]/g).filter(Boolean);
console.log('parts:', parts);

let resolvedPath = '';
for (let i = 0; i < parts.length; i++) {
  const part = parts[i];
  resolvedPath = resolvedPath ? resolve(resolvedPath, part) : part;
  console.log('  loop', i, 'part:', part, 'resolvedPath:', resolvedPath);
}
console.log('resolvedPath:', resolvedPath);

// Then check if it exists and call realpathSync
let canonicalPath = resolvedPath;
try {
  if (existsSync(resolvedPath)) {
    const parentDir = dirname(resolvedPath);
    if (existsSync(parentDir)) {
      console.log('parentDir exists:', parentDir);
      const canonicalParent = realpathSync(parentDir);
      console.log('canonicalParent:', canonicalParent);
      canonicalPath = resolve(canonicalParent, resolvedPath.slice(parentDir.length + 1));
      console.log('canonicalPath:', canonicalPath);
    }
  }
} catch (e) {
  console.log('error:', e.message);
}
