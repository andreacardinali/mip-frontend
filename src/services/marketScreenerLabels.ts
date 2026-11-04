const signalTypeLabels: Record<string, string> = {
  STRONG_BUY: "Acquisto forte",
  BUY: "Acquisto",
  HOLD: "Mantieni",
  NEUTRAL: "Neutrale",
  SELL: "Vendita",
  STRONG_SELL: "Vendita forte",
};

const strategyLabels: Record<string, string> = {
  TREND_PULLBACK: "Ritracciamento nel trend",
  SUPERTREND: "Supertrend",
  PULLBACK_DEEP_OVERSOLD: "Rimbalzo da ipervenduto",
  SMC_CHOCH: "Cambio della struttura (CHoCH)",
  SMC_BOS: "Rottura della struttura (BoS)",
  CALL_ENTRY_SETUP: "Ingresso su setup rialzista",
  SWING_EXIT: "Uscita da swing rialzista",
};

const directionLabels: Record<string, string> = {
  LONG: "Rialzista",
  SHORT: "Ribassista",
  NEUTRAL: "Neutrale",
};

export const signalDirectionValues = ["STRONG_BUY", "BUY", "NEUTRAL", "SELL", "STRONG_SELL"];

const consensusLabels: Record<string, string> = {
  ...directionLabels,
  CONFLICT: "In conflitto",
};

const trendLabels: Record<string, string> = {
  STRONG_BULLISH: "Fortemente rialzista",
  BULLISH: "Rialzista",
  STRONG_BEARISH: "Fortemente ribassista",
  BEARISH: "Ribassista",
  SIDEWAYS: "Laterale",
};

const verdictLabels: Record<string, string> = {
  CONFIRM: "Confermato dall'AI",
  REVIEW: "Da approfondire",
  REJECT: "Non confermato dall'AI",
};

const originLabels: Record<string, string> = {
  CORE: "Universo monitorato",
  DISCOVERY: "Scoperta",
};

const eventLabels: Record<string, string> = {
  CREATED: "Creato",
  CONFIRMED: "Confermato",
  DIRECTION_CHANGED: "Cambio di direzione",
  CLOSED: "Chiuso",
  EXPIRED: "Scaduto",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Attivo",
  OPEN: "Aperto",
  PENDING: "In attesa",
  CONFIRMED: "Confermato",
  TRIGGERED: "Attivato",
  INVALIDATED: "Invalidato",
  CLOSED: "Chiuso",
  EXPIRED: "Scaduto",
};

function displayCode(value: string | null | undefined, labels: Record<string, string>, fallback: string) {
  if (!value) return fallback;
  return labels[value] ?? value.replaceAll("_", " ").toLocaleLowerCase("it-IT");
}

export function signalTypeLabel(value: string | null | undefined) {
  return displayCode(value, signalTypeLabels, "Segnale N/D");
}

export function strategyLabel(value: string | null | undefined) {
  return displayCode(value, strategyLabels, "Strategia N/D");
}

export function directionLabel(value: string | null | undefined) {
  return displayCode(value, directionLabels, "Direzione N/D");
}

export function consensusLabel(value: string | null | undefined) {
  return displayCode(value, consensusLabels, "Consenso N/D");
}

export function trendLabel(value: string | null | undefined) {
  return displayCode(value, trendLabels, "Trend N/D");
}

export function verdictLabel(value: string | null | undefined) {
  return displayCode(value, verdictLabels, "Non disponibile");
}

export function originLabel(value: string | null | undefined) {
  return displayCode(value, originLabels, "Origine N/D");
}

export function eventLabel(value: string | null | undefined) {
  return displayCode(value, eventLabels, "Evento N/D");
}

export function statusLabel(value: string | null | undefined) {
  return displayCode(value, statusLabels, "Stato N/D");
}