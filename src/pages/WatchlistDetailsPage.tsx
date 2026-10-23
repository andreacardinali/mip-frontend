import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, IconButton, Paper, Stack, TextField, Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import { DataGrid } from "@mui/x-data-grid";
import type { GridRowModel, GridRowSelectionModel } from "@mui/x-data-grid";

import PriceDisplay from "../components/PriceDisplay";
import { deleteWatchlistItem, getWatchlistItems, saveWatchlistItem } from "../services/watchlistItems";
import { searchAssets } from "../services/search";
import { importSymbol } from "../services/imports";

type AssetSearchResult = {
  symbol: string; name: string; exchange?: string | null; exchange_code?: string | null;
  currency?: string | null; currency_code?: string | null; type?: string | null;
  instrument_type?: string | null; data_source?: string | null;
};
const assetExchange = (a: AssetSearchResult) => a.exchange ?? a.exchange_code ?? null;
const assetCurrency = (a: AssetSearchResult) => a.currency ?? a.currency_code ?? null;
const assetType = (a: AssetSearchResult) => a.type ?? a.instrument_type ?? null;
const assetKey = (a: AssetSearchResult) => [a.symbol, a.data_source ?? "YAHOO", assetExchange(a) ?? ""].join("|");
function formatPrice(value: unknown) {
  if (value == null || value === "") return "-";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";
}

export default function WatchlistDetailsPage() {
  const { id } = useParams(); const navigate = useNavigate(); const queryClient = useQueryClient();
  const [open, setOpen] = useState(false); const [entities, setEntities] = useState<AssetSearchResult[]>([]);
  const [searchText, setSearchText] = useState(""); const [isAdding, setIsAdding] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>({ type: "include", ids: new Set() });
  const { data = [], isLoading } = useQuery({ queryKey: ["watchlist-items", id], queryFn: () => getWatchlistItems(id!), enabled: Boolean(id) });
  const { data: searchResults, isFetching: isSearching } = useQuery({ queryKey: ["asset-search", searchText.trim()], queryFn: () => searchAssets(searchText.trim()), enabled: searchText.trim().length >= 2 });
  const selectedRowIds = rowSelectionModel.type === "exclude" ? data.map((r: GridRowModel) => String(r.watchlist_item_id)).filter((v: string) => !rowSelectionModel.ids.has(v)) : Array.from(rowSelectionModel.ids).map(String);
  const availableOptions = (searchResults?.results ?? []).filter((o: AssetSearchResult, i: number, a: AssetSearchResult[]) => a.findIndex((c) => assetKey(c) === assetKey(o)) === i);
  const refreshItems = async () => queryClient.invalidateQueries({ queryKey: ["watchlist-items", id] });
  const closeDialog = () => { if (!isAdding) { setOpen(false); setEntities([]); setSearchText(""); } };
  async function handleAdd() {
    if (!id || !entities.length || isAdding) return; setIsAdding(true);
    try { for (const e of entities) { const imported = await importSymbol({ symbol: e.symbol, data_source: e.data_source }); await saveWatchlistItem({ watchlist_id: id, entity_id: imported.entity_id }); } await refreshItems(); closeDialog(); } finally { setIsAdding(false); }
  }
  async function handleDelete(itemId: string) { if (window.confirm("Delete item?")) { await deleteWatchlistItem(itemId); await refreshItems(); } }
  async function handleBulkDelete() { if (!selectedRowIds.length || isBulkDeleting || !window.confirm(`Delete ${selectedRowIds.length} selected items?`)) return; setIsBulkDeleting(true); try { await Promise.all(selectedRowIds.map(deleteWatchlistItem)); setRowSelectionModel({ type: "include", ids: new Set() }); await refreshItems(); } finally { setIsBulkDeleting(false); } }
  async function handleUpdateItem(row: GridRowModel) { await saveWatchlistItem({ watchlist_item_id: row.watchlist_item_id, watchlist_id: row.watchlist_id, entity_id: row.entity_id, priority: row.priority, target_price: row.target_price, notes: row.notes }); return row; }

  return <Box sx={{ p: 3 }}>
    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}><Stack direction="row" spacing={2} sx={{ alignItems: "center" }}><Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/watchlists")}>Watchlists</Button><Typography variant="h4">Watchlist Details</Typography></Stack><Button variant="contained" onClick={() => { setEntities([]); setSearchText(""); setOpen(true); }}>Add Entities</Button></Box>
    <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}><Button variant="contained" color="error" startIcon={isBulkDeleting ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />} disabled={!selectedRowIds.length || isBulkDeleting} onClick={() => void handleBulkDelete()}>Delete selected ({selectedRowIds.length})</Button></Stack>
    <Paper sx={{ height: 700 }}><DataGrid rows={data} loading={isLoading} checkboxSelection disableRowSelectionOnClick rowSelectionModel={rowSelectionModel} onRowSelectionModelChange={setRowSelectionModel} processRowUpdate={handleUpdateItem} getRowId={(row) => row.watchlist_item_id} columns={[
      { field: "symbol", headerName: "Symbol", flex: 1 }, { field: "name", headerName: "Company", flex: 2 },
      { field: "priority", headerName: "Priority", type: "number", width: 100, editable: true },
      { field: "currency_code", headerName: "Currency", width: 100, renderCell: (p) => p.value ? String(p.value).trim() : "-" },
      { field: "target_price", headerName: "Target", type: "number", flex: 1, editable: true, renderCell: (p) => formatPrice(p.value) },
      { field: "last_price", headerName: "Current", flex: 1.55, renderCell: (p) => <PriceDisplay value={p.value} priceAsOf={p.row.price_as_of} priceIsStale={p.row.price_is_stale} refreshStatus={p.row.price_refresh_status} formatter={formatPrice} /> },
      { field: "delete", headerName: "Delete", width: 90, sortable: false, renderCell: (p) => <IconButton color="error" onClick={() => void handleDelete(p.row.watchlist_item_id)}><DeleteIcon /></IconButton> },
    ]} /></Paper>
    <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="md"><Box component="form" onSubmit={(e) => { e.preventDefault(); void handleAdd(); }}><DialogTitle>Add Entities</DialogTitle><DialogContent dividers sx={{ p: 3 }}><Autocomplete<AssetSearchResult, true> multiple fullWidth autoHighlight filterOptions={(o) => o} options={availableOptions} value={entities} inputValue={searchText} loading={isSearching} disabled={isAdding} getOptionLabel={(o) => `${o.symbol} - ${o.name}`} getOptionKey={assetKey} isOptionEqualToValue={(o, v) => assetKey(o) === assetKey(v)} onInputChange={(_, v, r) => { if (r !== "reset") setSearchText(v); }} onChange={(_, v) => setEntities(v)} renderOption={(props, option) => { const { key, ...rest } = props; return <Box component="li" key={key} {...rest}><Stack><Stack direction="row" spacing={1}><Typography sx={{ fontWeight: 700 }}>{option.symbol}</Typography>{assetExchange(option) && <Chip size="small" label={assetExchange(option)} />}{assetCurrency(option) && <Chip size="small" label={assetCurrency(option)} />}</Stack><Typography variant="body2">{option.name}</Typography>{assetType(option) && <Typography variant="caption">{assetType(option)}</Typography>}</Stack></Box>; }} renderInput={(params) => <TextField {...params} autoFocus label="Symbol or company name" />} />{entities.length > 0 && <><Divider sx={{ my: 2 }} /><Typography variant="body2">{entities.length} instruments selected</Typography></>}</DialogContent><DialogActions><Button onClick={closeDialog}>Cancel</Button><Button type="submit" variant="contained" disabled={!entities.length || isAdding}>{isAdding ? "Adding..." : "Add to Watchlist"}</Button></DialogActions></Box></Dialog>
  </Box>;
}
