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

import PriceDisplay from "../components/PriceDisplay";
import { deletePosition, getPositions, savePosition } from "../services/positions";
import { getPortfolioSummary } from "../services/portfolios";
import { searchAssets } from "../services/search";
import { importSymbol } from "../services/imports";
import type { PortfolioSummary } from "../types/portfolio";

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
  price_as_of?: string | null;
  price_is_stale?: boolean | null;
  price_age_hours?: number | string | null;
};

const assetExchange = (asset: AssetSearchResult) =>
  asset.exchange ?? asset.exchange_code ?? null;
const assetCurrency = (asset: AssetSearchResult) =>
  asset.currency ?? asset.currency_code ?? null;
const assetType = (asset: AssetSearchResult) =>
  asset.type ?? asset.instrument_type ?? null;
const assetKey = (asset: AssetSearchResult) =>
  [asset.symbol, asset.data_source ?? "YAHOO", assetExchange(asset) ?? ""].join("|");

function formatMoney(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number)
    ? number.toLocaleString("it-IT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true,
      })
    : "0,00";
}

function formatSignedMoney(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number)
    ? `${number > 0 ? "+" : ""}${formatMoney(number)}`
    : "N/D";
}

function formatSignedPercent(value: unknown) {
  if (value == null || value === "") return "N/D";
  const number = Number(value);
  return Number.isFinite(number)
    ? `${number > 0 ? "+" : ""}${number.toLocaleString("it-IT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true,
      })}%`
    : "N/D";
}

function pnlColor(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return "text.secondary";
  return number > 0 ? "success.main" : "error.main";
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

  const { data: summary } = useQuery<PortfolioSummary>({
    queryKey: ["portfolio-summary", id],
    queryFn: () => getPortfolioSummary(id!),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data && !query.state.data.pricing_complete ? 5000 : false,
  });

  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ["asset-search", searchText.trim()],
    queryFn: () => searchAssets(searchText.trim()),
    enabled: !editingPosition && searchText.trim().length >= 2,
  });

  const pricingPending = Boolean(summary && !summary.pricing_complete);
  const selectedRowIds =
    rowSelectionModel.type === "exclude"
      ? data
          .map((row: PositionRow) => String(row.position_id))
          .filter((rowId: string) => !rowSelectionModel.ids.has(rowId))
      : Array.from(rowSelectionModel.ids).map(String);

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

  function resetDialogState() {
    setEditingPosition(null);
    setInstrument(null);
    setQuantity("");
    setAvgPrice("");
    setSearchText("");
    setSaveError(null);
  }

  async function refreshQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["positions", id] }),
      queryClient.invalidateQueries({ queryKey: ["portfolio-summary", id] }),
    ]);
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
    setSaveError(null);
    setOpen(true);
  }

  function closeDialog() {
    if (isSaving) return;
    setOpen(false);
    resetDialogState();
  }

  async function handleSave() {
    if (!id || isSaving) return;

    const parsedQuantity = Number(quantity);
    const parsedAvgPrice = Number(avgPrice);
    if (
      !Number.isFinite(parsedQuantity) ||
      parsedQuantity <= 0 ||
      !Number.isFinite(parsedAvgPrice) ||
      parsedAvgPrice < 0
    ) {
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    try {
      let instrumentId = editingPosition?.instrument_id;
      if (!editingPosition) {
        if (!instrument) return;
        instrumentId = (
          await importSymbol({
            symbol: instrument.symbol,
            data_source: instrument.data_source,
          })
        ).instrument_id;
      }
      if (!instrumentId) return;

      await savePosition({
        position_id: editingPosition?.position_id,
        portfolio_id: id,
        instrument_id: instrumentId,
        quantity: parsedQuantity,
        avg_price: parsedAvgPrice,
      });
      await refreshQueries();
      setOpen(false);
      resetDialogState();
    } catch (error) {
      setSaveError(
        axios.isAxiosError(error) && error.response?.status === 409
          ? "Questo titolo è già presente nel portfolio. Modifica la posizione esistente."
          : "Impossibile salvare la posizione.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(positionId: string) {
    if (!window.confirm("Delete position?")) return;
    await deletePosition(positionId);
    await refreshQueries();
  }

  async function handleBulkDelete() {
    if (
      !selectedRowIds.length ||
      isBulkDeleting ||
      !window.confirm(`Delete ${selectedRowIds.length} selected positions?`)
    ) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      await Promise.all(selectedRowIds.map(deletePosition));
      setRowSelectionModel({ type: "include", ids: new Set() });
      await refreshQueries();
    } finally {
      setIsBulkDeleting(false);
    }
  }

  const quantityValid = quantity !== "" && Number(quantity) > 0;
  const avgPriceValid = avgPrice !== "" && Number(avgPrice) >= 0;
  const canSave =
    quantityValid &&
    avgPriceValid &&
    Boolean(editingPosition || instrument) &&
    !isSaving;

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/portfolios")}>
            Portfolios
          </Button>
          <Typography variant="h4">Portfolio Details</Typography>
        </Stack>
        <Button variant="contained" onClick={openAddDialog}>
          Add Position
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6">Portfolio Value</Typography>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={4}
          useFlexGap
          sx={{ mt: 2, flexWrap: "wrap" }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">
              Invested value
            </Typography>
            <Typography variant="h6">
              {formatMoney(summary?.invested_value_native)} {summary?.portfolio_currency}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Current value
            </Typography>
            <Typography variant="h6" color={pricingPending ? "warning.main" : undefined}>
              {pricingPending
                ? "Saldo in aggiornamento"
                : `${formatMoney(summary?.portfolio_value_native)} ${summary?.portfolio_currency ?? ""}`}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Profit / Loss
            </Typography>
            <Typography
              variant="h6"
              sx={{ color: pnlColor(summary?.profit_loss_native), fontWeight: 700 }}
            >
              {pricingPending
                ? "In aggiornamento"
                : `${formatSignedMoney(summary?.profit_loss_native)} ${summary?.portfolio_currency ?? ""}`}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: pnlColor(summary?.profit_loss_pct), fontWeight: 700 }}
            >
              {pricingPending ? "—" : formatSignedPercent(summary?.profit_loss_pct)}
            </Typography>
          </Box>
        </Stack>

        {pricingPending && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Saldo in aggiornamento: {summary?.pending_price_count ?? 0} posizioni in attesa del prezzo.
          </Alert>
        )}

        <Divider sx={{ my: 2 }} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
          <Typography variant="body2" color="text.secondary">
            Reporting value: {pricingPending
              ? "In aggiornamento"
              : `${formatMoney(summary?.portfolio_value_reporting)} ${summary?.reporting_currency ?? ""}`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Positions: {summary?.positions_count ?? 0}
          </Typography>
        </Stack>
      </Paper>

      <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
        <Button
          variant="contained"
          color="error"
          startIcon={
            isBulkDeleting ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />
          }
          disabled={!selectedRowIds.length || isBulkDeleting}
          onClick={() => void handleBulkDelete()}
        >
          Delete selected ({selectedRowIds.length})
        </Button>
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
            {
              field: "quantity",
              headerName: "Quantity",
              type: "number",
              flex: 1,
              align: "right",
              headerAlign: "right",
            },
            { field: "currency_code", headerName: "Currency", width: 90 },
            {
              field: "avg_price",
              headerName: "PMC",
              type: "number",
              flex: 1,
              align: "right",
              headerAlign: "right",
              renderCell: (params) => formatMoney(params.value),
            },
            {
              field: "last_price",
              headerName: "Current",
              type: "number",
              flex: 1.6,
              align: "right",
              headerAlign: "right",
              renderCell: (params) => (
                <PriceDisplay
                  value={params.value}
                  priceAsOf={params.row.price_as_of}
                  priceIsStale={params.row.price_is_stale}
                  refreshStatus={params.row.price_refresh_status}
                  formatter={formatMoney}
                />
              ),
            },
            {
              field: "market_value",
              headerName: "Value",
              type: "number",
              flex: 1,
              align: "right",
              headerAlign: "right",
              renderCell: (params) =>
                params.row.last_price == null
                  ? "In aggiornamento"
                  : formatMoney(params.value),
            },
            {
              field: "profit_loss",
              headerName: "P/L",
              type: "number",
              flex: 1,
              align: "right",
              headerAlign: "right",
              renderCell: (params) =>
                params.row.last_price == null ? "—" : formatSignedMoney(params.value),
            },
            {
              field: "profit_loss_pct",
              headerName: "P/L %",
              type: "number",
              flex: 1,
              align: "right",
              headerAlign: "right",
              renderCell: (params) =>
                params.row.last_price == null ? "—" : formatSignedPercent(params.value),
            },
            {
              field: "edit",
              headerName: "Edit",
              width: 80,
              sortable: false,
              renderCell: (params) => (
                <IconButton color="primary" onClick={() => openEditDialog(params.row)}>
                  <EditIcon />
                </IconButton>
              ),
            },
            {
              field: "delete",
              headerName: "Delete",
              width: 90,
              sortable: false,
              renderCell: (params) => (
                <IconButton
                  color="error"
                  onClick={() => void handleDelete(params.row.position_id)}
                >
                  <DeleteIcon />
                </IconButton>
              ),
            },
          ]}
        />
      </Paper>

      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="md">
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <DialogTitle>{editingPosition ? "Edit Position" : "Add Position"}</DialogTitle>
          <DialogContent
            dividers
            sx={{ display: "flex", flexDirection: "column", gap: 2.5, p: 3 }}
          >
            {saveError && <Alert severity="error">{saveError}</Alert>}

            {editingPosition ? (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography sx={{ fontWeight: 700 }}>{editingPosition.symbol}</Typography>
                <Typography variant="body2">{editingPosition.name}</Typography>
              </Paper>
            ) : (
              <Autocomplete<AssetSearchResult>
                fullWidth
                autoHighlight
                filterOptions={(options) => options}
                options={availableInstruments}
                value={instrument}
                inputValue={searchText}
                loading={isSearching}
                disabled={isSaving}
                getOptionDisabled={(option) =>
                  existingSymbols.has(option.symbol.toUpperCase())
                }
                getOptionLabel={(option) => `${option.symbol} - ${option.name}`}
                isOptionEqualToValue={(option, value) =>
                  assetKey(option) === assetKey(value)
                }
                getOptionKey={assetKey}
                onInputChange={(_, value, reason) => {
                  if (reason !== "reset") setSearchText(value);
                }}
                onChange={(_, value) => setInstrument(value)}
                renderOption={(props, option) => {
                  const { key, ...rest } = props;
                  return (
                    <Box component="li" key={key} {...rest}>
                      <Stack>
                        <Stack direction="row" spacing={1}>
                          <Typography sx={{ fontWeight: 700 }}>{option.symbol}</Typography>
                          {assetExchange(option) && (
                            <Chip size="small" label={assetExchange(option)} />
                          )}
                          {assetCurrency(option) && (
                            <Chip size="small" label={assetCurrency(option)} />
                          )}
                        </Stack>
                        <Typography variant="body2">{option.name}</Typography>
                        {assetType(option) && (
                          <Typography variant="caption">{assetType(option)}</Typography>
                        )}
                      </Stack>
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField {...params} autoFocus label="Symbol or company name" />
                )}
              />
            )}

            <Divider />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                fullWidth
                required
                label="Quantity"
                type="number"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
              <TextField
                fullWidth
                required
                label="PMC"
                type="number"
                value={avgPrice}
                onChange={(event) => setAvgPrice(event.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!canSave}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
