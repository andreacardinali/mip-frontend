import { useState } from "react";

import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  Typography,
  Button,
  Paper,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
} from "@mui/material";

import HomeIcon from "@mui/icons-material/Home";
import DeleteIcon
  from "@mui/icons-material/Delete";

import OpenInNewIcon
  from "@mui/icons-material/OpenInNew";

import {
  DataGrid,
} from "@mui/x-data-grid";

import type {
  GridColDef,
} from "@mui/x-data-grid";

import api from "../api/api";

import type {
  Watchlist,
} from "../types/watchlist";

import {
  useNavigate,
} from "react-router-dom";

export default function WatchlistsPage() {

  const queryClient =
    useQueryClient();

  const navigate =
    useNavigate();

  const [open, setOpen] =
    useState(false);

  const [name, setName] =
    useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const {
    data = [],
    isLoading,
    refetch,
  } = useQuery<Watchlist[]>({
    queryKey: ["watchlists"],
    queryFn: async () => {

      const response =
        await api.get(
          "/watchlists"
        );

      return response.data;
    },
  });

  const createWatchlist =
    async () => {

      await api.post(
        "/watchlists",
        {
          name,
          description,
        },
      );

      await queryClient.invalidateQueries(
        {
          queryKey: [
            "watchlists",
          ],
        },
      );

      setOpen(false);

      setName("");
      setDescription("");
    };

  const deleteWatchlist =
    async (
      watchlistId: string
    ) => {

      if (
        !window.confirm(
          "Delete watchlist?"
        )
      ) {
        return;
      }

      await api.delete(
        `/watchlists/${watchlistId}`,
      );

      await queryClient.invalidateQueries(
        {
          queryKey: [
            "watchlists",
          ],
        },
      );
    };

  const columns: GridColDef[] =
    [
      {
        field: "name",
        headerName: "Name",
        flex: 1,
      },
      {
        field: "description",
        headerName:
          "Description",
        flex: 2,
      },
      {
        field: "created_at",
        headerName:
          "Created",
        flex: 1,
      },
      {
        field: "open",
        headerName:
          "Open",
        width: 90,

        sortable: false,

        renderCell:
          (params) => (
            <IconButton
              onClick={(e) => {

                e.stopPropagation();

                navigate(
                  `/watchlists/${params.row.watchlist_id}`
                );
              }}
            >
              <OpenInNewIcon />
            </IconButton>
          ),
      },
      {
        field: "delete",
        headerName:
          "Delete",
        width: 90,

        sortable: false,

        renderCell:
          (params) => (
            <IconButton
              color="error"
              onClick={(e) => {

                e.stopPropagation();

                deleteWatchlist(
                  params.row.watchlist_id
                );
              }}
            >
              <DeleteIcon />
            </IconButton>
          ),
      },
    ];

  return (
    <>
      <Box
          <Button
            startIcon={<HomeIcon />}
            onClick={() => navigate("/")}
          >
            Home
          </Button>
        sx={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "center",
          mb: 2,
        }}
      >
        <Typography
          variant="h4"
        >
          Watchlists
        </Typography>

        <Box
          <Button
            startIcon={<HomeIcon />}
            onClick={() => navigate("/")}
          >
            Home
          </Button>
          sx={{
            display: "flex",
            gap: 2,
          }}
        >
          <Button
            variant="outlined"
            onClick={() =>
              refetch()
            }
          >
            Refresh
          </Button>

          <Button
            variant="contained"
            onClick={() =>
              setOpen(true)
            }
          >
            New Watchlist
          </Button>
        </Box>
      </Box>

      <Paper
        sx={{
          height: 650,
        }}
      >
        <DataGrid
          rows={data}
          columns={columns}
          loading={
            isLoading
          }
          getRowId={(row) =>
            row.watchlist_id
          }
          onRowClick={(
            params
          ) =>
            navigate(
              `/watchlists/${params.row.watchlist_id}`
            )
          }
        />
      </Paper>

      <Dialog
        open={open}
        onClose={() =>
          setOpen(false)
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Create Watchlist
        </DialogTitle>

        <DialogContent>

          <TextField
            fullWidth
            margin="normal"
            label="Name"
            value={name}
            onChange={(e) =>
              setName(
                e.target.value
              )
            }
          />

          <TextField
            fullWidth
            margin="normal"
            label="Description"
            value={
              description
            }
            onChange={(e) =>
              setDescription(
                e.target.value
              )
            }
          />

        </DialogContent>

        <DialogActions>

          <Button
            onClick={() =>
              setOpen(false)
            }
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={
              createWatchlist
            }
          >
            Create
          </Button>

        </DialogActions>
      </Dialog>

    </>
  );
}
