import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useCallback, useEffect, useState } from "react";
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
  runSchedulerJob,
  updateSchedulerJob,
  type SchedulerJob,
  type SchedulerJobRun,
} from "../services/systemAdmin";

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short",
  timeStyle: "medium",
});

function formatTimestamp(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : dateTimeFormatter.format(date);
}

function formatDuration(value: number | string | null) {
  if (value == null) {
    return "—";
  }

  const seconds = Number(value);
  if (!Number.isFinite(seconds)) {
    return "—";
  }

  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes} min ${remainingSeconds} s`;
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

export default function SystemSettingsPage() {
  const [jobs, setJobs] = useState<SchedulerJob[]>([]);
  const [runs, setRuns] = useState<Record<string, SchedulerJobRun[]>>({});
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

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  async function loadRuns(jobKey: string) {
    try {
      setError("");
      setLoadingRunsKey(jobKey);
      const recentRuns = await listSchedulerJobRuns(jobKey, 20);
      setRuns((current) => ({
        ...current,
        [jobKey]: recentRuns,
      }));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Impossibile caricare lo storico del job.",
      );
    } finally {
      setLoadingRunsKey(null);
    }
  }

  async function toggleJob(job: SchedulerJob) {
    try {
      setError("");
      setMessage("");
      setUpdatingJobKey(job.job_key);
      await updateSchedulerJob(job.job_key, {
        enabled: !job.enabled,
      });
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
      await runSchedulerJob(job.job_key);
      setMessage(`Esecuzione manuale richiesta per ${job.job_name}.`);
      window.setTimeout(() => {
        void Promise.all([loadJobs(), loadRuns(job.job_key)]);
      }, 1500);
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
            Gestione centralizzata dei job e storico delle esecuzioni.
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

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {message && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
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
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Typography variant="h6">{job.job_name}</Typography>
                      <Chip
                        size="small"
                        label={job.last_status ?? "Mai eseguito"}
                        color={statusColor(job.last_status)}
                      />
                    </Stack>

                    <Typography variant="body2" color="text.secondary">
                      {job.job_key} · {job.python_module}
                    </Typography>

                    <Typography variant="body2" sx={{ mt: 0.75 }}>
                      {job.trigger_type === "cron"
                        ? `Cron: ${job.cron_expression ?? "non configurato"}`
                        : `Intervallo: ${job.interval_minutes ?? 0} minuti`}
                    </Typography>

                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={{ xs: 0.25, sm: 3 }}
                      sx={{ mt: 0.75 }}
                    >
                      <Typography variant="body2">
                        Ultima esecuzione: {formatTimestamp(job.last_run_at)}
                      </Typography>
                      <Typography variant="body2">
                        Prossima esecuzione: {formatTimestamp(job.next_run_at)}
                      </Typography>
                    </Stack>

                    {job.last_error && (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {job.last_error}
                      </Alert>
                    )}
                  </Box>

                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center" }}
                  >
                    <Button
                      variant="contained"
                      startIcon={
                        runningJobKey === job.job_key ? (
                          <CircularProgress size={18} color="inherit" />
                        ) : (
                          <PlayArrowIcon />
                        )
                      }
                      disabled={runningJobKey !== null}
                      onClick={() => void runJob(job)}
                    >
                      Esegui ora
                    </Button>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={job.enabled}
                          disabled={updatingJobKey === job.job_key}
                          onChange={() => void toggleJob(job)}
                        />
                      }
                      label={job.enabled ? "Abilitato" : "Disabilitato"}
                    />
                  </Stack>
                </Stack>

                <Accordion
                  disableGutters
                  elevation={0}
                  sx={{ mt: 2 }}
                  onChange={(_, expanded) => {
                    if (expanded && !runs[job.job_key]) {
                      void loadRuns(job.job_key);
                    }
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>Run recenti</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {loadingRunsKey === job.job_key ? (
                      <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : (runs[job.job_key]?.length ?? 0) === 0 ? (
                      <Typography color="text.secondary">
                        Nessuna esecuzione registrata.
                      </Typography>
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
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {runs[job.job_key]?.map((run) => (
                              <TableRow key={run.job_run_id}>
                                <TableCell>
                                  {formatTimestamp(run.started_at)}
                                </TableCell>
                                <TableCell>
                                  {formatTimestamp(run.completed_at)}
                                </TableCell>
                                <TableCell>
                                  {formatDuration(run.duration_seconds)}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    size="small"
                                    label={run.status}
                                    color={statusColor(run.status)}
                                  />
                                </TableCell>
                                <TableCell>
                                  {run.error_message ?? "—"}
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
