import { Box, Paper, Typography } from "@mui/material";

import { useNavigate } from "react-router-dom";

import { useQuery } from "@tanstack/react-query";

import api from "../api/api";

export default function DashboardPage() {

  const navigate = useNavigate();

  const { data: watchlists = [] } =
    useQuery({
      queryKey: ["watchlists"],
      queryFn: async () => {
        const response =
          await api.get("/watchlists");

        return response.data;
      },
    });

  const { data: portfolios = [] } =
    useQuery({
      queryKey: ["portfolios"],
      queryFn: async () => {
        const response =
          await api.get("/portfolios");

        return response.data;
      },
    });

  return (
    <Box sx={{ p: 3 }}>
      <Typography
        variant="h4"
        gutterBottom
      >
        Market Intelligence Platform
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, 1fr)",
          gap: 2,
        }}
      >
        <Paper
          sx={{
            p: 3,
            cursor: "pointer",
          }}
          onClick={() =>
            navigate("/watchlists")
          }
        >
          <Typography variant="h6">
            Watchlists
          </Typography>

          <Typography variant="h3">
            {watchlists.length}
          </Typography>
        </Paper>

        <Paper
          sx={{
            p: 3,
            cursor: "pointer",
          }}
          onClick={() =>
            navigate("/portfolios")
          }
        >
          <Typography variant="h6">
            Portfolios
          </Typography>

          <Typography variant="h3">
            {portfolios.length}
          </Typography>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6">
            Platform Status
          </Typography>

          <Typography variant="h5">
            Online
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
