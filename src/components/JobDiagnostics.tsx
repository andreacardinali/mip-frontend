import { useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Box, Chip, Drawer, IconButton, LinearProgress, List, ListItemButton, ListItemText, Stack, Tab, Tabs, Tooltip, Typography } from "@mui/material";
import { BugReportOutlined, Close, Refresh } from "@mui/icons-material";
import { useAuth } from "../contexts/AuthProvider";
import { getTrackedJobs, subscribeTrackedJobs } from "../services/jobRuns";
import { getScreenerAnalysisProgress } from "../services/marketScreener";
import { listSchedulerJobs, listSchedulerJobRuns, listSchedulerRunLogs } from "../services/systemAdmin";
import type { SchedulerRunLog } from "../services/systemAdmin";
import { formatLogTimestamp } from "../services/timestamps";

const statusLabels: Record<string, string> = {
  QUEUED: "In coda", RUNNING: "In corso", SUCCESS: "Completato", PARTIAL: "Parziale",
  FAILED: "Fallito", SKIPPED: "Saltato", MONITORING_ERROR: "Monitoraggio interrotto",
};
const phaseLabels: Record<string, string> = {
  TECHNICAL: "Indicatori tecnici", LLM_ENRICHMENT: "Analisi economica AI", RANKING: "Ranking",
};
function statusColor(status: string): "success" | "error" | "warning" | "info" | "default" {
  if (status === "SUCCESS") return "success";
  if (status === "FAILED") return "error";
  if (status === "PARTIAL" || status === "MONITORING_ERROR") return "warning";
  return status === "RUNNING" || status === "QUEUED" ? "info" : "default";
}
function Status({ status }: { status: string }) {
  return <Chip size="small" variant="outlined" label={statusLabels[status] ?? status} color={statusColor(status)} />;
}

export default function JobDiagnostics() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.roles.includes("ADMIN"));
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("session");
  const [sessionRunId, setSessionRunId] = useState<string | null>(null);
  const [schedulerRunId, setSchedulerRunId] = useState<string | null>(null);
  const trackedJobs = useSyncExternalStore(subscribeTrackedJobs, getTrackedJobs);
  const queryClient = useQueryClient();
  const activeCount = trackedJobs.filter(job => job.status === "QUEUED" || job.status === "RUNNING").length;
  const sessionJob = trackedJobs.find(job => job.job_run_id === sessionRunId) ?? trackedJobs[0];
  const schedulerOpen = open && tab === "scheduler" && isAdmin;
  const scheduler = useQuery({
    queryKey: ["job-diagnostics-scheduler", user?.user_id],
    queryFn: async () => {
      const jobs = await listSchedulerJobs();
      const runs = await Promise.all(jobs.map(async job =>
        (await listSchedulerJobRuns(job.job_key, 5)).map(run => ({ ...run, job_name: job.job_name })),
      ));
      return runs.flat().sort((left, right) => right.started_at.localeCompare(left.started_at));
    },
    enabled: schedulerOpen,
    refetchInterval: schedulerOpen ? 10_000 : false,
  });
  const schedulerRun = scheduler.data?.find(run => run.job_run_id === schedulerRunId) ?? scheduler.data?.[0];
  const logsKey = ["job-diagnostics-logs", user?.user_id, schedulerRun?.job_run_id];
  const logs = useQuery({
    queryKey: logsKey,
    queryFn: async () => {
      const previous = queryClient.getQueryData<SchedulerRunLog[]>(logsKey) ?? [];
      const next = await listSchedulerRunLogs(schedulerRun!.job_run_id, previous.at(-1)?.log_id ?? 0, 500);
      return [...previous, ...next].slice(-1000);
    },
    enabled: schedulerOpen && Boolean(schedulerRun),
    refetchInterval: schedulerOpen && schedulerRun ? 2_000 : false,
    retry: false,
  });
  const context = sessionJob?.context;
  const progressEnabled = open && tab === "session" && Boolean(context);
  const progressQuery = useQuery({
    queryKey: ["job-diagnostics-progress", user?.user_id, sessionJob?.job_run_id],
    queryFn: () => getScreenerAnalysisProgress(context!.context_type, context!.context_id),
    enabled: progressEnabled,
    refetchInterval: progressEnabled && (sessionJob?.status === "QUEUED" || sessionJob?.status === "RUNNING") ? 2_000 : false,
    retry: false,
  });
  const progress = progressQuery.data?.job_run_id === sessionJob?.job_run_id
    ? progressQuery.data?.phase_results.progress : undefined;

  return <>
    <Tooltip title="Diagnostica job">
      <IconButton aria-label="Apri diagnostica job" onClick={() => setOpen(true)}>
        <Badge badgeContent={activeCount} color="info"><BugReportOutlined /></Badge>
      </IconButton>
    </Tooltip>
    <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
      <Box sx={{ width: { xs: "100vw", sm: 760 }, maxWidth: "100vw", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Stack direction="row" sx={{ p: 2, alignItems: "center", gap: 1 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>Diagnostica job</Typography>
          <Tooltip title="Aggiorna"><IconButton aria-label="Aggiorna diagnostica" onClick={() => {
            if (schedulerOpen) { void scheduler.refetch(); if (schedulerRun) void logs.refetch(); }
            else if (context) void progressQuery.refetch();
          }}><Refresh /></IconButton></Tooltip>
          <Tooltip title="Chiudi"><IconButton aria-label="Chiudi diagnostica" onClick={() => setOpen(false)}><Close /></IconButton></Tooltip>
        </Stack>
        <Tabs value={isAdmin ? tab : "session"} onChange={(_, value: string) => setTab(value)}>
          <Tab value="session" label="Sessione" />
          {isAdmin && <Tab value="scheduler" label="Scheduler" />}
        </Tabs>
        <Box sx={{ p: 2, overflow: "auto", flex: 1, minHeight: 0 }}>
          {tab === "session" || !isAdmin ? <>
            {!trackedJobs.length && <Typography color="text.secondary">Nessuna esecuzione seguita in questa sessione.</Typography>}
            <List sx={{ maxHeight: 240, overflow: "auto" }}>
              {trackedJobs.map(job => <ListItemButton key={job.job_run_id} selected={job === sessionJob} onClick={() => setSessionRunId(job.job_run_id)} sx={{ gap: 1 }}>
                <ListItemText primary={job.label ?? "Esecuzione richiesta"} secondary={formatLogTimestamp(job.updated_at)} />
                <Status status={job.status} />
              </ListItemButton>)}
            </List>
            {sessionJob && <>
              <Typography variant="caption" component="div" sx={{ overflowWrap: "anywhere", mt: 2 }}>Job: {sessionJob.job_run_id}</Typography>
              {context && <Typography variant="caption" component="div" sx={{ overflowWrap: "anywhere" }}>Contesto: {context.context_type} / {context.context_id}</Typography>}
              {progress && <Stack spacing={1} sx={{ my: 2 }}>
                <Typography variant="body2">{phaseLabels[progress.phase] ?? progress.phase}: {progress.completed} / {progress.total}{progress.symbol ? ` - ${progress.symbol}` : ""}</Typography>
                <LinearProgress variant={progress.total > 0 ? "determinate" : "indeterminate"} value={progress.total > 0 ? Math.min(100, 100 * progress.completed / progress.total) : undefined} />
              </Stack>}
              {progressQuery.isError && <Alert severity="warning">Avanzamento non disponibile.</Alert>}
              <Box component="pre" sx={{ fontSize: 12, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "monospace" }}>
                {sessionJob.events.map(event => `${formatLogTimestamp(event.at)} [${statusLabels[event.status] ?? event.status}]${event.message ? ` ${event.message}` : ""}`).join("\n")}
              </Box>
            </>}
          </> : <>
            {scheduler.isPending && <LinearProgress />}
            {scheduler.isError && <Alert severity="error">Elenco esecuzioni non disponibile.</Alert>}
            {!scheduler.isPending && !scheduler.isError && !scheduler.data?.length && <Typography color="text.secondary">Nessuna esecuzione scheduler.</Typography>}
            <List sx={{ maxHeight: 240, overflow: "auto" }}>
              {scheduler.data?.map(run => <ListItemButton key={run.job_run_id} selected={run === schedulerRun} onClick={() => setSchedulerRunId(run.job_run_id)} sx={{ gap: 1 }}>
                <ListItemText primary={run.job_name} secondary={formatLogTimestamp(run.started_at)} />
                <Status status={run.status} />
              </ListItemButton>)}
            </List>
            {schedulerRun && <>
              <Typography variant="caption" component="div" sx={{ mt: 2, overflowWrap: "anywhere" }}>Job: {schedulerRun.job_run_id}</Typography>
              {schedulerRun.error_message && <Alert severity="error" sx={{ my: 1, overflowWrap: "anywhere" }}>{schedulerRun.error_message}</Alert>}
              {logs.isPending && <LinearProgress />}
              {logs.isError && <Alert severity="error">Log non disponibili.</Alert>}
              {!logs.isPending && !logs.isError && !logs.data?.length && <Typography color="text.secondary" sx={{ mt: 2 }}>Nessun log registrato.</Typography>}
              <Box component="pre" sx={{ fontSize: 12, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "monospace" }}>
                {logs.data?.map(log => `${formatLogTimestamp(log.logged_at)} [${log.level}] ${log.logger_name}: ${log.message}`).join("\n")}
              </Box>
            </>}
          </>}
        </Box>
      </Box>
    </Drawer>
  </>;
}