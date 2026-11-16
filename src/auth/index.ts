// Auth Module Exports - Phase 8 Hardened
// Import config for validateAuthMode - use dynamic import to avoid circular issues
import { getAuthConfig } from './config.js';
import { DatabaseInstance } from '../database.js';
import { getFounderKeyId, getFounderPublicKey } from './founder.js';

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
    } else if (process.env.SESSION_SECRET.length < 32) {
      errors.push('SESSION_SECRET must be at least 32 characters in production');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * SEC-04: Validate Founder key configuration at startup
 * Must be called before any founder-signed operations are accepted
 * Returns { valid, errors } where valid is true when keys are properly configured
 */
export function validateFounderKeyConfiguration(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const config = getAuthConfig();

  const keyId = getFounderKeyId();
  const publicKey = getFounderPublicKey();
  const hasKeyMaterial = keyId !== null && publicKey !== null;

  if (config.mode === 'production') {
    if (!hasKeyMaterial) {
      errors.push('Founder keys must be initialized (founder-keys.json must exist with valid key material)');
    }

    if (config.local_single_user_mode) {
      errors.push('Local single-user mode cannot be enabled in production with founder keys');
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function validateIdentityForSession(
  db: DatabaseInstance,
  owner_type: string,
  owner_id: string,
  runtime: string
): Promise<boolean> {
  // Validate owner exists and is active based on type
  switch (owner_type) {
    case 'founder':
      return owner_id === 'founder';
    case 'staff': {
      const staff = db.query('SELECT * FROM staff_agents WHERE staff_id = ?', [owner_id])[0] as any;
      return staff && staff.status === 'active';
    }
    case 'division': {
      const division = db.query('SELECT * FROM divisions WHERE division_id = ?', [owner_id])[0] as any;
      return division !== undefined;
    }
    case 'seat': {
      const seat = db.query('SELECT * FROM council_seats WHERE seat_id = ?', [owner_id])[0] as any;
      return seat !== undefined;
    }
    default:
      return false;
  }
}