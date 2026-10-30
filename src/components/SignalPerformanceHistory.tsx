import { useState } from "react";
import { formatTimestamp as date } from "../services/timestamps";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, MenuItem, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";
import { getInstruments } from "../services/instruments";
import { getScreenerPerformance } from "../services/marketScreener";
import type { ScreenerPerformance } from "../types/marketScreener";
import PriceDisplay from "./PriceDisplay";

interface InstrumentOption {
  instrument_id: string;
  symbol: string;
  exchange?: string | null;
}

const PAGE_SIZE = 25;
const endLabels: Record<string, string> = {
  CLOSED: "Chiuso", EXPIRED: "Scaduto", DIRECTION_CHANGED: "Cambio direzione", CREATED: "Nuovo ciclo",
};

function price(value: unknown, currency: string | null) {
  const formatted = Number(value).toLocaleString("it-IT", { maximumFractionDigits: 6 });
  return currency ? `${formatted} ${currency}` : formatted;
}

export default function SignalPerformanceHistory({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [instrument, setInstrument] = useState<InstrumentOption | null>(null);
  const [strategy, setStrategy] = useState("");
  const [status, setStatus] = useState<"" | "OPEN" | "CLOSED">("");
  const [page, setPage] = useState(0);
  const filters = {
    instrument_id: instrument?.instrument_id,
    strategy_code: strategy.trim().toUpperCase() || undefined,
    status: status || undefined,
    limit: PAGE_SIZE + 1,
    offset: page * PAGE_SIZE,
  };
  const instruments = useQuery<InstrumentOption[]>({
    queryKey: ["instruments"], queryFn: getInstruments, enabled: open,
  });
  const history = useQuery({
    queryKey: ["market-screener-performance", filters],
    queryFn: () => getScreenerPerformance(filters), enabled: open,
  });
  const rows = history.data?.slice(0, PAGE_SIZE) ?? [];
  const columns: GridColDef<ScreenerPerformance>[] = [
    { field: "symbol", headerName: "Strumento", width: 140,
      renderCell: ({ row }) => <Tooltip title={row.exchange ?? ""}><span>{row.symbol}</span></Tooltip> },
    { field: "strategy_code", headerName: "Strategia", width: 150 },
    { field: "timeframe", headerName: "Timeframe", width: 100 },
    { field: "direction", headerName: "Direzione", width: 110,
      renderCell: ({ row }) => <Chip size="small" color={row.direction === "LONG" ? "success" : "error"} label={row.direction} /> },
    { field: "status", headerName: "Stato", width: 150,
      renderCell: ({ row }) => <Chip size="small" variant="outlined" label={row.status === "OPEN" ? "Aperto" : endLabels[row.end_reason ?? ""] ?? "Chiuso"} /> },
    { field: "entry_at", headerName: "Ingresso", width: 175, valueFormatter: (value) => date(value) },
    { field: "exit_at", headerName: "Uscita", width: 175, valueFormatter: (value) => date(value) },
    { field: "entry_price", headerName: "Prezzo ingresso", width: 170,
      renderCell: ({ row }) => <PriceDisplay value={row.entry_price} priceAsOf={row.entry_price_at}
        priceIsStale={Boolean(row.entry_price_at && row.entry_price_at < row.entry_at)}
        formatter={(value) => price(value, row.currency_code)} /> },
    { field: "valuation_price", headerName: "Prezzo uscita / attuale", width: 200,
      renderCell: ({ row }) => <PriceDisplay value={row.valuation_price} priceAsOf={row.valuation_price_at}
        priceIsStale={Boolean(row.exit_at && row.valuation_price_at && row.valuation_price_at < row.exit_at)}
        formatter={(value) => price(value, row.currency_code)} /> },
    { field: "return_pct", headerName: "Rendimento indicativo %", width: 200,
      renderCell: ({ row }) => <Typography variant="body2" sx={{ height: "100%", display: "flex", alignItems: "center",
        color: row.return_pct === null ? "text.secondary" : row.return_pct >= 0 ? "success.main" : "error.main" }}>
        {row.return_pct === null ? "N/D" : `${Number(row.return_pct).toLocaleString("it-IT", { maximumFractionDigits: 2, signDisplay: "exceptZero" })}%`}
      </Typography> },
    { field: "historical_backfill", headerName: "Origine prezzi", width: 150,
      renderCell: ({ row }) => <Tooltip title={`Ingresso: ${row.entry_price_source ?? "UNAVAILABLE"}; valutazione: ${row.valuation_price_source ?? "UNAVAILABLE"}`}>
        <Chip size="small" variant="outlined" label={row.historical_backfill ? "Ricostruito" : "Acquisito"} />
      </Tooltip> },
  ];
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
      <DialogTitle>Storico performance dei segnali</DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ pt: 1, mb: 2 }}>
          <Autocomplete options={instruments.data ?? []} value={instrument} loading={instruments.isLoading}
            getOptionLabel={(option) => `${option.symbol}${option.exchange ? ` (${option.exchange})` : ""}`}
            isOptionEqualToValue={(option, value) => option.instrument_id === value.instrument_id}
            onChange={(_, value) => { setInstrument(value); setPage(0); }} sx={{ minWidth: 220, flex: 1 }}
            renderInput={(params) => <TextField {...params} size="small" label="Strumento" />} />
          <TextField size="small" label="Strategia" value={strategy} slotProps={{ htmlInput: { maxLength: 100 } }}
            onChange={(event) => { setStrategy(event.target.value); setPage(0); }} />
          <TextField select size="small" label="Stato" value={status} sx={{ minWidth: 140 }}
            onChange={(event) => { setStatus(event.target.value as typeof status); setPage(0); }}>
            <MenuItem value="">Tutti</MenuItem><MenuItem value="OPEN">Aperti</MenuItem><MenuItem value="CLOSED">Chiusi</MenuItem>
          </TextField>
          <Tooltip title="Aggiorna"><span><IconButton aria-label="Aggiorna performance" disabled={history.isFetching}
            onClick={() => void history.refetch()}><RefreshIcon /></IconButton></span></Tooltip>
        </Stack>
        {instruments.isError && <Alert severity="warning" sx={{ mb: 1 }} action={<IconButton aria-label="Riprova catalogo strumenti" onClick={() => void instruments.refetch()}><RefreshIcon /></IconButton>}>Catalogo strumenti non disponibile.</Alert>}
        {history.isError && <Alert severity="error" sx={{ mb: 1 }}>Impossibile caricare lo storico delle performance.</Alert>}
        <Box sx={{ height: 480, width: "100%", minWidth: 0 }}>
          <DataGrid rows={rows} columns={columns} getRowId={(row) => row.performance_id}
            loading={history.isFetching} disableRowSelectionOnClick hideFooter
            localeText={{ noRowsLabel: "Nessuna performance disponibile" }} />
        </Box>
        <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "center", justifyContent: "flex-end" }}>
          <Tooltip title="Pagina precedente"><span><IconButton aria-label="Pagina precedente" disabled={page === 0 || history.isFetching}
            onClick={() => setPage(page - 1)}><ChevronLeftIcon /></IconButton></span></Tooltip>
          <Typography variant="body2">Pagina {page + 1}</Typography>
          <Tooltip title="Pagina successiva"><span><IconButton aria-label="Pagina successiva" disabled={history.isFetching || !history.data || history.data.length <= PAGE_SIZE}
            onClick={() => setPage(page + 1)}><ChevronRightIcon /></IconButton></span></Tooltip>
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Chiudi</Button></DialogActions>
    </Dialog>
  );
}