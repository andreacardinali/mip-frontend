import { useState } from "react";

import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
} from "@mui/material";

import { login }
  from "../services/auth";
import { notifyOperation } from "../services/operationFeedback";

export default function LoginPage() {

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  async function handleLogin() {

    try {

      const result =
        await login(
          username,
          password
        );

      localStorage.setItem(
        "access_token",
        result.access_token
      );

      console.log(
        "TOKEN SAVED",
        localStorage.getItem("access_token")
      );

      console.log(
        "LOGIN OK",
        result
      );

      window.location.href = "/";
    } catch {

      notifyOperation("Accesso non riuscito. Verifica le credenziali.", "error");

    }

  }

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        mt: 8,
      }}
    >
      <Paper
        sx={{
          p: 4,
          width: 400,
        }}
      >
        <Typography
          variant="h5"
          sx={{ mb: 2 }}
        >
          Login
        </Typography>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
        >
          <TextField
            fullWidth
            label="Username"
            margin="normal"
            value={username}
            onChange={(e) =>
              setUsername(
                e.target.value
              )
            }
          />

          <TextField
            fullWidth
            label="Password"
            type="password"
            margin="normal"
            value={password}
            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }
          />

          <Button
            fullWidth
            type="submit"
            variant="contained"
            sx={{ mt: 2 }}
          >
            Login
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
