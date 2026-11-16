import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { CssBaseline, Box, Typography, Link } from '@mui/material';
import { type ReactNode } from 'react';
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
import { ThemeProvider } from '../shared/theme';

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

// NotFoundPage component for 404 errors
function NotFoundPage() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Typography variant="h1" component="h1" sx={{ fontSize: '3rem', mb: 2 }}>
        404
      </Typography>
      <Typography variant="h5" component="h2" sx={{ mb: 3, color: 'text.secondary' }}>
        Page not found
      </Typography>
      <Link href="/dashboard" underline="hover" sx={{ fontSize: '1.1rem' }}>
        Return to Dashboard
      </Link>
    </Box>
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
      <ThemeProvider>
        <CssBaseline />
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
            {/* 404 catch-all route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppAuthProviderWithNavigate>
      </ThemeProvider>
    </BrowserRouter>
  );
}