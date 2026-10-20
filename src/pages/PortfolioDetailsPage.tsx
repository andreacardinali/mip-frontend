import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
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
import EditIcon from "@mui/icons-material/Edit";
import { DataGrid } from "@mui/x-data-grid";
import type { GridRowSelectionModel } from "@mui/x-data-grid";

import { deletePosition, getPositions, savePosition } from "../services/positions";
import { getPortfolioSummary } from "../services/portfolios";
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

type PositionRow = {
  position_id: string;
  portfolio_id: string;
  instrument_id: string;
  symbol: string;
  name: string;
  quantity: number | string;
  avg_price: number | string | null;
  last_price?: number | string | null;
  price_refresh_status?: string | null;
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

function formatNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : String(value);
}

function formatMoney(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number)
    ? number.toLocaleString("it-IT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0,00";
}
export default function PortfolioDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<PositionRow | null>(null);
  const [instrument, setInstrument] = useState<AssetSearchResult | null>(null);
  const [quantity, setQuantity] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [searchText, setSearchText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [rowSelectionModel, setRowSelectionModel] =
    useState<GridRowSelectionModel>({ type: "include", ids: new Set() });
  const { data = [], isLoading } = useQuery({
    queryKey: ["positions", id],
    queryFn: () => getPositions(id!),
    enabled: Boolean(id),
  });

  const selectedRowIds = rowSelectionModel.type === "exclude"
    ? data
        .map((row: any) => String(row.position_id))
        .filter((rowId: string) => !rowSelectionModel.ids.has(rowId))
    : Array.from(rowSelectionModel.ids).map(String);

  const { data: summary } = useQuery({
    queryKey: ["portfolio-summary", id],
    queryFn: () => getPortfolioSummary(id!),
    enabled: Boolean(id),
  });

  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ["asset-search", searchText.trim()],
    queryFn: () => searchAssets(searchText.trim()),
    enabled: !editingPosition && searchText.trim().length >= 2,
  });

  const existingSymbols = useMemo(
    () => new Set(data.map((position: PositionRow) => position.symbol.toUpperCase())),
    [data],
  );

  const availableInstruments = useMemo(() => {
    const seen = new Set<string>();
    return (searchResults?.results ?? []).filter((option: AssetSearchResult) => {
      const key = assetKey(option);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [searchResults]);

  function isAlreadyInPortfolio(option: AssetSearchResult) {
    return existingSymbols.has(option.symbol.toUpperCase());
  }

  function resetDialogState() {
    setEditingPosition(null);
    setInstrument(null);
    setQuantity("");
    setAvgPrice("");
    setSearchText("");
    setSaveError(null);
  }

  function openAddDialog() {
    resetDialogState();
    setOpen(true);
  }

  function openEditDialog(row: PositionRow) {
    setEditingPosition(row);
    setInstrument(null);
    setQuantity(String(row.quantity ?? ""));
    setAvgPrice(String(row.avg_price ?? ""));
    setSearchText("");
    setSaveError(null);
    setOpen(true);
  }

  function closeDialog() {
    if (isSaving) return;
    setOpen(false);
    resetDialogState();
  }

  async function refreshPortfolioQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["positions", id] }),
      queryClient.invalidateQueries({ queryKey: ["portfolio-summary", id] }),
    ]);
  }

  async function handleSave() {
    if (!id || isSaving) return;

    const parsedQuantity = Number(quantity);
    const parsedAvgPrice = Number(avgPrice);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) return;
    if (!Number.isFinite(parsedAvgPrice) || parsedAvgPrice < 0) return;

    setSaveError(null);
    setIsSaving(true);
    try {
      let instrumentId = editingPosition?.instrument_id;
      if (!editingPosition) {
        if (!instrument) return;
        const imported = await importSymbol({
          symbol: instrument.symbol,
          data_source: instrument.data_source,
        });
        instrumentId = imported.instrument_id;
      }
      if (!instrumentId) return;

      await savePosition({
        position_id: editingPosition?.position_id,
        portfolio_id: id,
        instrument_id: instrumentId,
        quantity: parsedQuantity,
        avg_price: parsedAvgPrice,
      });

      await refreshPortfolioQueries();
      setOpen(false);
      resetDialogState();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setSaveError(
          "Questo titolo è già presente nel portfolio. Modifica la posizione esistente.",
        );
      } else {
        console.error("[MIP portfolio] Position save failed", error);
        setSaveError("Impossibile salvare la posizione.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedRowIds.length === 0 || isBulkDeleting) return;
    if (!window.confirm(
      `Delete ${selectedRowIds.length} selected position${selectedRowIds.length === 1 ? "" : "s"}?`,
    )) return;

    setIsBulkDeleting(true);
    try {
      await Promise.all(selectedRowIds.map((positionId: string) => deletePosition(positionId)));
      setRowSelectionModel({ type: "include", ids: new Set() });
      await refreshPortfolioQueries();
    } finally {
      setIsBulkDeleting(false);
    }
  }

  async function handleDelete(positionId: string) {
    if (!window.confirm("Delete position?")) return;
    await deletePosition(positionId);
    await refreshPortfolioQueries();
  }

  const quantityValid = quantity !== "" && Number(quantity) > 0;
  const avgPriceValid = avgPrice !== "" && Number(avgPrice) >= 0;
  const canSave = quantityValid && avgPriceValid && Boolean(editingPosition || instrument) && !isSaving;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/portfolios")}>
            Portfolios
          </Button>
          <Typography variant="h4">Portfolio Details</Typography>
        </Stack>
        <Button variant="contained" onClick={openAddDialog}>Add Position</Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6">Portfolio Value</Typography>
        <Typography>Portfolio Currency: {summary?.portfolio_currency}</Typography>
        <Typography>Reporting Currency: {summary?.reporting_currency}</Typography>
        <Typography sx={{ mt: 1 }}>
          Native Value: {formatMoney(summary?.portfolio_value_native)} {summary?.portfolio_currency}
        </Typography>
        <Typography>
          Reporting Value: {formatMoney(summary?.portfolio_value_reporting)} {summary?.reporting_currency}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Positions: {summary?.positions_count ?? 0}
        </Typography>
      </Paper>

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
          checkboxSelection
          disableRowSelectionOnClick
          rowSelectionModel={rowSelectionModel}
          onRowSelectionModelChange={setRowSelectionModel}
          loading={isLoading}
          getRowId={(row) => row.position_id}
          columns={[
            { field: "symbol", headerName: "Symbol", flex: 1 },
            { field: "name", headerName: "Company", flex: 2 },
            { field: "quantity", headerName: "Quantity", flex: 1 },
            { field: "currency_code", headerName: "Currency", width: 90 },
            { field: "avg_price", headerName: "PMC", flex: 1 },
            {
              field: "last_price",
              headerName: "Current",
              flex: 1.45,
              renderCell: (params) => {
                if (params.value !== null && params.value !== undefined) return formatNumber(params.value);
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
            { field: "market_value", headerName: "Value", flex: 1 },
            { field: "profit_loss", headerName: "P/L", flex: 1 },
            { field: "profit_loss_pct", headerName: "P/L %", flex: 1 },
            {
              field: "edit", headerName: "Edit", width: 80, sortable: false,
              renderCell: (params) => (
                <IconButton color="primary" onClick={() => openEditDialog(params.row)}><EditIcon /></IconButton>
              ),
            },
            {
              field: "delete", headerName: "Delete", width: 90, sortable: false,
              renderCell: (params) => (
                <IconButton color="error" onClick={() => handleDelete(params.row.position_id)}><DeleteIcon /></IconButton>
              ),
            },
          ]}
        />
      </Paper>

      <Dialog
        open={open}
        onClose={closeDialog}
        fullWidth
        maxWidth="md"
        slotProps={{ paper: { sx: { minHeight: editingPosition ? 390 : 560, maxHeight: "88vh" } } }}
      >
        <Box
          component="form"
          onSubmit={(event) => { event.preventDefault(); void handleSave(); }}
          sx={{ display: "flex", flexDirection: "column", minHeight: "100%" }}
        >
          <DialogTitle>{editingPosition ? "Edit Position" : "Add Position"}</DialogTitle>
          <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2.5, p: 3 }}>
            {saveError && <Alert severity="error">{saveError}</Alert>}

            {editingPosition ? (
              <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{editingPosition.symbol}</Typography>
                <Typography variant="body2">{editingPosition.name}</Typography>
              </Paper>
            ) : (
              <>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Search for an instrument</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Search by ticker or company name, then enter quantity and PMC. I titoli già presenti restano visibili ma non sono selezionabili.
                  </Typography>
                </Box>

                <Autocomplete<AssetSearchResult>
                  fullWidth
                  autoHighlight
                  clearOnBlur={false}
                  filterOptions={(options) => options}
                  options={availableInstruments}
                  value={instrument}
                  inputValue={searchText}
                  loading={isSearching}
                  disabled={isSaving}
                  noOptionsText={searchText.trim().length < 2 ? "Enter at least two characters" : "No instruments found"}
                  getOptionDisabled={(option) => isAlreadyInPortfolio(option)}
                  getOptionLabel={(option) => [option.symbol, option.name].filter(Boolean).join(" - ")}
                  isOptionEqualToValue={(option, value) => assetKey(option) === assetKey(value)}
                  getOptionKey={(option) => assetKey(option)}
                  onInputChange={(_, value, reason) => { if (reason !== "reset") setSearchText(value); }}
                  onChange={(_, value) => setInstrument(value)}
                  slotProps={{ listbox: { sx: { maxHeight: 320, py: 0 } }, paper: { sx: { mt: 1 } } }}
                  renderOption={(props, option) => {
                    const { key, ...optionProps } = props;
                    const exchange = assetExchange(option);
                    const currency = assetCurrency(option);
                    const instrumentType = assetType(option);
                    const alreadyInPortfolio = isAlreadyInPortfolio(option);
                    return (
                      <Box
                        component="li"
                        key={key}
                        {...optionProps}
                        sx={{
                          alignItems: "stretch !important",
                          px: "16px !important",
                          py: "12px !important",
                          opacity: alreadyInPortfolio ? 0.55 : 1,
                        }}
                      >
                        <Stack spacing={0.75} sx={{ width: "100%", minWidth: 0 }}>
                          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{option.symbol}</Typography>
                            {exchange && <Chip label={exchange} size="small" variant="outlined" />}
                            {currency && <Chip label={currency} size="small" />}
                            {alreadyInPortfolio && (
                              <Chip
                                label="Già in portafoglio"
                                size="small"
                                color="default"
                                variant="outlined"
                              />
                            )}
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
                      helperText={instrument ? `${instrument.symbol} selected` : isSearching ? "Searching instruments..." : "Select an instrument before saving"}
                    />
                  )}
                />

                {instrument && (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
                    <Typography variant="overline" color="text.secondary">Selected instrument</Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", mt: 0.5 }}>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>{instrument.symbol}</Typography>
                        <Typography variant="body2">{instrument.name}</Typography>
                      </Box>
                      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                        {assetExchange(instrument) && <Chip label={assetExchange(instrument)} variant="outlined" />}
                        {assetCurrency(instrument) && <Chip label={assetCurrency(instrument)} />}
                      </Stack>
                    </Stack>
                  </Paper>
                )}
              </>
            )}

            <Divider />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                fullWidth required label="Quantity" type="number" value={quantity} disabled={isSaving}
                slotProps={{ htmlInput: { min: 0, step: "any" } }}
                error={quantity !== "" && !quantityValid}
                helperText={quantity !== "" && !quantityValid ? "Quantity must be greater than zero" : "Number of units held"}
                onChange={(event) => setQuantity(event.target.value)}
              />
              <TextField
                fullWidth required label="PMC" type="number" value={avgPrice} disabled={isSaving}
                slotProps={{ htmlInput: { min: 0, step: "any" } }}
                error={avgPrice !== "" && !avgPriceValid}
                helperText="Average purchase price per unit"
                onChange={(event) => setAvgPrice(event.target.value)}
              />
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={closeDialog} disabled={isSaving}>Cancel</Button>
            <Button
              type="submit" variant="contained" disabled={!canSave}
              startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {isSaving ? "Saving..." : editingPosition ? "Save Changes" : "Add Position"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
