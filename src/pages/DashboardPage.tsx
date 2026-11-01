import { Alert, Box, Button, Chip, Dialog, DialogContent, DialogTitle, IconButton, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import { ArrowForward, Close, Description, PlayArrow, Refresh } from "@mui/icons-material";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getScreenerContexts, getScreenerRuns } from "../services/marketScreener";
import { formatTimestamp } from "../services/timestamps";
import { useAuth } from "../contexts/AuthProvider";
import { listSchedulerJobs, listSchedulerRunLogs, runSchedulerJob } from "../services/systemAdmin";
import type { SchedulerRunLog } from "../services/systemAdmin";
import { notifyOperation, notifyOperationError } from "../services/operationFeedback";

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.roles.includes("ADMIN"));
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const contexts = useQuery({ queryKey: ["market-screener-contexts"], queryFn: getScreenerContexts });
  const runs = useQuery({ queryKey: ["market-screener-runs", "overview"], queryFn: () => getScreenerRuns(10), refetchInterval: 5_000 });
  const jobs = useQuery({ queryKey: ["scheduler-jobs", "overview"], queryFn: listSchedulerJobs, enabled: isAdmin, refetchInterval: 5_000 });
  const logs = useQuery({
    queryKey: ["scheduler-run-logs", "overview", selectedRunId],
    queryFn: async () => {
      const previous = queryClient.getQueryData<SchedulerRunLog[]>(["scheduler-run-logs", "overview", selectedRunId]) ?? [];
      const next = await listSchedulerRunLogs(selectedRunId!, previous.at(-1)?.log_id ?? 0, 500);
      return [...previous, ...next];
    },
    enabled: isAdmin && selectedRunId !== null,
    refetchInterval: selectedRunId ? 2_000 : false,
  });
  const execution = useMutation({
    mutationFn: (jobKey: string) => runSchedulerJob(jobKey),
    onSuccess: request => {
      setSelectedRunId(request.job_run_id);
      notifyOperation("Esecuzione richiesta.");
      void queryClient.invalidateQueries({ queryKey: ["scheduler-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["market-screener-runs"] });
    },
    onError: error => notifyOperationError(error, "Impossibile avviare il job."),
  });
  const screenerJob = jobs.data?.find(job => job.job_key === "market_screener_pipeline");
  const canRunScreener = jobs.isSuccess && screenerJob && !screenerJob.request_only
    && !["RUNNING", "QUEUED"].includes(screenerJob.last_status ?? "") && !execution.isPending;
  return (
    <Stack spacing={3}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        <Typography variant="h4">Panoramica operativa</Typography>
        <Button startIcon={<Refresh />} onClick={() => { void contexts.refetch(); void runs.refetch(); if (isAdmin) void jobs.refetch(); }} disabled={contexts.isFetching || runs.isFetching}>Aggiorna</Button>
      </Stack>
      {(contexts.isFetching || runs.isFetching) && <LinearProgress aria-label="Aggiornamento panoramica" />}
      {contexts.isError && <Alert severity="error">Contesti non disponibili. {contexts.error.message}</Alert>}
      <Box>
        <Typography variant="h6" gutterBottom>Contesti</Typography>
        <TableContainer>
          <Table size="small" aria-label="Contesti disponibili">
            <TableHead><TableRow><TableCell>Nome</TableCell><TableCell>Tipo</TableCell><TableCell align="right">Strumenti</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {contexts.data?.map(context => <TableRow key={`${context.context_type}:${context.context_id}`} hover>
                <TableCell><Button component={Link} to={context.context_type === "UNIVERSE" ? `/universes/${context.context_id}` : context.context_type === "WATCHLIST" ? `/watchlists/${context.context_id}` : `/portfolios/${context.context_id}`}>{context.name}</Button></TableCell>
                <TableCell>{context.context_type}</TableCell><TableCell align="right">{context.instrument_count}</TableCell>
                <TableCell align="right"><Button component={Link} to={`/screener?context=${context.context_type}:${context.context_id}`} endIcon={<ArrowForward />}>Analisi</Button></TableCell>
              </TableRow>)}
            </TableBody>
          </Table>
        </TableContainer>
        {contexts.isSuccess && contexts.data.length === 0 && <Alert severity="info">Nessun contesto disponibile.</Alert>}
      </Box>
      <Box>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap", mb: 1 }}>
          <Typography variant="h6">Diagnostica analisi</Typography>
          {isAdmin && <Button startIcon={<PlayArrow />} disabled={!canRunScreener} onClick={() => { if (canRunScreener && screenerJob) execution.mutate(screenerJob.job_key); }}>Esegui job</Button>}
        </Stack>
        {runs.isError && <Alert severity="error">Stato delle analisi non disponibile. {runs.error.message}</Alert>}
        {isAdmin && jobs.isError && <Alert severity="warning">Stato scheduler non disponibile. {jobs.error.message}</Alert>}
        {runs.isSuccess && runs.data.length === 0 && <Alert severity="info">Nessuna esecuzione registrata.</Alert>}
        <TableContainer>
          <Table size="small" aria-label="Ultime esecuzioni screener">
            <TableHead><TableRow><TableCell>Avvio</TableCell><TableCell>Job</TableCell><TableCell>Stato</TableCell><TableCell align="right">Opportunita</TableCell><TableCell>Termine</TableCell><TableCell>Errore</TableCell>{isAdmin && <TableCell align="right">Azioni</TableCell>}</TableRow></TableHead>
            <TableBody>{runs.data?.map(run => <TableRow key={run.screener_run_id}>
              <TableCell>{formatTimestamp(run.started_at)}</TableCell>
              <TableCell>{run.job_key ?? "-"}</TableCell>
              <TableCell><Chip size="small" label={run.status} color={run.status === "FAILED" ? "error" : run.status === "PARTIAL" ? "warning" : run.status === "SUCCESS" ? "success" : "info"} /></TableCell>
              <TableCell align="right">{run.opportunity_count}</TableCell><TableCell>{run.completed_at ? formatTimestamp(run.completed_at) : "Non conclusa"}</TableCell><TableCell sx={{ overflowWrap: "anywhere" }}>{run.error_message ?? "-"}</TableCell>
              {isAdmin && <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                <Tooltip title="Visualizza log"><span><IconButton aria-label="Visualizza log" disabled={!run.job_run_id} onClick={() => setSelectedRunId(run.job_run_id ?? null)}><Description /></IconButton></span></Tooltip>
              </TableCell>}
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>
      </Box>
      <Dialog open={selectedRunId !== null} onClose={() => setSelectedRunId(null)} fullWidth maxWidth="lg">
        <DialogTitle><Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}><Typography component="span">Log esecuzione</Typography><IconButton aria-label="Chiudi log" onClick={() => setSelectedRunId(null)}><Close /></IconButton></Stack></DialogTitle>
        <DialogContent>
          <Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>{selectedRunId}</Typography>
          {logs.isLoading && <LinearProgress aria-label="Caricamento log" />}
          {logs.isError && <Alert severity="error">Log non disponibili. {logs.error.message}</Alert>}
          {logs.isSuccess && logs.data.length === 0 && <Alert severity="info">Nessun log disponibile.</Alert>}
          <Box component="pre" sx={{ height: "min(55vh, 500px)", overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 13 }}>
            {logs.data?.map(log => `${formatTimestamp(log.logged_at)} [${log.level}] ${log.logger_name}: ${log.message}`).join("\n")}
          </Box>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
