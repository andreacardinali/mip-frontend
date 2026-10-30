import { useEffect, useMemo, useState } from "react";

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
  Divider,
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
import AlertRuleSettings from "../components/AlertRuleSettings";
import { useAuth } from "../contexts/AuthProvider";
import { updateAccountPreferences } from "../services/auth";
import { notifyOperationError } from "../services/operationFeedback";
import {
  createNotificationSource,
  deleteNotificationSource,
  getNotificationPreferences,
  testNotificationSource,
  updateNotificationPreferences,
  updateNotificationSource,
} from "../services/notifications";
import type {
  NotificationPreference,
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

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const [reportingCurrencyOverride, setReportingCurrencyOverride] =
    useState<string | null>(null);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [busySourceId, setBusySourceId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [savedPreferences, setSavedPreferences] = useState<NotificationPreference[]>([]);
  const [sources, setSources] = useState<NotificationSource[]>([]);
  const [channels, setChannels] = useState<SupportedNotificationChannel[]>([]);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<NotificationSource | null>(null);
  const [sourceForm, setSourceForm] =
    useState<NotificationSourcePayload>(emptySource);
  const [error, setError] = useState<string | null>(null);

  const savedReportingCurrency = user?.reporting_currency ?? "EUR";
  const reportingCurrency = reportingCurrencyOverride ?? savedReportingCurrency;

  async function reloadNotifications() {
    const response = await getNotificationPreferences();
    setPreferences(response.preferences);
    setSavedPreferences(response.preferences);
    setSources(response.sources);
    setChannels(response.supported_channels);
  }

  useEffect(() => {
    let active = true;
    void getNotificationPreferences()
      .then((response) => {
        if (!active) return;
        setPreferences(response.preferences);
        setSavedPreferences(response.preferences);
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
  }, []);

  const notificationsChanged = useMemo(
    () => JSON.stringify(preferences) !== JSON.stringify(savedPreferences),
    [preferences, savedPreferences],
  );
  const accountChanged = reportingCurrency !== savedReportingCurrency;
  const enabledSources = sources.filter((source) => source.enabled);
  const selectedChannel = channels.find(
    (channel) => channel.channel === sourceForm.source_type,
  );

  function patchPreference(
    notificationType: NotificationPreference["notification_type"],
    patch: Partial<NotificationPreference>,
  ) {
    setPreferences((current) =>
      current.map((preference) =>
        preference.notification_type === notificationType
          ? { ...preference, ...patch }
          : preference,
      ),
    );
    setError(null);
  }

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
      await updateAccountPreferences(reportingCurrency);
      await refreshUser();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["portfolios"] }),
        queryClient.invalidateQueries({ queryKey: ["portfolio-summary"] }),
      ]);
      setReportingCurrencyOverride(null);
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
      notifyOperationError(deleteError, "La destinazione è usata da una preferenza attiva o non può essere eliminata.");
    } finally {
      setBusySourceId(null);
    }
  }

  async function handleSaveNotifications() {
    setIsSavingNotifications(true);
    setError(null);
    try {
      const response = await updateNotificationPreferences(
        preferences.map((preference) => ({
          notification_type: preference.notification_type,
          enabled: preference.enabled,
          source_id: preference.enabled ? preference.source_id : null,
          severity_min: preference.severity_min,
        })),
      );
      setPreferences(response.preferences);
      setSavedPreferences(response.preferences);
      setSources(response.sources);
      setChannels(response.supported_channels);
    } catch (saveError) {
      console.error(saveError);
      notifyOperationError(saveError, "Impossibile salvare le preferenze di notifica.");
    } finally {
      setIsSavingNotifications(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", py: 2 }}>
      <Typography variant="h4" sx={{ mb: 0.75 }}>Account</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Gestisci il profilo, la valuta principale e le notifiche.
      </Typography>
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}

        <AlertRuleSettings />

        <Paper variant="outlined" sx={{ p: 3 }}>
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
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                startIcon={isSavingAccount ? <CircularProgress size={18} /> : <SaveIcon />}
                disabled={!accountChanged || isSavingAccount}
                onClick={() => void handleSaveAccount()}
              >Salva preferenze</Button>
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
              <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                <NotificationsActiveIcon color="primary" />
                <Box>
                  <Typography variant="h6">Destinazioni</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Configura il metodo, la destinazione e la credenziale cifrata.
                  </Typography>
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
        </Paper>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            <Typography variant="h6">Tipologie di notifica</Typography>
            {isLoadingNotifications ? <CircularProgress /> : (
              <Stack spacing={2} divider={<Divider flexItem />}>
                {preferences.map((preference) => (
                  <Stack key={preference.notification_type} direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between" }}>
                    <Box sx={{ flex: 1 }}>
                      <FormControlLabel
                        control={<Switch checked={preference.enabled} onChange={(_, checked) => patchPreference(preference.notification_type, { enabled: checked, source_id: checked && !preference.source_id ? enabledSources[0]?.source_id ?? null : preference.source_id })} />}
                        label={preference.label}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 6 }}>{preference.description}</Typography>
                    </Box>
                    <FormControl size="small" disabled={!preference.enabled} sx={{ minWidth: 280 }}>
                      <InputLabel>Metodo e destinazione</InputLabel>
                      <Select label="Metodo e destinazione" value={preference.source_id ?? ""} onChange={(event) => patchPreference(preference.notification_type, { source_id: event.target.value || null })}>
                        {enabledSources.map((source) => <MenuItem key={source.source_id} value={source.source_id}>{source.source_name} ({source.channel})</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Stack>
                ))}
              </Stack>
            )}
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button variant="contained" startIcon={<SaveIcon />} disabled={!notificationsChanged || isSavingNotifications || preferences.some((item) => item.enabled && !item.source_id)} onClick={() => void handleSaveNotifications()}>
                Salva notifiche
              </Button>
            </Box>
          </Stack>
        </Paper>
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
