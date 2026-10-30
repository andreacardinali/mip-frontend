import api from "../api/api";

export interface SchedulerJob {
  job_id: string;
  job_key: string;
  job_name: string;
  python_module: string;
  request_only: boolean;
  trigger_type: "cron" | "interval";
  cron_expression: string | null;
  interval_minutes: number | null;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  updated_at: string | null;
}

export interface SchedulerJobRun {
  job_run_id: string;
  job_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | string | null;
  error_message: string | null;
  result: Record<string, unknown> | null;
}

export interface SchedulerRunLog {
  log_id: number;
  job_run_id: string;
  logged_at: string;
  level: string;
  logger_name: string;
  message: string;
}

export interface ManualRunRequest {
  request_id: string;
  job_run_id: string;
  status: string;
}

export interface SchedulerJobUpdate {
  enabled?: boolean;
  trigger_type?: "cron" | "interval";
  cron_expression?: string | null;
  interval_minutes?: number | null;
}

export async function listSchedulerJobs(): Promise<SchedulerJob[]> {
  return (await api.get<SchedulerJob[]>("/admin/system/scheduler/jobs")).data;
}

export async function updateSchedulerJob(
  jobKey: string,
  payload: SchedulerJobUpdate,
) {
  return (
    await api.patch(`/admin/system/scheduler/jobs/${jobKey}`, payload)
  ).data;
}

export async function runSchedulerJob(
  jobKey: string,
): Promise<ManualRunRequest> {
  return (
    await api.post<ManualRunRequest>(
      `/admin/system/scheduler/jobs/${jobKey}/run`,
    )
  ).data;
}

export async function listSchedulerJobRuns(
  jobKey: string,
  limit = 20,
): Promise<SchedulerJobRun[]> {
  return (
    await api.get<SchedulerJobRun[]>(
      `/admin/system/scheduler/jobs/${jobKey}/runs`,
      { params: { limit } },
    )
  ).data;
}

export async function listSchedulerRunLogs(
  jobRunId: string,
  afterLogId = 0,
  limit = 500,
): Promise<SchedulerRunLog[]> {
  return (
    await api.get<SchedulerRunLog[]>(
      `/admin/system/scheduler/runs/${jobRunId}/logs`,
      { params: { after_log_id: afterLogId, limit } },
    )
  ).data;
}
