import { useEffect, useMemo, useState } from "react";
import { formatTimestamp } from "../services/timestamps";
import { useSearchParams } from "react-router-dom";

import HistoryIcon from "@mui/icons-material/History";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import RefreshIcon from "@mui/icons-material/Refresh";
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
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AlertRuleSettings from "../components/AlertRuleSettings";
import SignalPerformanceHistory from "../components/SignalPerformanceHistory";
import ScreenerRunLogDialog from "../components/ScreenerRunLogDialog";
import { analysisDescription, screenerOpportunityColumns, screenerOpportunityInitialState, score, matchLabel, matchColor, directionColor, originColor, verdictColor, scoreColor } from "../components/screenerOpportunityColumns";
import { consensusLabel, directionLabel, eventLabel, originLabel, signalTypeLabel, statusLabel, strategyLabel, trendLabel, verdictLabel } from "../services/marketScreenerLabels";

import {
  analyzeScreenerContext,
  screenerAnalysisMutationKey,
  getScreenerContextInstruments,
  getScreenerAnalysisProgress,
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
  ScreenerContext,
  ScreenerRun,
  ScreenerSignalEvent,
  ScreenerSnapshotItem,
  ScreenerSnapshotChange,
} from "../types/marketScreener";

export default function ScreenerPage() {
  const queryClient = useQueryClient();
  const analysisPending = useIsMutating({ mutationKey: screenerAnalysisMutationKey }) > 0;
  const [searchParams, setSearchParams] = useSearchParams();
  const [origin, setOrigin] = useState("");
  const [direction, setDirection] = useState("");
  const [verdict, setVerdict] = useState("");
  const [consensusDirection, setConsensusDirection] = useState<ConsensusDirection | "">("");
  const [portfolioFilter, setPortfolioFilter] = useState("ALL");
  const [watchlistFilter, setWatchlistFilter] = useState("ALL");
  const [minimumScore, setMinimumScore] = useState("0");
  const query = searchParams.get("query") ?? "";
  const setQuery = (value: string) => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    if (value) next.set("query", value);
    else next.delete("query");
    return next;
  }, { replace: true });
  const contextSelection = searchParams.get("context") ?? "";
  const [directContextType, directContextId = ""] = contextSelection.split(":");
  const directScope = directContextType === "ENTITY" || directContextType === "INSTRUMENT"
    ? directContextType : undefined;
  const [pageTab, setPageTab] = useState("results");
  const [detailTab, setDetailTab] = useState("overview");
  const [resultView, setResultView] = useState("all");
  const [strategy, setStrategy] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("opportunity"));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [logRun, setLogRun] = useState<ScreenerRun | null>(null);
  const [performanceOpen, setPerformanceOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesSnapshotId, setChangesSnapshotId] = useState("");
  const [changeType, setChangeType] = useState<ScreenerSnapshotChange["change_type"] | "">("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  const contextsQuery = useQuery({
    queryKey: ["market-screener-contexts"],
    queryFn: getScreenerContexts,
    enabled: !directScope,
  });
  const directContextQuery = useQuery({
    queryKey: ["context-instruments", directScope, directContextId],
    queryFn: () => getScreenerContextInstruments(directScope!, directContextId),
    enabled: Boolean(directScope && directContextId),
  });
  const directContext: ScreenerContext | undefined = directScope && directContextQuery.data
    ? {
      context_type: directScope,
      context_id: directContextId,
      name: searchParams.get("context_name") || (directScope === "ENTITY" ? "Entita" : directContextQuery.data[0]?.symbol || "Strumento"),
      instrument_count: directContextQuery.data.length,
    } : undefined;
  const selectedContext = directScope ? directContext : contextsQuery.data?.find(
    context => `${context.context_type}:${context.context_id}` === contextSelection,
  );
  const contextQuery = directScope ? directContextQuery : contextsQuery;
  const analysis = useMutation({
    mutationKey: screenerAnalysisMutationKey,
    mutationFn: analyzeScreenerContext,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["market-screener-progress"] });
      await refreshScreener();
    },
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: ["entity-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["entities"] });
    },
  });
  const progressQuery = useQuery({
    queryKey: ["market-screener-progress", selectedContext?.context_type, selectedContext?.context_id],
    queryFn: () => getScreenerAnalysisProgress(selectedContext!.context_type, selectedContext!.context_id),
    enabled: Boolean(selectedContext),
    refetchInterval: query => analysisPending || query.state.data?.status === "RUNNING" || query.state.data?.status === "QUEUED" ? 2_000 : 10_000,
  });
  const analysisRunning = analysisPending || progressQuery.data?.status === "RUNNING" || progressQuery.data?.status === "QUEUED";
  const analysisScopeType = directScope ?? selectedContext?.context_type;
  const analysisScopeLabel = analysisScopeType === "ENTITY" ? "dell'entità"
    : analysisScopeType === "INSTRUMENT" ? "del titolo"
      : analysisScopeType === "WATCHLIST" ? "della watchlist"
        : analysisScopeType === "PORTFOLIO" ? "del portafoglio"
          : analysisScopeType === "UNIVERSE" ? "dell'universo" : "degli strumenti selezionati";
  const progress = progressQuery.data?.status === "RUNNING" ? progressQuery.data.phase_results.progress : undefined;
  const progressPercent = progress && progress.total > 0
    ? Math.min(100, Math.max(0, progress.completed / progress.total * 100)) : undefined;
  const completedAt = progressQuery.data?.completed_at;
  const scanSummary = progressQuery.data?.phase_results?.analysis_scan;
  const evaluatedCount = Array.isArray(scanSummary?.evaluated_instrument_ids)
    ? scanSummary.evaluated_instrument_ids.length : undefined;
  const candidateCount = typeof scanSummary?.candidates === "number"
    && Number.isInteger(scanSummary.candidates) && scanSummary.candidates >= 0 ? scanSummary.candidates : undefined;
  useEffect(() => {
    if (completedAt) void queryClient.invalidateQueries({ queryKey: ["market-screener"] });
  }, [completedAt, queryClient]);
  const refreshInterval = autoRefresh && !analysisRunning ? 60_000 : false;

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
      watchlist_match: watchlistFilter === "YES" ? true : watchlistFilter === "NO" ? false : undefined,
      query: query.trim() || undefined,
      limit: 500,
    }),
    [origin, direction, verdict, consensusDirection, strategy, selectedContext, portfolioFilter, watchlistFilter, minimumScore, query],
  );

  const opportunitiesQuery = useQuery({
    queryKey: ["market-screener", filters],
    queryFn: () => getScreenerOpportunities(filters),
    enabled: !contextSelection || Boolean(selectedContext),
    refetchInterval: analysisRunning ? 2_000 : refreshInterval,
  });

  const detailQuery = useQuery({
    queryKey: ["market-screener-detail", selectedId],
    queryFn: () => getScreenerOpportunity(selectedId ?? ""),
    enabled: Boolean(selectedId),
    refetchInterval: analysisRunning ? 2_000 : false,
  });

  const signalEventsQuery = useQuery({
    queryKey: ["market-screener-signal-events", selectedId],
    queryFn: () => getScreenerSignalEvents(selectedId ?? ""),
    enabled: Boolean(selectedId && detailQuery.data),
    refetchInterval: analysisRunning ? 2_000 : false,
  });

  const runsQuery = useQuery({
    queryKey: ["market-screener-runs"],
    queryFn: () => getScreenerRuns(20),
    refetchInterval: query => analysisRunning || logRun || query.state.data?.[0]?.status === "RUNNING" ? 2_000 : refreshInterval,
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
        ? `${signalTypeLabel(row.previous.signal_type)} / ${strategyLabel(row.previous.strategy_code)} / ${directionLabel(row.previous.direction)} / ${consensusLabel(row.previous.consensus_direction)} / ${verdictLabel(row.previous.verdict)}` : "-" },
    { field: "current", headerName: "Attuale", minWidth: 280, flex: 1,
      valueGetter: (_, row) => row.current
        ? `${signalTypeLabel(row.current.signal_type)} / ${strategyLabel(row.current.strategy_code)} / ${directionLabel(row.current.direction)} / ${consensusLabel(row.current.consensus_direction)} / ${verdictLabel(row.current.verdict)}` : "-" },
    { field: "strategies", headerName: "Strategie (supporto; opposizione)", minWidth: 270, flex: 1,
      valueGetter: (_, row) => [row.previous, row.current].map(item => item
        ? `${(item.supporting_strategies ?? []).map(strategyLabel).join(", ") || "-"}; ${(item.opposing_strategies ?? []).map(strategyLabel).join(", ") || "-"}` : "-").join(" → ") },
  ];

  const allRows = contextSelection && !selectedContext ? [] : opportunitiesQuery.data ?? [];
  const aiCount = allRows.filter(row => row.llm_score !== null).length;
  const rows = resultView === "ai" ? allRows.filter(row => row.llm_score !== null) : allRows;
  const portfolioCount = rows.filter((row) => row.portfolio_match).length;

  const columns = screenerOpportunityColumns(row => {
    setDetailTab("overview");
    setSelectedId(row.opportunity_id);
  }, newEntries);

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
      ...(directScope && directContextId ? [directContextQuery.refetch()] : []),
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
        {selectedContext && <Typography variant="h4" sx={{ overflowWrap: "anywhere" }}>Segnali: {selectedContext.name}</Typography>}
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button variant="outlined" startIcon={<CompareArrowsIcon />} onClick={() => {
            setChangesSnapshotId("");
            setChangeType("");
            setChangesOpen(true);
          }}>
            {directScope ? "Variazioni globali" : "Variazioni"}
          </Button>
          <Button variant="outlined" startIcon={<ShowChartIcon />} onClick={() => setPerformanceOpen(true)}>
            {directScope ? "Performance globale" : "Performance"}
          </Button>
          <Button
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => setHistoryOpen(true)}
          >
            {directScope ? "Storico globale" : "Storico"}
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            disabled={refreshing || analysisRunning}
            onClick={() => void refreshScreener()}
          >
            Aggiorna
          </Button>
        </Stack>
      </Stack>

      {contextSelection && !selectedContext && <Alert severity={contextQuery.isError ? "error" : "info"} sx={{ mb: 2 }}>
        {contextQuery.isError ? "Impossibile caricare l'ambito selezionato."
          : contextQuery.isPending && (!directScope || directContextId) ? "Caricamento dell'ambito..." : "L'ambito selezionato non e' disponibile."}
      </Alert>}
      <Tabs value={pageTab} onChange={(_, value: string) => setPageTab(value)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        <Tab value="results" label="Segnali e analisi" id="screener-results-tab" aria-controls="screener-results" />
        <Tab value="monitoring" label="Alert di mercato" id="screener-monitoring-tab" aria-controls="screener-monitoring" />
      </Tabs>
      <Box hidden={pageTab !== "results"} role="tabpanel" id="screener-results" aria-labelledby="screener-results-tab">
      {changesQuery.isError && <Alert severity="error" sx={{ mb: 2 }} action={
        <IconButton aria-label="Riprova variazioni" onClick={() => void changesQuery.refetch()}><RefreshIcon /></IconButton>
      }>Impossibile caricare le variazioni dello screener.</Alert>}
      {changesQuery.data && <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
        <Typography variant="body2" color="text.secondary">Scansione completa: {formatTimestamp(changesQuery.data.observed_at)}</Typography>
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
                {formatTimestamp(snapshot.observed_at)}
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
              {formatTimestamp(comparisonQuery.data.observed_at)} · {comparisonQuery.data.opportunity_count} opportunità
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
          {directScope ? <Typography sx={{ alignSelf: "center", flex: 1, overflowWrap: "anywhere" }}>
            {directScope === "ENTITY" ? "Entita" : "Strumento"}: {selectedContext?.name ?? searchParams.get("context_name") ?? directContextId}
            {selectedContext && ` (${selectedContext.instrument_count} strumenti)`}
          </Typography> : <TextField select size="small" label="Ambito di analisi" value={selectedContext ? contextSelection : ""}
            disabled={analysisRunning || contextsQuery.isLoading}
            sx={{ minWidth: 220, flex: 1 }}
            onChange={event => {
              const next = new URLSearchParams(searchParams);
              if (event.target.value) next.set("context", event.target.value); else next.delete("context");
              next.delete("context_name");
              setSearchParams(next);
              setResultView("all"); setSelectedId(null); analysis.reset();
            }}>
            <MenuItem value="">Tutte le opportunita</MenuItem>
            {(contextsQuery.data ?? []).map(context => (
              <MenuItem key={`${context.context_type}:${context.context_id}`}
                value={`${context.context_type}:${context.context_id}`} sx={{ whiteSpace: "normal" }}>
                {context.context_type === "WATCHLIST" ? "Watchlist" : context.context_type === "PORTFOLIO" ? "Portafoglio" : "Universo"}: {context.name} ({context.instrument_count})
              </MenuItem>
            ))}
          </TextField>}
          <TextField size="small" label="Cerca" value={query}
            sx={{ minWidth: 180, flex: 1 }} onChange={event => setQuery(event.target.value)} />
          <Button variant="contained" startIcon={<PlayArrowIcon />}
            disabled={analysisRunning || !selectedContext || selectedContext.instrument_count === 0}
            onClick={() => { if (selectedContext && !analysisRunning) analysis.mutate({
              context_type: selectedContext.context_type, context_id: selectedContext.context_id,
            }); }}>
            {analysisRunning ? "Aggiornamento analisi in corso..." : `Aggiorna analisi ${analysisScopeLabel}`}
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
        {analysisRunning && <Box role="status" aria-live="polite" sx={{ mt: 2 }}>
          <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="body2">
              {progressQuery.data?.status === "QUEUED" ? "Analisi in coda allo scheduler"
                : progress?.phase === "LLM_ENRICHMENT" ? (progress.total > 0
                  ? `Arricchimento AI: ${progress.completed}/${progress.total} segnali`
                  : "Preparazione arricchimento AI...")
                : progress ? `Analisi tecnica: ${progress.completed}/${progress.total} strumenti`
                : "Avvio analisi..."}
              {progress?.symbol && ` · ${progress.symbol}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {progressPercent === 100 ? "Finalizzazione analisi e ranking..."
                : progressPercent !== undefined ? `${Math.round(progressPercent)}%` : ""}
            </Typography>
          </Stack>
          <LinearProgress aria-label="Avanzamento analisi screener"
            variant={progressPercent === undefined || progressPercent === 100 ? "indeterminate" : "determinate"}
            value={progressPercent} />
        </Box>}
        {analysisRunning && progressQuery.isError && <Alert severity="warning" sx={{ mt: 2 }}>
          Impossibile leggere l'avanzamento. L'analisi potrebbe essere ancora in corso.
        </Alert>}
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
            <MenuItem value="CORE">Universo monitorato</MenuItem>
            <MenuItem value="DISCOVERY">Scoperta</MenuItem>
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
            <MenuItem value="LONG">Rialzista</MenuItem>
            <MenuItem value="SHORT">Ribassista</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Valutazione AI"
            value={verdict}
            sx={{ minWidth: 140 }}
            onChange={(event) => setVerdict(event.target.value)}
          >
            <MenuItem value="">Tutti</MenuItem>
            <MenuItem value="CONFIRM">Confermato dall'AI</MenuItem>
            <MenuItem value="REVIEW">Da approfondire</MenuItem>
            <MenuItem value="REJECT">Non confermato dall'AI</MenuItem>
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
            <MenuItem value="LONG">Rialzista</MenuItem>
            <MenuItem value="SHORT">Ribassista</MenuItem>
            <MenuItem value="CONFLICT">In conflitto</MenuItem>
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
          <TextField select size="small" label="Entita in watchlist" value={watchlistFilter}
            sx={{ minWidth: 180 }} onChange={event => setWatchlistFilter(event.target.value)}>
            <MenuItem value="ALL">Tutte</MenuItem>
            <MenuItem value="YES">Solo in watchlist</MenuItem>
            <MenuItem value="NO">Escludi watchlist</MenuItem>
          </TextField>
          <TextField
            size="small"
            type="number"
            label="Punteggio minimo"
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

      {!directScope && contextsQuery.isError && <Alert severity="error" sx={{ mb: 2 }}
        action={<Button onClick={() => void contextsQuery.refetch()}>Riprova</Button>}>
        Impossibile caricare i contesti.
      </Alert>}

      {selectedContext && !analysisRunning && <Box role="status" aria-live="polite" sx={{ mb: 2, overflowWrap: "anywhere" }}>
        {progressQuery.isError ? <Alert severity="warning">Ultimo run analisi: esito non disponibile. Impossibile leggere lo stato dell'esecuzione.</Alert>
          : progressQuery.isPending ? <Typography variant="body2">Ultimo run analisi: lettura in corso...</Typography>
          : !progressQuery.data?.screener_run_id ? <Typography variant="body2" color="text.secondary">Ultimo run analisi: nessuna esecuzione registrata per {selectedContext.name}.</Typography>
          : <Alert severity={progressQuery.data.status === "FAILED" ? "error" : progressQuery.data.status === "SUCCESS" && evaluatedCount !== 0 ? "success" : "warning"}>
            <Stack spacing={0.5}>
              <Typography variant="body2">Ultimo run analisi · {selectedContext.name}: {progressQuery.data.status === "SUCCESS" ? "completato"
                : progressQuery.data.status === "PARTIAL" ? "completato parzialmente" : "fallito"}.</Typography>
              <Typography variant="body2">Avviato: {progressQuery.data.started_at ? formatTimestamp(progressQuery.data.started_at) : "non disponibile"} | Terminato: {completedAt ? formatTimestamp(completedAt) : "non disponibile"}</Typography>
              {(evaluatedCount !== undefined || candidateCount !== undefined) && <Typography variant="body2">Strumenti valutati: {evaluatedCount ?? "non disponibile"} | Segnali prodotti: {candidateCount ?? "non disponibile"}</Typography>}
              {evaluatedCount === 0 && <Typography variant="body2">Nessuno strumento valutato in questo run.</Typography>}
              {evaluatedCount !== undefined && evaluatedCount > 0 && candidateCount === 0 && <Typography variant="body2">Nessun segnale tecnico prodotto dagli strumenti valutati.</Typography>}
              {progressQuery.data.error_message && <Typography variant="body2">{progressQuery.data.error_message}</Typography>}
            </Stack>
          </Alert>}
      </Box>}
      {selectedContext && analysis.isError && analysis.variables?.context_type === selectedContext.context_type && analysis.variables?.context_id === selectedContext.context_id && <Alert severity="error" sx={{ mb: 2 }}>Ultima richiesta di analisi non confermata: {analysis.error.message}</Alert>}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ alignSelf: "center" }}>{rows.length} segnali · {portfolioCount} collegati al portafoglio</Typography>
        <Tabs value={resultView} onChange={(_, value: string) => setResultView(value)} aria-label="Risultati disponibili">
          <Tab value="all" label="Tutti" />
          <Tab value="ai" label={`Con analisi AI (${aiCount})`} />
        </Tabs>
        {latestRun && (
          <Chip
            color={latestRun.status === "SUCCESS" ? "success" : latestRun.status === "PARTIAL" ? "warning" : latestRun.status === "RUNNING" ? "info" : "error"}
            label={`Ultima pipeline: ${latestRun.status} · ${formatTimestamp(latestRun.started_at)}`}
            onClick={() => setLogRun(latestRun)}
            aria-label={`Apri log ultima esecuzione: ${latestRun.status}`}
          />
        )}
      </Stack>

      {resultView === "ai" && !opportunitiesQuery.isFetching && !opportunitiesQuery.isError && !rows.length && (
        <Alert severity="info" sx={{ mb: 2 }}>Nessuna analisi AI disponibile per i segnali e i filtri selezionati.</Alert>
      )}
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
          loading={opportunitiesQuery.isPending}
          getRowId={(row) => row.opportunity_id}
          onRowClick={(params) => { setDetailTab("overview"); setSelectedId(params.row.opportunity_id); }}
          initialState={screenerOpportunityInitialState}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
        />
      </Paper>

      </Box>
      <Box hidden={pageTab !== "monitoring"} role="tabpanel" id="screener-monitoring" aria-labelledby="screener-monitoring-tab">
        {directScope ? <Alert severity="info">Gli alert di mercato sono disponibili negli ambiti Screener, watchlist e portafoglio.</Alert> : (!contextSelection || selectedContext) && <AlertRuleSettings key={contextSelection || "SCREENER"} context={
          selectedContext && (selectedContext.context_type === "WATCHLIST" || selectedContext.context_type === "PORTFOLIO")
            ? { scope: selectedContext.context_type, scopeId: selectedContext.context_id }
            : { scope: "SCREENER" }
        } />}
      </Box>
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
        <Tabs value={detailTab} onChange={(_, value: string) => setDetailTab(value)} variant="scrollable" scrollButtons="auto">
          <Tab value="overview" label="Analisi AI" id="signal-overview-tab" aria-controls="signal-overview" />
          <Tab value="technical" label="Dati tecnici" id="signal-technical-tab" aria-controls="signal-technical" />
          <Tab value="history" label="Storico e posizioni" id="signal-history-tab" aria-controls="signal-history" />
        </Tabs>
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
                <Tooltip describeChild title={analysisDescription("ranking_position", selected.ranking_position)}><Chip tabIndex={0} label={`#${selected.ranking_position}`} /></Tooltip>
                <Tooltip describeChild title={analysisDescription("source_symbol", selected.source_symbol)}><Chip tabIndex={0} label={`${selected.source_symbol} · ${selected.source_exchange ?? "N/D"}`} /></Tooltip>
                <Tooltip describeChild title={analysisDescription("source_currency_code", selected.source_currency_code)}><Chip tabIndex={0} label={selected.source_currency_code ?? "N/D"} /></Tooltip>
                <Tooltip describeChild title={analysisDescription("direction", selected.direction)}><Chip tabIndex={0}
                  color={directionColor(selected.direction)}
                  label={directionLabel(selected.direction)}
                /></Tooltip>
                <Tooltip describeChild title={analysisDescription("origin", selected.origin)}><Chip tabIndex={0}
                  color={originColor(selected.origin)}
                  label={originLabel(selected.origin)}
                /></Tooltip>
                <Tooltip describeChild title={analysisDescription("verdict", selected.verdict)}><Chip tabIndex={0}
                  color={verdictColor(selected.verdict)}
                  label={verdictLabel(selected.verdict)}
                /></Tooltip>
                <Tooltip describeChild title={analysisDescription("portfolio_match_type", selected.portfolio_match_type)}><Chip tabIndex={0}
                  color={matchColor(selected.portfolio_match_type)}
                  label={matchLabel(selected.portfolio_match_type)}
                /></Tooltip>
              </Stack>

              <Box hidden={detailTab !== "overview"} role="tabpanel" id="signal-overview" aria-labelledby="signal-overview-tab">
                <Typography variant="h6" sx={{ mb: 1 }}>Valutazione AI</Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
                  <Tooltip describeChild title={analysisDescription("verdict", selected.verdict)}><Chip tabIndex={0} label={verdictLabel(selected.verdict)} color={verdictColor(selected.verdict)} /></Tooltip>
                  <Tooltip describeChild title={analysisDescription("llm_score", selected.llm_score)}><Chip tabIndex={0} label={`Punteggio AI: ${score(selected.llm_score)}`} /></Tooltip>
                  <Tooltip describeChild title={analysisDescription("composite_score", selected.composite_score)}><Chip tabIndex={0} label={`Punteggio totale: ${score(selected.composite_score)}`} /></Tooltip>
                </Stack>
                {selected.summary ? <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{selected.summary}</Typography>
                  : <Alert severity="info">{selected.llm_score === null
                    ? "Questo segnale non ha un'analisi AI disponibile."
                    : "Valutazione AI disponibile senza sintesi testuale."}</Alert>}
              </Box>

              <Box hidden={detailTab !== "technical"} role="tabpanel" id="signal-technical" aria-labelledby="signal-technical-tab">
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>Segnale tecnico</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mb: 2 }}>
                  <Tooltip describeChild title={analysisDescription("strategy_code", selected.strategy_code)}><Chip tabIndex={0} color="primary" label={strategyLabel(selected.strategy_code)} /></Tooltip>
                  <Tooltip describeChild title={analysisDescription("signal_type", selected.signal_type)}><Chip tabIndex={0} color={selected.signal_type === "BUY" || selected.signal_type === "STRONG_BUY" ? "success" : selected.signal_type === "SELL" || selected.signal_type === "STRONG_SELL" ? "error" : "default"} label={signalTypeLabel(selected.signal_type)} /></Tooltip>
                  <Tooltip describeChild title={analysisDescription("signal_trend", selected.signal_trend)}><Chip tabIndex={0} label={`Trend: ${trendLabel(selected.signal_trend)}`} /></Tooltip>
                  <Tooltip describeChild title={analysisDescription("signal_timeframe", selected.signal_timeframe)}><Chip tabIndex={0} label={`Timeframe: ${selected.signal_timeframe ?? "N/D"}`} /></Tooltip>
                  <Tooltip describeChild title={analysisDescription("signal_confidence", selected.signal_confidence)}><Chip tabIndex={0} label={`Affidabilità: ${selected.signal_confidence === null ? "N/D" : `${(Number(selected.signal_confidence) * 100).toFixed(1)}%`}`} /></Tooltip>
                </Stack>
                <Typography>
                  Prezzo riferimento: {selected.reference_price ?? "N/D"} · Invalidazione: {selected.invalidation_price ?? "N/D"} · Target: {selected.target_price ?? "N/D"}
                </Typography>
                <Typography sx={{ mt: 1 }}>
                  Motivi: {(selected.signal_reasons ?? []).length ? (selected.signal_reasons ?? []).join(", ") : "N/D"}
                </Typography>
                <Box component="details" sx={{ mt: 2 }}>
                <Typography component="summary" sx={{ cursor: "pointer" }}>Indicatori tecnici completi</Typography>
                <Box component="pre" sx={{ mt: 2, p: 1.5, bgcolor: "action.hover", borderRadius: 1, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {JSON.stringify(selected.technical_evidence ?? {}, null, 2)}
                </Box>
                </Box>
              </Box>
              <Tooltip describeChild title={[analysisDescription("attention_score", selected.attention_score), analysisDescription("technical_score", selected.technical_score), analysisDescription("quant_score", selected.quant_score)].join(" ")}><Typography tabIndex={0} sx={{ mt: 2 }}>
                Attenzione {score(selected.attention_score)} · Tecnica {score(selected.technical_score)} · Quantitativa {score(selected.quant_score)}
              </Typography></Tooltip>
              <Typography variant="h6" sx={{ mt: 2 }}>Consenso strategie</Typography>
              <Tooltip describeChild title={analysisDescription("consensus_direction", selected.consensus_direction)}><Typography tabIndex={0}>Direzione: {consensusLabel(selected.consensus_direction)} · Rialziste: {selected.bullish_strategy_count} · Ribassiste: {selected.bearish_strategy_count}</Typography></Tooltip>
              <Typography>Consenso: {score(selected.consensus_score)} · Conflitto: {score(selected.conflict_score)}</Typography>
              <Typography>Favorevoli: {selected.supporting_strategies.map(strategyLabel).join(", ") || "N/D"}</Typography>
              <Typography>Contrarie: {selected.opposing_strategies.map(strategyLabel).join(", ") || "N/D"}</Typography>
              <Box component="details" sx={{ mt: 2 }}>
                <Typography component="summary" sx={{ cursor: "pointer" }}>Dati completi dell'analisi</Typography>
                <Box component="pre" sx={{ p: 2, maxHeight: 360, overflow: "auto", bgcolor: "action.hover", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {JSON.stringify(selected.evidence ?? {}, null, 2)}
                </Box>
              </Box>
              </Box>

              <Stack hidden={detailTab !== "history"} spacing={3} role="tabpanel" id="signal-history" aria-labelledby="signal-history-tab" sx={{ display: detailTab === "history" ? "flex" : "none" }}>
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
                          renderCell: ({ row }) => formatTimestamp(row.observed_at) },
                        { field: "strategy_code", headerName: "Strategia", width: 180,
                          renderCell: ({ row }) => strategyLabel(row.strategy_code) },
                        { field: "timeframe", headerName: "Timeframe", width: 100 },
                        { field: "event_type", headerName: "Evento", width: 190,
                          renderCell: ({ row }) => eventLabel(row.event_type) },
                        { field: "new_status", headerName: "Stato", width: 220,
                          renderCell: ({ row }) => `${statusLabel(row.previous_status)} -> ${statusLabel(row.new_status)}` },
                        { field: "new_direction", headerName: "Direzione", width: 190,
                          renderCell: ({ row }) => `${directionLabel(row.previous_direction)} -> ${directionLabel(row.new_direction)}` },
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
                        <Tooltip describeChild title={analysisDescription("portfolio_match_type", position.match_type)}><Chip tabIndex={0}
                          size="small"
                          sx={{ mt: 1 }}
                          color={matchColor(position.match_type)}
                          label={matchLabel(position.match_type)}
                        /></Tooltip>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>

              <Box>
                <Typography variant="h6">Strumenti della stessa entità</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mt: 1 }}>
                  {selected.alternative_instruments.map((instrument) => (
                    <Tooltip key={instrument.instrument_id} describeChild title={`${analysisDescription("source_symbol", instrument.symbol)} ${instrument.is_source ? "Strumento su cui e stato calcolato questo segnale." : instrument.same_isin ? "Strumento della stessa entita con lo stesso ISIN di quello analizzato." : "Strumento della stessa entita, distinto da quello analizzato e dal suo ISIN."}`}><Chip tabIndex={0}
                      color={instrument.is_source ? "primary" : "default"}
                      variant={instrument.is_source ? "filled" : "outlined"}
                      label={`${instrument.symbol} · ${instrument.exchange ?? "N/D"} · ${instrument.currency_code ?? "N/D"}${instrument.same_isin ? " · stesso ISIN" : ""}`}
                    /></Tooltip>
                  ))}
                </Stack>
              </Box>

              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            disabled={!selected?.source_instrument_id || analysisRunning}
            onClick={() => {
              if (selected?.source_instrument_id && !analysisRunning) {
                analysis.mutate({
                  context_type: "INSTRUMENT",
                  context_id: selected.source_instrument_id,
                });
              }
            }}
          >
            {analysisRunning ? "Aggiornamento analisi in corso..." : "Aggiorna analisi del titolo"}
          </Button>
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
                    {formatTimestamp(snapshot.observed_at)} · {snapshot.opportunity_count}
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
                    { field: "direction", headerName: "Direzione", width: 120,
                      renderCell: ({ row }) => directionLabel(row.direction) },
                    { field: "origin", headerName: "Origine", width: 170,
                      renderCell: ({ row }) => originLabel(row.origin) },
                    { field: "composite_score", headerName: "Punteggio complessivo", width: 170,
                      renderCell: ({ row }) => <Typography sx={{ color: scoreColor(row.composite_score), fontWeight: 700 }}>{score(row.composite_score)}</Typography> },
                    { field: "verdict", headerName: "Valutazione AI", width: 180,
                      renderCell: ({ row }) => verdictLabel(row.verdict) },
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

      {logRun && <ScreenerRunLogDialog key={logRun.screener_run_id}
        run={runsQuery.data?.find(run => run.screener_run_id === logRun.screener_run_id) ?? logRun}
        onClose={() => setLogRun(null)} />}
    </Box>
  );
}
