import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
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

type AssetSearchResult = {
  symbol: string;
  name: string;
  exchange?: string | null;
  exchange_code?: string | null;
  currency?: string | null;
  currency_code?: string | null;
  type?: string | null;
  instrument_type?: string | null;
};

function assetExchange(asset: AssetSearchResult) {
  return asset.exchange ?? asset.exchange_code ?? null;
}

function assetCurrency(asset: AssetSearchResult) {
  return asset.currency ?? asset.currency_code ?? null;
}

function assetType(asset: AssetSearchResult) {
  return asset.type ?? asset.instrument_type ?? null;
}

export default function WatchlistDetailsPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [entities, setEntities] =
    useState<AssetSearchResult[]>([]);
  const [searchText, setSearchText] = useState("");
  const [isAdding, setIsAdding] = useState(false);

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
    isFetching: isSearching,
  } = useQuery({
    queryKey: [
      "asset-search",
      searchText.trim(),
    ],
    queryFn: () =>
      searchAssets(
        searchText.trim()
      ),
    enabled:
      searchText.trim().length >= 2,
  });

  function openAddDialog() {
    setEntities([]);
    setSearchText("");
    setOpen(true);
  }

  function closeAddDialog() {
    if (isAdding) {
      return;
    }

    setOpen(false);
    setEntities([]);
    setSearchText("");
  }

  async function handleAdd() {
    if (entities.length === 0 || !id || isAdding) {
      return;
    }

    setIsAdding(true);

    try {
      for (const selectedEntity of entities) {
        const imported =
          await importSymbol(
            selectedEntity.symbol
          );

        await saveWatchlistItem({
          watchlist_id: id,
          entity_id:
            imported.entity_id,
        });
      }

      await queryClient.invalidateQueries({
        queryKey: [
          "watchlist-items",
          id,
        ],
      });

      setOpen(false);
      setEntities([]);
      setSearchText("");
    } finally {
      setIsAdding(false);
    }
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
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() =>
              navigate("/watchlists")
            }
          >
            Watchlists
          </Button>

          <Typography variant="h4">
            Watchlist Details
          </Typography>
        </Box>

        <Button
          variant="contained"
          onClick={openAddDialog}
        >
          Add Entities
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
                        params.row
                          .watchlist_item_id
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
        onClose={closeAddDialog}
        fullWidth
        maxWidth="md"
        slotProps={{
          paper: {
            sx: {
              minHeight: 540,
              maxHeight: "88vh",
            },
          },
        }}
      >
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleAdd();
          }}
          sx={{
            display: "flex",
            flexDirection: "column",
            minHeight: 540,
          }}
        >
          <DialogTitle sx={{ pb: 1 }}>
            Add Entities
          </DialogTitle>

          <DialogContent
            dividers
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2.5,
              px: 3,
              py: 3,
            }}
          >
            <Box>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600 }}
              >
                Search for instruments
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                Search by ticker symbol or company name,
                then select every instrument you want to add.
              </Typography>
            </Box>

            <Autocomplete<AssetSearchResult, true>
              multiple
              fullWidth
              autoHighlight
              clearOnBlur={false}
              filterOptions={(options) =>
                options
              }
              options={
                searchResults?.results
                ?? []
              }
              value={entities}
              inputValue={searchText}
              loading={isSearching}
              disabled={isAdding}
              noOptionsText={
                searchText.trim().length < 2
                  ? "Enter at least two characters"
                  : "No instruments found"
              }
              getOptionLabel={(option) =>
                [
                  option.symbol,
                  option.name,
                ]
                  .filter(Boolean)
                  .join(" - ")
              }
              isOptionEqualToValue={(
                option,
                value,
              ) =>
                option.symbol === value.symbol
                && assetExchange(option)
                  === assetExchange(value)
              }
              onInputChange={(
                _,
                value,
                reason,
              ) => {
                if (reason !== "reset") {
                  setSearchText(value);
                }
              }}
              onChange={(_, value) => {
                setEntities(value);
              }}
              slotProps={{
                listbox: {
                  sx: {
                    maxHeight: 340,
                    py: 0,
                  },
                },
                paper: {
                  sx: {
                    mt: 1,
                  },
                },
              }}
              renderOption={(
                props,
                option,
              ) => {
                const {
                  key,
                  ...optionProps
                } = props;
                const exchange =
                  assetExchange(option);
                const currency =
                  assetCurrency(option);
                const instrumentType =
                  assetType(option);

                return (
                  <Box
                    component="li"
                    key={key}
                    {...optionProps}
                    sx={{
                      alignItems:
                        "stretch !important",
                      px: "16px !important",
                      py: "12px !important",
                    }}
                  >
                    <Stack
                      spacing={0.75}
                      sx={{
                        width: "100%",
                        minWidth: 0,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        sx={{
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 700 }}
                        >
                          {option.symbol}
                        </Typography>

                        {exchange && (
                          <Chip
                            label={exchange}
                            size="small"
                            variant="outlined"
                          />
                        )}

                        {currency && (
                          <Chip
                            label={currency}
                            size="small"
                          />
                        )}
                      </Stack>

                      <Typography
                        variant="body2"
                        noWrap
                      >
                        {option.name}
                      </Typography>

                      {instrumentType && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          {instrumentType}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  autoFocus
                  label="Symbol or company name"
                  placeholder="For example: AAPL or Apple"
                  helperText={
                    entities.length > 0
                      ? `${entities.length} instrument${entities.length === 1 ? "" : "s"} selected`
                      : isSearching
                        ? "Searching instruments..."
                        : "Select one or more results before adding them"
                  }
                />
              )}
            />

            {entities.length > 0 && (
              <>
                <Divider />

                <Box>
                  <Typography
                    variant="overline"
                    color="text.secondary"
                  >
                    Selected instruments
                  </Typography>

                  <Stack
                    spacing={1}
                    sx={{ mt: 1 }}
                  >
                    {entities.map((selectedEntity) => (
                      <Paper
                        key={`${selectedEntity.symbol}-${assetExchange(selectedEntity) ?? "unknown"}`}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          bgcolor: "action.hover",
                        }}
                      >
                        <Stack
                          direction={{
                            xs: "column",
                            sm: "row",
                          }}
                          spacing={1.5}
                          sx={{
                            justifyContent: "space-between",
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 700 }}
                            >
                              {selectedEntity.symbol}
                            </Typography>

                            <Typography
                              variant="body2"
                              noWrap
                            >
                              {selectedEntity.name}
                            </Typography>
                          </Box>

                          <Stack
                            direction="row"
                            spacing={1}
                            useFlexGap
                            sx={{
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            {assetExchange(selectedEntity) && (
                              <Chip
                                label={assetExchange(selectedEntity)}
                                size="small"
                                variant="outlined"
                              />
                            )}

                            {assetCurrency(selectedEntity) && (
                              <Chip
                                label={assetCurrency(selectedEntity)}
                                size="small"
                              />
                            )}
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              </>
            )}
          </DialogContent>

          <DialogActions
            sx={{
              px: 3,
              py: 2,
            }}
          >
            <Button
              onClick={closeAddDialog}
              disabled={isAdding}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="contained"
              disabled={entities.length === 0 || isAdding}
              startIcon={
                isAdding
                  ? (
                    <CircularProgress
                      size={18}
                      color="inherit"
                    />
                  )
                  : undefined
              }
            >
              {
                isAdding
                  ? "Adding..."
                  : entities.length > 1
                    ? `Add ${entities.length} instruments`
                    : "Add to Watchlist"
              }
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
