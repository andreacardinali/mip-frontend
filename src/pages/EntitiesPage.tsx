import { useDeferredValue, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, LinearProgress, Link, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { getEntities, getEntityOverview } from "../services/entities";

const timestamp = (value: string | null) => value ? new Date(value).toLocaleString("it-IT") : "N/D";

export default function EntitiesPage() {
  const { id } = useParams();
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim().toLocaleLowerCase());
  const list = useQuery({ queryKey: ["entities"], queryFn: getEntities, enabled: !id });
  const detail = useQuery({ queryKey: ["entity-overview", id], queryFn: () => getEntityOverview(id!), enabled: Boolean(id) });
  const overview = detail.data;
  const current = id ? detail : list;
  const rows = (list.data ?? []).filter(row => [row.name, row.symbol, row.exchange, row.entity_type].some(value => value?.toLocaleLowerCase().includes(query)));

  return <Stack spacing={2} sx={{ minWidth: 0 }}>
    <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      {id && <Button component={RouterLink} to="/entities" startIcon={<ArrowBackIcon />}>Entita</Button>}
      <Typography variant="h4" sx={{ flex: 1, overflowWrap: "anywhere" }}>{overview?.entity.name ?? (id ? "Scheda entita" : "Entita")}</Typography>
      <Button startIcon={<RefreshIcon />} onClick={() => void current.refetch()} disabled={current.isFetching}>Aggiorna</Button>
    </Stack>
    {current.isFetching && <LinearProgress />}
    {current.isError && <Alert severity="error">{current.error.message}</Alert>}
    {!id && <>
      <TextField label="Cerca nome, simbolo, mercato o tipo" value={search} onChange={event => setSearch(event.target.value)} />
      <Typography variant="caption" color="text.secondary">{rows.length} righe visibili / {list.data?.length ?? 0} caricate (limite API: 500)</Typography>
      <Box sx={{ height: 560, width: "100%" }}><DataGrid loading={list.isPending} rows={rows} getRowId={row => `${row.entity_id}:${row.symbol ?? ""}:${row.exchange ?? ""}`} disableRowSelectionOnClick columns={[
        { field: "name", headerName: "Entita", minWidth: 230, flex: 1, renderCell: ({ row }) => <Link component={RouterLink} to={`/entities/${row.entity_id}`}>{row.name}</Link> },
        { field: "symbol", headerName: "Simbolo", width: 130 },
        { field: "exchange", headerName: "Mercato", width: 150 },
        { field: "entity_type", headerName: "Tipo", width: 150 },
        { field: "country_code", headerName: "Paese", width: 95 },
      ]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50, 100]} /></Box>
    </>}
    {overview && <>
      <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
        <Chip label={overview.entity.entity_type} variant="outlined" />
        <Chip label={overview.entity.active ? "Attiva" : "Inattiva"} variant="outlined" />
        <Chip label={`Portafogli: ${overview.asset_match.portfolio_position_count}`} color={overview.asset_match.in_portfolio ? "success" : "default"} />
        <Chip label={`Watchlist: ${overview.asset_match.watchlist_item_count}`} color={overview.asset_match.in_watchlist ? "info" : "default"} />
        <Chip label={`News: ${overview.news_count}`} /><Chip label={`Catalizzatori: ${overview.catalyst_count}`} /><Chip label={`Segnali attivi: ${overview.opportunities.length}`} />
      </Stack>
      {overview.entity.description && <Typography>{overview.entity.description}</Typography>}
      <Typography variant="caption" color="text.secondary">ID: {overview.entity.entity_id} | Paese: {overview.entity.country_code ?? "N/D"} | Osservato: {timestamp(overview.observed_at)}</Typography>
      <Typography variant="h6">Strumenti e prezzi</Typography>
      <Box sx={{ height: 340, width: "100%" }}><DataGrid rows={overview.instruments} getRowId={row => row.instrument_id} disableRowSelectionOnClick columns={[
        { field: "symbol", headerName: "Simbolo", width: 130 }, { field: "exchange", headerName: "Mercato", width: 140 },
        { field: "currency_code", headerName: "Valuta", width: 95 }, { field: "instrument_type", headerName: "Tipo", width: 130 },
        { field: "last_price", headerName: "Ultimo prezzo", width: 145 },
        { field: "price_as_of", headerName: "Timestamp prezzo", width: 210, valueFormatter: timestamp },
        { field: "data_source", headerName: "Fonte", width: 150 },
      ]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50, 100]} /></Box>
      <Typography variant="h6">Appartenenze</Typography>
      <Stack spacing={1}>
        {overview.asset_match.portfolio_positions.map(position => <Typography key={position.position_id}><Link component={RouterLink} to={`/portfolios/${position.portfolio_id}`}>{position.portfolio_name}</Link> | {position.symbol} | Quantita: {position.quantity} | {position.match_type}</Typography>)}
        <Typography>Watchlist: {overview.asset_match.watchlist_names.join(", ") || "Nessuna"}</Typography>
        {overview.universes.map(universe => <Typography key={universe.universe_id}><Link component={RouterLink} to={`/universes/${universe.universe_id}`}>{universe.name}</Link> | {universe.code} | {universe.universe_type}</Typography>)}
        {!overview.asset_match.in_portfolio && overview.universes.length === 0 && <Typography color="text.secondary">Nessun portafoglio o universo associato.</Typography>}
      </Stack>
      <Typography variant="h6">Segnali screener attivi</Typography>
      {overview.opportunities.length === 0 ? <Typography color="text.secondary">Nessun segnale attivo.</Typography> : <Box sx={{ height: 340, width: "100%" }}><DataGrid rows={overview.opportunities} getRowId={row => row.opportunity_id} disableRowSelectionOnClick columns={[
        { field: "symbol", headerName: "Simbolo", width: 120 }, { field: "strategy_code", headerName: "Strategia", width: 160 },
        { field: "direction", headerName: "Direzione", width: 115 }, { field: "composite_score", headerName: "Score", width: 100 },
        { field: "consensus_direction", headerName: "Consenso", width: 130 }, { field: "verdict", headerName: "Verdetto AI", width: 140 },
        { field: "summary", headerName: "Sintesi", minWidth: 260, flex: 1 },
      ]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50, 100]} /></Box>}
      <Button component={RouterLink} to={`/screener?query=${encodeURIComponent(overview.entity.name)}`}>Segnali e analisi</Button>
      <Typography variant="h6">News ({overview.news.length} / {overview.news_count})</Typography>
      {overview.news.length === 0 && <Typography color="text.secondary">Nessuna news associata.</Typography>}
      {overview.news.map(news => <Box key={news.news_id} sx={{ py: 1, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle1">{news.url && /^https?:\/\//i.test(news.url) ? <Link href={news.url} target="_blank" rel="noopener noreferrer">{news.title ?? "Senza titolo"}</Link> : news.title ?? "Senza titolo"}</Typography>
        <Typography variant="caption" color="text.secondary">{timestamp(news.published_at)}</Typography>
        <Typography sx={{ overflowWrap: "anywhere" }}>{news.summary}</Typography>
      </Box>)}
      <Typography variant="h6">Catalizzatori ({overview.catalysts.length} / {overview.catalyst_count})</Typography>
      {overview.catalysts.length === 0 && <Typography color="text.secondary">Nessun catalizzatore associato.</Typography>}
      {overview.catalysts.map(catalyst => <Box key={catalyst.catalyst_id} sx={{ py: 1, borderBottom: 1, borderColor: "divider" }}><Typography>{catalyst.title ?? "Senza titolo"}</Typography><Typography variant="body2" color="text.secondary">{catalyst.catalyst_day} | {catalyst.catalyst_type ?? "N/D"} | {catalyst.status ?? "N/D"} | Importanza: {catalyst.importance ?? "N/D"} | {catalyst.source ?? "N/D"}</Typography></Box>)}
      <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}>Diagnostica completa</AccordionSummary><AccordionDetails><Box component="pre" sx={{ m: 0, p: 2, maxHeight: 500, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(overview, null, 2)}</Box></AccordionDetails></Accordion>
    </>}
  </Stack>;
}