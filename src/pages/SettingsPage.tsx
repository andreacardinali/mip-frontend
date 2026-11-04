import { useEffect, useState } from "react";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";

import CurrencySelect from "../components/CurrencySelect";
import { useAuth } from "../contexts/AuthProvider";
import { updateAccountPreferences } from "../services/auth";
import { notifyOperationError } from "../services/operationFeedback";
import {
  createNotificationSource,
  deleteNotificationSource,
  getNotificationPreferences,
  testNotificationSource,
  updateNotificationDelivery,
  updateNotificationSource,
} from "../services/notifications";
import type {
  NotificationDeliveryPreferences,
  NotificationSource,
  NotificationSourcePayload,
  SupportedNotificationChannel,
} from "../types/notifications";

const emptySource: NotificationSourcePayload = {
  source_type: "TELEGRAM",
  source_name: "",
  external_id: "",
  credential: "",
  enabled: true,
  parse_mode: null,
  disable_web_page_preview: true,
};

export default function SettingsPage({ view = "account" }: { view?: "account" | "delivery" } = {}) {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const [reportingCurrencyOverride, setReportingCurrencyOverride] =
    useState<string | null>(null);
  const [timezoneOverride, setTimezoneOverride] = useState<string | null>(null);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [busySourceId, setBusySourceId] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<NotificationDeliveryPreferences>({
    paused: false,
    default_source_id: null,
    daily_portfolio_report_time: "21:00",
  });
  const [savedDelivery, setSavedDelivery] = useState(delivery);
  const [sources, setSources] = useState<NotificationSource[]>([]);
  const [channels, setChannels] = useState<SupportedNotificationChannel[]>([]);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<NotificationSource | null>(null);
  const [sourceForm, setSourceForm] =
    useState<NotificationSourcePayload>(emptySource);
  const [error, setError] = useState<string | null>(null);

  const savedReportingCurrency = user?.reporting_currency ?? "EUR";
  const reportingCurrency = reportingCurrencyOverride ?? savedReportingCurrency;
  const savedTimezone = user?.display_timezone ?? "UTC";
  const displayTimezone = timezoneOverride ?? savedTimezone;
  const timezones = [...new Set(["UTC", savedTimezone, ...Intl.supportedValuesOf("timeZone")])];

  async function reloadNotifications() {
    const response = await getNotificationPreferences();
    setDelivery(response.delivery);
    setSavedDelivery(response.delivery);
    setSources(response.sources);
    setChannels(response.supported_channels);
    queryClient.setQueryData(["notification-preferences", user?.user_id], response);
  }

  useEffect(() => {
    if (view !== "delivery") return;
    let active = true;
    void getNotificationPreferences()
      .then((response) => {
        if (!active) return;
        setDelivery(response.delivery);
        setSavedDelivery(response.delivery);
        setSources(response.sources);
        setChannels(response.supported_channels);
      })
      .catch((loadError) => {
        console.error("[MIP notifications] Preference load failed", loadError);
        if (active) setError("Impossibile caricare le preferenze di notifica.");
      })
      .finally(() => {
        if (active) setIsLoadingNotifications(false);
      });
    return () => {
      active = false;
    };
  }, [view]);

  const notificationsChanged = delivery.paused !== savedDelivery.paused
    || delivery.default_source_id !== savedDelivery.default_source_id
    || delivery.daily_portfolio_report_time !== savedDelivery.daily_portfolio_report_time;
  const accountChanged = reportingCurrency !== savedReportingCurrency || displayTimezone !== savedTimezone;
  const enabledSources = sources.filter((source) => source.enabled);
  const selectedChannel = channels.find(
    (channel) => channel.channel === sourceForm.source_type,
  );


  function openCreateSource() {
    setEditingSource(null);
    setSourceForm({ ...emptySource, source_type: channels[0]?.channel ?? "TELEGRAM" });
    setSourceDialogOpen(true);
  }

  function openEditSource(source: NotificationSource) {
    setEditingSource(source);
    setSourceForm({
      source_type: source.channel,
      source_name: source.source_name,
      external_id: "",
      credential: "",
      enabled: source.enabled,
      parse_mode: null,
      disable_web_page_preview: true,
    });
    setSourceDialogOpen(true);
  }

  async function handleSaveAccount() {
    setIsSavingAccount(true);
    setError(null);
    try {
      await updateAccountPreferences(reportingCurrency, displayTimezone);
      await refreshUser();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["portfolios"] }),
        queryClient.invalidateQueries({ queryKey: ["portfolio-summary"] }),
      ]);
      setReportingCurrencyOverride(null);
      setTimezoneOverride(null);
    } catch (saveError) {
      console.error(saveError);
      notifyOperationError(saveError, "Impossibile salvare le preferenze account.");
    } finally {
      setIsSavingAccount(false);
    }
  }

  async function handleSaveSource() {
    setBusySourceId(editingSource?.source_id ?? "new");
    setError(null);
    try {
      const payload = { ...sourceForm };
      if (editingSource) {
        await updateNotificationSource(editingSource.source_id, payload);
      } else {
        await createNotificationSource(payload);
      }
      await reloadNotifications();
      setSourceDialogOpen(false);
    } catch (saveError) {
      console.error(saveError);
      notifyOperationError(saveError, "Impossibile salvare la destinazione.");
    } finally {
      setBusySourceId(null);
    }
  }

  async function handleTestSource(sourceId: string) {
    setBusySourceId(sourceId);
    setError(null);
    try {
      await testNotificationSource(sourceId);
    } catch (testError) {
      console.error(testError);
      notifyOperationError(testError, "Invio di prova non riuscito. Verifica token e destinazione.");
    } finally {
      setBusySourceId(null);
    }
  }

  async function handleDeleteSource(sourceId: string) {
    setBusySourceId(sourceId);
    setError(null);
    try {
      await deleteNotificationSource(sourceId);
      await reloadNotifications();
    } catch (deleteError) {
      console.error(deleteError);
      notifyOperationError(deleteError, "La destinazione è predefinita, usata da una regola o non può essere eliminata.");
    } finally {
      setBusySourceId(null);
    }
  }

  async function handleSaveNotifications() {
    setIsSavingNotifications(true);
    setError(null);
    try {
      const response = await updateNotificationDelivery(delivery);
      setDelivery(response.delivery);
      setSavedDelivery(response.delivery);
      setSources(response.sources);
      setChannels(response.supported_channels);
      queryClient.setQueryData(["notification-preferences", user?.user_id], response);
    } catch (saveError) {
      console.error(saveError);
      notifyOperationError(saveError, "Impossibile salvare le preferenze di notifica.");
    } finally {
      setIsSavingNotifications(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", py: 2 }}>
      {view === "account" && <Typography variant="h4" sx={{ mb: 3 }}>Account</Typography>}
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}

        {view === "account" && <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            <Typography variant="h6">Profilo e preferenze</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField fullWidth label="Username" value={user?.username ?? ""} disabled />
              <TextField fullWidth label="Email" value={user?.email ?? ""} disabled />
            </Stack>
            <CurrencySelect
              label="Valuta principale"
              value={reportingCurrency}
              disabled={isSavingAccount}
              helperText="Valuta consolidata dell'account."
              onChange={setReportingCurrencyOverride}
            />
            <FormControl fullWidth disabled={isSavingAccount}>
              <InputLabel id="display-timezone-label">Fuso orario</InputLabel>
              <Select labelId="display-timezone-label" label="Fuso orario"
                value={displayTimezone} onChange={(event) => setTimezoneOverride(event.target.value)}>
                {timezones.map((timezone) => <MenuItem key={timezone} value={timezone}>{timezone}</MenuItem>)}
              </Select>
            </FormControl>
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                startIcon={isSavingAccount ? <CircularProgress size={18} /> : <SaveIcon />}
                disabled={!accountChanged || isSavingAccount}
                onClick={() => void handleSaveAccount()}
              >Salva preferenze</Button>
            </Box>
          </Stack>
        </Paper>}

        {view === "delivery" && <Box sx={{ pb: 3, borderBottom: 1, borderColor: "divider" }}>
          <Stack spacing={2.5}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
              <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                <NotificationsActiveIcon color="primary" />
                <Box>
                  <Typography variant="h6">Destinazioni</Typography>
                </Box>
              </Box>
              <Button startIcon={<AddIcon />} onClick={openCreateSource}>
                Aggiungi
              </Button>
            </Stack>
            {sources.length === 0 ? (
              <Alert severity="info">Nessuna destinazione configurata.</Alert>
            ) : sources.map((source) => (
              <Stack
                key={source.source_id}
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{ alignItems: { xs: "stretch", sm: "center" } }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>{source.source_name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {source.channel} · {source.external_id_masked ?? "destinazione non disponibile"} · {source.credential_configured ? "credenziale configurata" : "credenziale assente"}
                  </Typography>
                </Box>
                <Tooltip title="Invia messaggio di prova">
                  <span><IconButton disabled={busySourceId === source.source_id} onClick={() => void handleTestSource(source.source_id)}><SendIcon /></IconButton></span>
                </Tooltip>
                <Tooltip title="Modifica"><IconButton onClick={() => openEditSource(source)}><EditIcon /></IconButton></Tooltip>
                <Tooltip title="Elimina"><span><IconButton disabled={busySourceId === source.source_id} onClick={() => void handleDeleteSource(source.source_id)}><DeleteIcon /></IconButton></span></Tooltip>
              </Stack>
            ))}
          </Stack>
        </Box>}

        {view === "delivery" && <Box>
          <Stack spacing={2.5}>
            <Typography variant="h6">Invio notifiche</Typography>
            {isLoadingNotifications ? <CircularProgress /> : (
              <Stack spacing={2}>
                <FormControlLabel label="Pausa tutte le notifiche" control={
                  <Switch checked={delivery.paused} disabled={isSavingNotifications}
                    onChange={(_, paused) => setDelivery(current => ({ ...current, paused }))} />
                } />
                <FormControl fullWidth size="small" disabled={isSavingNotifications}>
                  <InputLabel>Destinazione predefinita</InputLabel>
                  <Select label="Destinazione predefinita" value={delivery.default_source_id ?? ""}
                    onChange={event => setDelivery(current => ({ ...current, default_source_id: event.target.value || null }))}>
                    <MenuItem value="">Nessuna destinazione</MenuItem>
                    {delivery.default_source_id && !enabledSources.some(source => source.source_id === delivery.default_source_id) && (
                      <MenuItem disabled value={delivery.default_source_id}>Destinazione non disponibile</MenuItem>
                    )}
                    {enabledSources.map(source => <MenuItem key={source.source_id} value={source.source_id}>{source.source_name} ({source.channel})</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField
                  type="time"
                  label="Orario riepilogo portfolio"
                  value={delivery.daily_portfolio_report_time.slice(0, 5)}
                  disabled={isSavingNotifications}
                  slotProps={{ inputLabel: { shrink: true } }}
                  helperText={`Fuso orario account: ${displayTimezone}`}
                  onChange={event => setDelivery(current => ({
                    ...current,
                    daily_portfolio_report_time: event.target.value,
                  }))}
                />
              </Stack>
            )}
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button variant="contained" startIcon={<SaveIcon />} disabled={!notificationsChanged || isSavingNotifications || isLoadingNotifications || !!error} onClick={() => void handleSaveNotifications()}>
                Salva notifiche
              </Button>
            </Box>
          </Stack>
        </Box>}
      </Stack>

      <Dialog open={sourceDialogOpen} onClose={() => setSourceDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingSource ? "Modifica destinazione" : "Nuova destinazione"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Metodo</InputLabel>
              <Select label="Metodo" value={sourceForm.source_type} disabled={Boolean(editingSource)} onChange={(event) => setSourceForm((value) => ({ ...value, source_type: event.target.value }))}>
                {channels.map((channel) => <MenuItem key={channel.channel} value={channel.channel}>{channel.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Nome destinazione" value={sourceForm.source_name} onChange={(event) => setSourceForm((value) => ({ ...value, source_name: event.target.value }))} />
            <TextField
              label={selectedChannel?.destination_label ?? "Destinazione"}
              value={sourceForm.external_id}
              placeholder={editingSource?.external_id_masked ?? ""}
              helperText={editingSource ? "Lascia vuoto per mantenere la destinazione attuale." : undefined}
              onChange={(event) => setSourceForm((value) => ({ ...value, external_id: event.target.value }))}
            />
            <TextField
              type="password"
              label={selectedChannel?.credential_label ?? "Credenziale"}
              value={sourceForm.credential ?? ""}
              helperText={editingSource ? "Lascia vuoto per mantenere la credenziale cifrata attuale." : "La credenziale viene cifrata prima del salvataggio."}
              onChange={(event) => setSourceForm((value) => ({ ...value, credential: event.target.value }))}
            />
            <FormControlLabel control={<Switch checked={sourceForm.enabled} onChange={(_, checked) => setSourceForm((value) => ({ ...value, enabled: checked }))} />} label="Destinazione attiva" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSourceDialogOpen(false)}>Annulla</Button>
          <Button variant="contained" disabled={!sourceForm.source_name || (!editingSource && (!sourceForm.external_id || !sourceForm.credential)) || busySourceId !== null} onClick={() => void handleSaveSource()}>
            Salva
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
