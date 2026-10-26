import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
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
  CircularProgress,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import {
  listSchedulerJobRuns,
  listSchedulerJobs,
  listSchedulerRunLogs,
  runSchedulerJob,
  updateSchedulerJob,
  type SchedulerJob,
  type SchedulerJobRun,
  type SchedulerRunLog,
} from "../services/systemAdmin";

const TERMINAL_STATUSES = new Set([
  "SUCCESS",
  "FAILED",
  "PARTIAL",
  "INCOMPLETE",
]);

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short",
  timeStyle: "medium",
});

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : dateTimeFormatter.format(date);
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
      return "error.light";

    case "WARNING":
    case "WARN":
      return "warning.light";

    case "DEBUG":
      return "text.disabled";

    default:
      return "inherit";
  }
}

export default function SystemSettingsPage() {
  const [jobs, setJobs] = useState<SchedulerJob[]>([]);
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
  const [message, setMessage] = useState("");

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
    if (!selectedRunId) return;

    let cancelled = false;

    const refreshSelectedRun = async () => {
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
    lastLogIdRef.current = 0;
    setRunLogs([]);
    setSelectedJobKey(jobKey);
    setSelectedRunId(jobRunId);
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
      setMessage("");
      setUpdatingJobKey(job.job_key);
      await updateSchedulerJob(job.job_key, { enabled: !job.enabled });
      await loadJobs();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Impossibile aggiornare il job.",
      );
    } finally {
      setUpdatingJobKey(null);
    }
  }

  async function runJob(job: SchedulerJob) {
    try {
      setError("");
      setMessage("");
      setRunningJobKey(job.job_key);
      const request = await runSchedulerJob(job.job_key);
      setMessage(`Esecuzione manuale richiesta per ${job.job_name}.`);
      openRunLogs(request.job_run_id, job.job_key);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Impossibile avviare il job.",
      );
    } finally {
      setRunningJobKey(null);
    }
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: { sm: "center" }, mb: 2 }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" gutterBottom>
            Impostazioni di sistema
          </Typography>
          <Typography color="text.secondary">
            Gestione centralizzata dei job, run recenti e log live.
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
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

      {selectedRunId && (
        <Card sx={{ mb: 2, bgcolor: "grey.900", color: "grey.100" }}>
          <CardContent>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 1 }}>
              <Typography variant="h6" sx={{ flex: 1 }}>
                Log live del run
              </Typography>
              <IconButton
                color="inherit"
                aria-label="Chiudi log live"
                onClick={closeRunLogs}
              >
                <CloseIcon />
              </IconButton>
            </Stack>
            <Box
              component="div"
              sx={{
                m: 0,
                p: 2,
                maxHeight: 420,
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
                    {formatTimestamp(entry.logged_at)}{" "}
                    {entry.level}{" "}
                    {entry.logger_name}:{" "}
                    {entry.message}
                  </Box>
                ))
              ) : (
                "In attesa dei log..."
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2}>
          {jobs.map((job) => (
            <Card key={job.job_id}>
              <CardContent>
                <Stack
                  direction={{ xs: "column", lg: "row" }}
                  spacing={2}
                  sx={{ alignItems: { lg: "center" } }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                      <Typography variant="h6">{job.job_name}</Typography>
                      <Chip size="small" label={job.last_status ?? "Mai eseguito"} color={statusColor(job.last_status)} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {job.job_key} · {job.python_module}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.75 }}>
                      {job.trigger_type === "cron"
                        ? `Cron: ${job.cron_expression ?? "non configurato"}`
                        : `Intervallo: ${job.interval_minutes ?? 0} minuti`}
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.25, sm: 3 }} sx={{ mt: 0.75 }}>
                      <Typography variant="body2">Ultima esecuzione: {formatTimestamp(job.last_run_at)}</Typography>
                      <Typography variant="body2">Prossima esecuzione: {formatTimestamp(job.next_run_at)}</Typography>
                    </Stack>
                    {job.last_error && <Alert severity="error" sx={{ mt: 1 }}>{job.last_error}</Alert>}
                  </Box>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <Button
                      variant="contained"
                      startIcon={runningJobKey === job.job_key ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
                      disabled={runningJobKey !== null}
                      onClick={() => void runJob(job)}
                    >
                      Esegui ora
                    </Button>
                    <FormControlLabel
                      control={<Switch checked={job.enabled} disabled={updatingJobKey === job.job_key} onChange={() => void toggleJob(job)} />}
                      label={job.enabled ? "Abilitato" : "Disabilitato"}
                    />
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
  );
}
