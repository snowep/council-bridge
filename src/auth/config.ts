// Auth Configuration and Mode Management
// Phase 8: Production-ready auth with explicit mode control

export type AuthMode = 'development' | 'production';

export interface AuthConfig {
  mode: AuthMode;
  session_timeout_ms: number;
  max_sessions: number;
  require_founder_signature_for: string[];
  allow_hardcoded_fallback: boolean;
}

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
  allow_hardcoded_fallback: true // Only in development mode
};

export function getAuthConfig(): AuthConfig {
  const mode = (process.env.AUTH_MODE as AuthMode) || 'development';
  return {
    ...DEFAULT_AUTH_CONFIG,
    mode,
    allow_hardcoded_fallback: mode === 'development'
  };
}

export function isProductionMode(): boolean {
  return getAuthConfig().mode === 'production';
}

export function isDevelopmentMode(): boolean {
  return getAuthConfig().mode === 'development';
}