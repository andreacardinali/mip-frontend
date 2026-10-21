import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { DataGrid } from "@mui/x-data-grid";
import type {
  GridRowModel,
  GridRowSelectionModel,
} from "@mui/x-data-grid";

import {
  deleteWatchlistItem,
  getWatchlistItems,
  saveWatchlistItem,
} from "../services/watchlistItems";
import { searchAssets } from "../services/search";
import { importSymbol } from "../services/imports";

type AssetSearchResult = {
  symbol: string;
  name: string;
  exchange?: string | null;
  exchange_code?: string | null;
  currency?: string | null;
  currency_code?: string | null;
  type?: string | null;
  instrument_type?: string | null;
  data_source?: string | null;
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

function assetKey(asset: AssetSearchResult) {
  return [
    asset.symbol,
    asset.data_source ?? "YAHOO",
    assetExchange(asset) ?? "",
  ].join("|");
}

function formatPrice(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }

  return number.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function WatchlistDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [entities, setEntities] = useState<AssetSearchResult[]>([]);
  const [searchText, setSearchText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [rowSelectionModel, setRowSelectionModel] =
    useState<GridRowSelectionModel>({ type: "include", ids: new Set() });

  const { data = [], isLoading } = useQuery({
    queryKey: ["watchlist-items", id],
    queryFn: () => getWatchlistItems(id!),
    enabled: Boolean(id),
  });

  const selectedRowIds = rowSelectionModel.type === "exclude"
    ? data
        .map((row: GridRowModel) => String(row.watchlist_item_id))
        .filter((rowId: string) => !rowSelectionModel.ids.has(rowId))
    : Array.from(rowSelectionModel.ids).map(String);

  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ["asset-search", searchText.trim()],
    queryFn: () => searchAssets(searchText.trim()),
    enabled: searchText.trim().length >= 2,
  });

  const availableOptions = (searchResults?.results ?? []).filter(
    (option: AssetSearchResult, index: number, options: AssetSearchResult[]) =>
      options.findIndex((candidate) => assetKey(candidate) === assetKey(option)) === index,
  );

  function openAddDialog() {
    setEntities([]);
    setSearchText("");
    setOpen(true);
  }

  function closeAddDialog() {
    if (isAdding) return;
    setOpen(false);
    setEntities([]);
    setSearchText("");
  }

  async function refreshItems() {
    await queryClient.invalidateQueries({ queryKey: ["watchlist-items", id] });
  }

  async function handleAdd() {
    if (!id || entities.length === 0 || isAdding) return;
    setIsAdding(true);
    try {
      for (const selectedEntity of entities) {
        const imported = await importSymbol({
          symbol: selectedEntity.symbol,
          data_source: selectedEntity.data_source,
        });
        await saveWatchlistItem({
          watchlist_id: id,
          entity_id: imported.entity_id,
        });
      }
      await refreshItems();
      setOpen(false);
      setEntities([]);
      setSearchText("");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(itemId: string) {
    if (!window.confirm("Delete item?")) return;
    await deleteWatchlistItem(itemId);
    await refreshItems();
  }

  async function handleBulkDelete() {
    if (selectedRowIds.length === 0 || isBulkDeleting) return;
    if (!window.confirm(
      `Delete ${selectedRowIds.length} selected item${selectedRowIds.length === 1 ? "" : "s"}?`,
    )) return;

    setIsBulkDeleting(true);
    try {
      await Promise.all(selectedRowIds.map((itemId: string) => deleteWatchlistItem(itemId)));
      setRowSelectionModel({ type: "include", ids: new Set() });
      await refreshItems();
    } finally {
      setIsBulkDeleting(false);
    }
  }

  async function handleUpdateItem(row: GridRowModel) {
    await saveWatchlistItem({
      watchlist_item_id: row.watchlist_item_id,
      watchlist_id: row.watchlist_id,
      entity_id: row.entity_id,
      priority: row.priority,
      target_price: row.target_price,
      notes: row.notes,
    });
    return row;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/watchlists")}>
            Watchlists
          </Button>
          <Typography variant="h4">Watchlist Details</Typography>
        </Stack>
        <Button variant="contained" onClick={openAddDialog}>Add Entities</Button>
      </Box>

      <Stack direction="row" spacing={1.5} sx={{ mb: 1.5, alignItems: "center" }}>
        <Button
          variant="contained"
          color="error"
          startIcon={isBulkDeleting ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />}
          disabled={selectedRowIds.length === 0 || isBulkDeleting}
          onClick={() => void handleBulkDelete()}
        >
          {isBulkDeleting ? "Deleting..." : `Delete selected (${selectedRowIds.length})`}
        </Button>
        {selectedRowIds.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            {selectedRowIds.length} selected
          </Typography>
        )}
      </Stack>

      <Paper sx={{ height: 700 }}>
        <DataGrid
          rows={data}
          loading={isLoading}
          checkboxSelection
          disableRowSelectionOnClick
          rowSelectionModel={rowSelectionModel}
          onRowSelectionModelChange={setRowSelectionModel}
          processRowUpdate={handleUpdateItem}
          getRowId={(row) => row.watchlist_item_id}
          columns={[
            { field: "symbol", headerName: "Symbol", flex: 1 },
            { field: "name", headerName: "Company", flex: 2 },
            {
              field: "priority",
              headerName: "Priority",
              type: "number",
              width: 100,
              editable: true,
              description: "Priority from 1 (highest) to 5 (lowest)",
            },
            {
              field: "currency_code",
              headerName: "Currency",
              width: 100,
              renderCell: (params) => params.value ? String(params.value).trim() : "-",
            },
            {
              field: "target_price",
              headerName: "Target",
              type: "number",
              flex: 1,
              editable: true,
              renderCell: (params) => formatPrice(params.value),
            },
            {
              field: "last_price",
              headerName: "Current",
              flex: 1.35,
              renderCell: (params) => {
                if (params.value !== null && params.value !== undefined) {
                  return formatPrice(params.value);
                }
                const status = params.row.price_refresh_status;
                const active = ["PENDING", "PROCESSING", "RETRY"].includes(status);
                return (
                  <Chip
                    size="small"
                    color={active ? "warning" : "default"}
                    variant={active ? "filled" : "outlined"}
                    label={active ? "Prezzo in aggiornamento" : status === "FAILED" ? "Prezzo non disponibile" : "Nessun prezzo"}
                  />
                );
              },
            },
            {
              field: "delete",
              headerName: "Delete",
              width: 90,
              sortable: false,
              renderCell: (params) => (
                <IconButton color="error" onClick={() => void handleDelete(params.row.watchlist_item_id)}>
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
        slotProps={{ paper: { sx: { minHeight: 540, maxHeight: "88vh" } } }}
      >
        <Box
          component="form"
          onSubmit={(event) => { event.preventDefault(); void handleAdd(); }}
          sx={{ display: "flex", flexDirection: "column", minHeight: 540 }}
        >
          <DialogTitle>Add Entities</DialogTitle>
          <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2.5, p: 3 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Search for instruments</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Search by ticker symbol or company name, then select every instrument you want to add.
              </Typography>
            </Box>

            <Autocomplete<AssetSearchResult, true>
              multiple
              fullWidth
              autoHighlight
              clearOnBlur={false}
              filterOptions={(options) => options}
              options={availableOptions}
              value={entities}
              inputValue={searchText}
              loading={isSearching}
              disabled={isAdding}
              noOptionsText={searchText.trim().length < 2 ? "Enter at least two characters" : "No instruments found"}
              getOptionLabel={(option) => [option.symbol, option.name].filter(Boolean).join(" - ")}
              getOptionKey={(option) => assetKey(option)}
              isOptionEqualToValue={(option, value) => assetKey(option) === assetKey(value)}
              onInputChange={(_, value, reason) => { if (reason !== "reset") setSearchText(value); }}
              onChange={(_, value) => setEntities(value)}
              slotProps={{ listbox: { sx: { maxHeight: 340, py: 0 } }, paper: { sx: { mt: 1 } } }}
              renderOption={(props, option) => {
                const { key, ...optionProps } = props;
                const exchange = assetExchange(option);
                const currency = assetCurrency(option);
                const instrumentType = assetType(option);
                return (
                  <Box component="li" key={key} {...optionProps} sx={{ alignItems: "stretch !important", px: "16px !important", py: "12px !important" }}>
                    <Stack spacing={0.75} sx={{ width: "100%", minWidth: 0 }}>
                      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{option.symbol}</Typography>
                        {exchange && <Chip label={exchange} size="small" variant="outlined" />}
                        {currency && <Chip label={currency} size="small" />}
                      </Stack>
                      <Typography variant="body2" noWrap>{option.name}</Typography>
                      {instrumentType && <Typography variant="caption" color="text.secondary">{instrumentType}</Typography>}
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
                      : isSearching ? "Searching instruments..." : "Select one or more results before adding them"
                  }
                />
              )}
            />

            {entities.length > 0 && (
              <>
                <Divider />
                <Typography variant="body2" color="text.secondary">
                  {entities.length} instrument{entities.length === 1 ? "" : "s"} selected
                </Typography>
              </>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={closeAddDialog} disabled={isAdding}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={entities.length === 0 || isAdding}
              startIcon={isAdding ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {isAdding ? "Adding..." : entities.length > 1 ? `Add ${entities.length} instruments` : "Add to Watchlist"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
