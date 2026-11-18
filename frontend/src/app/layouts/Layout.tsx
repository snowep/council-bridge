import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Drawer,
  Toolbar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
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
  SettingsOutlined,
  History,
} from '@mui/icons-material';
import { useState } from 'react';
import { useAppAuth } from '../use-app-auth';
import { useThemeStore } from '../../shared/theme';

const LOCAL_SINGLE_USER_MODE = import.meta.env.VITE_LOCAL_SINGLE_USER_MODE === 'true' || import.meta.env.DEV;

const drawerWidth = 260;

const navigationItems = [
  { path: '/dashboard', label: 'Dashboard', icon: <DashboardOutlined /> },
  { path: '/activity', label: 'Activity', icon: <History /> },
  { path: '/chat', label: 'Chat', icon: <ChatOutlined /> },
  { path: '/council', label: 'Council', icon: <AccountBalanceOutlined /> },
  { path: '/meetings', label: 'Meetings', icon: <EventOutlined /> },
  { path: '/memory', label: 'Memory', icon: <LibraryBooksOutlined /> },
  { path: '/organization', label: 'Organization', icon: <BusinessOutlined /> },
  { path: '/tasks', label: 'Tasks & Delegation', icon: <EngineeringOutlined /> },
  { path: '/executions', label: 'Executions', icon: <PlayArrowOutlined /> },
  { path: '/deliverables', label: 'Deliverables', icon: <AssignmentOutlined /> },
  { path: '/approvals', label: 'Approvals', icon: <VerifiedUserOutlined /> },
  { path: '/profile', label: 'Profile', icon: <PersonOutlined /> },
  { path: '/settings', label: 'Settings', icon: <SettingsOutlined /> },
];

export default function Layout() {
  const themeStore = useThemeStore();
  const { authContext, logout } = useAppAuth();
  const location = useLocation();
  const navigate = useNavigate();
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

  const isItemSelected = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const drawerNavigation = (
    <List component="nav" aria-label="main navigation">
      {navigationItems.map((item) => (
        <ListItem key={item.path} disablePadding>
          <ListItemButton
            component={NavLink}
            to={item.path}
            end
            selected={isItemSelected(item.path)}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
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
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Council Bridge
          </Typography>
          <Tooltip title={themeStore.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton onClick={handleThemeToggle} color="inherit">
              {themeStore.mode === 'dark' ? <LightModeOutlined /> : <DarkModeOutlined />}
            </IconButton>
          </Tooltip>
          <IconButton onClick={handleMenuOpen} color="inherit" aria-label="User menu">
            <PersonOutlined />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            border: 'none',
            backgroundColor: 'background.paper',
          },
        }}
        open
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>{drawerNavigation}</Box>
      </Drawer>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            border: 'none',
            backgroundColor: 'background.paper',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>{drawerNavigation}</Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, minHeight: '100vh' }}>
        <Toolbar />
        <Outlet />
      </Box>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleMenuClose}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Signed in as
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {authContext?.owner_type === 'founder' ? 'Founder' : authContext?.owner_id}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {authContext?.runtime} • {authContext?.owner_type}
            {LOCAL_SINGLE_USER_MODE && ' • Local Mode'}
          </Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }}>
          <ListItemIcon>
            <PersonOutlined fontSize="small" />
          </ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={() => { handleMenuClose(); navigate('/settings'); }}>
          <ListItemIcon>
            <SettingsOutlined fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutOutlined fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
    </Box>
  );
}