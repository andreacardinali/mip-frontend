import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import HistoryIcon from "@mui/icons-material/History";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem,
  Stack, Switch, TextField, Tooltip, Typography,
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useAuth } from "../contexts/AuthProvider";
import { deleteAlertRule, getAlertEvents, getAlertRules, saveAlertRule, setAlertRuleEnabled } from "../services/alerts";
import { getWatchlists } from "../services/watchlists";
import { getPortfolios } from "../services/portfolios";
import InstrumentAlertOverrides from "./InstrumentAlertOverrides";
import type { AlertConditions, AlertRule, AlertRulePayload } from "../services/alerts";

const alertTypes = {
  MARKET_SIGNAL: "Segnale di mercato", FIXED_PRICE: "Soglia di prezzo",
  PERCENT_MOVE: "Variazione percentuale", SIGNAL_CHANGE: "Cambio del segnale",
};
const scopes = {
  SCREENER: "Screener", WATCHLIST: "Watchlist", PORTFOLIO: "Portafoglio", ALL: "Tutti gli ambiti",
};
const historyPageSize = 25;
const lifecycleEvents = {
  CREATED: "Creato", CONFIRMED: "Confermato", DIRECTION_CHANGED: "Cambio direzione",
  CLOSED: "Chiuso", EXPIRED: "Scaduto",
};
const notificationStatuses: Record<string, string> = {
  PENDING: "In coda", PROCESSING: "In invio", RETRY: "Nuovo tentativo",
  SENT: "Inviata", FAILED: "Invio fallito",
};
const notificationSkipReasons: Record<string, string> = {
  DISABLED: "Notifiche disabilitate",
  PREFERENCE_DISABLED: "Disabilitata nelle preferenze",
  SOURCE_NOT_FOUND: "Nessuna destinazione disponibile",
  DUPLICATE: "Notifica duplicata",
};

function formatTimestamp(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("it-IT");
}

function formatNumber(value?: number | null) {
  return value != null && Number.isFinite(value)
    ? value.toLocaleString("it-IT", { maximumFractionDigits: 6 }) : "-";
}

function emptyRule(): AlertRulePayload {
  return {
    alert_type: "MARKET_SIGNAL",
    name: "", severity: "MEDIUM", channel: null, cooldown_minutes: 240, enabled: true,
    conditions: {
      scope: "SCREENER", max_age_minutes: 60,
      symbols: [], excluded_symbols: [], directions: [], verdicts: [], origins: [], strategy_codes: [],
      min_composite_score: 0.75, min_consensus_score: 0, max_conflict_score: 1,
      min_strategy_count: 1,
      regular_session_only: false, crossing_only: true, once_per_session: true,
      notification_mode: "IMMEDIATE", event_types: [], instrument_overrides: {},
    },
  };
}

const filters = [
  ["symbols", "Simboli"], ["excluded_symbols", "Simboli esclusi"],
  ["directions", "Direzioni"], ["verdicts", "Verdetti"],
  ["origins", "Origini"], ["strategy_codes", "Strategie di supporto"],
] as const;
const thresholds = [
  ["min_composite_score", "Score composito minimo", 0, 1, 0.01],
  ["min_consensus_score", "Consenso minimo", 0, 1, 0.01],
  ["max_conflict_score", "Conflitto massimo", 0, 1, 0.01],
  ["min_strategy_count", "Numero minimo di strategie", 1, 2147483647, 1],
] as const;

type AlertRuleSettingsProps = {
  context?: { scope: "SCREENER" } | { scope: "WATCHLIST" | "PORTFOLIO"; scopeId: string };
};

export default function AlertRuleSettings({ context }: AlertRuleSettingsProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["alert-rules", user?.user_id];
  const rules = useQuery({ queryKey, queryFn: getAlertRules, enabled: !!user });
  const visibleRules = rules.data?.filter(rule => !context || (
    (rule.conditions.scope ?? "SCREENER") === context.scope &&
    (context.scope === "SCREENER" || rule.conditions.scope_id === context.scopeId)
  ));
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState<AlertRulePayload>(emptyRule);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [deletingRule, setDeletingRule] = useState<AlertRule | null>(null);
  const [historyRule, setHistoryRule] = useState<AlertRule | null>(null);
  const [historyOffset, setHistoryOffset] = useState(0);
  const history = useQuery({
    queryKey: ["alert-events", user?.user_id, historyRule?.rule_id, historyOffset],
    queryFn: () => getAlertEvents(historyRule?.rule_id ?? "", historyPageSize + 1, historyOffset),
    enabled: !!user && !!historyRule,
  });
  const priceRule = form.alert_type === "FIXED_PRICE" || form.alert_type === "PERCENT_MOVE";
  const collections = useQuery({
    queryKey: ["alert-collections", user?.user_id, form.conditions.scope],
    enabled: !!user && open && (form.conditions.scope === "WATCHLIST" || form.conditions.scope === "PORTFOLIO"),
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      if (form.conditions.scope === "WATCHLIST") {
        const rows: { watchlist_id: string; name: string }[] = await getWatchlists();
        return rows.map(row => ({ id: row.watchlist_id, name: row.name }));
      }
      return (await getPortfolios()).map(row => ({ id: row.portfolio_id, name: row.name }));
    },
  });

  function edit(rule?: AlertRule) {
    const defaults = emptyRule();
    if (context) {
      defaults.conditions.scope = context.scope;
      if (context.scope !== "SCREENER") defaults.conditions.scope_id = context.scopeId;
    }
    setForm(rule ? {
      alert_type: rule.alert_type,
      name: rule.name, severity: rule.severity, channel: rule.channel,
      cooldown_minutes: rule.cooldown_minutes, enabled: rule.enabled,
      conditions: {
        ...defaults.conditions, ...rule.conditions,
        crossing_only: rule.conditions.crossing_only ?? false,
        once_per_session: rule.conditions.once_per_session ?? false,
      },
    } : defaults);
    setEditingId(rule?.rule_id);
    setError(null);
    setSaved(false);
    setOpen(true);
  }

  function condition<Key extends keyof AlertConditions>(key: Key, value: AlertConditions[Key]) {
    setForm(previous => ({ ...previous, conditions: { ...previous.conditions, [key]: value } }));
  }

  function changeType(alert_type: AlertRulePayload["alert_type"]) {
    setForm(previous => {
      const conditions = { ...previous.conditions };
      delete conditions.threshold;
      delete conditions.price_direction;
      conditions.instrument_overrides = Object.fromEntries(Object.entries(conditions.instrument_overrides).map(([id, value]) => {
        const override = { ...value };
        delete override.threshold;
        delete override.price_direction;
        return [id, override];
      }));
      if (alert_type === "FIXED_PRICE" || alert_type === "PERCENT_MOVE") {
        conditions.threshold = NaN;
        conditions.price_direction = alert_type === "PERCENT_MOVE" ? "ANY" : "UP";
      }
      return { ...previous, alert_type, conditions };
    });
  }

  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveAlertRule(form, editingId);
      setOpen(false);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey });
    } catch (saveError) {
      const detail = isAxiosError(saveError) ? saveError.response?.data?.detail : null;
      setError(typeof detail === "string" ? detail : "Impossibile salvare la regola.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRule(rule: AlertRule, enabled: boolean) {
    setActionBusy(true);
    setActionError(null);
    setActionMessage(null);
    setSaved(false);
    try {
      await setAlertRuleEnabled(rule.rule_id, enabled);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<AlertRule[]>(queryKey, previous => previous?.map(item =>
        item.rule_id === rule.rule_id ? { ...item, enabled } : item));
      setActionMessage(enabled ? "Regola attivata." : "Regola disattivata.");
      await queryClient.invalidateQueries({ queryKey });
    } catch (actionFailure) {
      const detail = isAxiosError(actionFailure) ? actionFailure.response?.data?.detail : null;
      setActionError(typeof detail === "string" ? detail : "Impossibile aggiornare lo stato della regola.");
    } finally {
      setActionBusy(false);
    }
  }

  async function removeRule() {
    if (!deletingRule) return;
    setActionBusy(true);
    setActionError(null);
    setActionMessage(null);
    setSaved(false);
    try {
      await deleteAlertRule(deletingRule.rule_id);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<AlertRule[]>(queryKey, previous =>
        previous?.filter(rule => rule.rule_id !== deletingRule.rule_id));
      queryClient.removeQueries({ queryKey: ["alert-events", user?.user_id, deletingRule.rule_id] });
      if (historyRule?.rule_id === deletingRule.rule_id) setHistoryRule(null);
      setDeletingRule(null);
      setActionMessage("Regola eliminata.");
      await queryClient.invalidateQueries({ queryKey });
    } catch (actionFailure) {
      const detail = isAxiosError(actionFailure) ? actionFailure.response?.data?.detail : null;
      setActionError(typeof detail === "string" ? detail : "Impossibile eliminare la regola.");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <Box sx={{ borderTop: 1, borderColor: "divider", pt: 3 }}>
      <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6">Alert di mercato</Typography>
        <Button startIcon={<AddIcon />} onClick={() => edit()} disabled={actionBusy || rules.isPending || rules.isError}>
          Nuova regola
        </Button>
      </Stack>
      {saved && <Alert severity="success" sx={{ mb: 2 }}>Regola salvata.</Alert>}
      {actionMessage && <Alert severity="success" sx={{ mb: 2 }}>{actionMessage}</Alert>}
      {actionError && !deletingRule && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
      {rules.isPending && <CircularProgress size={24} aria-label="Caricamento regole" />}
      {rules.isError && (
        <Alert severity="error" action={
          <Tooltip title="Riprova"><IconButton onClick={() => void rules.refetch()} aria-label="Riprova"><RefreshIcon /></IconButton></Tooltip>
        }>Impossibile caricare le regole di alert.</Alert>
      )}
      {rules.isSuccess && !visibleRules?.length && <Typography color="text.secondary">Nessuna regola.</Typography>}
      {visibleRules?.map(rule => (
        <Stack key={rule.rule_id} direction={{ xs: "column", sm: "row" }} spacing={1}
          sx={{ py: 1.5, borderBottom: 1, borderColor: "divider", minWidth: 0, alignItems: { xs: "stretch", sm: "center" } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ overflowWrap: "anywhere" }}>{rule.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
              {rule.enabled ? "Attiva" : "Disattivata"} · {alertTypes[rule.alert_type]} · {scopes[rule.conditions.scope ?? "SCREENER"]} · {rule.severity} · {rule.cooldown_minutes} min
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", justifyContent: "flex-end", flexShrink: 0 }}>
            <Tooltip title={rule.enabled ? "Disattiva regola" : "Attiva regola"}><span>
              <Switch checked={rule.enabled} disabled={actionBusy || rules.isFetching}
                slotProps={{ input: { "aria-label": `Attiva ${rule.name}` } }}
                onChange={(_, enabled) => void toggleRule(rule, enabled)} />
            </span></Tooltip>
            <Tooltip title="Storico alert">
              <IconButton aria-label={`Storico ${rule.name}`} onClick={() => {
                setHistoryOffset(0);
                setHistoryRule(rule);
              }}><HistoryIcon /></IconButton>
            </Tooltip>
            <Tooltip title="Modifica regola"><span>
              <IconButton disabled={actionBusy || rules.isFetching} aria-label={`Modifica ${rule.name}`} onClick={() => edit(rule)}><EditIcon /></IconButton>
            </span></Tooltip>
            <Tooltip title="Elimina regola"><span>
              <IconButton disabled={actionBusy || rules.isFetching} aria-label={`Elimina ${rule.name}`} onClick={() => {
                setActionError(null);
                setActionMessage(null);
                setSaved(false);
                setDeletingRule(rule);
              }}><DeleteIcon /></IconButton>
            </span></Tooltip>
          </Stack>
        </Stack>
      ))}
      <Dialog open={!!deletingRule && !!user} onClose={() => { if (!actionBusy) setDeletingRule(null); }} fullWidth maxWidth="xs">
        <DialogTitle>Elimina regola</DialogTitle>
        <DialogContent>
          {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
          <Typography sx={{ overflowWrap: "anywhere" }}>Eliminare la regola "{deletingRule?.name}" e tutto il suo storico?</Typography>
          <Typography sx={{ mt: 1 }}>L&apos;operazione non puo essere annullata.</Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={actionBusy} onClick={() => setDeletingRule(null)}>Annulla</Button>
          <Button color="error" variant="contained" disabled={actionBusy} onClick={() => void removeRule()}
            startIcon={actionBusy ? <CircularProgress size={16} /> : <DeleteIcon />}>Elimina</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!historyRule && !!user} onClose={() => setHistoryRule(null)} fullWidth maxWidth="md">
        <DialogTitle sx={{ overflowWrap: "anywhere" }}>Storico alert: {historyRule?.name}</DialogTitle>
        <DialogContent>
          <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 1 }}>
            <Tooltip title="Aggiorna storico">
              <IconButton aria-label="Aggiorna storico" disabled={history.isFetching} onClick={() => {
                if (historyOffset === 0) void history.refetch();
                else setHistoryOffset(0);
              }}><RefreshIcon /></IconButton>
            </Tooltip>
          </Stack>
          {history.isPending && <CircularProgress size={24} aria-label="Caricamento storico" />}
          {history.isError && <Alert severity="error" action={
            <IconButton aria-label="Riprova storico" onClick={() => void history.refetch()}><RefreshIcon /></IconButton>
          }>Impossibile caricare lo storico degli alert.</Alert>}
          {history.isSuccess && !history.data.length && (
            <Typography color="text.secondary">Nessun evento registrato in questa pagina.</Typography>
          )}
          {history.isSuccess && history.data.slice(0, historyPageSize).map(event => {
            const payload = event.payload;
            const type = payload.alert_type ?? "MARKET_SIGNAL";
            const priceEvent = type === "FIXED_PRICE" || type === "PERCENT_MOVE";
            const change = payload.last_price != null && payload.reference_price != null && payload.reference_price > 0
              ? (payload.last_price / payload.reference_price - 1) * 100 : null;
            return (
              <Box key={event.alert_event_id} sx={{ py: 2, borderBottom: 1, borderColor: "divider", overflowWrap: "anywhere" }}>
                <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap", alignItems: "center", mb: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>{payload.symbol ?? "-"}</Typography>
                  <Typography variant="body2" color="text.secondary">{formatTimestamp(event.created_at)}</Typography>
                  <Chip size="small" label={event.notification_status
                    ? notificationStatuses[event.notification_status] ?? event.notification_status
                    : event.notification_id ? "Stato non disponibile" : "Non accodata"}
                    color={event.notification_status === "SENT" ? "success" : event.notification_status === "FAILED" ? "error" : "default"} />
                </Stack>
                {!event.notification_id && event.notification_skip_reason && <Typography variant="body2" color="text.secondary">
                  {notificationSkipReasons[event.notification_skip_reason] ?? event.notification_skip_reason}
                </Typography>}
                <Typography variant="body2" color="text.secondary">
                  {payload.rule_name ?? "-"} · {alertTypes[type]} · {scopes[payload.scope ?? "SCREENER"]}
                </Typography>
                {priceEvent ? <>
                  <Typography variant="body2">Prezzo: {formatNumber(payload.last_price)}</Typography>
                  {type === "PERCENT_MOVE" && <Typography variant="body2">
                    Riferimento: {formatNumber(payload.reference_price)} · Variazione: {formatNumber(change)}%
                  </Typography>}
                  {payload.reference_at && <Typography variant="body2" color="text.secondary">
                    Riferimento del {formatTimestamp(payload.reference_at)}
                  </Typography>}
                </> : <>
                  <Typography variant="body2">{[payload.event_type, payload.direction, payload.verdict].filter(Boolean).join(" · ") || "-"}</Typography>
                  {type === "MARKET_SIGNAL" && <Typography variant="body2">
                    Score: {formatNumber(payload.composite_score)} · Consenso: {formatNumber(payload.consensus_score)}
                  </Typography>}
                  {!!payload.strategy_codes?.length && <Typography variant="body2">Strategie: {payload.strategy_codes.join(", ")}</Typography>}
                </>}
                {payload.observed_at && <Typography variant="body2" color="text.secondary">Osservato: {formatTimestamp(payload.observed_at)}</Typography>}
                {event.sent_at && <Typography variant="body2" color="text.secondary">Inviata: {formatTimestamp(event.sent_at)}</Typography>}
                {!priceEvent && payload.summary && <Typography variant="body2" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>{payload.summary}</Typography>}
              </Box>
            );
          })}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Tooltip title="Pagina precedente"><span>
              <IconButton aria-label="Pagina precedente" disabled={historyOffset === 0 || history.isFetching}
                onClick={() => setHistoryOffset(previous => Math.max(0, previous - historyPageSize))}><ChevronLeftIcon /></IconButton>
            </span></Tooltip>
            <Typography variant="body2">Pagina {Math.floor(historyOffset / historyPageSize) + 1}</Typography>
            <Tooltip title="Pagina successiva"><span>
              <IconButton aria-label="Pagina successiva" disabled={!history.isSuccess || history.isFetching || history.data.length <= historyPageSize || historyOffset >= 100000}
                onClick={() => setHistoryOffset(previous => previous + historyPageSize)}><ChevronRightIcon /></IconButton>
            </span></Tooltip>
          </Stack>
          <Button onClick={() => setHistoryRule(null)}>Chiudi</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={open} onClose={() => { if (!busy) setOpen(false); }} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={save}>
          <DialogTitle>{editingId ? "Modifica regola" : "Nuova regola"}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField required fullWidth label="Nome" value={form.name} disabled={busy}
                slotProps={{ htmlInput: { maxLength: 160, pattern: ".*\\S.*" } }}
                onChange={event => setForm({ ...form, name: event.target.value })} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField select fullWidth label="Tipo di alert" value={form.alert_type} disabled={busy}
                  onChange={event => changeType(event.target.value as AlertRulePayload["alert_type"])}>
                  {Object.entries(alertTypes).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                </TextField>
                <TextField select fullWidth label="Ambito" value={form.conditions.scope} disabled={busy || !!context}
                  onChange={event => setForm(previous => ({ ...previous, conditions: {
                    ...previous.conditions, scope: event.target.value as AlertConditions["scope"], scope_id: undefined,
                  } }))}>
                  {Object.entries(scopes).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                </TextField>
              </Stack>
              {(form.conditions.scope === "WATCHLIST" || form.conditions.scope === "PORTFOLIO") && (
                <TextField select fullWidth label="Collezione" value={form.conditions.scope_id ?? ""}
                  disabled={busy || !!context || collections.isPending || collections.isError}
                  onChange={event => condition("scope_id", event.target.value || undefined)}>
                  <MenuItem value="">Tutte le mie collezioni</MenuItem>
                  {form.conditions.scope_id && !collections.data?.some(row => row.id === form.conditions.scope_id) && (
                    <MenuItem value={form.conditions.scope_id}>Collezione non disponibile</MenuItem>
                  )}
                  {collections.data?.map(row => <MenuItem key={row.id} value={row.id}>{row.name}</MenuItem>)}
                </TextField>
              )}
              {collections.isError && <Alert severity="error" action={
                <IconButton aria-label="Riprova collezioni" onClick={() => void collections.refetch()}><RefreshIcon /></IconButton>
              }>Impossibile caricare le collezioni.</Alert>}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField select fullWidth label="Severita" value={form.severity} disabled={busy}
                  onChange={event => setForm({ ...form, severity: event.target.value as AlertRulePayload["severity"] })}>
                  {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                </TextField>
                <TextField select fullWidth label="Canale" value={form.channel ?? ""} disabled={busy}
                  onChange={event => setForm({ ...form, channel: event.target.value === "TELEGRAM" ? "TELEGRAM" : null })}>
                  <MenuItem value="">Preferenze di notifica</MenuItem>
                  <MenuItem value="TELEGRAM">Telegram</MenuItem>
                </TextField>
              </Stack>
              {filters.filter(([key]) => !priceRule || key === "symbols" || key === "excluded_symbols").map(([key, label]) => (
                <Autocomplete key={key} multiple freeSolo autoSelect options={Array.from(new Set(rules.data?.flatMap(rule => rule.conditions[key] ?? []) ?? []))}
                  value={form.conditions[key]} disabled={busy}
                  onChange={(_, values) => condition(key, values.map(value => value.trim().toUpperCase()).filter(Boolean))}
                  renderInput={params => <TextField {...params} label={label} />} />
              ))}
              {form.alert_type === "SIGNAL_CHANGE" && (
                <Autocomplete multiple options={Object.keys(lifecycleEvents) as AlertConditions["event_types"]}
                  value={form.conditions.event_types} disabled={busy}
                  getOptionLabel={value => lifecycleEvents[value]}
                  onChange={(_, values) => condition("event_types", values)}
                  renderInput={params => <TextField {...params} label="Eventi del segnale" />} />
              )}
              <TextField select fullWidth label="Invio notifiche" disabled={busy}
                value={form.conditions.notification_mode}
                onChange={event => condition("notification_mode", event.target.value as AlertConditions["notification_mode"])}>
                <MenuItem value="IMMEDIATE">Immediato</MenuItem>
                <MenuItem value="DIGEST">Riepilogo per esecuzione</MenuItem>
              </TextField>
              <FormControlLabel label="Solo sessione regolare" control={<Switch
                checked={form.conditions.regular_session_only} disabled={busy}
                onChange={(_, value) => condition("regular_session_only", value)} />} />
              {priceRule && <FormControlLabel label="Solo attraversamento della soglia" control={<Switch
                checked={form.conditions.crossing_only} disabled={busy}
                onChange={(_, value) => condition("crossing_only", value)} />} />}
              <FormControlLabel label="Un alert per strumento, sessione e direzione" control={<Switch
                checked={form.conditions.once_per_session} disabled={busy}
                onChange={(_, value) => condition("once_per_session", value)} />} />
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                {form.alert_type === "MARKET_SIGNAL" && thresholds.map(([key, label, min, max, step]) => (
                  <TextField key={key} required type="number" label={label} disabled={busy}
                    value={Number.isNaN(form.conditions[key]) ? "" : form.conditions[key]}
                    slotProps={{ htmlInput: { min, max, step } }}
                    onChange={event => condition(key, event.target.value === "" ? NaN : Number(event.target.value))} />
                ))}
                {priceRule && <>
                  <TextField required type="number" label={form.alert_type === "PERCENT_MOVE" ? "Variazione (%)" : "Prezzo soglia"}
                    disabled={busy} value={Number.isFinite(form.conditions.threshold) ? form.conditions.threshold : ""}
                    slotProps={{ htmlInput: { min: Number.MIN_VALUE, max: 1e15, step: "any" } }}
                    onChange={event => condition("threshold", event.target.value === "" ? NaN : Number(event.target.value))} />
                  <TextField select label="Condizione" value={form.conditions.price_direction ?? "UP"} disabled={busy}
                    onChange={event => condition("price_direction", event.target.value as AlertConditions["price_direction"])}>
                    <MenuItem value="UP">{form.alert_type === "FIXED_PRICE" ? "Prezzo maggiore o uguale" : "Rialzo"}</MenuItem>
                    <MenuItem value="DOWN">{form.alert_type === "FIXED_PRICE" ? "Prezzo minore o uguale" : "Ribasso"}</MenuItem>
                    {form.alert_type === "PERCENT_MOVE" && <MenuItem value="ANY">Entrambe le direzioni</MenuItem>}
                  </TextField>
                </>}
                <TextField required type="number" label="Eta massima dati (minuti)" disabled={busy}
                  value={Number.isNaN(form.conditions.max_age_minutes) ? "" : form.conditions.max_age_minutes}
                  slotProps={{ htmlInput: { min: 1, max: 10080, step: 1 } }}
                  onChange={event => condition("max_age_minutes", event.target.value === "" ? NaN : Number(event.target.value))} />
                <TextField required type="number" label="Cooldown (minuti)" disabled={busy}
                  value={Number.isNaN(form.cooldown_minutes) ? "" : form.cooldown_minutes}
                  slotProps={{ htmlInput: { min: 0, max: 2147483647, step: 1 } }}
                  onChange={event => setForm({ ...form, cooldown_minutes: event.target.value === "" ? NaN : Number(event.target.value) })} />
                <FormControlLabel label="Attiva" control={<Switch checked={form.enabled} disabled={busy}
                  onChange={(_, enabled) => setForm({ ...form, enabled })} />} />
              </Box>
              <InstrumentAlertOverrides value={form.conditions.instrument_overrides}
                onChange={value => condition("instrument_overrides", value)} alertType={form.alert_type} disabled={busy} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setOpen(false)}>Annulla</Button>
            <Button type="submit" variant="contained" disabled={busy} startIcon={busy ? <CircularProgress size={16} /> : <SaveIcon />}>Salva</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}