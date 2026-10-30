import { useContext, useState } from "react";
import { AppBar, Box, Drawer, FormControlLabel, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Switch, Toolbar, Tooltip, Typography } from "@mui/material";
import { DashboardOutlined, BusinessOutlined, PublicOutlined, BookmarkBorder, AccountBalanceWalletOutlined, NewspaperOutlined, BoltOutlined, InsightsOutlined, SettingsOutlined, AdminPanelSettingsOutlined, Menu, Logout } from "@mui/icons-material";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthProvider";
import { usePriceRefresh } from "../contexts/PriceRefreshProvider";
import { ThemeModeContext } from "../contexts/ThemeModeContext";
import NotificationCenter from "./NotificationCenter";

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const { enabled, setEnabled, intervalMs } = usePriceRefresh();
  const { mode, setMode } = useContext(ThemeModeContext);
  const menu = [
    { label: "Panoramica", path: "/", icon: <DashboardOutlined /> },
    { label: "Entita", path: "/entities", icon: <BusinessOutlined /> },
    { label: "Universi", path: "/universes", icon: <PublicOutlined /> },
    { label: "Watchlist", path: "/watchlists", icon: <BookmarkBorder /> },
    { label: "Portafogli", path: "/portfolios", icon: <AccountBalanceWalletOutlined /> },
    { label: "News", path: "/news", icon: <NewspaperOutlined /> },
    { label: "Catalizzatori", path: "/catalysts", icon: <BoltOutlined /> },
    { label: "Segnali e analisi", path: "/screener", icon: <InsightsOutlined /> },
    { label: "Preferenze", path: "/settings", icon: <SettingsOutlined /> },
  ];
  if (user?.roles.includes("ADMIN")) {
    menu.push({ label: "Sistema", path: "/system-settings", icon: <AdminPanelSettingsOutlined /> });
  }
  const active = menu.find((item) => item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path));
  const navigation = (
    <Box component="nav" aria-label="Navigazione principale" sx={{ width: 224, height: "100%", bgcolor: "background.paper", borderRight: 1, borderColor: "divider" }}>
      <Box sx={{ p: 2.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography component={Link} to="/" variant="h5" sx={{ textDecoration: "none", color: "primary.main" }}>MIP</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Market Intelligence Platform</Typography>
      </Box>
      <List sx={{ p: 1 }}>
        {menu.map((item) => (
          <ListItemButton key={item.path} component={Link} to={item.path} selected={active?.path === item.path} onClick={() => setMobileOpen(false)} sx={{ borderRadius: 1, mb: 0.5, "&.Mui-selected": { color: "primary.main", bgcolor: "rgba(0,107,100,0.1)" } }}>
            <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
  return (
    <Box sx={{ display: "flex", height: "100svh", overflow: "hidden" }}>
      <Box sx={{ display: { xs: "none", md: "block" }, flexShrink: 0 }}>{navigation}</Box>
      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} sx={{ display: { md: "none" } }}>{navigation}</Drawer>
      <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <AppBar position="static">
          <Toolbar sx={{ gap: 1, flexWrap: "wrap", py: 0.5 }}>
            <IconButton aria-label="Apri navigazione" onClick={() => setMobileOpen(true)} sx={{ display: { md: "none" } }}><Menu /></IconButton>
            <Typography variant="h6" sx={{ flex: 1 }}>{active?.label ?? "MIP"}</Typography>
            <FormControlLabel control={<Switch checked={mode === "dark"} onChange={(_, checked) => setMode(checked ? "dark" : "light")} slotProps={{ input: { "aria-label": "Tema scuro" } }} />} label="Dark" sx={{ mr: 0 }} />
            <Tooltip title={enabled ? `Aggiornamento ogni ${intervalMs / 1000} secondi` : "Aggiornamento automatico disattivato"}>
              <FormControlLabel control={<Switch checked={enabled} onChange={(_, checked) => setEnabled(checked)} slotProps={{ input: { "aria-label": "Aggiornamento automatico prezzi" } }} />} label="Prezzi live" sx={{ mr: 0, "& .MuiFormControlLabel-label": { fontSize: 13 } }} />
            </Tooltip>
            <Typography variant="body2" sx={{ display: { xs: "none", sm: "block" } }}>{user?.display_name ?? user?.username}</Typography>
            <NotificationCenter />
            <Tooltip title="Esci"><IconButton aria-label="Esci" onClick={logout}><Logout /></IconButton></Tooltip>
          </Toolbar>
        </AppBar>
        <Box component="main" id="main-content" sx={{ flex: 1, minHeight: 0, overflow: "auto", p: { xs: 1.5, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
