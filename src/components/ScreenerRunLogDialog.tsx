import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, Stack, Switch, Typography } from "@mui/material";
import { useAuth } from "../contexts/AuthProvider";
import { listSchedulerRunLogs, type SchedulerRunLog } from "../services/systemAdmin";
import { formatLogTimestamp, formatTimestamp } from "../services/timestamps";
import type { ScreenerRun } from "../types/marketScreener";

export default function ScreenerRunLogDialog({ run, onClose }: { run: ScreenerRun; onClose: () => void }) {
  const { user } = useAuth();
  const canReadLogs = Boolean(run.job_run_id && user?.roles.includes("ADMIN"));
  const queryClient = useQueryClient();
  const [live, setLive] = useState(true);
  const viewport = useRef<HTMLDivElement>(null);
  const queryKey = ["screener-run-logs", run.job_run_id];
  const logs = useQuery({
    queryKey,
    queryFn: async () => {
      const entries = [...(queryClient.getQueryData<SchedulerRunLog[]>(queryKey) ?? [])];
      let batch: SchedulerRunLog[];
      do {
        batch = await listSchedulerRunLogs(run.job_run_id!, entries.at(-1)?.log_id ?? 0);
        entries.push(...batch);
      } while (batch.length === 500);
      return entries;
    },
    enabled: canReadLogs,
    refetchInterval: live ? 2_000 : false,
  });
  useEffect(() => {
    if (live && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [live, logs.data]);

  return <Dialog open onClose={onClose} fullWidth maxWidth="lg">
    <DialogTitle>Log esecuzione screener</DialogTitle>
    <DialogContent dividers>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", mb: 1 }}>
        <Typography variant="body2">{run.status} · {formatTimestamp(run.started_at)}</Typography>
        {canReadLogs && <FormControlLabel label="Live" control={<Switch checked={live} onChange={(_, checked) => setLive(checked)} />} />}
      </Stack>
      {logs.isFetching && canReadLogs && <LinearProgress />}
      {logs.isError && canReadLogs && <Alert severity="error" action={<Button onClick={() => void logs.refetch()}>Riprova</Button>}>Impossibile caricare il log dell'esecuzione.</Alert>}
      {!canReadLogs && <Alert severity="info" sx={{ mb: 1 }}>{run.job_run_id ? "Il log dettagliato e' riservato agli amministratori. Sono disponibili i risultati delle fasi." : "Questa esecuzione non ha un log scheduler associato. Sono disponibili i risultati delle fasi."}</Alert>}
      {run.error_message && <Alert severity="error" sx={{ mb: 1 }}>{run.error_message}</Alert>}
      <Box ref={viewport} sx={{ height: "clamp(240px, 55svh, 600px)", overflow: "auto", fontFamily: "monospace", fontSize: 13, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {canReadLogs ? (logs.data ?? []).map(entry => <Box key={entry.log_id} sx={{ color: entry.level === "ERROR" || entry.level === "CRITICAL" ? "error.main" : entry.level === "WARNING" ? "warning.main" : "text.primary" }}>
          {formatLogTimestamp(entry.logged_at)} {entry.level} {entry.logger_name}: {entry.message}
        </Box>) : JSON.stringify(run.phase_results, null, 2)}
        {canReadLogs && logs.isPending && "Caricamento log..."}
        {canReadLogs && logs.isSuccess && !logs.data.length && "Nessun log disponibile."}
      </Box>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Chiudi</Button></DialogActions>
  </Dialog>;
}