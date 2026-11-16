import type { AuthContext } from '../shared/types/api';

// Auth context for the app
export interface AppAuthContextType {
  authContext: AuthContext | null;
  isLoading: boolean;
  login: (ownerType: string, ownerId: string, runtime: 'claude' | 'hermes') => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  navigateAfterLogin: () => void;
}

import { createContext } from 'react';

export const AppAuthContext = createContext<AppAuthContextType | null>(null);