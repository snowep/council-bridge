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
 * Resolves a database path to its canonical form, handling symlinks, relative paths,
 * and platform-specific behavior.
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
    // If file doesn't exist yet, resolve parent directory symlinks
    const parentDir = dirname(absolutePath);
    if (existsSync(parentDir)) {
      const canonicalParent = realpathSync(parentDir);
      return resolve(canonicalParent, absolutePath.slice(parentDir.length + 1));
    }
    return absolutePath;
  } catch {
    return absolutePath;
  }
}

/**
 * Canonical path prefix validation helper.
 * Checks if a path is a descendant of an allowed directory using exact path component matching.
 */
function isDescendantOf(canonicalPath: string, allowedDir: string): boolean {
  const normPath = canonicalPath.replace(/\\/g, '/');
  const normAllowed = allowedDir.replace(/\\/g, '/');

  // Check if path starts with allowed dir (either as full match or as prefix with separator)
  // This handles both absolute paths and relative path segments
  if (normPath === normAllowed) return true;
  if (normPath.startsWith(normAllowed + '/') || normPath.startsWith('/' + normAllowed + '/')) return true;

  return false;
}

/**
 * Checks if a path contains a specific directory name as a path segment.
 * Used for classifying paths like /project/test-dbs/db.db or test-dbs/db.db
 */
function hasPathSegment(pathStr: string, segment: string): boolean {
  const normPath = pathStr.replace(/\\/g, '/');
  const normSegment = segment.replace(/\\/g, '/');

  // Check if the segment appears in the path as a directory
  const segments = normPath.split('/');
  return segments.includes(normSegment);
}

/**
 * Resolves a path and validates symlinks along the entire path chain.
 * Returns the final canonical path, checking for symlink escapes.
 */
function resolvePathWithSymlinkValidation(dbPath: string, baseDir: string): {
  canonicalPath: string;
  symlinkIssues: string[];
} {
  const symlinkIssues: string[] = [];

  // First resolve to absolute path
  let absolutePath: string;
  if (isAbsolute(dbPath)) {
    absolutePath = dbPath;
  } else {
    absolutePath = resolve(baseDir, dbPath);
  }

  // Normalize path separators for consistent processing
  const normalizedPath = absolutePath.replace(/\\/g, '/');
  const basePath = baseDir.replace(/\\/g, '/');

  // Check for path traversal outside base directory
  if (!normalizedPath.startsWith(basePath + '/') && normalizedPath !== basePath) {
    symlinkIssues.push(`Path outside base directory: ${normalizedPath}`);
  }

  // Resolve canonical path (handles existing symlinks via realpathSync)
  let canonicalPath: string;
  try {
    if (existsSync(absolutePath)) {
      canonicalPath = realpathSync(absolutePath);
    } else {
      // File doesn't exist yet - resolve parent directory symlinks
      const parentDir = dirname(absolutePath);
      if (existsSync(parentDir)) {
        const canonicalParent = realpathSync(parentDir);
        // Get the filename component (remove parent dir from path, skip the separator)
        const fileName = absolutePath.substring(parentDir.length + 1);
        canonicalPath = resolve(canonicalParent, fileName);
      } else {
        canonicalPath = absolutePath;
      }
    }
  } catch (e) {
    canonicalPath = absolutePath;
  }

  return { canonicalPath, symlinkIssues };
}

/**
 * Classifies a database target based on its canonical path and environment.
 * Returns the target type for explicit authorization decisions.
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
 * Validates that a database target is an explicitly authorized isolated
 * development or test database. This is the core fail-closed guard.
 */
export function validateDatabaseTarget(
  dbPath: string,
  options: {
    environment?: 'production' | 'development' | 'test';
    requireExplicitAuthorization?: boolean;
    allowedTestPaths?: string[];
    allowedDevPaths?: string[];
    baseDir?: string;
    checkEnvConflicts?: boolean; // Check for env var conflicts
  } = {}
): GuardResult {
  // Determine environment - default based on NODE_ENV if not explicitly provided
  const env = options.environment;
  const environment = env ?? (process.env.NODE_ENV === 'production' ? 'production' :
                                process.env.NODE_ENV === 'test' ? 'test' : 'development');

  const requireExplicitAuthorization = options.requireExplicitAuthorization ?? true;
  const allowedTestPaths = options.allowedTestPaths ?? ['test-dbs', 'test-dbs-e2e', 'test-data', 'test-dbs-guard'];
  // NO default development paths - must be explicitly provided for development
  const allowedDevPaths = options.allowedDevPaths ?? (env === 'development' ? [] : []);
  const baseDir = options.baseDir ?? process.cwd();
  const checkEnvConflicts = options.checkEnvConflicts ?? true;

  // Check for environment variable conflicts first
  if (checkEnvConflicts) {
    const conflict = checkEnvVarConflicts();
    if (conflict) {
      return {
        allowed: false,
        reason: conflict,
        targetType: 'unknown',
      };
    }
  }

  // Reject empty or missing path
  if (!dbPath || dbPath.trim() === '') {
    return {
      allowed: false,
      reason: 'Database path is missing or empty',
      targetType: 'unknown',
    };
  }

  // NEVER allow in-memory databases for seeding operations
  // In-memory databases are not suitable for seeding as they provide no isolation guarantee
  if (dbPath === ':memory:' || dbPath.includes(':memory:')) {
    if (environment === 'production') {
      return {
        allowed: false,
        reason: 'In-memory database (:memory:) not allowed in production - requires persistent database',
        canonicalPath: dbPath,
        targetType: 'production',
      };
    }
    // In test/development, :memory: is allowed for testing
    return {
      allowed: true,
      reason: 'In-memory database allowed in non-production environment',
      canonicalPath: dbPath,
      targetType: environment,
    };
  }

  // In production, reject everything before path resolution (fail-closed)
  if (environment === 'production') {
    return {
      allowed: false,
      reason: 'Production environment: database seeding requires explicit Founder authorization',
      canonicalPath: dbPath,
      targetType: 'production',
    };
  }

  // Resolve canonical path with symlink validation
  const { canonicalPath, symlinkIssues } = resolvePathWithSymlinkValidation(dbPath, baseDir);

  // Report symlink issues
  if (symlinkIssues.length > 0) {
    return {
      allowed: false,
      reason: `Path validation failed: ${symlinkIssues.join('; ')}`,
      canonicalPath,
      targetType: 'unknown',
    };
  }

  // Check for path traversal attempts
  const relativePath = relative(baseDir, canonicalPath);
  if (relativePath.startsWith('..') || canonicalPath.startsWith('..')) {
    return {
      allowed: false,
      reason: 'Path traversal detected',
      canonicalPath,
      targetType: 'unknown',
    };
  }

  // Classify the target using exact path matching (not substring)
  // Extract directory names from paths for classification
  // For paths like "data/council.db", extract "data"; for "test-dbs", keep "test-dbs"
  const allowedTestDirs = allowedTestPaths.map(p => {
    const parts = p.split('/').filter(Boolean);
    return parts.length > 0 ? parts[0] : p;
  });
  const allowedDevDirs = allowedDevPaths.map(p => {
    const parts = p.split('/').filter(Boolean);
    return parts.length > 0 ? parts[0] : p;
  });

  const targetType = classifyDatabaseTarget(
    canonicalPath,
    environment,
    allowedTestDirs,
    allowedDevDirs
  );

  // Normalize paths for comparison
  const normalizePath = (p: string) => p.replace(/\\/g, '/');
  const normCanonical = normalizePath(canonicalPath);
  const normBaseDir = normalizePath(baseDir);
  const normRelative = normalizePath(relativePath);

  // Validate target type classification
  if (targetType === 'unknown') {
    let reason: string;
    if (environment === 'test') {
      reason = 'Database target not in allowed test database paths - requires explicit test database path';
    } else if (environment === 'development') {
      reason = 'Database target not in allowed development database paths - requires explicit development database path';
    } else {
      reason = 'Database target cannot be positively identified as isolated test/development database';
    }
    return {
      allowed: false,
      reason,
      canonicalPath,
      targetType: 'unknown',
    };
  }

  if (targetType === 'test') {
    return {
      allowed: true,
      reason: 'Explicitly authorized test database',
      canonicalPath,
      targetType: 'test',
    };
  }

  if (targetType === 'development') {
    return {
      allowed: true,
      reason: 'Explicitly authorized development database',
      canonicalPath,
      targetType: 'development',
    };
  }

  // Unknown environment - reject
  return {
    allowed: false,
    reason: `Unknown or unsupported environment: ${environment}`,
    canonicalPath,
    targetType: 'unknown',
  };
}

/**
 * High-level guard function that throws on rejection.
 * Call this BEFORE any database operation in seeding entry points.
 */
export function guardDatabaseAccess(
  dbPath: string,
  options: Parameters<typeof validateDatabaseTarget>[1] = {}
): { canonicalPath: string; targetType: string } {
  const result = validateDatabaseTarget(dbPath, options);

  if (!result.allowed) {
    const error = new Error(`Database seeding guard rejected: ${result.reason}`);
    (error as any).guardResult = result;
    throw error;
  }

  return {
    canonicalPath: result.canonicalPath!,
    targetType: result.targetType!,
  };
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