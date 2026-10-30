import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import TerminalIcon from "@mui/icons-material/Terminal";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import {
  listSchedulerJobRuns,
  listSchedulerJobs,
  listSchedulerRunLogs,
  previewSchedulerCron,
  runSchedulerJob,
  updateSchedulerJob,
  type SchedulerJob,
  type SchedulerJobRun,
  type SchedulerRunLog,
  type SchedulerRunParameters,
  type ScreenerPhase,
} from "../services/systemAdmin";
import { notifyOperation, notifyOperationError } from "../services/operationFeedback";
import { formatLogTimestamp, formatTimestamp } from "../services/timestamps";

const TERMINAL_STATUSES = new Set([
  "SUCCESS",
  "FAILED",
  "PARTIAL",
  "INCOMPLETE",
]);

type JobSort = "name" | "last_run_at" | "next_run_at";
type JobStatusFilter = "all" | "SUCCESS" | "FAILED";

function getVisibleJobs(jobs: SchedulerJob[], sort: JobSort, status: JobStatusFilter) {
  const timestamp = (job: SchedulerJob) => {
    const value = sort === "last_run_at" ? job.last_run_at
      : job.enabled && !job.request_only ? job.next_run_at : null;
    const parsed = value ? Date.parse(value) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };

  return jobs.filter(job => status === "all" || job.last_status?.toUpperCase() === status)
    .sort((first, second) => {
      const byName = first.job_name.localeCompare(second.job_name, "it", { numeric: true, sensitivity: "base" })
        || first.job_key.localeCompare(second.job_key);
      if (sort === "name") return byName;
      const firstTime = timestamp(first);
      const secondTime = timestamp(second);
      if (firstTime === null) return secondTime === null ? byName : 1;
      if (secondTime === null) return -1;
      return (sort === "last_run_at" ? secondTime - firstTime : firstTime - secondTime) || byName;
    });
}

function formatDuration(value: number | string | null) {
  if (value == null) return "—";
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

function statusColor(status: string | null) {
  switch (status?.toUpperCase()) {
    case "SUCCESS":
      return "success" as const;
    case "FAILED":
      return "error" as const;
    case "PARTIAL":
    case "INCOMPLETE":
      return "warning" as const;
    case "RUNNING":
      return "info" as const;
    default:
      return "default" as const;
  }
}

function logColor(level: string) {
  switch (level.toUpperCase()) {
    case "ERROR":
    case "CRITICAL":
      return "error.main";

    case "WARNING":
    case "WARN":
      return "warning.main";

    case "DEBUG":
      return "text.secondary";

    default:
      return "inherit";
  }
}

function CronEditor({ job, onSaved }: { job: SchedulerJob; onSaved: () => Promise<void> }) {
  const [expression, setExpression] = useState(job.cron_expression ?? "");
  const [preview, setPreview] = useState<{ expression: string; next_run_at: string | null; timezone: string } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const changed = expression.trim() !== job.cron_expression;
  const validPreview = preview?.expression === expression.trim() ? preview : null;

  useEffect(() => {
    if (!changed) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setError("");
      void previewSchedulerCron(expression.trim()).then(result => {
        if (!cancelled) setPreview({ ...result, expression: expression.trim() });
      }).catch(() => {
        if (!cancelled) {
          setPreview(null);
          setError("Cron non valido o anteprima non disponibile.");
        }
      });
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [expression, changed]);

  async function save() {
    if (!validPreview || !changed) return;
    setSaving(true);
    try {
      await updateSchedulerJob(job.job_key, { trigger_type: "cron", cron_expression: expression.trim() });
      notifyOperation("Pianificazione salvata.");
      await onSaved();
    } catch (requestError) {
      notifyOperationError(requestError, "Impossibile salvare la pianificazione.");
    } finally { setSaving(false); }
  }

  return <Box sx={{ mt: 1, maxWidth: 480 }}>
    <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
      <TextField size="small" label="Cron" value={expression} disabled={saving}
        onChange={event => { setExpression(event.target.value); setPreview(null); setError(""); }}
        error={Boolean(error)} helperText={error || undefined} fullWidth
        slotProps={{ htmlInput: { "aria-label": `Cron di ${job.job_name}` } }} />
      <Tooltip title="Salva pianificazione"><span><IconButton aria-label="Salva pianificazione"
        disabled={saving || !changed || !validPreview} onClick={() => void save()}>
        {saving ? <CircularProgress size={24} /> : <SaveIcon />}
      </IconButton></span></Tooltip>
    </Stack>
    <Typography variant="body2" sx={{ mt: 0.75 }}>
      {changed ? "Anteprima" : "Prossima esecuzione"}: {changed && !validPreview
        ? error ? "N/D" : "Calcolo..."
        : formatTimestamp(changed ? validPreview?.next_run_at : job.enabled ? job.next_run_at : null)}
      {changed && validPreview && ` · ${validPreview.timezone}`}
    </Typography>
  </Box>;
}

const SCREENER_PHASES: { value: ScreenerPhase; label: string }[] = [
  { value: "discovery_refresh", label: "Discovery" },
  { value: "candidate_resolver", label: "Risoluzione candidati" },
  { value: "analysis_scan", label: "Analisi quantitativa" },
  { value: "llm_enrichment", label: "Arricchimento AI" },
  { value: "ranking", label: "Ranking" },
];

function JobRunDialog({ job, busy, onClose, onRun }: {
  job: SchedulerJob;
  busy: boolean;
  onClose: () => void;
  onRun: (parameters: SchedulerRunParameters) => Promise<void>;
}) {
  const screener = job.job_key === "market_screener_pipeline";
  const [phases, setPhases] = useState<ScreenerPhase[]>(SCREENER_PHASES.map(phase => phase.value));
  const [stopOnError, setStopOnError] = useState("default");
  const [mode, setMode] = useState<"MISSING" | "ALL" | "SYMBOL">("MISSING");
  const [symbol, setSymbol] = useState("");
  const [fullRefresh, setFullRefresh] = useState(false);
  const [createIfMissing, setCreateIfMissing] = useState(false);
  const valid = screener ? phases.length > 0 : mode !== "SYMBOL" || symbol.trim().length > 0;

  function parameters(): SchedulerRunParameters {
    if (screener) return {
      phases,
      ...(stopOnError === "default" ? {} : { stop_on_error: stopOnError === "stop" }),
    };
    return { mode, full_refresh: fullRefresh,
      ...(mode === "SYMBOL" ? { symbol: symbol.trim().toUpperCase(), create_if_missing: createIfMissing } : {}),
    };
  }

  return <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle>{job.job_name}</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 1 }}>
        {screener ? <>
          <Stack>
            {SCREENER_PHASES.map(phase => <FormControlLabel key={phase.value} label={phase.label}
              control={<Checkbox checked={phases.includes(phase.value)} disabled={busy}
                onChange={(_, checked) => setPhases(current => checked
                  ? [...current, phase.value] : current.filter(value => value !== phase.value))} />} />)}
          </Stack>
          <TextField select label="In caso di errore" value={stopOnError} disabled={busy}
            onChange={event => setStopOnError(event.target.value)}>
            <MenuItem value="default">Da configurazione</MenuItem>
            <MenuItem value="stop">Interrompi</MenuItem>
            <MenuItem value="continue">Prosegui</MenuItem>
          </TextField>
        </> : <>
          <TextField select label="Modalità" value={mode} disabled={busy}
            onChange={event => setMode(event.target.value as typeof mode)}>
            <MenuItem value="MISSING">Dati mancanti</MenuItem>
            <MenuItem value="ALL">Tutte le entità</MenuItem>
            <MenuItem value="SYMBOL">Singolo simbolo</MenuItem>
          </TextField>
          {mode === "SYMBOL" && <>
            <TextField label="Simbolo" value={symbol} disabled={busy} required
              onChange={event => setSymbol(event.target.value)} />
            <FormControlLabel label="Crea se assente" control={<Switch checked={createIfMissing}
              disabled={busy} onChange={(_, checked) => setCreateIfMissing(checked)} />} />
          </>}
          <FormControlLabel label="Refresh completo" control={<Switch checked={fullRefresh}
            disabled={busy} onChange={(_, checked) => setFullRefresh(checked)} />} />
        </>}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={busy}>Annulla</Button>
      <Button variant="contained" disabled={busy || !valid} onClick={() => void onRun(parameters())}
        startIcon={busy ? <CircularProgress size={18} /> : <PlayArrowIcon />}>Esegui</Button>
    </DialogActions>
  </Dialog>;
}

export default function SystemSettingsPage() {
  const [parameterJob, setParameterJob] = useState<SchedulerJob | null>(null);
  const [jobs, setJobs] = useState<SchedulerJob[]>([]);
  const [jobSort, setJobSort] = useState<JobSort>("name");
  const [jobStatusFilter, setJobStatusFilter] = useState<JobStatusFilter>("all");
  const [runs, setRuns] = useState<Record<string, SchedulerJobRun[]>>({});
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedJobKey, setSelectedJobKey] = useState<string | null>(null);
  const [runLogs, setRunLogs] = useState<SchedulerRunLog[]>([]);
  const lastLogIdRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [updatingJobKey, setUpdatingJobKey] = useState<string | null>(null);
  const [runningJobKey, setRunningJobKey] = useState<string | null>(null);
  const [loadingRunsKey, setLoadingRunsKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [followLogs, setFollowLogs] = useState(true);
  const logViewportRef = useRef<HTMLDivElement>(null);
  const selectedRun = selectedJobKey
    ? runs[selectedJobKey]?.find(run => run.job_run_id === selectedRunId)
    : undefined;
  const visibleJobs = getVisibleJobs(jobs, jobSort, jobStatusFilter);

  useEffect(() => {
    if (followLogs && logViewportRef.current) {
      logViewportRef.current.scrollTop = logViewportRef.current.scrollHeight;
    }
  }, [followLogs, runLogs]);

  const loadJobs = useCallback(async () => {
    try {
      setError("");
      setJobs(await listSchedulerJobs());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Impossibile caricare i job dello scheduler.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRuns = useCallback(async (jobKey: string, showLoader = true) => {
    try {
      if (showLoader) setLoadingRunsKey(jobKey);
      const recentRuns = await listSchedulerJobRuns(jobKey, 20);
      setRuns((current) => ({ ...current, [jobKey]: recentRuns }));
      return recentRuns;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Impossibile caricare lo storico del job.",
      );
      return [];
    } finally {
      if (showLoader) setLoadingRunsKey(null);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadJobs();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadJobs]);

  useEffect(() => {
    const timer = window.setInterval(() => { if (!selectedRunId) void loadJobs(); }, 15000);
    return () => window.clearInterval(timer);
  }, [loadJobs, selectedRunId]);

  useEffect(() => {
    if (!selectedRunId) return;

    let cancelled = false;
    let refreshing = false;

    const refreshSelectedRun = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const entries = await listSchedulerRunLogs(
          selectedRunId,
          lastLogIdRef.current,
        );
        if (!cancelled && entries.length > 0) {
          lastLogIdRef.current = entries[entries.length - 1].log_id;
          setRunLogs((current) => [...current, ...entries]);
        }

        await loadJobs();
        if (selectedJobKey) {
          const recentRuns = await loadRuns(selectedJobKey, false);
          const selectedRun = recentRuns.find(
            (run) => run.job_run_id === selectedRunId,
          );
          if (
            selectedRun &&
            TERMINAL_STATUSES.has(selectedRun.status.toUpperCase())
          ) {
            await loadJobs();
          }
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Impossibile aggiornare il run.",
          );
        }
      } finally {
        refreshing = false;
      }
    };

    void refreshSelectedRun();
    const timer = window.setInterval(
      () => void refreshSelectedRun(),
      1000,
    );

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loadJobs, loadRuns, selectedJobKey, selectedRunId]);

  function openRunLogs(jobRunId: string, jobKey: string) {
    if (selectedRunId === jobRunId) return;
    lastLogIdRef.current = 0;
    setRunLogs([]);
    setSelectedJobKey(jobKey);
    setSelectedRunId(jobRunId);
  }

  async function openLatestRun(jobKey: string) {
    setError("");
    const recentRuns = await loadRuns(jobKey);
    const latest = recentRuns.find(run => run.status.toUpperCase() === "RUNNING") ?? recentRuns[0];
    if (latest) openRunLogs(latest.job_run_id, jobKey);
    else notifyOperation("Nessuna esecuzione disponibile per questo job.");
  }

  function closeRunLogs() {
    setSelectedRunId(null);
    setSelectedJobKey(null);
    setRunLogs([]);
    lastLogIdRef.current = 0;
  }

  async function toggleJob(job: SchedulerJob) {
    try {
      setError("");
      setUpdatingJobKey(job.job_key);
      await updateSchedulerJob(job.job_key, { enabled: !job.enabled });
      await loadJobs();
    } catch (requestError) {
      notifyOperationError(requestError,
        requestError instanceof Error
          ? requestError.message
          : "Impossibile aggiornare il job.",
      );
    } finally {
      setUpdatingJobKey(null);
    }
  }

  async function runJob(job: SchedulerJob, parameters?: SchedulerRunParameters) {
    try {
      setError("");
      setRunningJobKey(job.job_key);
      const request = await runSchedulerJob(job.job_key, parameters);
      setParameterJob(null);
      openRunLogs(request.job_run_id, job.job_key);
    } catch (requestError) {
      notifyOperationError(requestError,
        requestError instanceof Error
          ? requestError.message
          : "Impossibile avviare il job.",
      );
    } finally {
      setRunningJobKey(null);
    }
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: { sm: "center" }, mb: 2, flexShrink: 0 }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" gutterBottom>
            Impostazioni di sistema
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => void loadJobs()}
        >
          Aggiorna
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ mb: 2, flexShrink: 0, borderBottom: 1, borderColor: "divider" }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1, flexWrap: "nowrap" }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6" noWrap>{selectedJobKey ?? "Log esecuzione"}</Typography>
                <Typography variant="caption" component="div" color="text.secondary" noWrap sx={{ height: 20 }}>
                  {selectedRunId ? `${selectedRunId} · ${formatTimestamp(selectedRun?.started_at ?? null)}` : "\u00a0"}
                </Typography>
              </Box>
              {selectedRun && <Chip size="small" label={selectedRun.status} color={statusColor(selectedRun.status)} />}
              <FormControlLabel control={<Switch checked={followLogs} onChange={(_, checked) => setFollowLogs(checked)} />} label="Live" />
              <IconButton
                color="inherit"
                aria-label="Chiudi log live"
                disabled={!selectedRunId}
                onClick={closeRunLogs}
              >
                <CloseIcon />
              </IconButton>
            </Stack>
            <Box
              component="div"
              ref={logViewportRef}
              sx={{
                m: 0,
                p: 2,
                height: "clamp(100px, 25svh, 280px)",
                boxSizing: "border-box",
                bgcolor: "background.paper",
                color: "text.primary",
                overflow: "auto",
                textAlign: "left",
                fontFamily: "monospace",
                fontSize: 13,
              }}
            >
              {runLogs.length > 0 ? (
                runLogs.map((entry) => (
                  <Box
                    component="div"
                    key={entry.log_id}
                    sx={{
                      color: logColor(entry.level),
                      textAlign: "left",
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {formatLogTimestamp(entry.logged_at)}{" "}
                    {entry.level}{" "}
                    {entry.logger_name}:{" "}
                    {entry.message}
                  </Box>
                ))
              ) : (
                selectedRunId ? "Nessun log disponibile." : "Nessuna esecuzione selezionata."
              )}
            </Box>
        </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} useFlexGap sx={{ mb: 2, flexShrink: 0, flexWrap: "wrap", alignItems: { sm: "center" } }}>
        <TextField
          select
          size="small"
          label="Ordina per"
          value={jobSort}
          onChange={event => setJobSort(event.target.value as JobSort)}
          sx={{ width: { xs: "100%", sm: 300 } }}
        >
          <MenuItem value="name">Nome (A-Z)</MenuItem>
          <MenuItem value="last_run_at">Ultima esecuzione (recenti)</MenuItem>
          <MenuItem value="next_run_at">Prossima esecuzione (imminenti)</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Esito ultima esecuzione"
          value={jobStatusFilter}
          onChange={event => setJobStatusFilter(event.target.value as JobStatusFilter)}
          sx={{ width: { xs: "100%", sm: 230 } }}
        >
          <MenuItem value="all">Tutti</MenuItem>
          <MenuItem value="SUCCESS">Riusciti</MenuItem>
          <MenuItem value="FAILED">Falliti</MenuItem>
        </TextField>
        {!loading && <Typography variant="body2" color="text.secondary">{visibleJobs.length} / {jobs.length} job</Typography>}
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", pr: 1 }}>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : visibleJobs.length === 0 ? (
        <Typography color="text.secondary" sx={{ p: 2 }}>
          {jobs.length === 0 ? "Nessun job disponibile." : "Nessun job corrisponde al filtro."}
        </Typography>
      ) : (
        <Stack spacing={2}>
          {visibleJobs.map((job) => (
            <Card key={job.job_id}>
              <CardContent>
                <Stack
                  direction={{ xs: "column", lg: "row" }}
                  spacing={2}
                  sx={{ alignItems: { lg: "center" } }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                      <Typography variant="h6">{job.job_name}</Typography>
                      <Chip size="small" label={job.last_status ?? "Mai eseguito"} color={statusColor(job.last_status)} />
                      {job.last_run_at && <Typography variant="body2" color="text.secondary">{formatTimestamp(job.last_run_at)}</Typography>}
                    </Stack>
                    {job.description && <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: "anywhere" }}>{job.description}</Typography>}
                    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                      {job.job_key} · {job.python_module}
                    </Typography>
                    {job.request_only ? <Typography variant="body2" sx={{ mt: 0.75 }}>Su richiesta contestuale</Typography>
                      : job.trigger_type === "cron" ? <CronEditor job={job} onSaved={loadJobs} />
                      : <Box sx={{ mt: 0.75 }}>
                        <Typography variant="body2">Intervallo: {job.interval_minutes ?? 0} minuti</Typography>
                        <Typography variant="body2">Prossima esecuzione: {formatTimestamp(job.enabled ? job.next_run_at : null)}</Typography>
                      </Box>}
                    {job.last_error && <Alert severity="error" sx={{ mt: 1 }}>{job.last_error}</Alert>}
                  </Box>
                  <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                    <Button
                      variant="outlined"
                      startIcon={loadingRunsKey === job.job_key ? <CircularProgress size={18} /> : <TerminalIcon />}
                      disabled={loadingRunsKey !== null}
                      onClick={() => void openLatestRun(job.job_key)}
                    >{job.last_status === "RUNNING" ? "Run attivo" : "Ultimo run"}</Button>
                    {!job.request_only && <Button
                      variant="contained"
                      startIcon={runningJobKey === job.job_key ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
                      disabled={runningJobKey !== null}
                      onClick={() => {
                        if (["market_screener_pipeline", "refresh_entities_missing"].includes(job.job_key)) setParameterJob(job);
                        else void runJob(job);
                      }}
                    >
                      Esegui ora
                    </Button>}
                    {!job.request_only && <FormControlLabel
                      control={<Switch checked={job.enabled} disabled={updatingJobKey === job.job_key} onChange={() => void toggleJob(job)} />}
                      label={job.enabled ? "Abilitato" : "Disabilitato"}
                    />}
                  </Stack>
                </Stack>

                <Accordion
                  disableGutters
                  elevation={0}
                  sx={{ mt: 2 }}
                  onChange={(_, expanded) => {
                    if (expanded) void loadRuns(job.job_key);
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>Run recenti</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {loadingRunsKey === job.job_key ? (
                      <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}><CircularProgress size={24} /></Box>
                    ) : (runs[job.job_key]?.length ?? 0) === 0 ? (
                      <Typography color="text.secondary">Nessuna esecuzione registrata.</Typography>
                    ) : (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Avvio</TableCell>
                              <TableCell>Completamento</TableCell>
                              <TableCell>Durata</TableCell>
                              <TableCell>Stato</TableCell>
                              <TableCell>Errore</TableCell>
                              <TableCell>Log</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {runs[job.job_key]?.map((run) => (
                              <TableRow key={run.job_run_id}>
                                <TableCell>{formatTimestamp(run.started_at)}</TableCell>
                                <TableCell>{formatTimestamp(run.completed_at)}</TableCell>
                                <TableCell>{formatDuration(run.duration_seconds)}</TableCell>
                                <TableCell><Chip size="small" label={run.status} color={statusColor(run.status)} /></TableCell>
                                <TableCell>{run.error_message ?? "—"}</TableCell>
                                <TableCell>
                                  <Button size="small" onClick={() => openRunLogs(run.job_run_id, job.job_key)}>Apri</Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </AccordionDetails>
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
      </Box>
      {parameterJob && <JobRunDialog key={parameterJob.job_key} job={parameterJob}
        busy={runningJobKey !== null} onClose={() => setParameterJob(null)}
        onRun={parameters => runJob(parameterJob, parameters)} />}
    </Box>
  );
}
