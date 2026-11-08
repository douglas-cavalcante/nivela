import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import LogoutIcon from '@mui/icons-material/LogoutOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import {
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { menuItems } from 'src/app/layouts/AppLayout/menu';
import { Mascot } from 'src/components/Mascot';
import { useAuth } from 'src/lib/auth/AuthContext';
import { useColorMode } from 'src/lib/theme/ColorModeProvider';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

export const DRAWER_WIDTH = 240;

function Binder({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const colors = useNivelaColors();
  const mode = useTheme().palette.mode;

  // Fichário: capa de tinta no tema claro, capa de "papel noturno" mais clara no escuro.
  const cover = mode === 'light' ? colors.text : colors.surface;
  const onCover = mode === 'light' ? colors.background : colors.text;
  const items = menuItems.filter((item) => user !== null && item.roles.includes(user.role));

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: cover,
        color: onCover,
        py: 2.5,
        px: 1.75,
        gap: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1 }}>
        <Mascot size={44} />
        <Typography variant="h3" component="p" sx={{ lineHeight: 1 }}>
          Nivela
        </Typography>
      </Box>

      <Box component="nav" aria-label="Menu principal" sx={{ flex: 1 }}>
        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {items.map(({ label, path, icon: Icon }) => (
            <ListItemButton
              key={path}
              component={NavLink}
              to={path}
              end={path === '/'}
              onClick={onNavigate}
              sx={{
                borderRadius: 3,
                minHeight: 46,
                color: onCover,
                border: '2px solid transparent',
                transition: 'background-color 120ms ease, box-shadow 120ms ease',
                '&:hover': { backgroundColor: alpha(onCover, 0.1) },
                // item ativo: folha de papel solta, com marca-texto amarelo por baixo
                '&.active': {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                  boxShadow: `3px 3px 0 ${colors.highlight}`,
                  '&:hover': { backgroundColor: colors.background },
                  '& .MuiListItemText-primary': { fontWeight: 800 },
                },
                '&.Mui-focusVisible': { outline: `3px solid ${colors.highlight}`, outlineOffset: 2 },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={label} slotProps={{ primary: { sx: { fontWeight: 700 } } }} />
            </ListItemButton>
          ))}
        </List>
      </Box>

      {user ? (
        <Box
          sx={{
            borderTop: `2px dashed ${alpha(onCover, 0.35)}`,
            pt: 1.5,
            px: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography noWrap sx={{ fontWeight: 800 }}>
              {user.name}
            </Typography>
            <Typography noWrap variant="body2" sx={{ opacity: 0.75 }}>
              {user.role === 'admin' ? 'Administrador' : 'Professor'}
            </Typography>
          </Box>
          <Tooltip title="Sair">
            <IconButton aria-label="Sair" onClick={() => void signOut()} sx={{ color: 'inherit' }}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ) : null}
    </Box>
  );
}

export function AppLayout() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [open, setOpen] = useState(false);
  const { mode, toggleMode } = useColorMode();
  const nextLabel = mode === 'light' ? 'Usar tema escuro' : 'Usar tema claro';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer
        variant={desktop ? 'permanent' : 'temporary'}
        open={desktop || open}
        onClose={() => setOpen(false)}
        slotProps={{ paper: { sx: { width: DRAWER_WIDTH, borderRight: `2px solid ${theme.palette.text.primary}` } } }}
        sx={{ width: desktop ? DRAWER_WIDTH : 0, flexShrink: 0 }}
      >
        <Binder onNavigate={() => setOpen(false)} />
      </Drawer>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Toolbar sx={{ justifyContent: desktop ? 'flex-end' : 'space-between', gap: 1 }}>
          {desktop ? null : (
            <IconButton aria-label="Abrir menu" onClick={() => setOpen(true)}>
              <MenuIcon />
            </IconButton>
          )}
          <Tooltip title={nextLabel}>
            <Button
              variant="outlined"
              color="inherit"
              aria-label={nextLabel}
              onClick={toggleMode}
              startIcon={mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
              sx={{ minHeight: 40 }}
            >
              {mode === 'light' ? 'Noturno' : 'Claro'}
            </Button>
          </Tooltip>
        </Toolbar>
        <Box component="main" sx={{ flex: 1, px: { xs: 2, md: 5 }, pb: 6, pt: 1, maxWidth: 1200, width: '100%' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
