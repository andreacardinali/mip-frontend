import { useDeferredValue, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, LinearProgress, Link, MenuItem, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { getEntities, getEntityOverview } from "../services/entities";
import { analyzeScreenerContext, screenerAnalysisMutationKey } from "../services/marketScreener";
import type { EntityScope } from "../types/entity";
import type { ScreenerOpportunity } from "../types/marketScreener";
import { formatTimestamp as timestamp } from "../services/timestamps";
import { directionLabel, strategyLabel, verdictLabel } from "../services/marketScreenerLabels";
import { screenerOpportunityColumns, screenerOpportunityInitialState } from "../components/screenerOpportunityColumns";

export default function EntitiesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const analysisPending = useIsMutating({ mutationKey: screenerAnalysisMutationKey }) > 0;
  const analysis = useMutation({
    mutationKey: screenerAnalysisMutationKey,
    mutationFn: analyzeScreenerContext,
    onSettled: async () => {
      await queryClient.invalidateQueries({ predicate: entry => {
        const key = entry.queryKey[0];
        return key === "entities" || key === "entity-overview"
          || (typeof key === "string" && key.startsWith("market-screener"));
      } });
    },
  });
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<EntityScope>("ALL");
  const query = useDeferredValue(search.trim().toLocaleLowerCase());
  const list = useQuery({ queryKey: ["entities", scope, query], queryFn: () => getEntities(scope, query), enabled: !id,
    refetchInterval: analysisPending ? 2_000 : false });
  const detail = useQuery({ queryKey: ["entity-overview", id], queryFn: () => getEntityOverview(id!), enabled: Boolean(id),
    refetchInterval: analysisPending ? 2_000 : false });
  const overview = detail.data;
  const current = id ? detail : list;
  const rows = list.data ?? [];
  const openOpportunity = (row: ScreenerOpportunity) => {
    navigate(`/screener?context=ENTITY:${row.entity_id}&context_name=${encodeURIComponent(row.entity_name)}&opportunity=${encodeURIComponent(row.opportunity_id)}`);
  };
  const watchlistMemberships = [...new Map((overview?.asset_match.watchlist_items ?? []).map(item => [item.watchlist_id, item])).values()];
  const instrumentRows = overview?.instruments.map(instrument => {
    const positions = overview.asset_match.portfolio_positions.filter(
      position => position.instrument_id === instrument.instrument_id,
    );
    return {
      ...instrument,
      in_portfolio: positions.length > 0,
      portfolio_quantity: positions.length > 0
        ? positions.reduce((total, position) => total + Number(position.quantity), 0)
        : null,
      portfolio_names: [...new Set(positions.map(position => position.portfolio_name))].join(", "),
      watchlist_names: overview.asset_match.watchlist_names.join(", "),
    };
  }) ?? [];
  const analysisContext = analysis.variables;
  const showsAnalysis = Boolean(overview && analysisContext && (
    (analysisContext.context_type === "ENTITY" && analysisContext.context_id === overview.entity.entity_id)
    || (analysisContext.context_type === "INSTRUMENT" && instrumentRows.some(row => row.instrument_id === analysisContext.context_id))
  ));
  const analysisTarget = analysisContext?.context_type === "INSTRUMENT"
    ? instrumentRows.find(row => row.instrument_id === analysisContext.context_id)?.symbol ?? "Strumento"
    : overview?.entity.name;
  const scan = analysis.data?.scan;
  const evaluated = Array.isArray(scan?.evaluated_instrument_ids) && scan.evaluated_instrument_ids.every(value => typeof value === "string")
    ? new Set(scan.evaluated_instrument_ids).size : null;
  const scanCount = (key: string, values = scan) => typeof values?.[key] === "number" && Number.isSafeInteger(values[key]) && values[key] >= 0 ? values[key] : null;
  const candidates = scanCount("candidates");
  const skipped = scanCount("skipped");
  const failures = scanCount("failures");
  const reasons = scan?.skipped_by_reason && typeof scan.skipped_by_reason === "object" && !Array.isArray(scan.skipped_by_reason)
    ? scan.skipped_by_reason as Record<string, unknown> : undefined;
  const withoutSignals = scanCount("NO_TECHNICAL_SIGNAL", reasons);
  const insufficientHistory = scanCount("INSUFFICIENT_HISTORY", reasons);
  const partialAnalysis = analysis.data?.status === "PARTIAL" || (skipped ?? 0) > (withoutSignals ?? 0) || (failures ?? 0) > 0;

  return <Stack spacing={2} sx={{ minWidth: 0 }}>
    <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      {id && <Button component={RouterLink} to="/entities" startIcon={<ArrowBackIcon />}>Entita</Button>}
      <Typography variant="h4" sx={{ flex: 1, overflowWrap: "anywhere" }}>{overview?.entity.name ?? (id ? "Scheda entita" : "Entita")}</Typography>
      <Button startIcon={<RefreshIcon />} onClick={() => void current.refetch()} disabled={current.isFetching}>{id ? "Ricarica scheda" : "Aggiorna"}</Button>
    </Stack>
    {overview && <Stack direction="row" sx={{ gap: 1, columnGap: 3, flexWrap: "wrap" }}>
      <Tooltip describeChild title="Data di caricamento della scheda dal database, non di aggiornamento dei prezzi o di analisi degli strumenti.">
        <Typography tabIndex={0} variant="caption" color="text.secondary">Scheda caricata: {timestamp(overview.observed_at)}</Typography>
      </Tooltip>
      <Tooltip describeChild title={overview.last_analysis_at
        ? "Ultima scansione tecnica completata che ha valutato almeno uno strumento, anche senza generare segnali. Non certifica l'analisi di tutti gli strumenti."
        : overview.instruments.length === 0
          ? "La scheda non ha strumenti associati da analizzare. Non indica un errore di caricamento dei dati."
          : "Non risulta una valutazione tecnica completata nei log disponibili. Non indica un errore di caricamento dei dati: le scansioni periodiche selezionano candidati e non coprono necessariamente tutti gli strumenti. Storico insufficiente, scansioni fallite o vecchi log senza dettaglio non aggiornano questa data."}>
        <Typography tabIndex={0} variant="caption" color="text.secondary">{overview.last_analysis_at
          ? `Ultima analisi tecnica registrata (almeno uno strumento): ${timestamp(overview.last_analysis_at)}`
          : overview.instruments.length === 0
            ? "Analisi tecnica: nessuno strumento associato"
            : "Analisi tecnica: nessuna valutazione completata registrata"}</Typography>
      </Tooltip>
    </Stack>}
    {id && analysisPending && <LinearProgress />}
    {current.isFetching && <LinearProgress />}
    {current.isError && <Alert severity="error">{current.error.message}</Alert>}
    {!id && <>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField select label="Mostra" value={scope} onChange={event => setScope(event.target.value as EntityScope)} sx={{ width: { xs: "100%", sm: 240 }, flexShrink: 0 }}>
          <MenuItem value="ALL">Tutte le entita</MenuItem>
          <MenuItem value="PORTFOLIO">In portafoglio</MenuItem>
          <MenuItem value="WATCHLIST">In watchlist</MenuItem>
          <MenuItem value="SIGNALS">Con segnali attivi</MenuItem>
        </TextField>
        <TextField label="Cerca nome, simbolo, mercato o tipo" value={search} onChange={event => setSearch(event.target.value)} sx={{ flex: 1 }} />
      </Stack>
      <Typography variant="caption" color="text.secondary">{rows.length} entita{rows.length === 500 ? " (limite raggiunto)" : ""}</Typography>
      <Box sx={{ height: 560, width: "100%" }}><DataGrid loading={list.isPending} rows={rows} getRowId={row => row.entity_id} disableRowSelectionOnClick columns={[
        { field: "name", headerName: "Entita", minWidth: 230, flex: 1, renderCell: ({ row }) => <Link component={RouterLink} to={`/entities/${row.entity_id}`}>{row.name}</Link> },
        { field: "entity_type", headerName: "Tipo", width: 150 },
        { field: "country_code", headerName: "Paese", width: 95 },
        { field: "relevance", headerName: "In evidenza", minWidth: 300, flex: 1, sortable: false, filterable: false, renderCell: ({ row }) => <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", height: "100%" }}>
          {row.in_portfolio && <Chip size="small" label="Portafoglio" color="success" variant="outlined" />}
          {row.in_watchlist && <Chip size="small" label="Watchlist" color="info" variant="outlined" />}
          {row.has_active_signals && <Chip size="small" label="Segnali attivi" color="warning" variant="outlined" />}
        </Stack> },
      ]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50, 100]} /></Box>
    </>}
    {overview && <>
      <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
        <Chip label={overview.entity.entity_type} variant="outlined" />
        <Chip label={overview.entity.active ? "Attiva" : "Inattiva"} variant="outlined" />
        <Chip label={`Portafogli: ${overview.asset_match.portfolio_position_count}`} color={overview.asset_match.in_portfolio ? "success" : "default"} />
        <Chip label={`Watchlist: ${overview.asset_match.watchlist_item_count}`} color={overview.asset_match.in_watchlist ? "info" : "default"} />
        <Chip component="a" href="#entity-catalysts" clickable label={`Catalizzatori: ${overview.catalyst_count}`} />
        <Chip component="a" href="#entity-news" clickable label={`News: ${overview.news_count}`} />
        <Chip component="a" href="#entity-signals" clickable label={`Segnali attivi: ${overview.opportunities.length}`} />
      </Stack>
      {overview.entity.description && <Typography>{overview.entity.description}</Typography>}
      <Typography variant="caption" color="text.secondary">ID: {overview.entity.entity_id} | Paese: {overview.entity.country_code ?? "N/D"}</Typography>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h6" sx={{ flex: 1 }}>Strumenti: prezzi e analisi</Typography>
        <Button variant="contained" startIcon={<PlayArrowIcon />} disabled={analysisPending || !instrumentRows.length}
          onClick={() => { if (!analysisPending) analysis.mutate({
            context_type: "ENTITY", context_id: overview.entity.entity_id,
          }); }}>Analizza entita</Button>
      </Stack>
      {showsAnalysis && <Box aria-live="polite" sx={{ overflowWrap: "anywhere" }}>
        {analysis.isPending && <Alert severity="info">Analisi richiesta per {analysisTarget}: esecuzione in corso, in attesa dell'esito.</Alert>}
        {analysis.isError && <Alert severity="error">Analisi non confermata per {analysisTarget}: {analysis.error.message}</Alert>}
        {!analysis.isPending && analysis.data && <Alert severity={analysis.data.status === "FAILED" ? "error"
          : partialAnalysis || evaluated === null || evaluated === 0 || candidates === null ? "warning" : "success"}>
          <Stack spacing={1}>
            <Typography variant="body2">{analysisTarget}: {analysis.data.status === "FAILED" ? "analisi fallita."
              : evaluated === 0 ? "nessuno strumento valutato: l'analisi tecnica non ha potuto produrre un esito."
              : evaluated === null ? "analisi terminata, ma il numero di strumenti valutati non e' disponibile."
              : `${partialAnalysis ? "Analisi tecnica parziale" : "Analisi tecnica completata"}${candidates === 0 ? ": nessun segnale prodotto." : "."}`}</Typography>
            <Typography variant="body2">Strumenti valutati: {evaluated ?? "non disponibile"} | Segnali prodotti: {candidates ?? "non disponibile"} | Esclusi dalla generazione di segnali: {skipped ?? "non disponibile"} | Errori sugli strumenti: {failures ?? "non disponibile"}</Typography>
            {reasons && <Typography variant="body2">Valutati senza segnale tecnico: {withoutSignals ?? "non disponibile"} | Non valutati per storico insufficiente: {insufficientHistory ?? "non disponibile"}</Typography>}
            {analysis.data.llm_enrichment && analysis.data.llm_enrichment.status !== "SUCCESS" && <Typography variant="body2">Arricchimento AI incompleto: {analysis.data.llm_enrichment.reason ?? "consultare i dettagli della scansione"}.</Typography>}
            <Box component="details">
              <Typography component="summary" sx={{ cursor: "pointer" }}>Dettagli dell'esecuzione</Typography>
              <Typography variant="caption">Esecuzione: {analysis.data.run_id}</Typography>
              <Box component="pre" sx={{ m: 0, maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(scan, null, 2)}</Box>
            </Box>
          </Stack>
        </Alert>}
      </Box>}
      <Box sx={{ height: 340, width: "100%" }}><DataGrid rows={instrumentRows} getRowId={row => row.instrument_id} disableRowSelectionOnClick columns={[
        { field: "symbol", headerName: "Simbolo", width: 130 }, { field: "exchange", headerName: "Mercato", width: 140 },
        { field: "analysis", headerName: "Analisi", width: 130, sortable: false, filterable: false,
          renderCell: ({ row }) => <Button size="small" startIcon={<PlayArrowIcon />} disabled={analysisPending}
            onClick={() => { if (!analysisPending) analysis.mutate({
              context_type: "INSTRUMENT", context_id: row.instrument_id,
            }); }}>Analizza</Button> },
        { field: "in_portfolio", headerName: "In portafoglio", type: "boolean", width: 140 },
        { field: "portfolio_quantity", headerName: "Quantita totale", type: "number", width: 145 },
        { field: "portfolio_names", headerName: "Portafogli", minWidth: 180, flex: 1 },
        { field: "watchlist_names", headerName: "Watchlist (entita)", minWidth: 180, flex: 1 },
        { field: "currency_code", headerName: "Valuta", width: 95 }, { field: "instrument_type", headerName: "Tipo", width: 130 },
        { field: "last_price", headerName: "Ultimo prezzo", width: 145 },
        { field: "price_as_of", headerName: "Timestamp prezzo", width: 210, valueFormatter: value => timestamp(value) },
        { field: "data_source", headerName: "Fonte", width: 150 },
      ]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50, 100]} /></Box>
      <Typography variant="h6">Appartenenze</Typography>
      <Stack spacing={1} sx={{ overflowWrap: "anywhere" }}>
        {overview.asset_match.portfolio_positions.map(position => <Typography key={position.position_id}><Link component={RouterLink} to={`/portfolios/${position.portfolio_id}`}>Portafoglio: {position.portfolio_name}</Link> | {position.symbol} | Quantita: {position.quantity} | {position.match_type}</Typography>)}
        {watchlistMemberships.map(watchlist => <Typography key={watchlist.watchlist_id}><Link component={RouterLink} to={`/watchlists/${watchlist.watchlist_id}`}>Watchlist: {watchlist.watchlist_name}</Link></Typography>)}
        {watchlistMemberships.length === 0 && <Typography color="text.secondary">Watchlist: Nessuna</Typography>}
        {overview.universes.map(universe => <Typography key={universe.universe_id}><Link component={RouterLink} to={`/universes/${universe.universe_id}`}>Universo: {universe.name}</Link> | {universe.code} | {universe.universe_type}</Typography>)}
        {!overview.asset_match.in_portfolio && overview.universes.length === 0 && <Typography color="text.secondary">Nessun portafoglio o universo associato.</Typography>}
      </Stack>
      <Typography id="entity-signals" component="h2" variant="h6" sx={{ scrollMarginTop: 96 }}>Risultati analisi: segnali degli strumenti</Typography>
      {overview.opportunities.length === 0 ? <Typography color="text.secondary">Nessun segnale attivo.</Typography> : <Box sx={{ height: 340, width: "100%" }}><DataGrid rows={overview.opportunities} getRowId={row => row.opportunity_id} disableRowSelectionOnClick columns={screenerOpportunityColumns(openOpportunity)} onRowClick={({ row }) => openOpportunity(row)} initialState={screenerOpportunityInitialState} showToolbar slotProps={{ toolbar: { csvOptions: { fileName: "mip-entity-signals", utf8WithBom: true, escapeFormulas: true }, printOptions: { disableToolbarButton: true } } }} pageSizeOptions={[25, 50, 100]} /></Box>}
      {overview.opportunities.map(opportunity => <Accordion key={opportunity.opportunity_id}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls={`analysis-${opportunity.opportunity_id}`} id={`analysis-heading-${opportunity.opportunity_id}`}>
          <Typography sx={{ overflowWrap: "anywhere" }}>Analisi {opportunity.symbol} | {strategyLabel(opportunity.strategy_code)} | {directionLabel(opportunity.direction)}</Typography>
        </AccordionSummary>
        <AccordionDetails id={`analysis-${opportunity.opportunity_id}`}>
          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary">Ultima analisi: {timestamp(opportunity.last_analysis_at)}</Typography>
            <Typography variant="subtitle2">Analisi tecnica e quantitativa</Typography>
            <Typography>Punteggio tecnico: {opportunity.technical_score ?? "N/D"} | Punteggio quantitativo: {opportunity.quant_score ?? "N/D"}</Typography>
            <Typography>Prezzo di riferimento: {opportunity.reference_price ?? "N/D"} | Invalidazione: {opportunity.invalidation_price ?? "N/D"} | Target: {opportunity.target_price ?? "N/D"}</Typography>
            {(opportunity.signal_reasons ?? []).map((reason, index) => <Typography key={`${index}-${reason}`}>{reason}</Typography>)}
            <Box component="details">
              <Typography component="summary" sx={{ cursor: "pointer" }}>Indicatori tecnici</Typography>
              <Box component="pre" sx={{ maxHeight: 300, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(opportunity.technical_evidence ?? {}, null, 2)}</Box>
            </Box>
            <Typography variant="subtitle2">Arricchimento AI</Typography>
            <Typography>Valutazione AI: {verdictLabel(opportunity.verdict)} | Punteggio AI: {opportunity.llm_score ?? "N/D"}</Typography>
            <Typography sx={{ overflowWrap: "anywhere" }}>{opportunity.summary ?? "Nessun arricchimento AI disponibile."}</Typography>
          </Stack>
        </AccordionDetails>
      </Accordion>)}
      <Button component={RouterLink} to={`/screener?context=ENTITY:${overview.entity.entity_id}&context_name=${encodeURIComponent(overview.entity.name)}`} startIcon={<PlayArrowIcon />}>Apri screener</Button>
      <Typography id="entity-catalysts" component="h2" variant="h6" sx={{ scrollMarginTop: 96 }}>Catalizzatori dell'entita ({overview.catalysts.length} / {overview.catalyst_count})</Typography>
      {overview.catalysts.length === 0 && <Typography color="text.secondary">Nessun catalizzatore associato.</Typography>}
      {overview.catalysts.map(catalyst => <Box key={catalyst.catalyst_id} sx={{ py: 1, borderBottom: 1, borderColor: "divider" }}><Typography>{catalyst.title ?? "Senza titolo"}</Typography><Typography variant="body2" color="text.secondary">{catalyst.catalyst_day} | {catalyst.catalyst_type ?? "N/D"} | {catalyst.status ?? "N/D"} | Importanza: {catalyst.importance ?? "N/D"} | {catalyst.source ?? "N/D"}</Typography></Box>)}
      <Typography id="entity-news" component="h2" variant="h6" sx={{ scrollMarginTop: 96 }}>News dell'entita ({overview.news.length} / {overview.news_count})</Typography>
      {overview.news.length === 0 && <Typography color="text.secondary">Nessuna news associata.</Typography>}
      {overview.news.map(news => <Box key={news.news_id} sx={{ py: 1, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle1">{news.url && /^https?:\/\//i.test(news.url) ? <Link href={news.url} target="_blank" rel="noopener noreferrer">{news.title ?? "Senza titolo"}</Link> : news.title ?? "Senza titolo"}</Typography>
        <Typography variant="caption" color="text.secondary">{timestamp(news.published_at)}</Typography>
        <Typography sx={{ overflowWrap: "anywhere" }}>{news.summary}</Typography>
      </Box>)}
      <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}>Diagnostica completa</AccordionSummary><AccordionDetails><Box component="pre" sx={{ m: 0, p: 2, maxHeight: 500, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(overview, null, 2)}</Box></AccordionDetails></Accordion>
    </>}
  </Stack>;
}