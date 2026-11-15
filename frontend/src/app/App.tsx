import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { lightTheme, darkTheme } from '../theme';
import { apiClient } from '../services/api';
import type { AuthContext } from '../types/api';
import DashboardPage from '../pages/DashboardPage';
import ChatPage from '../pages/ChatPage';
import CouncilPage from '../pages/CouncilPage';
import MeetingsPage from '../pages/MeetingsPage';
import MemoryPage from '../pages/MemoryPage';
import OrganizationPage from '../pages/OrganizationPage';
import TasksPage from '../pages/TasksPage';
import ExecutionsPage from '../pages/ExecutionsPage';
import DeliverablesPage from '../pages/DeliverablesPage';
import ApprovalsPage from '../pages/ApprovalsPage';
import LoginPage from '../pages/LoginPage';
import Layout from '../layouts/Layout';

// Check if local single-user mode is enabled (set by Vite at build time or runtime env)
const LOCAL_SINGLE_USER_MODE = import.meta.env.VITE_LOCAL_SINGLE_USER_MODE === 'true' || import.meta.env.DEV;

// Auth context for the app
interface AppAuthContextType {
  authContext: AuthContext | null;
  isLoading: boolean;
  login: (ownerType: string, ownerId: string, runtime: 'claude' | 'hermes') => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  navigateAfterLogin: () => void;
}

const AppAuthContext = createContext<AppAuthContextType | null>(null);

export const useAppAuth = () => {
  const context = useContext(AppAuthContext);
  if (!context) {
    throw new Error('useAppAuth must be used within AppAuthProvider');
  }
  return context;
};

function AppAuthProvider({ children }: { children: ReactNode }) {
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

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

  const navigateAfterLogin = () => {
    navigate('/', { replace: true });
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

function ThemeWrapper({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = localStorage.getItem('theme_mode') as 'light' | 'dark' | null;
    if (saved) setMode(saved);
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) setMode('dark');
  }, []);

  useEffect(() => {
    localStorage.setItem('theme_mode', mode);
  }, [mode]);

  const theme = mode === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { authContext, isLoading } = useAppAuth();

  if (isLoading) {
    return null;
  }

  // In local single-user mode, always allow access (already authenticated)
  if (LOCAL_SINGLE_USER_MODE) {
    return <>{children}</>;
  }

  if (!authContext) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeWrapper>
        <AppAuthProvider>
          <Routes>
            {/* No login page in local single-user mode */}
            {!LOCAL_SINGLE_USER_MODE && <Route path="/login" element={<LoginPage />} />}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="council" element={<CouncilPage />} />
              <Route path="meetings" element={<MeetingsPage />} />
              <Route path="memory" element={<MemoryPage />} />
              <Route path="organization" element={<OrganizationPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="executions" element={<ExecutionsPage />} />
              <Route path="deliverables" element={<DeliverablesPage />} />
              <Route path="approvals" element={<ApprovalsPage />} />
            </Route>
          </Routes>
        </AppAuthProvider>
      </ThemeWrapper>
    </BrowserRouter>
  );
}