import { useMemo, useState } from "react";

import HistoryIcon from "@mui/icons-material/History";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import RefreshIcon from "@mui/icons-material/Refresh";
import FiberNewIcon from "@mui/icons-material/FiberNew";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import FilterListIcon from "@mui/icons-material/FilterList";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import AlertRuleSettings from "../components/AlertRuleSettings";
import SignalPerformanceHistory from "../components/SignalPerformanceHistory";

import {
  analyzeScreenerContext,
  getScreenerContexts,
  getScreenerOpportunities,
  getScreenerOpportunity,
  getScreenerRuns,
  getScreenerSignalEvents,
  getScreenerSnapshots,
  getScreenerSnapshotItems,
  getScreenerSnapshotChanges,
} from "../services/marketScreener";
import type {
  ConsensusDirection,
  PortfolioMatchType,
  ScreenerOpportunity,
  ScreenerSignalEvent,
  ScreenerSnapshotItem,
  ScreenerSnapshotChange,
} from "../types/marketScreener";

function score(value: number | null) {
  return value === null ? "–" : Number(value).toFixed(1);
}

function matchLabel(matchType: PortfolioMatchType) {
  return {
    EXACT_INSTRUMENT: "Strumento posseduto",
    SAME_ISIN: "Stesso ISIN",
    SAME_ENTITY: "Stessa entità",
    NO_MATCH: "Nessun match",
  }[matchType];
}

function matchColor(matchType: PortfolioMatchType) {
  if (matchType === "EXACT_INSTRUMENT") return "success" as const;
  if (matchType === "SAME_ISIN") return "primary" as const;
  if (matchType === "SAME_ENTITY") return "info" as const;
  return "default" as const;
}

function directionColor(direction: string) {
  if (direction === "LONG") return "success" as const;
  if (direction === "SHORT") return "error" as const;
  return "default" as const;
}

function originColor(origin: string) {
  if (origin === "CORE") return "primary" as const;
  if (origin === "DISCOVERY") return "secondary" as const;
  return "default" as const;
}

function verdictColor(verdict: string | null) {
  if (verdict === "CONFIRM") return "success" as const;
  if (verdict === "REVIEW") return "warning" as const;
  if (verdict === "REJECT") return "error" as const;
  return "default" as const;
}

function scoreColor(value: number | null) {
  const numeric = value === null ? null : Number(value);
  if (numeric === null || !Number.isFinite(numeric)) return "text.secondary";
  if (numeric >= 70) return "success.main";
  if (numeric >= 40) return "warning.main";
  return "error.main";
}

export default function ScreenerPage() {
  const [origin, setOrigin] = useState("");
  const [direction, setDirection] = useState("");
  const [verdict, setVerdict] = useState("");
  const [consensusDirection, setConsensusDirection] = useState<ConsensusDirection | "">("");
  const [portfolioFilter, setPortfolioFilter] = useState("ALL");
  const [minimumScore, setMinimumScore] = useState("0");
  const [query, setQuery] = useState("");
  const [contextSelection, setContextSelection] = useState("");
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [strategy, setStrategy] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [performanceOpen, setPerformanceOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesSnapshotId, setChangesSnapshotId] = useState("");
  const [changeType, setChangeType] = useState<ScreenerSnapshotChange["change_type"] | "">("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  const contextsQuery = useQuery({
    queryKey: ["market-screener-contexts"],
    queryFn: getScreenerContexts,
  });
  const selectedContext = contextsQuery.data?.find(
    context => `${context.context_type}:${context.context_id}` === contextSelection,
  );
  const analysis = useMutation({
    mutationFn: analyzeScreenerContext,
    onSuccess: async (): Promise<void> => { await refreshScreener(); },
  });
  const refreshInterval = autoRefresh && !analysis.isPending ? 60_000 : false;
  const analysisError = isAxiosError(analysis.error)
    ? analysis.error.response?.status === 409
      ? "Un'altra analisi e' gia' in corso. Riprova al termine."
      : analysis.error.response?.status === 404
        ? "Il contesto non e' piu' disponibile."
        : analysis.error.response?.status === 422
          ? "Il contesto deve contenere da 1 a 1000 strumenti."
          : "Impossibile completare l'analisi."
    : "Impossibile completare l'analisi.";

  const filters = useMemo(
    () => ({
      origin: origin || undefined,
      direction: direction || undefined,
      verdict: verdict || undefined,
      consensus_direction: consensusDirection || undefined,
      strategy_code: strategy.trim().toUpperCase() || undefined,
      context_type: selectedContext?.context_type,
      context_id: selectedContext?.context_id,
      portfolio_match:
        portfolioFilter === "YES"
          ? true
          : portfolioFilter === "NO"
            ? false
            : undefined,
      minimum_score: Number(minimumScore) || 0,
      query: query.trim() || undefined,
      limit: 500,
    }),
    [origin, direction, verdict, consensusDirection, strategy, selectedContext, portfolioFilter, minimumScore, query],
  );

  const opportunitiesQuery = useQuery({
    queryKey: ["market-screener", filters],
    queryFn: () => getScreenerOpportunities(filters),
    refetchInterval: refreshInterval,
  });

  const detailQuery = useQuery({
    queryKey: ["market-screener-detail", selectedId],
    queryFn: () => getScreenerOpportunity(selectedId ?? ""),
    enabled: Boolean(selectedId),
  });

  const signalEventsQuery = useQuery({
    queryKey: ["market-screener-signal-events", selectedId],
    queryFn: () => getScreenerSignalEvents(selectedId ?? ""),
    enabled: Boolean(selectedId && detailQuery.data),
  });

  const runsQuery = useQuery({
    queryKey: ["market-screener-runs"],
    queryFn: () => getScreenerRuns(20),
    refetchInterval: refreshInterval,
  });
  const snapshotsQuery = useQuery({
    queryKey: ["market-screener-snapshots"],
    queryFn: () => getScreenerSnapshots(20),
    refetchInterval: refreshInterval,
  });
  const snapshotItemsQuery = useQuery({
    queryKey: ["market-screener-snapshot-items", selectedSnapshotId],
    queryFn: () => getScreenerSnapshotItems(selectedSnapshotId ?? ""),
    enabled: Boolean(selectedSnapshotId),
  });
  const latestRun = runsQuery.data?.[0];
  const changesQuery = useQuery({
    queryKey: ["market-screener-changes"],
    queryFn: () => getScreenerSnapshotChanges(),
    refetchInterval: refreshInterval,
  });
  const historicalChangesQuery = useQuery({
    queryKey: ["market-screener-changes", changesSnapshotId],
    queryFn: () => getScreenerSnapshotChanges(changesSnapshotId),
    enabled: changesOpen && Boolean(changesSnapshotId),
  });
  const comparisonQuery = changesSnapshotId ? historicalChangesQuery : changesQuery;
  const comparisonRows = (comparisonQuery.data?.changes ?? [])
    .filter(change => !changeType || change.change_type === changeType);
  const newEntries = new Set(changesQuery.data?.changes
    .filter(change => change.change_type === "NEW" && change.current)
    .map(change => `${change.current!.instrument_id}:${change.current!.signal_timeframe ?? ""}:${change.current!.signal_id}`));
  const changeLabels = { NEW: "Nuovo ingresso", CHANGED: "Variato", REMOVED: "Uscito" };
  const changeColumns: GridColDef<ScreenerSnapshotChange>[] = [
    {
      field: "detail",
      headerName: "Dettaglio",
      width: 90,
      sortable: false,
      filterable: false,
      disableExport: true,
      renderCell: ({ row }) => (
        <Tooltip title={row.current ? "Apri opportunit\u00e0 attuale" : "Opportunit\u00e0 uscita dalla scansione"}>
          <span>
            <IconButton
              size="small"
              aria-label="Apri opportunit\u00e0 attuale"
              disabled={!row.current}
              onClick={() => {
                if (!row.current) return;
                setChangesOpen(false);
                setSelectedId(row.current.opportunity_id);
              }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      ),
    },
    { field: "change_type", headerName: "Variazione", width: 145,
      renderCell: ({ row }) => <Chip size="small" label={changeLabels[row.change_type]}
        color={row.change_type === "NEW" ? "success" : row.change_type === "REMOVED" ? "error" : "warning"} /> },
    { field: "symbol", headerName: "Simbolo", width: 115,
      valueGetter: (_, row) => (row.current ?? row.previous)?.symbol ?? "-" },
    { field: "timeframe", headerName: "Timeframe", width: 105,
      valueGetter: (_, row) => (row.current ?? row.previous)?.signal_timeframe ?? "-" },
    { field: "previous", headerName: "Precedente", minWidth: 280, flex: 1,
      valueGetter: (_, row) => row.previous
        ? `${row.previous.signal_type ?? "-"} / ${row.previous.strategy_code ?? "-"} / ${row.previous.direction} / ${row.previous.consensus_direction} / ${row.previous.verdict ?? "-"}` : "-" },
    { field: "current", headerName: "Attuale", minWidth: 280, flex: 1,
      valueGetter: (_, row) => row.current
        ? `${row.current.signal_type ?? "-"} / ${row.current.strategy_code ?? "-"} / ${row.current.direction} / ${row.current.consensus_direction} / ${row.current.verdict ?? "-"}` : "-" },
    { field: "strategies", headerName: "Strategie (supporto; opposizione)", minWidth: 270, flex: 1,
      valueGetter: (_, row) => [row.previous, row.current].map(item => item
        ? `${(item.supporting_strategies ?? []).join(", ") || "-"}; ${(item.opposing_strategies ?? []).join(", ") || "-"}` : "-").join(" → ") },
  ];

  const rows = opportunitiesQuery.data ?? [];
  const portfolioCount = rows.filter((row) => row.portfolio_match).length;

  const columns: GridColDef<ScreenerOpportunity>[] = [
    { field: "ranking_position", headerName: "#", width: 60 },
    {
      field: "source_symbol",
      headerName: "Simbolo",
      width: 135,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", height: "100%" }}>
          <span>{row.source_symbol}</span>
          {newEntries.has(`${row.source_instrument_id}:${row.signal_timeframe ?? ""}:${row.signal_id}`) && (
            <Tooltip title="New entry nell'ultima scansione completa">
              <FiberNewIcon color="success" fontSize="small" aria-label="New entry" />
            </Tooltip>
          )}
        </Stack>
      ),
    },
    {
      field: "entity_name",
      headerName: "Entità",
      minWidth: 210,
      flex: 1,
    },
    {
      field: "signal_type",
      headerName: "Segnale",
      minWidth: 165,
      renderCell: ({ row }) => (
        <Chip
          size="small"
          color={row.signal_type === "BUY" || row.signal_type === "STRONG_BUY" ? "success" : row.signal_type === "SELL" || row.signal_type === "STRONG_SELL" ? "error" : "default"}
          label={`${row.signal_type ?? "N/D"} · ${row.strategy_code ?? "N/D"}`}
        />
      ),
    },
    {
      field: "direction",
      headerName: "Direzione",
      width: 105,
      renderCell: ({ row }) => (
        <Chip
          size="small"
          color={directionColor(row.direction)}
          label={row.direction}
        />
      ),
    },
    {
      field: "origin",
      headerName: "Origine",
      width: 105,
      renderCell: ({ row }) => (
        <Chip
          size="small"
          color={originColor(row.origin)}
          label={row.origin}
        />
      ),
    },
    {
      field: "consensus_direction",
      headerName: "Consenso",
      width: 125,
      renderCell: ({ row }) => (
        <Chip size="small" color={row.consensus_direction === "LONG" ? "success" : row.consensus_direction === "SHORT" ? "error" : row.consensus_direction === "CONFLICT" ? "warning" : "default"} label={`${row.consensus_direction} · ${row.strategy_count}`} />
      ),
    },
    {
      field: "portfolio_match_type",
      headerName: "Portafoglio",
      minWidth: 190,
      renderCell: ({ row }) =>
        row.portfolio_match ? (
          <Chip
            size="small"
            color={matchColor(row.portfolio_match_type)}
            label={`${matchLabel(row.portfolio_match_type)} · ${row.portfolio_symbols.join(", ")}`}
          />
        ) : (
          <Typography color="text.secondary">–</Typography>
        ),
    },
    {
      field: "attention_score",
      headerName: "Attention",
      width: 105,
      renderCell: ({ row }) => (
        <Typography
          sx={{
            color: scoreColor(row.attention_score),
            fontWeight: 600,
          }}
        >
          {score(row.attention_score)}
        </Typography>
      ),
    },
    {
      field: "technical_score",
      headerName: "Technical",
      width: 105,
      renderCell: ({ row }) => (
        <Typography
          sx={{
            color: scoreColor(row.technical_score),
            fontWeight: 600,
          }}
        >
          {score(row.technical_score)}
        </Typography>
      ),
    },
    {
      field: "quant_score",
      headerName: "Quant",
      width: 90,
      renderCell: ({ row }) => (
        <Typography
          sx={{
            color: scoreColor(row.quant_score),
            fontWeight: 600,
          }}
        >
          {score(row.quant_score)}
        </Typography>
      ),
    },
    {
      field: "llm_score",
      headerName: "LLM",
      width: 80,
      renderCell: ({ row }) => (
        <Typography
          sx={{
            color: scoreColor(row.llm_score),
            fontWeight: 600,
          }}
        >
          {score(row.llm_score)}
        </Typography>
      ),
    },
    {
      field: "composite_score",
      headerName: "Composite",
      width: 110,
      renderCell: ({ row }) => (
        <Typography
          sx={{
            color: scoreColor(row.composite_score),
            fontWeight: 700,
          }}
        >
          {score(row.composite_score)}
        </Typography>
      ),
    },
    {
      field: "verdict",
      headerName: "Verdetto",
      width: 110,
      renderCell: ({ row }) => (
        <Chip
          size="small"
          color={verdictColor(row.verdict)}
          label={row.verdict ?? "N/D"}
        />
      ),
    },
  ];

  const selected = detailQuery.data;
  const refreshing = opportunitiesQuery.isFetching || changesQuery.isFetching
    || runsQuery.isFetching || snapshotsQuery.isFetching
    || (changesOpen && historicalChangesQuery.isFetching)
    || (Boolean(selectedId) && (detailQuery.isFetching || signalEventsQuery.isFetching))
    || (Boolean(selectedSnapshotId) && snapshotItemsQuery.isFetching);

  function refreshScreener() {
    return Promise.all([
      opportunitiesQuery.refetch(),
      changesQuery.refetch(),
      runsQuery.refetch(),
      snapshotsQuery.refetch(),
      contextsQuery.refetch(),
      ...(changesOpen && changesSnapshotId ? [historicalChangesQuery.refetch()] : []),
      ...(selectedId ? [detailQuery.refetch()] : []),
      ...(selectedId && selected ? [signalEventsQuery.refetch()] : []),
      ...(selectedSnapshotId ? [snapshotItemsQuery.refetch()] : []),
    ]);
  }

  return (
    <Box sx={{ py: 1 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", mb: 2 }}
      >
        <Box>
          <Typography variant="h4">Screener</Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button variant="outlined" startIcon={<CompareArrowsIcon />} onClick={() => {
            setChangesSnapshotId("");
            setChangeType("");
            setChangesOpen(true);
          }}>
            Variazioni
          </Button>
          <Button variant="outlined" startIcon={<ShowChartIcon />} onClick={() => setPerformanceOpen(true)}>
            Performance
          </Button>
          <Button
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => setHistoryOpen(true)}
          >
            Storico
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            disabled={refreshing || analysis.isPending}
            onClick={() => void refreshScreener()}
          >
            Aggiorna
          </Button>
        </Stack>
      </Stack>

      {changesQuery.isError && <Alert severity="error" sx={{ mb: 2 }} action={
        <IconButton aria-label="Riprova variazioni" onClick={() => void changesQuery.refetch()}><RefreshIcon /></IconButton>
      }>Impossibile caricare le variazioni dello screener.</Alert>}
      {changesQuery.data && <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
        <Typography variant="body2" color="text.secondary">Scansione completa: {new Date(changesQuery.data.observed_at).toLocaleString("it-IT")}</Typography>
        <Typography variant="body2" color="success.main">Nuovi ingressi: {changesQuery.data.new_count}</Typography>
        <Typography variant="body2" color="warning.main">Variati: {changesQuery.data.changed_count}</Typography>
        <Typography variant="body2" color="error.main">Usciti: {changesQuery.data.removed_count}</Typography>
      </Stack>}
      <Dialog open={changesOpen} onClose={() => setChangesOpen(false)} fullWidth maxWidth="xl">
        <DialogTitle>Variazioni della scansione completa</DialogTitle>
        <DialogContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ my: 2 }}>
            <TextField select size="small" label="Scansione" value={changesSnapshotId}
              onChange={event => setChangesSnapshotId(event.target.value)} sx={{ minWidth: 240, flex: 1 }}>
              <MenuItem value="">Ultima scansione completa</MenuItem>
              {(snapshotsQuery.data ?? []).map(snapshot => <MenuItem
                key={snapshot.ranking_snapshot_id} value={snapshot.ranking_snapshot_id}>
                {new Date(snapshot.observed_at).toLocaleString("it-IT")}
              </MenuItem>)}
            </TextField>
            <TextField select size="small" label="Variazione" value={changeType} sx={{ minWidth: 180 }}
              onChange={event => setChangeType(event.target.value as ScreenerSnapshotChange["change_type"] | "")}>
              <MenuItem value="">Tutte</MenuItem>
              <MenuItem value="NEW">Nuovi ingressi</MenuItem>
              <MenuItem value="CHANGED">Variati</MenuItem>
              <MenuItem value="REMOVED">Usciti</MenuItem>
            </TextField>
          </Stack>
          {snapshotsQuery.isError && <Alert severity="error" sx={{ mb: 2 }} action={
            <IconButton aria-label="Riprova elenco scansioni" disabled={snapshotsQuery.isFetching}
              onClick={() => void snapshotsQuery.refetch()}><RefreshIcon /></IconButton>
          }>Impossibile caricare l'elenco delle scansioni.</Alert>}
          {comparisonQuery.isPending && <Typography>Caricamento...</Typography>}
          {comparisonQuery.isError && <Alert severity="error" action={
            <IconButton aria-label="Riprova confronto" disabled={comparisonQuery.isFetching}
              onClick={() => void comparisonQuery.refetch()}><RefreshIcon /></IconButton>
          }>Impossibile caricare le variazioni.</Alert>}
          {comparisonQuery.isSuccess && !comparisonQuery.data && <Typography>Nessuna scansione completa disponibile per questo confronto.</Typography>}
          {comparisonQuery.data && <>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {new Date(comparisonQuery.data.observed_at).toLocaleString("it-IT")} · {comparisonQuery.data.opportunity_count} opportunità
              {!comparisonQuery.data.previous_snapshot_id && " · Prima scansione completa"}
              {` · Nuovi ingressi: ${comparisonQuery.data.new_count} · Variati: ${comparisonQuery.data.changed_count} · Usciti: ${comparisonQuery.data.removed_count}`}
            </Typography>
            <Box sx={{ height: 480, width: "100%" }}>
              <DataGrid rows={comparisonRows} columns={changeColumns}
                loading={comparisonQuery.isFetching} showToolbar
                slotProps={{ toolbar: {
                  csvOptions: { fileName: "mip-screener-variazioni", utf8WithBom: true, escapeFormulas: true },
                  printOptions: { disableToolbarButton: true },
                } }}
                getRowId={row => (row.current ?? row.previous)!.ranking_snapshot_item_id}
                disableRowSelectionOnClick pageSizeOptions={[10, 25, 50, 100]}
                initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
            </Box>
          </>}
        </DialogContent>
        <DialogActions><Button onClick={() => setChangesOpen(false)}>Chiudi</Button></DialogActions>
      </Dialog>

      <Box sx={{ py: 2, mb: 2, borderBottom: 1, borderColor: "divider" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
          <TextField select size="small" label="Contesto" value={contextSelection}
            disabled={analysis.isPending || contextsQuery.isLoading}
            sx={{ minWidth: 220, flex: 1 }}
            onChange={event => { setContextSelection(event.target.value); analysis.reset(); }}>
            <MenuItem value="">Tutte le opportunita</MenuItem>
            {(contextsQuery.data ?? []).map(context => (
              <MenuItem key={`${context.context_type}:${context.context_id}`}
                value={`${context.context_type}:${context.context_id}`} sx={{ whiteSpace: "normal" }}>
                {context.context_type === "WATCHLIST" ? "Watchlist" : context.context_type === "PORTFOLIO" ? "Portafoglio" : "Universo"}: {context.name} ({context.instrument_count})
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Cerca" value={query}
            sx={{ minWidth: 180, flex: 1 }} onChange={event => setQuery(event.target.value)} />
          <FormControlLabel control={<Switch checked={llmEnabled}
            disabled={analysis.isPending || !selectedContext}
            onChange={event => { setLlmEnabled(event.target.checked); analysis.reset(); }} />} label="Analisi AI" />
          <Button variant="contained" startIcon={<PlayArrowIcon />}
            disabled={analysis.isPending || !selectedContext || selectedContext.instrument_count === 0}
            onClick={() => { if (selectedContext) analysis.mutate({
              context_type: selectedContext.context_type, context_id: selectedContext.context_id,
              llm_enabled: llmEnabled,
            }); }}>
            {analysis.isPending ? "Analisi in corso..." : "Analizza"}
          </Button>
          <Tooltip title="Filtri avanzati">
            <IconButton aria-label="Filtri avanzati" aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen(!advancedOpen)} color={advancedOpen ? "primary" : "default"}>
              <FilterListIcon />
            </IconButton>
          </Tooltip>
          <FormControlLabel control={<Switch checked={autoRefresh}
            onChange={event => setAutoRefresh(event.target.checked)} />} label="Aggiornamento automatico" />
        </Stack>
        <Collapse in={advancedOpen}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} useFlexGap sx={{ flexWrap: "wrap", pt: 2 }}>
          <TextField
            select
            size="small"
            label="Origine"
            value={origin}
            sx={{ minWidth: 140 }}
            onChange={(event) => setOrigin(event.target.value)}
          >
            <MenuItem value="">Tutte</MenuItem>
            <MenuItem value="CORE">Core</MenuItem>
            <MenuItem value="DISCOVERY">Discovery</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Direzione"
            value={direction}
            sx={{ minWidth: 140 }}
            onChange={(event) => setDirection(event.target.value)}
          >
            <MenuItem value="">Tutte</MenuItem>
            <MenuItem value="LONG">Long</MenuItem>
            <MenuItem value="SHORT">Short</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Verdetto"
            value={verdict}
            sx={{ minWidth: 140 }}
            onChange={(event) => setVerdict(event.target.value)}
          >
            <MenuItem value="">Tutti</MenuItem>
            <MenuItem value="CONFIRM">Confirm</MenuItem>
            <MenuItem value="REVIEW">Review</MenuItem>
            <MenuItem value="REJECT">Reject</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Consenso"
            value={consensusDirection}
            sx={{ minWidth: 150 }}
            onChange={(event) => setConsensusDirection(event.target.value as ConsensusDirection | "", )}
          >
            <MenuItem value="">Tutti</MenuItem>
            <MenuItem value="LONG">Long</MenuItem>
            <MenuItem value="SHORT">Short</MenuItem>
            <MenuItem value="CONFLICT">Conflitto</MenuItem>
            <MenuItem value="NEUTRAL">Neutrale</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Portafoglio"
            value={portfolioFilter}
            sx={{ minWidth: 170 }}
            onChange={(event) => setPortfolioFilter(event.target.value)}
          >
            <MenuItem value="ALL">Tutti</MenuItem>
            <MenuItem value="YES">Solo in portafoglio</MenuItem>
            <MenuItem value="NO">Escludi portafoglio</MenuItem>
          </TextField>
          <TextField
            size="small"
            type="number"
            label="Score minimo"
            value={minimumScore}
            sx={{ width: 135 }}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 5 } }}
            onChange={(event) => setMinimumScore(event.target.value)}
          />
          <TextField size="small" label="Strategia" value={strategy}
            slotProps={{ htmlInput: { maxLength: 100 } }} sx={{ minWidth: 170 }}
            onChange={event => setStrategy(event.target.value)} />
        </Stack>
        </Collapse>
      </Box>

      {contextsQuery.isError && <Alert severity="error" sx={{ mb: 2 }}
        action={<Button onClick={() => void contextsQuery.refetch()}>Riprova</Button>}>
        Impossibile caricare i contesti.
      </Alert>}
      {analysis.isError && <Alert severity="error" sx={{ mb: 2 }}>{analysisError}</Alert>}
      {analysis.isSuccess && <Alert severity={analysis.data.status === "SUCCESS" ? "success" : "warning"} sx={{ mb: 2 }}>
        {analysis.data.status === "SUCCESS" ? "Analisi completata." : "Analisi parziale: alcune elaborazioni non sono state completate."}
        {analysis.data.llm_enrichment && <Box component="span" sx={{ display: "block" }}>
          {analysis.data.llm_enrichment.status === "FAILED"
            ? "AI non disponibile."
            : `AI: ${analysis.data.llm_enrichment.enriched ?? 0} segnali arricchiti, ${analysis.data.llm_enrichment.failed ?? 0} non elaborati.`}
        </Box>}
      </Alert>}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        <Chip label={`${rows.length} opportunità`} />
        <Chip color="primary" label={`${portfolioCount} collegate al portafoglio`} />
        {latestRun && (
          <Chip
            color={latestRun.status === "SUCCESS" ? "success" : latestRun.status === "PARTIAL" ? "warning" : "error"}
            label={`Ultimo run: ${latestRun.status} · ${new Date(latestRun.started_at).toLocaleString("it-IT")}`}
          />
        )}
      </Stack>

      {opportunitiesQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Impossibile caricare lo screener entity-centric.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ height: 680 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          showToolbar
          slotProps={{
            toolbar: {
              csvOptions: {
                fileName: "mip-screener",
                utf8WithBom: true,
                escapeFormulas: true,
              },
              printOptions: { disableToolbarButton: true },
            },
          }}
          loading={opportunitiesQuery.isFetching || analysis.isPending}
          getRowId={(row) => row.opportunity_id}
          onRowClick={(params) => setSelectedId(params.row.opportunity_id)}
          initialState={{
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
            sorting: {
              sortModel: [{ field: "ranking_position", sort: "asc" }],
            },
          }}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
        />
      </Paper>

      <AlertRuleSettings context={{ scope: "SCREENER" }} />
      <SignalPerformanceHistory open={performanceOpen} onClose={() => setPerformanceOpen(false)} />

      <Dialog
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          {selected?.entity_name ?? "Dettaglio opportunità"}
        </DialogTitle>
        <DialogContent dividers>
          {detailQuery.isLoading && <Typography>Caricamento…</Typography>}
          {detailQuery.isError && (
            <Alert severity="error">Impossibile caricare il dettaglio.</Alert>
          )}
          {detailQuery.isSuccess && !selected && (
            <Alert severity="info">Opportunit\u00e0 non pi\u00f9 disponibile.</Alert>
          )}
          {selected && (
            <Stack spacing={3}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                <Chip label={`#${selected.ranking_position}`} />
                <Chip label={`${selected.source_symbol} · ${selected.source_exchange ?? "N/D"}`} />
                <Chip label={selected.source_currency_code ?? "N/D"} />
                <Chip
                  color={directionColor(selected.direction)}
                  label={selected.direction}
                />
                <Chip
                  color={originColor(selected.origin)}
                  label={selected.origin}
                />
                <Chip
                  color={verdictColor(selected.verdict)}
                  label={selected.verdict ?? "N/D"}
                />
                <Chip
                  color={matchColor(selected.portfolio_match_type)}
                  label={matchLabel(selected.portfolio_match_type)}
                />
              </Stack>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Segnale tecnico</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mb: 2 }}>
                  <Chip color="primary" label={selected.strategy_code ?? "Strategia N/D"} />
                  <Chip color={selected.signal_type === "BUY" || selected.signal_type === "STRONG_BUY" ? "success" : selected.signal_type === "SELL" || selected.signal_type === "STRONG_SELL" ? "error" : "default"} label={selected.signal_type ?? "Tipo N/D"} />
                  <Chip label={`Trend: ${selected.signal_trend ?? "N/D"}`} />
                  <Chip label={`Timeframe: ${selected.signal_timeframe ?? "N/D"}`} />
                  <Chip label={`Confidence: ${selected.signal_confidence === null ? "N/D" : `${(Number(selected.signal_confidence) * 100).toFixed(1)}%`}`} />
                </Stack>
                <Typography>
                  Prezzo riferimento: {selected.reference_price ?? "N/D"} · Invalidazione: {selected.invalidation_price ?? "N/D"} · Target: {selected.target_price ?? "N/D"}
                </Typography>
                <Typography sx={{ mt: 1 }}>
                  Motivi: {(selected.signal_reasons ?? []).length ? (selected.signal_reasons ?? []).join(", ") : "N/D"}
                </Typography>
                <Box component="pre" sx={{ mt: 2, p: 1.5, bgcolor: "action.hover", borderRadius: 1, overflow: "auto", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(selected.technical_evidence ?? {}, null, 2)}
                </Box>
              </Paper>

              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="h6">Storico segnali</Typography>
                  <Tooltip title="Aggiorna storico segnali">
                    <span>
                      <IconButton
                        aria-label="Aggiorna storico segnali"
                        disabled={signalEventsQuery.isFetching}
                        onClick={() => void signalEventsQuery.refetch()}
                      >
                        <RefreshIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
                {signalEventsQuery.isError ? (
                  <Alert severity="error">Impossibile caricare lo storico segnali.</Alert>
                ) : signalEventsQuery.isLoading ? (
                  <Typography>Caricamento...</Typography>
                ) : !signalEventsQuery.data?.length ? (
                  <Typography color="text.secondary">Nessun evento registrato.</Typography>
                ) : (
                  <Box sx={{ height: 360, width: "100%" }}>
                    <DataGrid<ScreenerSignalEvent>
                      rows={signalEventsQuery.data}
                      getRowId={(row) => row.signal_event_id}
                      loading={signalEventsQuery.isFetching}
                      columns={[
                        { field: "observed_at", headerName: "Data", width: 180,
                          renderCell: ({ row }) => new Date(row.observed_at).toLocaleString("it-IT") },
                        { field: "strategy_code", headerName: "Strategia", width: 150 },
                        { field: "timeframe", headerName: "Timeframe", width: 100 },
                        { field: "event_type", headerName: "Evento", width: 190 },
                        { field: "new_status", headerName: "Stato", width: 220,
                          renderCell: ({ row }) => `${row.previous_status ?? "N/D"} -> ${row.new_status}` },
                        { field: "new_direction", headerName: "Direzione", width: 190,
                          renderCell: ({ row }) => `${row.previous_direction ?? "N/D"} -> ${row.new_direction}` },
                        { field: "reason", headerName: "Motivo", minWidth: 220, flex: 1 },
                      ]}
                      initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                      pageSizeOptions={[10, 25, 100]}
                      disableRowSelectionOnClick
                      disableColumnSorting
                    />
                  </Box>
                )}
              </Box>

              <Box>
                <Typography variant="h6">Strumento analizzato</Typography>
                <Typography>
                  {selected.source_symbol} · {selected.source_exchange ?? "N/D"} · {selected.source_currency_code ?? "N/D"}
                </Typography>
                <Typography color="text.secondary">
                  ISIN: {selected.source_isin ?? "N/D"}
                </Typography>
              </Box>

              <Box>
                <Typography variant="h6">Posizioni collegate</Typography>
                {selected.portfolio_positions.length === 0 ? (
                  <Typography color="text.secondary">Nessuna posizione collegata.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {selected.portfolio_positions.map((position) => (
                      <Paper key={position.position_id} variant="outlined" sx={{ p: 1.5 }}>
                        <Typography sx={{ fontWeight: 700 }}>
                          {position.symbol} · {position.portfolio_name}
                        </Typography>
                        <Typography color="text.secondary">
                          {position.exchange ?? "N/D"} · {position.currency_code ?? "N/D"} · ISIN {position.isin ?? "N/D"}
                        </Typography>
                        <Chip
                          size="small"
                          sx={{ mt: 1 }}
                          color={matchColor(position.match_type)}
                          label={matchLabel(position.match_type)}
                        />
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>

              <Box>
                <Typography variant="h6">Strumenti della stessa entità</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mt: 1 }}>
                  {selected.alternative_instruments.map((instrument) => (
                    <Chip
                      key={instrument.instrument_id}
                      color={instrument.is_source ? "primary" : "default"}
                      variant={instrument.is_source ? "filled" : "outlined"}
                      label={`${instrument.symbol} · ${instrument.exchange ?? "N/D"} · ${instrument.currency_code ?? "N/D"}${instrument.same_isin ? " · stesso ISIN" : ""}`}
                    />
                  ))}
                </Stack>
              </Box>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6">Consenso strategie</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, my: 1 }}>
                  <Chip label={`Direzione: ${selected.consensus_direction}`} color={selected.consensus_direction === "CONFLICT" ? "warning" : selected.consensus_direction === "LONG" ? "success" : selected.consensus_direction === "SHORT" ? "error" : "default"} />
                  <Chip label={`Long: ${selected.bullish_strategy_count}`} />
                  <Chip label={`Short: ${selected.bearish_strategy_count}`} />
                  <Chip label={`Consenso: ${score(selected.consensus_score)}`} />
                  <Chip label={`Conflitto: ${score(selected.conflict_score)}`} />
                </Stack>
                <Typography>Favorevoli: {selected.supporting_strategies.join(", ") || "N/D"}</Typography>
                <Typography>Contrarie: {selected.opposing_strategies.join(", ") || "N/D"}</Typography>
              </Paper>

              <Box>
                <Typography variant="h6">Punteggi</Typography>
                <Typography>
                  Attention {score(selected.attention_score)} · Technical {score(selected.technical_score)} · Quant {score(selected.quant_score)} · LLM {score(selected.llm_score)} · Composite {score(selected.composite_score)}
                </Typography>
              </Box>

              {selected.summary && (
                <Box>
                  <Typography variant="h6">Sintesi LLM</Typography>
                  <Typography>{selected.summary}</Typography>
                </Box>
              )}

              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>Evidence</Typography>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 2,
                    maxHeight: 360,
                    overflow: "auto",
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    textAlign: "left",
                  }}
                >
                  {JSON.stringify(selected.evidence ?? {}, null, 2)}
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedId(null)}>Chiudi</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Storico Screener</DialogTitle>
        <DialogContent dividers>
          {runsQuery.isError && <Alert severity="error" sx={{ mb: 2 }} action={
            <IconButton aria-label="Riprova stato scansioni" disabled={runsQuery.isFetching}
              onClick={() => void runsQuery.refetch()}><RefreshIcon /></IconButton>
          }>Impossibile caricare lo stato delle scansioni.</Alert>}
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Box sx={{ width: { xs: "100%", md: 320 }, flexShrink: 0 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>Snapshot ranking</Typography>
              {snapshotsQuery.isLoading && <Typography>Caricamento...</Typography>}
              {snapshotsQuery.isError && <Alert severity="error" action={
                <IconButton aria-label="Riprova snapshot" disabled={snapshotsQuery.isFetching}
                  onClick={() => void snapshotsQuery.refetch()}><RefreshIcon /></IconButton>
              }>Impossibile caricare gli snapshot.</Alert>}
              {snapshotsQuery.isSuccess && !snapshotsQuery.data.length && (
                <Typography color="text.secondary">Nessuno snapshot disponibile.</Typography>
              )}
              <Stack spacing={1}>
                {(snapshotsQuery.data ?? []).map((snapshot) => (
                  <Button
                    key={snapshot.ranking_snapshot_id}
                    variant={selectedSnapshotId === snapshot.ranking_snapshot_id ? "contained" : "outlined"}
                    onClick={() => setSelectedSnapshotId(snapshot.ranking_snapshot_id)}
                    sx={{ justifyContent: "space-between" }}
                  >
                    {new Date(snapshot.observed_at).toLocaleString("it-IT")} · {snapshot.opportunity_count}
                  </Button>
                ))}
              </Stack>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>Classifica storica</Typography>
              {selectedSnapshotId && <Button size="small" startIcon={<CompareArrowsIcon />} sx={{ mb: 1 }}
                onClick={() => {
                  setChangesSnapshotId(selectedSnapshotId);
                  setChangeType("");
                  setHistoryOpen(false);
                  setChangesOpen(true);
                }}>Variazioni</Button>}
              {!selectedSnapshotId && <Typography color="text.secondary" sx={{ mb: 1 }}>Nessuno snapshot selezionato.</Typography>}
              {selectedSnapshotId && snapshotItemsQuery.isError && <Alert severity="error" sx={{ mb: 1 }} action={
                <IconButton aria-label="Riprova classifica storica" disabled={snapshotItemsQuery.isFetching}
                  onClick={() => void snapshotItemsQuery.refetch()}><RefreshIcon /></IconButton>
              }>Impossibile caricare la classifica storica.</Alert>}
              <Paper variant="outlined" sx={{ height: 520 }}>
                <DataGrid<ScreenerSnapshotItem>
                  rows={snapshotItemsQuery.data ?? []}
                  getRowId={(row) => row.ranking_snapshot_item_id}
                  loading={snapshotItemsQuery.isFetching}
                  columns={[
                    { field: "ranking_position", headerName: "#", width: 60 },
                    { field: "ranking_change", headerName: "Δ", width: 70,
                      renderCell: ({ row }) => row.ranking_change === null ? "Nuova" : row.ranking_change > 0 ? `+${row.ranking_change}` : `${row.ranking_change}` },
                    { field: "symbol", headerName: "Simbolo", width: 100 },
                    { field: "direction", headerName: "Direzione", width: 105 },
                    { field: "origin", headerName: "Origine", width: 105 },
                    { field: "composite_score", headerName: "Composite", width: 110,
                      renderCell: ({ row }) => <Typography sx={{ color: scoreColor(row.composite_score), fontWeight: 700 }}>{score(row.composite_score)}</Typography> },
                    { field: "verdict", headerName: "Verdetto", width: 110 },
                  ]}
                  pageSizeOptions={[25, 50, 100]}
                  disableRowSelectionOnClick
                />
              </Paper>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setHistoryOpen(false)}>Chiudi</Button></DialogActions>
      </Dialog>

    </Box>
  );
}
