import api from "../api/api";

export interface ExecutionRequest {
	request_id: string;
	job_run_id: string;
	status: "QUEUED";
}

export interface JobRun<Result> {
	job_run_id: string;
	status: "QUEUED" | "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
	error_message: string | null;
	result: Result | null;
}


export interface JobTrackingOptions {
	label?: string;
	context?: { context_type: "WATCHLIST" | "PORTFOLIO" | "UNIVERSE" | "ENTITY" | "INSTRUMENT"; context_id: string };
}

export interface TrackedJob extends JobTrackingOptions {
	job_run_id: string;
	status: JobRun<unknown>["status"] | "MONITORING_ERROR";
	updated_at: string;
	events: { at: string; status: TrackedJob["status"]; message: string | null }[];
}

let trackedJobs: TrackedJob[] = [];
let sessionVersion = 0;
const listeners = new Set<() => void>();

export function getTrackedJobs() { return trackedJobs; }
export function clearTrackedJobs() {
	sessionVersion++;
	trackedJobs = [];
	listeners.forEach(listener => listener());
}
export function subscribeTrackedJobs(listener: () => void) {
	listeners.add(listener);
	return () => { listeners.delete(listener); };
}

function recordJob(jobRunId: string, status: TrackedJob["status"], options: JobTrackingOptions, message: string | null = null) {
	const previous = trackedJobs.find(job => job.job_run_id === jobRunId);
	const lastEvent = previous?.events.at(-1);
	if (lastEvent?.status === status && lastEvent.message === message) return;
	const at = new Date().toISOString();
	const updated: TrackedJob = {
		...options, job_run_id: jobRunId, status, updated_at: at,
		events: [...(previous?.events ?? []), { at, status, message }].slice(-100),
	};
	let completed = 0;
	trackedJobs = [updated, ...trackedJobs.filter(job => job.job_run_id !== jobRunId)]
		.filter(job => job.status === "QUEUED" || job.status === "RUNNING" || ++completed <= 50);
	listeners.forEach(listener => listener());
}

export async function waitForJobRun<Result>(jobRunId: string, options: JobTrackingOptions = {}): Promise<Result> {
	const version = sessionVersion;
	const record = (status: TrackedJob["status"], message: string | null = null) => {
		if (version === sessionVersion) recordJob(jobRunId, status, options, message);
	};
	record("QUEUED");
	try {
		for (;;) {
			const { data } = await api.get<JobRun<Result>>(`/jobs/runs/${encodeURIComponent(jobRunId)}`);
			record(data.status, data.error_message);
			if (data.status === "FAILED") throw new Error(data.error_message || "Esecuzione fallita");
			if (data.status === "SUCCESS" || data.status === "PARTIAL") {
				if (data.result === null) throw new Error("Risultato dell'esecuzione non disponibile");
				return data.result;
			}
			await new Promise<void>(resolve => setTimeout(resolve, 2_000));
		}
	} catch (error) {
		if (trackedJobs.find(job => job.job_run_id === jobRunId)?.status !== "FAILED") {
			record("MONITORING_ERROR",
				error instanceof Error ? error.message : "Monitoraggio non disponibile");
		}
		throw error;
	}
}