import { useEffect, useSyncExternalStore } from "react";
import { Alert, Snackbar } from "@mui/material";
import { useAuth } from "../contexts/AuthProvider";
import { listSchedulerJobRuns } from "../services/systemAdmin";
import {
  dismissFeedback, getFeedback, getTrackedJobs, notifyOperation,
  subscribeFeedback, untrackJob,
} from "../services/operationFeedback";

export default function OperationFeedback() {
  const feedback = useSyncExternalStore(subscribeFeedback, getFeedback);
  const { authenticated } = useAuth();

  useEffect(() => {
    if (!authenticated) {
      getTrackedJobs().forEach(job => untrackJob(job.runId));
      return;
    }
    let active = true;
    let polling = false;
    const timer = window.setInterval(async () => {
      if (polling || document.visibilityState !== "visible") return;
      polling = true;
      try {
        const tracked = getTrackedJobs();
        await Promise.all([...new Set(tracked.map(job => job.jobKey))].map(async jobKey => {
          try {
            const runs = await listSchedulerJobRuns(jobKey, 100);
            if (!active) return;
            for (const job of tracked.filter(job => job.jobKey === jobKey)) {
              const run = runs.find(run => run.job_run_id === job.runId);
              if (!run || !["SUCCESS", "FAILED", "PARTIAL", "INCOMPLETE"].includes(run.status.toUpperCase())) continue;
              untrackJob(job.runId);
              const status = run.status.toUpperCase();
              notifyOperation(`Job ${jobKey}: ${status === "SUCCESS" ? "completato" : status === "FAILED" ? "fallito" : "completato parzialmente"}.`,
                status === "SUCCESS" ? "success" : status === "FAILED" ? "error" : "warning");
            }
          } catch {
            return;
          }
        }));
      } finally {
        polling = false;
      }
    }, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [authenticated]);

  return (
    <Snackbar key={feedback?.id} open={Boolean(feedback)} autoHideDuration={3000}
      disableWindowBlurListener anchorOrigin={{ vertical: "top", horizontal: "right" }}
      sx={{ zIndex: theme => theme.zIndex.modal + 1, top: { xs: 64, sm: 72 } }}
      onClose={(_, reason) => { if (feedback && reason !== "clickaway") dismissFeedback(feedback.id); }}>
      <Alert variant="filled" severity={feedback?.severity ?? "info"}
        onClose={() => { if (feedback) dismissFeedback(feedback.id); }}
        sx={{ width: "100%", maxWidth: 520, overflowWrap: "anywhere" }}>
        {feedback?.message}
      </Alert>
    </Snackbar>
  );
}