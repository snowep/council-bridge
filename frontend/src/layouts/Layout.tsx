import { Outlet, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useMediaQuery,
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
  SettingsOutlined,
  DarkModeOutlined,
  LightModeOutlined,
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useAppAuth } from '../app/App';
import { useTheme as useMuiTheme } from '@mui/material/styles';

const drawerWidth = 260;

const navigationItems = [
  { path: '/dashboard', label: 'Dashboard', icon: <DashboardOutlined /> },
  { path: '/chat', label: 'Chat', icon: <ChatOutlined /> },
  { path: '/council', label: 'Council', icon: <AccountBalanceOutlined /> },
  { path: '/meetings', label: 'Meetings', icon: <EventOutlined /> },
  { path: '/memory', label: 'Memory', icon: <LibraryBooksOutlined /> },
  { path: '/organization', label: 'Organization', icon: <BusinessOutlined /> },
  { path: '/tasks', label: 'Tasks & Delegation', icon: <EngineeringOutlined /> },
  { path: '/executions', label: 'Executions', icon: <PlayArrowOutlined /> },
  { path: '/deliverables', label: 'Deliverables', icon: <AssignmentOutlined /> },
  { path: '/approvals', label: 'Approvals', icon: <VerifiedUserOutlined /> },
];

export default function Layout() {
  const theme = useMuiTheme();
  useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const { authContext, logout } = useAppAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('theme_mode') as 'light' | 'dark' | null;
    setDarkMode(saved === 'dark');
  }, []);

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
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('theme_mode', newMode ? 'dark' : 'light');
    window.location.reload();
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
          <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              component="a"
              href={item.path}
              selected={location.pathname === item.path}
              onClick={handleDrawerClose}
              sx={{
                borderRadius: 2,
                mx: 1,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.contrastText',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          backgroundColor: (theme) => theme.palette.background.paper,
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
          <Tooltip title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton onClick={handleThemeToggle} color="inherit">
              {darkMode ? <LightModeOutlined /> : <DarkModeOutlined />}
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

      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="Main navigation"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerClose}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRight: 1,
              borderColor: 'divider',
              backgroundColor: 'background.paper',
              height: '100vh',
              position: 'sticky',
              top: 0,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: '64px',
          backgroundColor: 'background.default',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <Outlet />
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            Signed in as
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {authContext?.owner_type === 'founder' ? 'Founder' : authContext?.owner_id}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {authContext?.runtime} • {authContext?.owner_type}
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon><PersonOutlined fontSize="small" /></ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon><SettingsOutlined fontSize="small" /></ListItemIcon>
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon><LogoutOutlined fontSize="small" /></ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
    </Box>
  );
}