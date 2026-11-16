import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { useState, useEffect, type ReactNode } from 'react';
import { lightTheme, darkTheme } from '../shared/theme';
import DashboardPage from '../features/dashboard/pages/DashboardPage';
import ChatPage from '../features/chat/pages/ChatPage';
import CouncilPage from '../features/council/pages/CouncilPage';
import MeetingsPage from '../features/meetings/pages/MeetingsPage';
import MemoryPage from '../features/memory/pages/MemoryPage';
import OrganizationPage from '../features/organization/pages/OrganizationPage';
import TasksPage from '../features/tasks/pages/TasksPage';
import ExecutionsPage from '../features/executions/pages/ExecutionsPage';
import DeliverablesPage from '../features/deliverables/pages/DeliverablesPage';
import ApprovalsPage from '../features/approvals/pages/ApprovalsPage';
import LoginPage from '../features/auth/pages/LoginPage';
import Layout from '../app/layouts/Layout';
import { AppAuthProvider } from './auth-context';
import { useAppAuth } from './use-app-auth';
import { LOCAL_SINGLE_USER_MODE } from './constants';

function AppAuthProviderWithNavigate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const navigateAfterLogin = () => {
    navigate('/', { replace: true });
  };

  return (
    <AppAuthProvider navigateAfterLogin={navigateAfterLogin}>
      {children}
    </AppAuthProvider>
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
        <AppAuthProviderWithNavigate>
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
        </AppAuthProviderWithNavigate>
      </ThemeWrapper>
    </BrowserRouter>
  );
}