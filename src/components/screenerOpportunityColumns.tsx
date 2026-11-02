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

export function analysisDescription(field: string, value: string | number | null) {
  const values: Record<string, Record<string, string>> = {
    signal_type: {
      BUY: "Segnale tecnico rialzista generato dalla strategia.",
      STRONG_BUY: "Segnale tecnico rialzista classificato come forte dalla strategia, non una garanzia di rendimento.",
      SELL: "Indicazione di vendita della strategia: puo segnalare una fase ribassista oppure un'uscita da un movimento rialzista, come in SWING_EXIT.",
      STRONG_SELL: "Segnale tecnico ribassista classificato come forte dalla strategia, non una garanzia di rendimento.",
      HOLD: "La strategia non indica un nuovo acquisto o una nuova vendita.",
    },
    direction: { LONG: "Orientamento rialzista del segnale.", SHORT: "Orientamento ribassista del segnale.", NEUTRAL: "Nessun orientamento direzionale." },
    strategy_code: {
      TREND_PULLBACK: "Segnale basato su medie mobili a 50 e 200 periodi e RSI, coerente con il trend rilevato.",
      SUPERTREND: "Direzione dell'indicatore Supertrend confermata dal prezzo rispetto alla media a 50 periodi.",
      PULLBACK_DEEP_OVERSOLD: "Possibile recupero da forte ipervenduto: RSI molto basso ed eventuale calo dal massimo richiesto dalla configurazione.",
      SMC_CHOCH: "Change of Character: cambiamento della struttura di mercato con rottura di un livello swing, confermata da order block o fair value gap.",
      SMC_BOS: "Break of Structure: rottura della struttura di mercato oltre un livello swing, confermata da order block o fair value gap.",
      CALL_ENTRY_SETUP: "Ingresso LONG in trend rialzista forte, con RSI in ipervenduto e prezzo sotto la banda di Bollinger inferiore. Non e un contratto di opzione.",
      SWING_EXIT: "Indicazione di uscita LONG in trend rialzista forte, con RSI in ipercomprato e prezzo sopra la banda di Bollinger superiore. SELL non indica qui un ingresso SHORT.",
    },
    origin: {
      CORE: "Candidato appartenente a un universo monitorato.",
      DISCOVERY: "Candidato individuato dalla scansione ma non appartenente a un universo monitorato.",
    },
    signal_trend: {
      STRONG_BULLISH: "Trend fortemente rialzista: prezzo sopra la media a 50 periodi, a sua volta sopra quella a 200.",
      BULLISH: "Trend rialzista: prezzo sopra la media a 200 periodi.",
      STRONG_BEARISH: "Trend fortemente ribassista: prezzo sotto la media a 50 periodi, a sua volta sotto quella a 200.",
      BEARISH: "Trend ribassista: prezzo sotto la media a 200 periodi.",
      SIDEWAYS: "Nessun trend rialzista o ribassista classificato, oppure medie mobili insufficienti.",
    },
    consensus_direction: {
      LONG: "Consenso rialzista tra le strategie sullo stesso strumento e timeframe. Il numero indica le strategie considerate.",
      SHORT: "Consenso ribassista tra le strategie sullo stesso strumento e timeframe. Il numero indica le strategie considerate.",
      CONFLICT: "Le strategie producono indicazioni rialziste e ribassiste contrastanti. Il numero indica le strategie considerate.",
      NEUTRAL: "Nessun consenso direzionale tra le strategie. Il numero indica le strategie considerate.",
    },
    portfolio_match_type: {
      EXACT_INSTRUMENT: "Lo strumento analizzato coincide con uno strumento presente in portafoglio.",
      SAME_ISIN: "Una posizione in portafoglio ha lo stesso ISIN dello strumento analizzato.",
      SAME_ENTITY: "Una posizione in portafoglio appartiene alla stessa entita, ma non coincide con lo strumento o il suo ISIN.",
      NO_MATCH: "Nessuna posizione in portafoglio collegata allo strumento analizzato.",
    },
    verdict: {
      CONFIRM: "L'analisi AI conferma il segnale tecnico; non costituisce una garanzia di risultato.",
      REVIEW: "L'analisi AI richiede una valutazione ulteriore del segnale.",
      REJECT: "L'analisi AI non conferma il segnale tecnico.",
    },
  };
  const descriptions: Record<string, string> = {
    strategy_code: "Strategia tecnica che ha generato il segnale; i motivi e gli indicatori sono riportati nei dati tecnici.",
    origin: "Provenienza del candidato analizzato.",
    signal_trend: "Trend rilevato dagli indicatori tecnici; distinto dalla direzione del singolo segnale.",
    signal_timeframe: "Intervallo temporale delle candele usate per il segnale tecnico.",
    signal_confidence: "Confidenza attribuita al segnale dalla strategia, espressa in percentuale. Non e una probabilita di profitto.",
    attention_score: "Punteggio di attenzione del candidato, su scala 0-100; una componente della classifica.",
    technical_score: "Punteggio tecnico del segnale, su scala 0-100.",
    quant_score: "Punteggio del filtro quantitativo, su scala 0-100.",
    llm_score: "Punteggio attribuito dall'analisi AI, su scala 0-100. Non e una probabilita di rendimento.",
    composite_score: "Punteggio totale 0-100: media pesata delle componenti disponibili, con bonus di consenso e penalita di conflitto quando sono presenti almeno due strategie.",
    ranking_position: "Posizione nella classifica delle opportunita, ordinata per punteggio totale decrescente.",
    source_symbol: "Simbolo e mercato dello strumento su cui e stato calcolato il segnale.",
    source_currency_code: "Valuta dello strumento analizzato e dei suoi prezzi.",
  };
  if (value === null) return `${descriptions[field] ?? "Informazione dell'analisi."} Dato non disponibile.`;
  const specificDescription = values[field]?.[String(value)];
  if (specificDescription) return specificDescription;
  if (values[field]) return `${descriptions[field] ?? ""} Codice ${String(value)}: descrizione non disponibile.`.trim();
  return descriptions[field] ?? `Codice ${String(value)}: descrizione non disponibile.`;
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
      renderHeader: () => <Tooltip describeChild title="Ultima scansione completata che ha effettivamente valutato questo strumento, anche senza nuovi segnali. Non indica l'ultimo tentativo o l'aggiornamento dei prezzi."><Typography tabIndex={0} variant="body2" sx={{ fontWeight: 600 }}>Ultima analisi</Typography></Tooltip>,
      valueGetter: value => value ? new Date(value) : null,
      valueFormatter: (value: Date | null) => value ? formatTimestamp(value) : "Non registrata",
      renderCell: ({ row }) => <Tooltip describeChild title={row.last_analysis_at
        ? "Ultima valutazione tecnica completata dello strumento. L'esito dell'ultimo run del contesto e' riportato sopra la tabella."
        : "Nessuna valutazione tecnica completata registrata per questo strumento. Non indica un errore di caricamento; l'ultimo run potrebbe averlo escluso o non averlo valutato."}>
        <Typography tabIndex={0} variant="body2" sx={{ alignSelf: "center" }}>{row.last_analysis_at ? formatTimestamp(row.last_analysis_at) : "Non registrata"}</Typography>
      </Tooltip> },
    { field: "source_symbol", headerName: "Simbolo", width: 135,
      renderCell: ({ row }) => <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", height: "100%" }}>
        <span>{row.source_symbol}</span>
        {newEntries.has(`${row.source_instrument_id}:${row.signal_timeframe ?? ""}:${row.signal_id}`) &&
          <Tooltip title="New entry nell'ultima scansione completa"><FiberNewIcon color="success" fontSize="small" aria-label="New entry" /></Tooltip>}
      </Stack> },
    { field: "entity_name", headerName: "Entità", minWidth: 210, flex: 1,
      renderCell: ({ row }) => <Link component={RouterLink} to={`/entities/${row.entity_id}`} onClick={event => event.stopPropagation()}>{row.entity_name}</Link> },
    { field: "signal_type", headerName: "Segnale", minWidth: 165,
      renderCell: ({ row }) => <Tooltip describeChild title={`${analysisDescription("signal_type", row.signal_type)} ${analysisDescription("strategy_code", row.strategy_code)}`}><Chip tabIndex={0} size="small" color={row.signal_type === "BUY" || row.signal_type === "STRONG_BUY" ? "success" : row.signal_type === "SELL" || row.signal_type === "STRONG_SELL" ? "error" : "default"} label={`${row.signal_type ?? "N/D"} · ${row.strategy_code ?? "N/D"}`} /></Tooltip> },
    { field: "direction", headerName: "Direzione", width: 105,
      renderCell: ({ row }) => <Tooltip describeChild title={analysisDescription("direction", row.direction)}><Chip tabIndex={0} size="small" color={directionColor(row.direction)} label={row.direction} /></Tooltip> },
    { field: "origin", headerName: "Origine", width: 105,
      renderCell: ({ row }) => <Tooltip describeChild title={analysisDescription("origin", row.origin)}><Chip tabIndex={0} size="small" color={originColor(row.origin)} label={row.origin} /></Tooltip> },
    { field: "consensus_direction", headerName: "Consenso", width: 125,
      renderCell: ({ row }) => <Tooltip describeChild title={analysisDescription("consensus_direction", row.consensus_direction)}><Chip tabIndex={0} size="small" color={row.consensus_direction === "LONG" ? "success" : row.consensus_direction === "SHORT" ? "error" : row.consensus_direction === "CONFLICT" ? "warning" : "default"} label={`${row.consensus_direction} · ${row.strategy_count}`} /></Tooltip> },
    { field: "portfolio_match_type", headerName: "Portafoglio", minWidth: 190,
      renderCell: ({ row }) => <Tooltip describeChild title={analysisDescription("portfolio_match_type", row.portfolio_match_type)}>{row.portfolio_match ? <Chip tabIndex={0} size="small" color={matchColor(row.portfolio_match_type)} label={`${matchLabel(row.portfolio_match_type)} · ${row.portfolio_symbols.join(", ")}`} /> : <Typography tabIndex={0} color="text.secondary">–</Typography>}</Tooltip> },
    ...([
      ["attention_score", "Attention", 105], ["technical_score", "Technical", 105],
      ["quant_score", "Quant", 90], ["llm_score", "Score AI", 80], ["composite_score", "Score totale", 110],
    ] as const).map(([field, headerName, width]): GridColDef<ScreenerOpportunity> => ({
      field, headerName, width,
      renderCell: ({ row }) => <Tooltip describeChild title={analysisDescription(field, row[field])}><Typography tabIndex={0} sx={{ color: scoreColor(row[field]), fontWeight: field === "composite_score" ? 700 : 600 }}>{score(row[field])}</Typography></Tooltip>,
    })),
    { field: "verdict", headerName: "Valutazione", width: 150,
      renderCell: ({ row }) => <Tooltip describeChild title={analysisDescription("verdict", row.verdict)}><Chip tabIndex={0} size="small" color={verdictColor(row.verdict)} label={verdictLabel(row.verdict)} /></Tooltip> },
    { field: "summary", headerName: "Sintesi AI", minWidth: 250, flex: 1,
      renderCell: ({ row }) => <Tooltip title={row.summary ?? "Sintesi AI non disponibile"}>
        <Typography variant="body2" noWrap sx={{ alignSelf: "center", minWidth: 0 }}>{row.summary || (row.llm_score === null ? "Non analizzato con AI" : "Sintesi non disponibile")}</Typography>
      </Tooltip> },
  ];
}