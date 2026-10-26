import { useMemo, useState } from "react";

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
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";

import {
  getScreenerOpportunities,
  getScreenerOpportunity,
} from "../services/marketScreener";
import type {
  PortfolioMatchType,
  ScreenerOpportunity,
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
  const [portfolioFilter, setPortfolioFilter] = useState("ALL");
  const [minimumScore, setMinimumScore] = useState("0");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      algorithm_version: "market-screener-v1",
      origin: origin || undefined,
      direction: direction || undefined,
      verdict: verdict || undefined,
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
    [origin, direction, verdict, portfolioFilter, minimumScore, query],
  );

  const opportunitiesQuery = useQuery({
    queryKey: ["market-screener", filters],
    queryFn: () => getScreenerOpportunities(filters),
  });

  const detailQuery = useQuery({
    queryKey: ["market-screener-detail", selectedId],
    queryFn: () => getScreenerOpportunity(selectedId ?? ""),
    enabled: Boolean(selectedId),
  });

  const rows = opportunitiesQuery.data ?? [];
  const portfolioCount = rows.filter((row) => row.portfolio_match).length;

  const columns: GridColDef<ScreenerOpportunity>[] = [
    { field: "ranking_position", headerName: "#", width: 60 },
    {
      field: "source_symbol",
      headerName: "Simbolo",
      width: 105,
    },
    {
      field: "entity_name",
      headerName: "Entità",
      minWidth: 210,
      flex: 1,
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

  return (
    <Box sx={{ py: 1 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", mb: 2 }}
      >
        <Box>
          <Typography variant="h4">Screener</Typography>
          <Typography color="text.secondary">
            Opportunità associate all&apos;entità, con match sulle posizioni personali.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => void opportunitiesQuery.refetch()}
        >
          Aggiorna
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
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
          <TextField
            size="small"
            label="Cerca"
            placeholder="Entità, simbolo, ISIN o ticker posseduto"
            value={query}
            sx={{ minWidth: 260, flex: 1 }}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        <Chip label={`${rows.length} opportunità`} />
        <Chip color="primary" label={`${portfolioCount} collegate al portafoglio`} />
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
          loading={opportunitiesQuery.isLoading}
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
    </Box>
  );
}
