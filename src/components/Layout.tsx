import {
  AppBar,
  Box,
  Button,
  FormControlLabel,
  Switch,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";

import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthProvider";
import { usePriceRefresh } from "../contexts/PriceRefreshProvider";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { enabled, setEnabled, intervalMs } = usePriceRefresh();

  const menu = [
    { label: "Dashboard", path: "/" },
    { label: "Watchlists", path: "/watchlists" },
    { label: "Portfolios", path: "/portfolios" },
    { label: "News", path: "/news" },
    { label: "Catalysts", path: "/catalysts" },
    { label: "Settings", path: "/settings" },
  ];

if (user?.roles.includes("ADMIN")) {
  menu.push({
    label: "Sistema",
    path: "/system-settings",
  });
}

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography
            variant="h6"
            sx={{ mr: 4, cursor: "pointer" }}
            onClick={() => navigate("/")}
          >
            MIP
          </Typography>

          {menu.map((item) => (
            <Button
              key={item.path}
              color="inherit"
              variant={location.pathname === item.path ? "outlined" : "text"}
              onClick={() => navigate(item.path)}
              sx={{ mr: 1 }}
            >
              {item.label}
            </Button>
          ))}

          <Box sx={{ flexGrow: 1 }} />

          <Tooltip
            title={
              enabled
                ? `Aggiornamento automatico ogni ${intervalMs / 1000} secondi`
                : "Aggiornamento automatico dei prezzi disattivato"
            }
          >
            <FormControlLabel
              control={
                <Switch
                  color="default"
                  checked={enabled}
                  onChange={(_, checked) => setEnabled(checked)}
                  slotProps={{
                    input: {
                      "aria-label":
                        "Aggiornamento prezzi in tempo reale",
                    },
                  }}
                />
              }
              label={enabled ? "Prezzi live" : "Prezzi manuali"}
              sx={{ mr: 2, whiteSpace: "nowrap" }}
            />
          </Tooltip>

          <Typography sx={{ mr: 2 }}>
            {user?.display_name ?? user?.username}
          </Typography>

          <Button color="inherit" onClick={logout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2 }}>
        <Outlet />
      </Box>
    </>
  );
}
