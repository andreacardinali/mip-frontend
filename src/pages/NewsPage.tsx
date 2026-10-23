import { useMemo, useState } from "react";

import LaunchIcon from "@mui/icons-material/Launch";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Link,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";

import { getNews, getNewsFacets } from "../services/news";
import type { NewsItem, NewsScope } from "../types/news";

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}
function startOfDay(value: string) {
  return value ? `${value}T00:00:00` : undefined;
}
function endOfDay(value: string) {
  return value ? `${value}T23:59:59` : undefined;
}
function formatDate(value: string | null) {
  if (!value) return "N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
function numeric(value: number | string | null) {
  if (value == null || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
function score(value: number | string | null) {
  const result = numeric(value);
  return result == null ? "N/D" : result.toLocaleString("it-IT", { maximumFractionDigits: 2 });
}
function sentimentLabel(value: NewsItem["sentiment"]) {
  const result = numeric(value);
  if (result == null) return "N/D";
  if (result >= 0.2) return `Positivo (${score(result)})`;
  if (result <= -0.2) return `Negativo (${score(result)})`;
  return `Neutro (${score(result)})`;
}
function sentimentColor(value: NewsItem["sentiment"]) {
  const result = numeric(value);
  if (result == null) return "default" as const;
  if (result >= 0.2) return "success" as const;
  if (result <= -0.2) return "error" as const;
  return "default" as const;
}
function scopeLabel(value: NewsItem["asset_scope"]) {
  return { PORTFOLIO: "Portafoglio", WATCHLIST: "Watchlist", BOTH: "Entrambi", GLOBAL: "Globale" }[value];
}

export default function NewsPage() {
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const [scope, setScope] = useState<NewsScope>("MY_ASSETS");
  const [dateFrom, setDateFrom] = useState(dateInput(from));
  const [dateTo, setDateTo] = useState(dateInput(new Date()));
  const [source, setSource] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [impactMin, setImpactMin] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<NewsItem | null>(null);

  const filters = useMemo(() => {
    const sentimentFilter = sentiment === "POSITIVE"
      ? { sentiment_min: 0.2 }
      : sentiment === "NEGATIVE"
        ? { sentiment_max: -0.2 }
        : sentiment === "NEUTRAL"
          ? { sentiment_min: -0.2, sentiment_max: 0.2 }
          : {};
    return {
      scope,
      date_from: startOfDay(dateFrom),
      date_to: endOfDay(dateTo),
      source: source || undefined,
      impact_min: impactMin ? Number(impactMin) : undefined,
      query: query.trim() || undefined,
      limit: 1000,
      ...sentimentFilter,
    };
  }, [scope, dateFrom, dateTo, source, sentiment, impactMin, query]);

  const newsQuery = useQuery({ queryKey: ["news", filters], queryFn: () => getNews(filters) });
  const facetsQuery = useQuery({ queryKey: ["news-facets", scope], queryFn: () => getNewsFacets(scope) });
  const data = newsQuery.data ?? [];
  const positiveCount = data.filter((item) => (numeric(item.sentiment) ?? 0) >= 0.2).length;
  const negativeCount = data.filter((item) => (numeric(item.sentiment) ?? 0) <= -0.2).length;

  const columns: GridColDef<NewsItem>[] = [
    { field: "published_at", headerName: "Pubblicata", width: 175, renderCell: ({ row }) => formatDate(row.published_at) },
    { field: "source", headerName: "Fonte", width: 140 },
    { field: "title", headerName: "Titolo", minWidth: 310, flex: 1.5 },
    {
      field: "symbols", headerName: "Simboli", minWidth: 150, flex: 0.7,
      valueGetter: (_, row) => row.symbols.map((item) => item.symbol).join(", "),
    },
    {
      field: "sentiment", headerName: "Sentiment", width: 155,
      renderCell: ({ row }) => <Chip size="small" color={sentimentColor(row.sentiment)} label={sentimentLabel(row.sentiment)} />,
    },
    { field: "impact", headerName: "Impatto", type: "number", width: 100, align: "right", headerAlign: "right", renderCell: ({ row }) => score(row.impact) },
    { field: "relevance", headerName: "Rilevanza", type: "number", width: 110, align: "right", headerAlign: "right", renderCell: ({ row }) => score(row.relevance) },
    { field: "asset_scope", headerName: "Ambito", width: 125, valueGetter: (_, row) => scopeLabel(row.asset_scope) },
  ];

  return (
    <Box sx={{ py: 1 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between", mb: 2 }}>
        <Box>
          <Typography variant="h4">News</Typography>
          <Typography color="text.secondary">Notizie associate alle entità presenti nei portafogli e nelle watchlist.</Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void newsQuery.refetch()}>Aggiorna</Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
          <TextField select size="small" label="Ambito" value={scope} sx={{ minWidth: 180 }} onChange={(event) => setScope(event.target.value as NewsScope)}>
            <MenuItem value="MY_ASSETS">I miei asset</MenuItem><MenuItem value="PORTFOLIO">Portafogli</MenuItem><MenuItem value="WATCHLIST">Watchlist</MenuItem><MenuItem value="ALL">Tutte le news</MenuItem>
          </TextField>
          <TextField size="small" type="date" label="Dal" value={dateFrom} slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => setDateFrom(event.target.value)} />
          <TextField size="small" type="date" label="Al" value={dateTo} slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => setDateTo(event.target.value)} />
          <TextField select size="small" label="Fonte" value={source} sx={{ minWidth: 150 }} onChange={(event) => setSource(event.target.value)}>
            <MenuItem value="">Tutte</MenuItem>{(facetsQuery.data?.sources ?? []).map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Sentiment" value={sentiment} sx={{ minWidth: 145 }} onChange={(event) => setSentiment(event.target.value)}>
            <MenuItem value="">Tutti</MenuItem><MenuItem value="POSITIVE">Positivo</MenuItem><MenuItem value="NEUTRAL">Neutro</MenuItem><MenuItem value="NEGATIVE">Negativo</MenuItem>
          </TextField>
          <TextField size="small" type="number" label="Impatto minimo" value={impactMin} sx={{ width: 145 }} onChange={(event) => setImpactMin(event.target.value)} />
          <TextField size="small" label="Cerca" placeholder="Titolo, entità, simbolo o fonte" value={query} sx={{ minWidth: 260, flex: 1 }} onChange={(event) => setQuery(event.target.value)} />
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        <Chip label={`${data.length} news`} /><Chip color="success" label={`${positiveCount} positive`} /><Chip color="error" label={`${negativeCount} negative`} />
      </Stack>
      {newsQuery.isError && <Alert severity="error" sx={{ mb: 2 }}>Impossibile caricare le news. Verifica migrazione SQL e route backend.</Alert>}
      <Paper variant="outlined" sx={{ height: 660 }}>
        <DataGrid rows={data} columns={columns} loading={newsQuery.isLoading} getRowId={(row) => row.news_id} onRowClick={(params) => setSelected(params.row)} initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } }, sorting: { sortModel: [{ field: "published_at", sort: "desc" }] } }} pageSizeOptions={[25, 50, 100]} disableRowSelectionOnClick />
      </Paper>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="md">
        <DialogTitle>{selected?.title ?? "Dettaglio news"}</DialogTitle>
        <DialogContent dividers>
          {selected && <Stack spacing={2}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              <Chip label={selected.source ?? "Fonte non disponibile"} /><Chip color={sentimentColor(selected.sentiment)} label={sentimentLabel(selected.sentiment)} /><Chip label={scopeLabel(selected.asset_scope)} />
              {selected.symbols.map((item) => <Chip key={`${item.symbol}-${item.exchange ?? ""}`} variant="outlined" label={item.exchange ? `${item.symbol} · ${item.exchange}` : item.symbol} />)}
            </Stack>
            <Typography><strong>Pubblicata:</strong> {formatDate(selected.published_at)}</Typography>
            <Typography>{selected.summary ?? "Nessun riepilogo disponibile."}</Typography>
            <Divider />
            <Typography><strong>Rilevanza:</strong> {score(selected.relevance)} · <strong>Impatto:</strong> {score(selected.impact)} · <strong>Confidenza:</strong> {score(selected.confidence)}</Typography>
            {selected.url && <Link href={selected.url} target="_blank" rel="noopener noreferrer" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}><LaunchIcon fontSize="small" />Apri la fonte originale</Link>}
            <Box component="pre" sx={{ m: 0, p: 2, bgcolor: "action.hover", borderRadius: 1, overflow: "auto", maxHeight: 280, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(selected.raw_json ?? {}, null, 2)}</Box>
          </Stack>}
        </DialogContent>
        <DialogActions><Button onClick={() => setSelected(null)}>Chiudi</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
