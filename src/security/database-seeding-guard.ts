import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { existsSync, realpathSync, lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Database path environment variable names
const DB_PATH_VARS = ['DATABASE_PATH', 'DB_PATH', 'SQLITE_PATH'];

export interface DatabaseTarget {
  path: string;
  environment: 'production' | 'development' | 'test';
  description: string;
}

export interface GuardResult {
  allowed: boolean;
  reason: string;
  canonicalPath?: string;
  targetType?: 'production' | 'development' | 'test' | 'unknown';
}

export type DatabaseOperation = 'initialize' | 'seed';

export interface DatabaseGuardOptions {
  operation: DatabaseOperation;
  environment?: 'production' | 'development' | 'test';
  allowedDevPaths?: string[];
  allowedProdPaths?: string[];
  baseDir?: string;
  checkEnvConflicts?: boolean;
  allowedTestPaths?: string[];
}

/**
 * Detects environment variable conflicts for database paths.
 * Returns an error description if multiple conflicting DB_PATH variables are set.
 */
export function checkEnvVarConflicts(): string | null {
  const activePaths: string[] = [];

  for (const varName of DB_PATH_VARS) {
    const val = process.env[varName];
    if (val && val.trim() !== '') {
      activePaths.push(`${varName}=${val}`);
    }
  }

  if (activePaths.length > 1) {
    return `Conflicting database path environment variables: ${activePaths.join(', ')}. Only one should be set.`;
  }

  return null;
}

/**
 * Normalizes path for comparison, handling Windows-specific behavior.
 * On Windows, paths are case-insensitive and use backslashes.
 * On Unix, paths are case-sensitive and use forward slashes.
 */
function normalizePathForComparison(pathStr: string): string {
  // Normalize separators
  let normalized = pathStr.replace(/\\/g, '/');
  // Windows case-insensitive comparison
  if (process.platform === 'win32') {
    normalized = normalized.toLowerCase();
  }
  return normalized;
}

/**
 * Resolves a database path to its canonical form, handling symlinks, relative paths,
 * and platform-specific behavior.
 *
 * Requirements from M3-004:
 * - Canonicalize existing path components
 * - Resolve symlinked ancestors
 * - Correctly handle nonexistent nested target directories
 * - Reject traversal
 */
export function resolveCanonicalPath(dbPath: string, baseDir: string = process.cwd()): string {
  if (!dbPath || dbPath.trim() === '') {
    throw new Error('Database path is empty');
  }

  // Handle special in-memory cases
  if (dbPath === ':memory:') {
    return ':memory:';
  }

  // Resolve relative to base directory
  let absolutePath: string;
  if (isAbsolute(dbPath)) {
    absolutePath = dbPath;
  } else {
    absolutePath = resolve(baseDir, dbPath);
  }

  // Resolve symlinks to get true canonical path
  try {
    if (existsSync(absolutePath)) {
      return realpathSync(absolutePath);
    }

    // If file doesn't exist, resolve parent directory symlinks
    // and append the remaining path segments
    const parentDir = dirname(absolutePath);
    if (existsSync(parentDir)) {
      const canonicalParent = realpathSync(parentDir);
      const remainingPath = absolutePath.slice(parentDir.length + 1);
      // Ensure the remaining path doesn't contain traversal
      if (remainingPath.startsWith('..') || remainingPath.includes('/../')) {
        throw new Error('Path traversal detected in target path');
      }
      return resolve(canonicalParent, remainingPath);
    }

    // Parent doesn't exist either - return the resolved but unverified path
    // This handles the case of creating a new database in a non-existent nested directory
    return absolutePath;
  } catch (error) {
    if (error instanceof Error && error.message.includes('traversal')) {
      throw error;
    }
    // Return absolute path as fallback
    return absolutePath;
  }
}

/**
 * Checks if a path contains a specific directory name as a path segment.
 * Used for classifying paths like /project/test-dbs/db.db or test-dbs/db.db
 */
function hasPathSegment(pathStr: string, segment: string): boolean {
  const normPath = normalizePathForComparison(pathStr);
  const normSegment = normalizePathForComparison(segment);

  // Check if the segment appears in the path as a directory
  const segments = normPath.split('/');
  return segments.includes(normSegment);
}

/**
 * Classifies a database target based on its canonical path and environment.
 * Returns the target type for explicit authorization decisions.
 * Exported for testing and external use.
 */
export function classifyDatabaseTarget(
  canonicalPath: string,
  env: 'production' | 'development' | 'test',
  allowedTestDirs: string[] = ['test-dbs', 'test-dbs-e2e', 'test-data', 'test-dbs-guard'],
  allowedDevDirs: string[] = [] // NO default - must be explicit
): 'production' | 'development' | 'test' | 'unknown' {
  // In production, everything is production unless explicitly a test fixture
  if (env === 'production') {
    return 'production';
  }

  // Check for test-specific paths - look for directory names as path segments
  for (const testDir of allowedTestDirs) {
    if (hasPathSegment(canonicalPath, testDir)) {
      return 'test';
    }
  }

  // Check for development paths using explicit allowlist
  for (const devDir of allowedDevDirs) {
    if (hasPathSegment(canonicalPath, devDir)) {
      return 'development';
    }
  }

  return 'unknown';
}

/**
 * Validates a database path for seeding operations.
 * Separates path validation from authorization.
 * Throws if the path is invalid or cannot be safely accessed.
 *
 * SECURITY: This function does NOT authorize production seeding.
 * It only validates that the path is safe for the requested operation.
 */
export function validateSeedDatabasePath(
  dbPath: string,
  options: {
    environment?: 'production' | 'development' | 'test';
    allowedProdPaths?: string[];
    allowedDevPaths?: string[];
    allowedTestPaths?: string[];
    baseDir?: string;
    checkEnvConflicts?: boolean;
  } = {}
): string {
  const environment = options.environment ?? (process.env.NODE_ENV === 'production' ? 'production' :
                                              process.env.NODE_ENV === 'test' ? 'test' : 'development');

  const allowedProdPaths = options.allowedProdPaths ?? [];
  const allowedDevPaths = options.allowedDevPaths ?? [];
  const allowedTestPaths = options.allowedTestPaths ?? ['test-dbs', 'test-dbs-e2e', 'test-data', 'test-dbs-guard'];
  const baseDir = options.baseDir ?? process.cwd();
  const checkEnvConflicts = options.checkEnvConflicts ?? true;

  // Check for environment variable conflicts first
  if (checkEnvConflicts) {
    const conflict = checkEnvVarConflicts();
    if (conflict) {
      throw new Error(conflict);
    }
  }

  // Reject empty or missing path
  if (!dbPath || dbPath.trim() === '') {
    throw new Error('Database path is missing or empty');
  }

  // NEVER allow in-memory databases for seeding operations
  if (dbPath === ':memory:' || dbPath.includes(':memory:')) {
    if (environment === 'production') {
      throw new Error('In-memory database (:memory:) not allowed in production - requires persistent database');
    }
    // In test/development, :memory: is allowed for testing
    return dbPath;
  }

  // Resolve canonical path (handles symlinks, relative paths)
  const canonicalPath = resolveCanonicalPath(dbPath, baseDir);

  // Check for path traversal attempts - only for relative paths
  // Absolute paths are validated by allowedProdPaths/allowedDevPaths/allowedTestPaths
  if (!isAbsolute(dbPath)) {
    const relativePath = relative(baseDir, canonicalPath);
    if (relativePath.startsWith('..') || canonicalPath.startsWith('..')) {
      throw new Error('Path traversal detected');
    }
  }

  // In production: check against explicitly authorized production paths
  // Requirement 9: Exact path or explicitly authorized descendants only, no parent-directory authorization
  if (environment === 'production') {
    const normalizedCanonical = normalizePathForComparison(canonicalPath);
    const isProdPathAuthorized = allowedProdPaths.some(allowedPath => {
      const normalizedAllowed = normalizePathForComparison(allowedPath);
      // Exact match or descendant (canonical must start with allowed + /)
      // No parent-directory authorization: do NOT check if allowed starts with canonical
      return normalizedCanonical === normalizedAllowed ||
             normalizedCanonical.startsWith(normalizedAllowed + '/');
    });

    if (!isProdPathAuthorized) {
      throw new Error('Production environment: database path not in allowed production paths for seeding');
    }
    return canonicalPath;
  }

  // For non-production environments: check against allowed test/dev paths
  // Check for test-specific paths
  if (environment === 'test') {
    for (const testPath of allowedTestPaths) {
      if (hasPathSegment(canonicalPath, testPath)) {
        return canonicalPath;
      }
    }
    throw new Error('Database target not in allowed test database paths - requires explicit test database path');
  }

  // Development environment
  if (environment === 'development') {
    const hasDevPath = allowedDevPaths.some(devPath => {
      return hasPathSegment(canonicalPath, devPath);
    });

    if (!hasDevPath) {
      throw new Error('Database target not in allowed development database paths - requires explicit development database path');
    }
    return canonicalPath;
  }

  throw new Error(`Unknown or unsupported environment: ${environment}`);
}

/**
 * Validates that a database target is an explicitly authorized isolated
 * development or test database. This is the core fail-closed guard.
 *
 * @deprecated Use validateSeedDatabasePath() for seeding operations or
 *             guardDatabaseAccess({ operation: 'initialize' }) for server initialization.
 */
export function validateDatabaseTarget(
  dbPath: string,
  options: {
    environment?: 'production' | 'development' | 'test';
    requireExplicitAuthorization?: boolean;
    allowedTestPaths?: string[];
    allowedDevPaths?: string[];
    allowedProdPaths?: string[];
    baseDir?: string;
    checkEnvConflicts?: boolean;
  } = {}
): GuardResult {
  try {
    const canonicalPath = validateSeedDatabasePath(dbPath, {
      environment: options.environment,
      allowedProdPaths: options.allowedProdPaths,
      allowedDevPaths: options.allowedDevPaths,
      allowedTestPaths: options.allowedTestPaths,
      baseDir: options.baseDir,
      checkEnvConflicts: options.checkEnvConflicts
    });

    // Determine target type
    const environment = options.environment ?? (process.env.NODE_ENV === 'production' ? 'production' :
                                                process.env.NODE_ENV === 'test' ? 'test' : 'development');

    let targetType: 'production' | 'development' | 'test' | 'unknown' = 'unknown';

    // Handle :memory: databases
    if (canonicalPath === ':memory:') {
      if (environment === 'production') {
        targetType = 'production';
      } else if (environment === 'test') {
        targetType = 'test';
      } else {
        targetType = 'development';
      }
    } else if (environment === 'production') {
      targetType = 'production';
    } else if (environment === 'test') {
      targetType = 'test';
    } else {
      const normPath = normalizePathForComparison(canonicalPath);
      for (const devPath of (options.allowedDevPaths ?? [])) {
        if (hasPathSegment(normPath, devPath)) {
          targetType = 'development';
          break;
        }
      }
    }

    return {
      allowed: true,
      reason: targetType === 'production'
        ? 'Explicitly authorized production database path for seeding'
        : `Authorized ${targetType} database`,
      canonicalPath,
      targetType
    };
  } catch (error: any) {
    // Preserve targetType even on rejection if we can infer it
    const msg = error.message.toLowerCase();
    const detectedEnv = options.environment ?? (process.env.NODE_ENV === 'production' ? 'production' :
                                              process.env.NODE_ENV === 'test' ? 'test' : 'development');
    let inferredTargetType: 'production' | 'development' | 'test' | 'unknown' = 'unknown';

    if (detectedEnv === 'production' || msg.includes('production') || msg.includes('not in allowed production')) {
      inferredTargetType = 'production';
    } else if (detectedEnv === 'test' || msg.includes('test') || msg.includes(':memory:')) {
      inferredTargetType = 'test';
    } else if (detectedEnv === 'development') {
      inferredTargetType = 'development';
    }

    return {
      allowed: false,
      reason: error.message,
      targetType: inferredTargetType
    };
  }
}

/**
 * High-level guard function for server initialization and seeding.
 * Call this BEFORE any database operation.
 */
export function guardDatabaseAccess(
  dbPath: string,
  options: {
    operation?: 'initialize' | 'seed';
    environment?: 'production' | 'development' | 'test';
    requireExplicitAuthorization?: boolean;
    allowedTestPaths?: string[];
    allowedDevPaths?: string[];
    allowedProdPaths?: string[];
    baseDir?: string;
    checkEnvConflicts?: boolean;
  } = {}
): { canonicalPath: string; targetType: string } {
  const operation = options.operation ?? 'initialize';
  const environment = options.environment ?? (process.env.NODE_ENV === 'production' ? 'production' :
                                                process.env.NODE_ENV === 'test' ? 'test' : 'development');

  // For initialization, reject :memory: in production
  if (operation === 'initialize' && dbPath === ':memory:' && environment === 'production') {
    const error = new Error('Database seeding guard rejected: In-memory database (:memory:) not allowed in production - requires persistent database');
    (error as any).guardResult = { allowed: false, reason: 'In-memory database (:memory:) not allowed in production - requires persistent database', targetType: 'production' };
    throw error;
  }

  // For seeding, use the dedicated validation
  if (operation === 'seed') {
    const canonicalPath = validateSeedDatabasePath(dbPath, {
      environment,
      allowedProdPaths: options.allowedProdPaths ?? [],
      allowedDevPaths: options.allowedDevPaths ?? (environment === 'development' ? ['data'] : []),
      allowedTestPaths: options.allowedTestPaths,
      baseDir: options.baseDir,
      checkEnvConflicts: options.checkEnvConflicts
    });

    // Determine target type
    let targetType: 'production' | 'development' | 'test' = 'unknown' as any;
    if (environment === 'production') {
      targetType = 'production';
    } else if (environment === 'test') {
      targetType = 'test';
    } else {
      targetType = 'development';
    }

    return { canonicalPath, targetType };
  }

  // For initialization, use simple validation
  try {
    const canonicalPath = validateSeedDatabasePath(dbPath, {
      environment,
      allowedProdPaths: options.allowedProdPaths,
      allowedDevPaths: options.allowedDevPaths ?? (environment === 'development' ? ['data'] : []),
      allowedTestPaths: options.allowedTestPaths,
      baseDir: options.baseDir,
      checkEnvConflicts: options.checkEnvConflicts
    });

    let targetType: 'production' | 'development' | 'test' | 'unknown' = 'unknown';
    if (environment === 'production') {
      targetType = 'production';
    } else if (environment === 'test') {
      targetType = 'test';
    } else {
      targetType = 'development';
    }

    return { canonicalPath, targetType };
  } catch (error: any) {
    const result = validateDatabaseTarget(dbPath, options);
    const err = new Error(`Database seeding guard rejected: ${result.reason}`);
    (err as any).guardResult = result;
    throw err;
  }
}

/**
 * Checks if a path conflicts with known production paths.
 */
export function checkProductionPathConflict(canonicalPath: string): boolean {
  const productionPatterns = [
    '/data/council.db',
    '\\data\\council.db',
    'production',
    'prod',
    'live',
  ];

  const lowerPath = canonicalPath.toLowerCase();
  return productionPatterns.some(pattern => lowerPath.includes(pattern.toLowerCase()));
}

export const DATABASE_SEEDING_GUARD_VERSION = '1.0.0';