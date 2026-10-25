import api from "../api/api";

export interface SchedulerJob {
  job_id: string;
  job_key: string;
  job_name: string;
  python_module: string;
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

export interface SchedulerJobUpdate {
  enabled?: boolean;
  trigger_type?: "cron" | "interval";
  cron_expression?: string | null;
  interval_minutes?: number | null;
}

export async function listSchedulerJobs(): Promise<SchedulerJob[]> {
  const response = await api.get<SchedulerJob[]>(
    "/admin/system/scheduler/jobs",
  );
  return response.data;
}

export async function updateSchedulerJob(
  jobKey: string,
  payload: SchedulerJobUpdate,
) {
  const response = await api.patch(
    `/admin/system/scheduler/jobs/${jobKey}`,
    payload,
  );
  return response.data;
}

export async function runSchedulerJob(jobKey: string) {
  const response = await api.post(
    `/admin/system/scheduler/jobs/${jobKey}/run`,
  );
  return response.data;
}

export async function listSchedulerJobRuns(
  jobKey: string,
  limit = 20,
): Promise<SchedulerJobRun[]> {
  const response = await api.get<SchedulerJobRun[]>(
    `/admin/system/scheduler/jobs/${jobKey}/runs`,
    { params: { limit } },
  );
  return response.data;
}
