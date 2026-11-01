import { Link as RouterLink } from "react-router-dom";
import { Chip, IconButton, Link, Stack, Tooltip, Typography } from "@mui/material";
import FiberNewIcon from "@mui/icons-material/FiberNew";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { GridColDef } from "@mui/x-data-grid";
import type { PortfolioMatchType, ScreenerOpportunity } from "../types/marketScreener";
import { formatTimestamp } from "../services/timestamps";

export const screenerOpportunityInitialState = {
  columns: { columnVisibilityModel: {
    ranking_position: false,
    entity_name: true, direction: false, origin: false, portfolio_match_type: false,
    attention_score: false, technical_score: false, quant_score: false,
  } },
  pagination: { paginationModel: { pageSize: 25, page: 0 } },
  sorting: { sortModel: [{ field: "ranking_position", sort: "asc" as const }] },
};

export function score(value: number | null) {
  return value === null ? "–" : Number(value).toFixed(1);
}

export function matchLabel(matchType: PortfolioMatchType) {
  return {
    EXACT_INSTRUMENT: "Strumento posseduto", SAME_ISIN: "Stesso ISIN",
    SAME_ENTITY: "Stessa entità", NO_MATCH: "Nessun match",
  }[matchType];
}

export function matchColor(matchType: PortfolioMatchType) {
  if (matchType === "EXACT_INSTRUMENT") return "success" as const;
  if (matchType === "SAME_ISIN") return "primary" as const;
  if (matchType === "SAME_ENTITY") return "info" as const;
  return "default" as const;
}

export function directionColor(direction: string) {
  return direction === "LONG" ? "success" : direction === "SHORT" ? "error" : "default";
}

export function originColor(origin: string) {
  return origin === "CORE" ? "primary" : origin === "DISCOVERY" ? "secondary" : "default";
}

export function verdictColor(verdict: string | null) {
  return verdict === "CONFIRM" ? "success" : verdict === "REVIEW" ? "warning" : verdict === "REJECT" ? "error" : "default";
}

export function verdictLabel(verdict: string | null) {
  return verdict === "CONFIRM" ? "Confermato" : verdict === "REVIEW" ? "Da valutare"
    : verdict === "REJECT" ? "Non confermato" : verdict ?? "Non disponibile";
}

export function scoreColor(value: number | null) {
  const numeric = value === null ? null : Number(value);
  if (numeric === null || !Number.isFinite(numeric)) return "text.secondary";
  if (numeric >= 70) return "success.main";
  if (numeric >= 40) return "warning.main";
  return "error.main";
}

export function screenerOpportunityColumns(
  onOpen: (row: ScreenerOpportunity) => void,
  newEntries: ReadonlySet<string> = new Set(),
): GridColDef<ScreenerOpportunity>[] {
  return [
    { field: "detail", headerName: "", width: 55, sortable: false, filterable: false, disableExport: true,
      renderCell: ({ row }) => <Tooltip title={`Apri analisi di ${row.source_symbol}`}>
        <IconButton aria-label={`Apri analisi di ${row.source_symbol}`} size="small"
          onClick={event => { event.stopPropagation(); onOpen(row); }}><OpenInNewIcon fontSize="small" /></IconButton>
      </Tooltip> },
    { field: "ranking_position", headerName: "Classifica", hideable: false, disableExport: true },
    { field: "last_analysis_at", headerName: "Ultima analisi", width: 185, type: "dateTime",
      valueGetter: value => value ? new Date(value) : null,
      valueFormatter: (value: Date | null) => formatTimestamp(value) },
    { field: "source_symbol", headerName: "Simbolo", width: 135,
      renderCell: ({ row }) => <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", height: "100%" }}>
        <span>{row.source_symbol}</span>
        {newEntries.has(`${row.source_instrument_id}:${row.signal_timeframe ?? ""}:${row.signal_id}`) &&
          <Tooltip title="New entry nell'ultima scansione completa"><FiberNewIcon color="success" fontSize="small" aria-label="New entry" /></Tooltip>}
      </Stack> },
    { field: "entity_name", headerName: "Entità", minWidth: 210, flex: 1,
      renderCell: ({ row }) => <Link component={RouterLink} to={`/entities/${row.entity_id}`} onClick={event => event.stopPropagation()}>{row.entity_name}</Link> },
    { field: "signal_type", headerName: "Segnale", minWidth: 165,
      renderCell: ({ row }) => <Chip size="small" color={row.signal_type === "BUY" || row.signal_type === "STRONG_BUY" ? "success" : row.signal_type === "SELL" || row.signal_type === "STRONG_SELL" ? "error" : "default"} label={`${row.signal_type ?? "N/D"} · ${row.strategy_code ?? "N/D"}`} /> },
    { field: "direction", headerName: "Direzione", width: 105,
      renderCell: ({ row }) => <Chip size="small" color={directionColor(row.direction)} label={row.direction} /> },
    { field: "origin", headerName: "Origine", width: 105,
      renderCell: ({ row }) => <Chip size="small" color={originColor(row.origin)} label={row.origin} /> },
    { field: "consensus_direction", headerName: "Consenso", width: 125,
      renderCell: ({ row }) => <Chip size="small" color={row.consensus_direction === "LONG" ? "success" : row.consensus_direction === "SHORT" ? "error" : row.consensus_direction === "CONFLICT" ? "warning" : "default"} label={`${row.consensus_direction} · ${row.strategy_count}`} /> },
    { field: "portfolio_match_type", headerName: "Portafoglio", minWidth: 190,
      renderCell: ({ row }) => row.portfolio_match ? <Chip size="small" color={matchColor(row.portfolio_match_type)} label={`${matchLabel(row.portfolio_match_type)} · ${row.portfolio_symbols.join(", ")}`} /> : <Typography color="text.secondary">–</Typography> },
    ...([
      ["attention_score", "Attention", 105], ["technical_score", "Technical", 105],
      ["quant_score", "Quant", 90], ["llm_score", "Score AI", 80], ["composite_score", "Score totale", 110],
    ] as const).map(([field, headerName, width]): GridColDef<ScreenerOpportunity> => ({
      field, headerName, width,
      renderCell: ({ row }) => <Typography sx={{ color: scoreColor(row[field]), fontWeight: field === "composite_score" ? 700 : 600 }}>{score(row[field])}</Typography>,
    })),
    { field: "verdict", headerName: "Valutazione", width: 150,
      renderCell: ({ row }) => <Chip size="small" color={verdictColor(row.verdict)} label={verdictLabel(row.verdict)} /> },
    { field: "summary", headerName: "Sintesi AI", minWidth: 250, flex: 1,
      renderCell: ({ row }) => <Tooltip title={row.summary ?? "Sintesi AI non disponibile"}>
        <Typography variant="body2" noWrap sx={{ alignSelf: "center", minWidth: 0 }}>{row.summary || (row.llm_score === null ? "Non analizzato con AI" : "Sintesi non disponibile")}</Typography>
      </Tooltip> },
  ];
}