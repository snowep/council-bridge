// Auth Configuration and Mode Management
// Phase 8: Production-ready auth with explicit mode control
// Phase 10: Local single-user Founder mode

import crypto from 'crypto';

export type AuthMode = 'development' | 'production';

export interface AuthConfig {
  mode: AuthMode;
  session_timeout_ms: number;
  max_sessions: number;
  require_founder_signature_for: string[];
  allow_hardcoded_fallback: boolean;
  local_single_user_mode: boolean;
  local_single_user_bind_address: string;
  session_secret: string;
}

function generateDevSecret(): string {
  // Generate a cryptographically secure secret for development
  // This is process-local and changes on each restart
  return crypto.randomBytes(32).toString('base64url');
}

let devSecret: string | null = null;

export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  mode: (process.env.AUTH_MODE as AuthMode) || 'development',
  session_timeout_ms: 30 * 60 * 1000, // 30 minutes
  max_sessions: 100,
  require_founder_signature_for: [
    'approve_execution',
    'approve_cross_division_access',
    'create_division',
    'update_division_head',
    'revoke_cross_division_access',
    'create_session'
  ],
  allow_hardcoded_fallback: false,
  local_single_user_mode: process.env.LOCAL_SINGLE_USER_MODE === 'true',
  local_single_user_bind_address: process.env.LOCAL_SINGLE_USER_BIND_ADDRESS || '127.0.0.1',
  session_secret: process.env.SESSION_SECRET || ''
};

export function getAuthConfig(): AuthConfig {
  const mode = (process.env.AUTH_MODE as AuthMode) || 'development';
  const envSecret = process.env.SESSION_SECRET;

  if (mode === 'production') {
    if (!envSecret) {
      throw new Error('SESSION_SECRET must be set in production mode');
    }
    if (envSecret.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters in production mode');
    }
    return {
      ...DEFAULT_AUTH_CONFIG,
      mode,
      allow_hardcoded_fallback: false,
      local_single_user_mode: process.env.LOCAL_SINGLE_USER_MODE === 'true',
      local_single_user_bind_address: process.env.LOCAL_SINGLE_USER_BIND_ADDRESS || '127.0.0.1',
      session_secret: envSecret
    };
  }

  // Development mode: use env secret or generate process-local secret (memoized)
  if (!devSecret) {
    devSecret = envSecret || generateDevSecret();
  }
  return {
    ...DEFAULT_AUTH_CONFIG,
    mode,
    allow_hardcoded_fallback: process.env.ALLOW_HARDCODED_FALLBACK === 'true',
    local_single_user_mode: process.env.LOCAL_SINGLE_USER_MODE === 'true',
    local_single_user_bind_address: process.env.LOCAL_SINGLE_USER_BIND_ADDRESS || '127.0.0.1',
    session_secret: devSecret
  };
}

export function isProductionMode(): boolean {
  return getAuthConfig().mode === 'production';
}

export function isDevelopmentMode(): boolean {
  return getAuthConfig().mode === 'development';
}

export function isLocalSingleUserMode(): boolean {
  return getAuthConfig().local_single_user_mode;
}

export function getLocalBindAddress(): string {
  return getAuthConfig().local_single_user_bind_address;
}