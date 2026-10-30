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

export async function waitForJobRun<Result>(jobRunId: string): Promise<Result> {
	for (;;) {
		const { data } = await api.get<JobRun<Result>>(`/jobs/runs/${encodeURIComponent(jobRunId)}`);
		if (data.status === "FAILED") throw new Error(data.error_message || "Esecuzione fallita");
		if (data.status === "SUCCESS" || data.status === "PARTIAL") {
			if (data.result === null) throw new Error("Risultato dell'esecuzione non disponibile");
			return data.result;
		}
		await new Promise<void>(resolve => setTimeout(resolve, 2_000));
	}
}