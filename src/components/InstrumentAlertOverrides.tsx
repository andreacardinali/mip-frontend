import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert, Autocomplete, Box, FormControlLabel, IconButton, MenuItem,
  Stack, Switch, TextField, Tooltip, Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getInstruments } from "../services/instruments";
import type { AlertType, InstrumentAlertOverride, SignalEventType } from "../services/alerts";

interface InstrumentOption { instrument_id: string; symbol: string; exchange?: string | null }
interface Props {
  value: Record<string, InstrumentAlertOverride>;
  onChange: (value: Record<string, InstrumentAlertOverride>) => void;
  alertType: AlertType;
  disabled: boolean;
}

const scores = [
  ["min_composite_score", "Score composito minimo", 0, 1, 0.01],
  ["min_consensus_score", "Consenso minimo", 0, 1, 0.01],
  ["max_conflict_score", "Conflitto massimo", 0, 1, 0.01],
  ["min_strategy_count", "Numero minimo di strategie", 1, 2147483647, 1],
] as const;
const events: Record<SignalEventType, string> = {
  CREATED: "Creato", CONFIRMED: "Confermato", DIRECTION_CHANGED: "Cambio direzione",
  CLOSED: "Chiuso", EXPIRED: "Scaduto",
};

export default function InstrumentAlertOverrides({ value, onChange, alertType, disabled }: Props) {
  const [selected, setSelected] = useState<InstrumentOption | null>(null);
  const instruments = useQuery<InstrumentOption[]>({
    queryKey: ["instruments"], queryFn: getInstruments,
  });
  const priceRule = alertType === "FIXED_PRICE" || alertType === "PERCENT_MOVE";

  function update<Key extends keyof InstrumentAlertOverride>(id: string, key: Key, next: InstrumentAlertOverride[Key]) {
    const override = { ...value[id], [key]: next };
    if (next === undefined) delete override[key];
    onChange({ ...value, [id]: override });
  }

  function remove(id: string) {
    const next = { ...value };
    delete next[id];
    onChange(next);
  }

  return (
    <Stack spacing={2} sx={{ borderTop: 1, borderColor: "divider", pt: 2 }}>
      <Typography variant="subtitle1">Eccezioni per strumento</Typography>
      {instruments.isError && <Alert severity="error" action={
        <IconButton aria-label="Riprova strumenti" onClick={() => void instruments.refetch()}><RefreshIcon /></IconButton>
      }>Impossibile caricare gli strumenti.</Alert>}
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Autocomplete fullWidth options={instruments.data ?? []} value={selected}
          loading={instruments.isPending} disabled={disabled || instruments.isError || Object.keys(value).length >= 500}
          isOptionEqualToValue={(option, item) => option.instrument_id === item.instrument_id}
          getOptionLabel={item => `${item.symbol}${item.exchange ? ` (${item.exchange})` : ""}`}
          getOptionDisabled={item => item.instrument_id in value}
          onChange={(_, item) => setSelected(item)}
          renderInput={params => <TextField {...params} label="Strumento" />} />
        <Tooltip title="Aggiungi eccezione"><span>
          <IconButton aria-label="Aggiungi eccezione" disabled={disabled || !selected || selected.instrument_id in value || Object.keys(value).length >= 500}
            onClick={() => {
              if (selected) onChange({ ...value, [selected.instrument_id]: { enabled: true } });
              setSelected(null);
            }}><AddIcon /></IconButton>
        </span></Tooltip>
      </Stack>
      {Object.entries(value).map(([id, override]) => (
        <Stack key={id} spacing={2} sx={{ borderTop: 1, borderColor: "divider", pt: 2 }}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="subtitle2" sx={{ overflowWrap: "anywhere" }}>
              {instruments.data?.find(item => item.instrument_id === id)?.symbol ?? id}
            </Typography>
            <Tooltip title="Rimuovi eccezione"><span>
              <IconButton aria-label="Rimuovi eccezione" disabled={disabled} onClick={() => remove(id)}><DeleteIcon /></IconButton>
            </span></Tooltip>
          </Stack>
          <FormControlLabel label="Alert per questo strumento" control={<Switch
            checked={override.enabled !== false} disabled={disabled}
            onChange={(_, enabled) => update(id, "enabled", enabled)} />} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <TextField select label="Sessione regolare" disabled={disabled}
              value={override.regular_session_only === undefined ? "" : String(override.regular_session_only)}
              onChange={event => update(id, "regular_session_only", event.target.value === "" ? undefined : event.target.value === "true")}>
              <MenuItem value="">Eredita dalla regola</MenuItem>
              <MenuItem value="true">Solo sessione regolare</MenuItem>
              <MenuItem value="false">Tutte le sessioni</MenuItem>
            </TextField>
            {priceRule && <>
              <TextField type="number" label={alertType === "PERCENT_MOVE" ? "Variazione (%)" : "Prezzo soglia"}
                disabled={disabled} value={override.threshold ?? ""} placeholder="Eredita dalla regola"
                slotProps={{ htmlInput: { min: Number.MIN_VALUE, max: 1e15, step: "any" } }}
                onChange={event => update(id, "threshold", event.target.value === "" ? undefined : Number(event.target.value))} />
              <TextField select label="Direzione prezzo" value={override.price_direction ?? ""} disabled={disabled}
                onChange={event => update(id, "price_direction", (event.target.value || undefined) as InstrumentAlertOverride["price_direction"])}>
                <MenuItem value="">Eredita dalla regola</MenuItem>
                <MenuItem value="UP">Rialzo</MenuItem><MenuItem value="DOWN">Ribasso</MenuItem>
                {alertType === "PERCENT_MOVE" && <MenuItem value="ANY">Entrambe le direzioni</MenuItem>}
              </TextField>
            </>}
            {alertType === "MARKET_SIGNAL" && scores.map(([key, label, min, max, step]) => (
              <TextField key={key} type="number" label={label} disabled={disabled}
                value={override[key] ?? ""} placeholder="Eredita dalla regola"
                slotProps={{ htmlInput: { min, max, step } }}
                onChange={event => update(id, key, event.target.value === "" ? undefined : Number(event.target.value))} />
            ))}
          </Box>
          {!priceRule && <>
            <FormControlLabel label="Strategie personalizzate" control={<Switch
              checked={override.strategy_codes !== undefined} disabled={disabled}
              onChange={(_, checked) => update(id, "strategy_codes", checked ? [] : undefined)} />} />
            {override.strategy_codes !== undefined && <Autocomplete multiple freeSolo autoSelect options={[]}
              disabled={disabled} value={override.strategy_codes}
              onChange={(_, codes) => update(id, "strategy_codes", codes.map(code => code.trim().toUpperCase()).filter(Boolean))}
              renderInput={params => <TextField {...params} label="Strategie di supporto" />} />}
          </>}
          {alertType === "SIGNAL_CHANGE" && <>
            <FormControlLabel label="Eventi personalizzati" control={<Switch
              checked={override.event_types !== undefined} disabled={disabled}
              onChange={(_, checked) => update(id, "event_types", checked ? [] : undefined)} />} />
            {override.event_types !== undefined && <Autocomplete multiple options={Object.keys(events) as SignalEventType[]}
              disabled={disabled} value={override.event_types} getOptionLabel={item => events[item]}
              onChange={(_, types) => update(id, "event_types", types)}
              renderInput={params => <TextField {...params} label="Eventi del segnale" />} />}
          </>}
        </Stack>
      ))}
    </Stack>
  );
}