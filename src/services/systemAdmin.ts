import api from "../api/api";

export interface PipelineDiagnostics {
  generated_at: string;
  window_days: number;
  ingestion: {
    by_stage_source: {
      stage: string;
      source: string;
      event_count: number;
      latest_ingested_at: string | null;
    }[];
    recent_events: {
      event_id: string;
      event_type: string;
      stage: string;
      source: string;
      event_key: string;
      revision: number;
      entity_id: string | null;
      occurred_at: string | null;
      ingested_at: string;
    }[];
  };
  processing: {
    by_status: {
      status: string;
      run_count: number;
      latest_started_at: string | null;
    }[];
    recent_runs: {
      job_run_id: string;
      job_key: string;
      job_name: string;
      status: string;
      started_at: string;
      completed_at: string | null;
      error_message: string | null;
      result: Record<string, unknown> | null;
    }[];
  };
  price_refresh: {
    by_status: {
      status: string;
      job_count: number;
      dispatcher_attempts: number;
      http_404_count: number;
      latest_updated_at: string | null;
    }[];
    recent_jobs: {
      job_id: string;
      symbol: string;
      data_source: string;
      status: string;
      attempt_count: number;
      max_attempts: number;
      next_attempt_at: string | null;
      last_error: string | null;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
    }[];
    outdated_instruments: {
      max_age_seconds: number;
      truncated: boolean;
      instruments: {
        symbol: string;
        exchange: string;
        data_source: string;
        last_price: number | string | null;
        price_as_of: string | null;
        issue: "MISSING_PRICE" | "MISSING_TIMESTAMP" | "NOT_UPDATED_DURING_OPEN_MARKET";
        market_status: "OPEN" | "CLOSED" | "UNKNOWN";
      }[];
    };
  };
  notifications: {
    by_status_channel: {
      status: string;
      channel: string;
      notification_count: number;
      latest_created_at: string | null;
    }[];
    recent: {
      notification_id: string;
      notification_type: string;
      title: string;
      status: string;
      channel: string | null;
      severity: string | null;
      attempt_count: number;
      next_attempt_at: string | null;
      last_error: string | null;
      created_at: string;
      sent_at: string | null;
    }[];
    channels: {
      channel: string;
      configured_sources: number;
      enabled_sources: number;
      credentialed_sources: number;
      ready_sources: number;
    }[];
  };
}

export async function getPipelineDiagnostics(limit = 50): Promise<PipelineDiagnostics> {
  return (await api.get<PipelineDiagnostics>("/admin/system/diagnostics", {
    params: { limit },
  })).data;
}

export interface SchedulerJob {
  job_id: string;
  job_key: string;
  job_name: string;
  description: string | null;
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

export type ScreenerPhase = "discovery_refresh" | "candidate_resolver" | "analysis_scan" | "llm_enrichment" | "ranking";

export interface SchedulerRunParameters {
  phases?: ScreenerPhase[];
  stop_on_error?: boolean;
  mode?: "MISSING" | "ALL" | "SYMBOL";
  symbol?: string;
  create_if_missing?: boolean;
  full_refresh?: boolean;
}

export async function listSchedulerJobs(): Promise<SchedulerJob[]> {
  return (await api.get<SchedulerJob[]>("/admin/system/scheduler/jobs")).data;
}

export async function previewSchedulerCron(cronExpression: string): Promise<{
  next_run_at: string | null;
  timezone: string;
}> {
  return (await api.post("/admin/system/scheduler/cron-preview", {
    cron_expression: cronExpression,
  })).data;
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
  payload?: SchedulerRunParameters,
): Promise<ManualRunRequest> {
  return (
    await api.post<ManualRunRequest>(
      `/admin/system/scheduler/jobs/${jobKey}/run`,
      payload,
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
