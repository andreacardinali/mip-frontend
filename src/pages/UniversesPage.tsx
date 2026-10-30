import { useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, LinearProgress, Link, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import api from "../api/api";
import { getScreenerContexts } from "../services/marketScreener";
import type { ContextInstrument } from "../types/entity";

export default function UniversesPage() {
  const { id } = useParams();
  const [search, setSearch] = useState("");
  const contexts = useQuery({ queryKey: ["market-screener-contexts"], queryFn: getScreenerContexts });
  const members = useQuery({ queryKey: ["context-instruments", "UNIVERSE", id], queryFn: async () => (await api.get<ContextInstrument[]>(`/screener/contexts/UNIVERSE/${id}/instruments`)).data, enabled: Boolean(id) });
  const universes = (contexts.data ?? []).filter(context => context.context_type === "UNIVERSE");
  const selected = universes.find(context => context.context_id === id);
  const query = search.trim().toLocaleLowerCase();
  const instruments = (members.data ?? []).filter(row => [row.symbol, row.exchange, row.currency_code].some(value => value?.toLocaleLowerCase().includes(query)));
  return <Stack spacing={2} sx={{ minWidth: 0 }}>
    <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      {id && <Button component={RouterLink} to="/universes" startIcon={<ArrowBackIcon />}>Universi</Button>}
      <Typography variant="h4" sx={{ flex: 1, overflowWrap: "anywhere" }}>{selected?.name ?? "Universi"}</Typography>
      <Button startIcon={<RefreshIcon />} onClick={() => { void contexts.refetch(); if (id) void members.refetch(); }} disabled={contexts.isFetching || (Boolean(id) && members.isFetching)}>Aggiorna</Button>
      {id && <Button component={RouterLink} to={`/screener?context=UNIVERSE:${id}`} startIcon={<AnalyticsIcon />}>Segnali e analisi</Button>}
    </Stack>
    {(contexts.isFetching || (Boolean(id) && members.isFetching)) && <LinearProgress />}
    {contexts.isError && <Alert severity="error">{contexts.error.message}</Alert>}
    {id && members.isError && <Alert severity="error">{members.error.message}</Alert>}
    <TextField label={id ? "Cerca simbolo, mercato o valuta" : "Cerca universo"} value={search} onChange={event => setSearch(event.target.value)} />
    {id ? <>
      <Typography variant="caption" color="text.secondary">ID: {id} | Strumenti visibili: {instruments.length} / {members.data?.length ?? 0}</Typography>
      <Box sx={{ height: 560, width: "100%" }}><DataGrid rows={instruments} loading={members.isPending} getRowId={row => row.instrument_id} disableRowSelectionOnClick columns={[
        { field: "symbol", headerName: "Strumento / entita", minWidth: 200, flex: 1, renderCell: ({ row }) => <Link component={RouterLink} to={`/entities/${row.entity_id}`}>{row.symbol ?? row.entity_id}</Link> },
        { field: "exchange", headerName: "Mercato", width: 180 }, { field: "currency_code", headerName: "Valuta", width: 100 },
        { field: "instrument_id", headerName: "ID strumento", width: 310 },
      ]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50, 100]} /></Box>
    </> : <Box sx={{ height: 560, width: "100%" }}><DataGrid rows={universes.filter(row => row.name.toLocaleLowerCase().includes(query))} loading={contexts.isPending} getRowId={row => row.context_id} disableRowSelectionOnClick columns={[
      { field: "name", headerName: "Universo", minWidth: 230, flex: 1, renderCell: ({ row }) => <Link component={RouterLink} to={`/universes/${row.context_id}`}>{row.name}</Link> },
      { field: "instrument_count", headerName: "Strumenti", type: "number", width: 130 },
      { field: "context_id", headerName: "ID universo", width: 310 },
    ]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50, 100]} /></Box>}
  </Stack>;
}