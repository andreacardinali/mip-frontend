import type { AlertColor } from "@mui/material";

type Feedback = { id: number; message: string; severity: AlertColor };
type TrackedJob = { runId: string; jobKey: string };
let feedback: Feedback | null = null;
let sequence = 0;
const pendingFeedback: Feedback[] = [];
const listeners = new Set<() => void>();
const jobs = new Map<string, TrackedJob>();
const reportedErrors = new WeakSet<object>();

export function subscribeFeedback(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getFeedback() { return feedback; }

export function notifyOperation(message: string, severity: AlertColor = "info") {
  const next = { id: ++sequence, message, severity };
  if (feedback) pendingFeedback.push(next);
  else feedback = next;
  listeners.forEach(listener => listener());
}

export function notifyOperationError(error: unknown, message: string) {
  if (error && typeof error === "object") {
    if (reportedErrors.has(error)) return;
    reportedErrors.add(error);
  }
  notifyOperation(message, "error");
}

export function dismissFeedback(id: number) {
  if (feedback?.id !== id) return;
  feedback = pendingFeedback.shift() ?? null;
  listeners.forEach(listener => listener());
}

export function trackJob(runId: string, jobKey: string) {
  jobs.set(runId, { runId, jobKey });
}

export function getTrackedJobs() { return [...jobs.values()]; }
export function untrackJob(runId: string) { jobs.delete(runId); }

export function operationLabel(url: string, method: string) {
  if (url === "/screener/analyze") return "Analisi screener";
  if (url === "/market-data/prices/refresh") return "Aggiornamento prezzi";
  if (url.endsWith("/test")) return "Invio messaggio di prova";
  if (url.startsWith("/admin/system/scheduler/jobs/")) {
    const jobKey = decodeURIComponent(url.split("/")[5]);
    return url.endsWith("/run") ? `Job ${jobKey}` : `Aggiornamento job ${jobKey}`;
  }
  const scope = url.startsWith("/notification-preferences") ? "preferenze di notifica"
    : url.startsWith("/auth") ? "account"
    : url.startsWith("/alerts") ? "regola di alert"
    : url.includes("positions") ? "posizione"
    : url.includes("items") ? "strumento watchlist"
    : url.startsWith("/portfolios") ? "portafoglio"
    : url.startsWith("/watchlists") ? "watchlist"
    : url.startsWith("/imports") ? "strumento"
    : "dati";
  return `${method === "delete" ? "Eliminazione" : "Salvataggio"} ${scope}`;
}