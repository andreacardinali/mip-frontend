import axios from "axios";
import { notifyOperation, notifyOperationError, operationLabel, trackJob } from "../services/operationFeedback";

declare module "axios" {
  interface AxiosRequestConfig {
    silentFeedback?: boolean;
  }
}

function feedbackLabel(config: { url?: string; method?: string; silentFeedback?: boolean }) {
  const method = config.method?.toLowerCase() ?? "get";
  if (config.silentFeedback || !["post", "put", "patch", "delete"].includes(method) || config.url === "/auth/login") return null;
  return operationLabel(config.url ?? "", method);
}

const api = axios.create({
  baseURL: "http://mip.internal:8000/api",
});

api.interceptors.request.use(
  (config) => {
    const label = feedbackLabel(config);
    if (label) notifyOperation(`${label}: avvio in corso.`);
    const token =
      localStorage.getItem(
        "access_token"
      );

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  }
);

api.interceptors.response.use(
  (response) => {
    const label = feedbackLabel(response.config);
    if (label) {
      const data = response.data;
      const jobMatch = response.config.url?.match(/^\/admin\/system\/scheduler\/jobs\/([^/]+)\/run$/);
      if (jobMatch && data?.job_run_id) {
        trackJob(data.job_run_id, decodeURIComponent(jobMatch[1]));
        notifyOperation(`${label}: esecuzione richiesta.`);
      } else if (response.config.url === "/market-data/prices/refresh") {
        notifyOperation(data?.enqueued_count > 0
          ? `${label}: ${data.enqueued_count} strumenti accodati.`
          : `${label}: nessun nuovo aggiornamento da accodare.`, "info");
      } else {
        const status = typeof data?.status === "string" ? data.status.toUpperCase() : "SUCCESS";
        const failed = ["FAILED", "ERROR"].includes(status);
        const partial = ["PARTIAL", "INCOMPLETE"].includes(status);
        const pending = response.status === 202 || ["PENDING", "QUEUED", "RUNNING", "PROCESSING"].includes(status);
        notifyOperation(`${label}: ${failed ? "operazione fallita" : partial ? "completata parzialmente" : pending ? "richiesta accettata" : status === "SKIPPED" ? "operazione non eseguita" : "completata"}.`,
          failed ? "error" : partial || status === "SKIPPED" ? "warning" : pending ? "info" : "success");
      }
    }
    return response;
  },

  (error) => {
    if (error.config) {
      const label = feedbackLabel(error.config);
      if (label) {
        const detail = error.response?.data?.detail;
        const message = error.config.url === "/screener/analyze" && error.response?.status === 409
          ? "Un'altra analisi e' gia' in corso. Riprova al termine."
          : typeof detail === "string" ? detail : "Operazione non riuscita.";
        notifyOperationError(error, `${label}: ${message}`);
      }
    }
    if (
      error.response?.status === 401
    ) {
      localStorage.removeItem(
        "access_token"
      );

      window.location.href =
        "/login";
    }

    return Promise.reject(error);
  }
);

export default api;