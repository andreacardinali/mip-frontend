import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
} from "@mui/material";

import {
  Outlet,
  useNavigate,
  useLocation,
} from "react-router-dom";

import { useAuth }
  from "../contexts/AuthProvider";

export default function Layout() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const {
    user,
    logout,
  } = useAuth();

  const menu = [
    {
      label: "Dashboard",
      path: "/",
    },
    {
      label: "Watchlists",
      path: "/watchlists",
    },
    {
      label: "Portfolios",
      path: "/portfolios",
    },
    {
      label: "News",
      path: "/news",
    },
    {
      label: "Catalysts",
      path: "/catalysts",
    },
    {
      label: "Settings",
      path: "/settings",
    },
  ];

  return (
    <>
      <AppBar position="static">
        <Toolbar>

          <Typography
            variant="h6"
            sx={{
              mr: 4,
              cursor: "pointer",
            }}
            onClick={() =>
              navigate("/")
            }
          >
            MIP
          </Typography>

          {menu.map((item) => (
            <Button
              key={item.path}
              color="inherit"
              variant={
                location.pathname ===
                  item.path
                  ? "outlined"
                  : "text"
              }
              onClick={() =>
                navigate(item.path)
              }
              sx={{
                mr: 1,
              }}
            >
              {item.label}
            </Button>
          ))}

          <Box sx={{ flexGrow: 1 }} />

          <Typography
            sx={{
              mr: 2,
            }}
          >
            {user?.display_name ??
             user?.username}
          </Typography>

          <Button
            color="inherit"
            onClick={logout}
          >
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
