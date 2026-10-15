import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  TextField,
  IconButton,
} from "@mui/material";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";

import {
  DataGrid,
} from "@mui/x-data-grid";

import type {
  GridRowModel,
} from "@mui/x-data-grid";

import {
  getWatchlistItems,
  saveWatchlistItem,
  deleteWatchlistItem,
} from "../services/watchlistItems";

import {
  searchAssets,
} from "../services/search";

import {
  importSymbol,
} from "../services/imports";

export default function WatchlistDetailsPage() {

  const { id } = useParams();

  const queryClient = useQueryClient();
  const navigate = useNavigate();
    

  const [open, setOpen] =
    useState(false);

  const [entity, setEntity] =
    useState<any>(null);

  const [
    searchText,
    setSearchText,
  ] = useState("");

  const {
    data = [],
    isLoading,
  } = useQuery({
    queryKey: [
      "watchlist-items",
      id,
    ],

    queryFn: () =>
      getWatchlistItems(id!),
  });

  const {
    data: searchResults,
  } = useQuery({
    queryKey: [
      "asset-search",
      searchText,
    ],

    queryFn: () =>
      searchAssets(
        searchText
      ),

    enabled:
      searchText.length >= 2,
  });

  async function handleAdd() {

    if (!entity) {
      return;
    }

    const imported =
      await importSymbol(
        entity.symbol
      );

    await saveWatchlistItem({
      watchlist_id: id!,
      entity_id:
        imported.entity_id,
    });

    await queryClient.invalidateQueries({
      queryKey: [
        "watchlist-items",
        id,
      ],
    });

    setOpen(false);
    setEntity(null);
    setSearchText("");
  }

  async function handleDelete(
    itemId: string
  ) {

    if (
      !window.confirm(
        "Delete item?"
      )
    ) {
      return;
    }

    await deleteWatchlistItem(
      itemId
    );

    await queryClient.invalidateQueries({
      queryKey: [
        "watchlist-items",
        id,
      ],
    });
  }

  async function handleUpdateItem(
    row: GridRowModel
  ) {

    await saveWatchlistItem({
      watchlist_item_id:
        row.watchlist_item_id,

      watchlist_id:
        row.watchlist_id,

      entity_id:
        row.entity_id,

      priority:
        row.priority,

      target_price:
        row.target_price,

      notes:
        row.notes,
    });

    return row;
  }

  return (
    <Box sx={{ p: 3 }}>

      <Box
        sx={{
          display: "flex",
          justifyContent:
            "space-between",
          mb: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/watchlists")}
          >
            Watchlists
          </Button>

          <Typography variant="h4">
            Watchlist Details
          </Typography>
        </Box>

        <Button
          variant="contained"
          onClick={() =>
            setOpen(true)
          }
        >
          Add Entity
        </Button>
      </Box>

      <Paper sx={{ height: 700 }}>
        <DataGrid
          rows={data}
          loading={isLoading}
          processRowUpdate={
            handleUpdateItem
          }
          getRowId={(row) =>
            row.watchlist_item_id
          }
          columns={[
            {
              field: "symbol",
              headerName: "Symbol",
              flex: 1,
            },
            {
              field: "name",
              headerName: "Company",
              flex: 2,
            },
            {
              field: "priority",
              headerName: "Priority",
              flex: 1,
              editable: true,
            },
            {
              field: "currency_code",
              headerName: "Currency",
              width: 90,
              editable: true,
            },
            {
              field: "target_price",
              headerName: "Target",
              flex: 1,
            },
            {
              field: "last_price",
              headerName: "Current",
              flex: 1,
            },
            {
              field: "delete",
              headerName: "Delete",
              width: 100,

              renderCell:
                (params) => (
                  <IconButton
                    color="error"
                    onClick={() =>
                      handleDelete(
                        params.row.watchlist_item_id
                      )
                    }
                  >
                    <DeleteIcon />
                  </IconButton>
                ),
            },
          ]}
        />
      </Paper>

      <Dialog
        open={open}
        onClose={() =>
          setOpen(false)
        }
      >
        <DialogTitle>
          Add Entity
        </DialogTitle>

        <DialogContent>

          <Autocomplete
            options={
              searchResults?.results
              ?? []
            }

            getOptionLabel={
              (option: any) =>
                `${option.symbol} - ${option.name}`
            }

            inputValue={
              searchText
            }

            onInputChange={
              (_, value) =>
                setSearchText(
                  value
                )
            }

            onChange={
              (_, value) =>
                setEntity(
                  value
                )
            }

            renderInput={(params) => (
              <TextField
                {...params}
                label="Search Symbol"
              />
            )}
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
              handleAdd
            }
          >
            Save
          </Button>

        </DialogActions>

      </Dialog>

    </Box>
  );
}
