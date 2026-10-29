import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert, Autocomplete, Box, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem,
  Stack, Switch, TextField, Tooltip, Typography,
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useAuth } from "../contexts/AuthProvider";
import { getAlertRules, saveAlertRule } from "../services/alerts";
import type { AlertConditions, AlertRule, AlertRulePayload } from "../services/alerts";

function emptyRule(): AlertRulePayload {
  return {
    name: "", severity: "MEDIUM", channel: null, cooldown_minutes: 240, enabled: true,
    conditions: {
      symbols: [], directions: [], verdicts: [], origins: [], strategy_codes: [],
      min_composite_score: 0.75, min_consensus_score: 0, max_conflict_score: 1,
      min_strategy_count: 1,
    },
  };
}

const filters = [
  ["symbols", "Simboli"], ["directions", "Direzioni"], ["verdicts", "Verdetti"],
  ["origins", "Origini"], ["strategy_codes", "Strategie di supporto"],
] as const;
const thresholds = [
  ["min_composite_score", "Score composito minimo", 0, 1, 0.01],
  ["min_consensus_score", "Consenso minimo", 0, 1, 0.01],
  ["max_conflict_score", "Conflitto massimo", 0, 1, 0.01],
  ["min_strategy_count", "Numero minimo di strategie", 1, 2147483647, 1],
] as const;

export default function AlertRuleSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["alert-rules", user?.user_id];
  const rules = useQuery({ queryKey, queryFn: getAlertRules, enabled: !!user });
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState<AlertRulePayload>(emptyRule);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function edit(rule?: AlertRule) {
    const defaults = emptyRule();
    setForm(rule ? {
      name: rule.name, severity: rule.severity, channel: rule.channel,
      cooldown_minutes: rule.cooldown_minutes, enabled: rule.enabled,
      conditions: { ...defaults.conditions, ...rule.conditions },
    } : defaults);
    setEditingId(rule?.rule_id);
    setError(null);
    setSaved(false);
    setOpen(true);
  }

  function condition<Key extends keyof AlertConditions>(key: Key, value: AlertConditions[Key]) {
    setForm(previous => ({ ...previous, conditions: { ...previous.conditions, [key]: value } }));
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

  return (
    <Box sx={{ borderTop: 1, borderColor: "divider", pt: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h6">Alert di mercato</Typography>
        <Button startIcon={<AddIcon />} onClick={() => edit()} disabled={rules.isPending || rules.isError}>
          Nuova regola
        </Button>
      </Stack>
      {saved && <Alert severity="success" sx={{ mb: 2 }}>Regola salvata.</Alert>}
      {rules.isPending && <CircularProgress size={24} aria-label="Caricamento regole" />}
      {rules.isError && (
        <Alert severity="error" action={
          <Tooltip title="Riprova"><IconButton onClick={() => void rules.refetch()} aria-label="Riprova"><RefreshIcon /></IconButton></Tooltip>
        }>Impossibile caricare le regole di alert.</Alert>
      )}
      {rules.isSuccess && !rules.data.length && <Typography color="text.secondary">Nessuna regola.</Typography>}
      {rules.data?.map(rule => (
        <Stack key={rule.rule_id} direction="row" alignItems="center" spacing={2}
          sx={{ py: 1.5, borderBottom: 1, borderColor: "divider", minWidth: 0 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ overflowWrap: "anywhere" }}>{rule.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
              {rule.enabled ? "Attiva" : "Disattivata"} · {rule.severity} · {rule.cooldown_minutes} min
            </Typography>
          </Box>
          <Tooltip title="Modifica regola">
            <IconButton aria-label={`Modifica ${rule.name}`} onClick={() => edit(rule)}><EditIcon /></IconButton>
          </Tooltip>
        </Stack>
      ))}
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
              {filters.map(([key, label]) => (
                <Autocomplete key={key} multiple freeSolo autoSelect options={Array.from(new Set(rules.data?.flatMap(rule => rule.conditions[key] ?? []) ?? []))}
                  value={form.conditions[key]} disabled={busy}
                  onChange={(_, values) => condition(key, values.map(value => value.trim().toUpperCase()).filter(Boolean))}
                  renderInput={params => <TextField {...params} label={label} />} />
              ))}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                {thresholds.map(([key, label, min, max, step]) => (
                  <TextField key={key} required type="number" label={label} disabled={busy}
                    value={Number.isNaN(form.conditions[key]) ? "" : form.conditions[key]}
                    slotProps={{ htmlInput: { min, max, step } }}
                    onChange={event => condition(key, event.target.value === "" ? NaN : Number(event.target.value))} />
                ))}
                <TextField required type="number" label="Cooldown (minuti)" disabled={busy}
                  value={Number.isNaN(form.cooldown_minutes) ? "" : form.cooldown_minutes}
                  slotProps={{ htmlInput: { min: 0, max: 2147483647, step: 1 } }}
                  onChange={event => setForm({ ...form, cooldown_minutes: event.target.value === "" ? NaN : Number(event.target.value) })} />
                <FormControlLabel label="Attiva" control={<Switch checked={form.enabled} disabled={busy}
                  onChange={(_, enabled) => setForm({ ...form, enabled })} />} />
              </Box>
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