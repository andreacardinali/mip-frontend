#!/bin/bash

set -e

mkdir -p src/types
mkdir -p src/pages

############################################
# WATCHLIST TYPE
############################################

cat > src/types/watchlist.ts << 'EOF'
export interface Watchlist {
  watchlist_id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}
EOF

############################################
# WATCHLIST PAGE
############################################

cat > src/pages/WatchlistsPage.tsx << 'EOF'
import { useQuery } from "@tanstack/react-query";

import {
  Typography,
  Button,
  Paper,
  Stack,
} from "@mui/material";

import {
  DataGrid,
  GridColDef,
} from "@mui/x-data-grid";

import api from "../api/api";

import { Watchlist } from "../types/watchlist";

const columns: GridColDef[] = [
  {
    field: "name",
    headerName: "Name",
    flex: 1,
  },
  {
    field: "description",
    headerName: "Description",
    flex: 2,
  },
  {
    field: "created_at",
    headerName: "Created",
    flex: 1,
  },
];

export default function WatchlistsPage() {
  const {
    data = [],
    isLoading,
    refetch,
  } = useQuery<Watchlist[]>({
    queryKey: ["watchlists"],
    queryFn: async () => {
      const response =
        await api.get("/watchlists");

      return response.data;
    },
  });

  return (
    <>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h4">
          Watchlists
        </Typography>

        <Button
          variant="contained"
          onClick={() => refetch()}
        >
          Refresh
        </Button>
      </Stack>

      <Paper sx={{ height: 600 }}>
        <DataGrid
          rows={data}
          columns={columns}
          loading={isLoading}
          getRowId={(row) =>
            row.watchlist_id
          }
        />
      </Paper>
    </>
  );
}
EOF

echo
echo "Watchlists UI created."