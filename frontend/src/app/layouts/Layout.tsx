import { Outlet, NavLink } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  DashboardOutlined,
  ChatOutlined,
  AccountBalanceOutlined,
  EventOutlined,
  LibraryBooksOutlined,
  BusinessOutlined,
  EngineeringOutlined,
  PlayArrowOutlined,
  AssignmentOutlined,
  VerifiedUserOutlined,
  Menu as MenuIcon,
  LogoutOutlined,
  PersonOutlined,
  DarkModeOutlined,
  LightModeOutlined,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useState } from 'react';
import { useAppAuth } from '../use-app-auth';
import { useThemeStore } from '../../shared/theme';

const LOCAL_SINGLE_USER_MODE = import.meta.env.VITE_LOCAL_SINGLE_USER_MODE === 'true' || import.meta.env.DEV;

const drawerWidth = 260;

// Styled NavLink with proper hover/focus/active states
const StyledNavLink = styled(NavLink)(({ theme }) => ({
  borderRadius: (theme.shape.borderRadius as number) * 2,
  margin: '0.25rem 1rem',
  display: 'flex',
  alignItems: 'center',
  textDecoration: 'none',
  color: theme.palette.text.primary,
  backgroundColor: 'transparent',
  transition: 'background-color 150ms ease, color 150ms ease',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.primary,
    textDecoration: 'none',
  },
  '&.active': {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  '& .MuiListItemIcon-root': {
    color: 'inherit',
    minWidth: 40,
  },
  '& .MuiListItemTextPrimary': {
    color: 'inherit',
  },
}));

const navigationItems = [
  { path: '/dashboard', label: 'Dashboard', icon: <DashboardOutlined />, comingSoon: false },
  { path: '/chat', label: 'Chat', icon: <ChatOutlined />, comingSoon: false },
  { path: '/council', label: 'Council', icon: <AccountBalanceOutlined />, comingSoon: true },
  { path: '/meetings', label: 'Meetings', icon: <EventOutlined />, comingSoon: true },
  { path: '/memory', label: 'Memory', icon: <LibraryBooksOutlined />, comingSoon: false },
  { path: '/organization', label: 'Organization', icon: <BusinessOutlined />, comingSoon: false },
  { path: '/tasks', label: 'Tasks & Delegation', icon: <EngineeringOutlined />, comingSoon: false },
  { path: '/executions', label: 'Executions', icon: <PlayArrowOutlined />, comingSoon: false },
  { path: '/deliverables', label: 'Deliverables', icon: <AssignmentOutlined />, comingSoon: false },
  { path: '/approvals', label: 'Approvals', icon: <VerifiedUserOutlined />, comingSoon: false },
];

export default function Layout() {
  const themeStore = useThemeStore();
  const { authContext, logout } = useAppAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerClose = () => {
    setMobileOpen(false);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
  };

  const handleThemeToggle = () => {
    themeStore.setMode(themeStore.mode === 'light' ? 'dark' : 'light');
  };

  const drawer = (
    <Box onClick={handleDrawerClose} sx={{ textAlign: 'center', p: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        <AccountBalanceOutlined sx={{ fontSize: 28 }} />
        Council Bridge
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <List component="nav" aria-label="main navigation">
        {navigationItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <StyledNavLink
              to={item.path}
              end
              aria-current={item.comingSoon ? undefined : 'page'}
              aria-disabled={item.comingSoon}
              onClick={(e) => {
                if (item.comingSoon) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
              {item.comingSoon && (
                <Chip label="Coming Soon" size="small" color="warning" variant="outlined" />
              )}
            </StyledNavLink>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop permanent drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            borderRight: 1,
            borderColor: 'divider',
            backgroundColor: 'background.paper',
          },
        }}
        open
      >
        {drawer}
      </Drawer>

      {/* Mobile temporary drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
        }}
      >
        {drawer}
      </Drawer>

      {/* Main content wrapper - includes AppBar and main content */}
      <Box sx={{ display: 'flex', flexGrow: 1, minHeight: '100vh', width: { md: `calc(100% - ${drawerWidth}px)` } }}>
        {/* AppBar */}
        <AppBar
          position="fixed"
          sx={{
            width: { md: '100%' },
            ml: { md: `${drawerWidth}px` },
            backgroundColor: (t) => t.palette.background.paper,
            borderBottom: 1,
            borderColor: 'divider',
            boxShadow: 'none',
          }}
          elevation={0}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: 'none' } }}
              aria-label="Open navigation menu"
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
              Council Bridge
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title={themeStore.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <IconButton onClick={handleThemeToggle} color="inherit">
                {themeStore.mode === 'dark' ? <LightModeOutlined /> : <DarkModeOutlined />}
              </IconButton>
            </Tooltip>
            <IconButton onClick={handleMenuOpen} color="inherit" aria-label="User menu">
              <Avatar
                sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}
              >
                <PersonOutlined fontSize="small" />
              </Avatar>
            </IconButton>
          </Toolbar>
        </AppBar>

        {/* Main content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            backgroundColor: 'background.default',
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {/* User menu - positioned at app root level for proper z-index */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }} role="menu" aria-label="User menu options">
          <Typography variant="body2" color="text.secondary">
            Signed in as
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {authContext?.owner_type === 'founder' ? 'Founder' : authContext?.owner_id}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {authContext?.runtime} • {authContext?.owner_type}
            {LOCAL_SINGLE_USER_MODE && ' • Local Mode'}
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon aria-label="Logout"><LogoutOutlined fontSize="small" /></ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
    </Box>
  );
}