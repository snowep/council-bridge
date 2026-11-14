// Auth Module Exports - Phase 8 Hardened
// Import config for validateAuthMode - use dynamic import to avoid circular issues
import { getAuthConfig } from './config.js';

export * from './config.js';
export * from './session.js';
export * from './founder.js';
export * from './middleware.js';

export interface AuthContext {
  owner_type: 'founder' | 'staff' | 'division' | 'seat';
  owner_id: string;
  runtime: 'claude' | 'hermes';
  session_id: string;
  permissions: string[];
  expires_at: number;
  issued_at: number;
  founder_signed?: boolean;
  client_ip?: string;
}

export function requirePermission(
  permission: string,
  getSession: () => AuthContext | null
): boolean {
  const session = getSession();
  if (!session) return false;

  if (session.owner_type === 'founder') return true;
  if (session.permissions.includes(permission)) return true;

  return false;
}

export function requireFounder(ctx: AuthContext): boolean {
  return ctx.owner_type === 'founder';
}

export function requireDivisionHead(
  ctx: AuthContext,
  divisionId: string,
  getDivisionById: (id: string) => { head_staff_id?: string } | null
): boolean {
  if (ctx.owner_type === 'founder') return true;
  if (ctx.owner_type !== 'division') return false;

  const division = getDivisionById(divisionId);
  // Division context acts as head
  return ctx.owner_id === divisionId;
}

export function validateSessionOwnership(
  ctx: AuthContext,
  resourceOwnerId: string
): boolean {
  if (ctx.owner_type === 'founder') return true;
  if (ctx.owner_type === 'staff') return ctx.owner_id === resourceOwnerId;
  if (ctx.owner_type === 'division') return ctx.owner_id === resourceOwnerId;
  return false;
}

export function validateAuthMode(): { valid: boolean; errors: string[] } {
  const config = getAuthConfig();
  const errors: string[] = [];

  if (config.mode === 'production') {
    if (config.allow_hardcoded_fallback) {
      errors.push('Hardcoded fallback must be disabled in production');
    }
    if (!process.env.SESSION_SECRET) {
      errors.push('SESSION_SECRET must be set in production');
    }
  }

  return { valid: errors.length === 0, errors };
}