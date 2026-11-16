import { useEffect, useState, type ReactNode } from 'react';
import { apiClient } from '../shared/api/client';
import type { AuthContext } from '../shared/types/api';
import { LOCAL_SINGLE_USER_MODE } from './constants';
import { AppAuthContext } from './auth-context-type';

interface AppAuthProviderProps {
  children: ReactNode;
  navigateAfterLogin?: () => void;
}

export function AppAuthProvider({ children, navigateAfterLogin = () => {} }: AppAuthProviderProps) {
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuth = async () => {
    try {
      if (LOCAL_SINGLE_USER_MODE) {
        // In local single-user mode, auto-authenticate as Founder without API call
        const localAuthContext: AuthContext = {
          owner_type: 'founder',
          owner_id: 'founder',
          runtime: 'claude',
          session_id: 'local-founder',
          permissions: [],
          expires_at: Infinity,
          issued_at: Date.now(),
          founder_signed: true
        };
        setAuthContext(localAuthContext);
      } else if (apiClient.isAuthenticated()) {
        const status = await apiClient.getAuthStatus();
        setAuthContext(status.session);
      } else {
        setAuthContext(null);
      }
    } catch (error) {
      console.error('Failed to refresh auth:', error);
      if (LOCAL_SINGLE_USER_MODE) {
        // Fallback to local Founder context on error
        const localAuthContext: AuthContext = {
          owner_type: 'founder',
          owner_id: 'founder',
          runtime: 'claude',
          session_id: 'local-founder',
          permissions: [],
          expires_at: Infinity,
          issued_at: Date.now(),
          founder_signed: true
        };
        setAuthContext(localAuthContext);
      } else {
        setAuthContext(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (ownerType: string, ownerId: string, runtime: 'claude' | 'hermes') => {
    const response = await apiClient.createSession(ownerType, ownerId, runtime);
    apiClient.setSessionToken(response.session_token);
    await refreshAuth();
  };

  const logout = async () => {
    try {
      await apiClient.deleteSession();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      apiClient.clearSession();
      setAuthContext(null);
    }
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  return (
    <AppAuthContext.Provider value={{ authContext, isLoading, login, logout, refreshAuth, navigateAfterLogin }}>
      {children}
    </AppAuthContext.Provider>
  );
}