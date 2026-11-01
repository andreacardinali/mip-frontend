import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(
  readFileSync(new URL("../src/services/jobRuns.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function service(get) {
  const exports = {};
  runInNewContext(compiled, {
    exports, Date, Error, setTimeout: callback => { callback(); },
    require: name => {
      assert.equal(name, "../api/api");
      return { __esModule: true, default: { get } };
    },
  });
  return exports;
}

test("tracks real state changes once, preserves context and returns the result", async () => {
  const states = ["QUEUED", "RUNNING", "RUNNING", "SUCCESS"];
  const result = { updated: 2 };
  const api = service(async path => {
    assert.equal(path, "/jobs/runs/job%2Fid");
    const status = states.shift();
    return { data: { status, error_message: null, result: status === "SUCCESS" ? result : null } };
  });
  let notifications = 0;
  const unsubscribe = api.subscribeTrackedJobs(() => { notifications++; });
  const context = { context_type: "INSTRUMENT", context_id: "instrument" };
  assert.strictEqual(await api.waitForJobRun("job/id", { label: "Analisi", context }), result);
  const [job] = api.getTrackedJobs();
  assert.equal(job.label, "Analisi");
  assert.strictEqual(job.context, context);
  assert.deepEqual(Array.from(job.events, event => event.status), ["QUEUED", "RUNNING", "SUCCESS"]);
  assert.equal(notifications, 3);
  unsubscribe();
});

test("partial completion remains partial", async () => {
  const result = { failed: 1 };
  const api = service(async () => ({ data: { status: "PARTIAL", error_message: null, result } }));
  assert.strictEqual(await api.waitForJobRun("partial"), result);
  assert.equal(api.getTrackedJobs()[0].status, "PARTIAL");
});

test("job failures are distinct from failures to monitor a job", async () => {
  const failed = service(async () => ({ data: { status: "FAILED", error_message: "Scan fallita", result: null } }));
  await assert.rejects(failed.waitForJobRun("failed"), /Scan fallita/);
  assert.equal(failed.getTrackedJobs()[0].status, "FAILED");
  assert.equal(failed.getTrackedJobs()[0].events.at(-1).message, "Scan fallita");
  const offline = service(async () => { throw new Error("Offline"); });
  await assert.rejects(offline.waitForJobRun("offline"), /Offline/);
  assert.equal(offline.getTrackedJobs()[0].status, "MONITORING_ERROR");
});

test("missing results reject and completed history is bounded", async () => {
  const missing = service(async () => ({ data: { status: "SUCCESS", error_message: null, result: null } }));
  await assert.rejects(missing.waitForJobRun("missing"), /non disponibile/);
  assert.equal(missing.getTrackedJobs()[0].status, "MONITORING_ERROR");
  const api = service(async () => ({ data: { status: "SUCCESS", error_message: null, result: {} } }));
  for (let index = 0; index < 60; index++) await api.waitForJobRun(`job-${index}`);
  assert.equal(api.getTrackedJobs().length, 50);
  assert.equal(api.getTrackedJobs()[0].job_run_id, "job-59");
});

test("logout clears history and late responses cannot recreate it", async () => {
  let finish;
  const api = service(() => new Promise(resolve => { finish = resolve; }));
  const pending = api.waitForJobRun("old-session");
  assert.equal(api.getTrackedJobs().length, 1);
  api.clearTrackedJobs();
  finish({ data: { status: "SUCCESS", error_message: null, result: {} } });
  await pending;
  assert.equal(api.getTrackedJobs().length, 0);
});

const panelCompiled = ts.transpileModule(
  readFileSync(new URL("../src/components/JobDiagnostics.tsx", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } },
).outputText;

function panel({ admin = false, open = false, tab = "session", previousLogs = [] } = {}) {
  const queries = [];
  const states = [open, tab, null, null];
  const requests = [];
  const run = { job_run_id: "run-1", started_at: "2026-11-01T10:00:00Z", status: "RUNNING", job_name: "Scan" };
  const jobs = [{ job_run_id: "manual", status: "RUNNING", events: [], context: { context_type: "INSTRUMENT", context_id: "instrument" } }];
  const jsx = (type, props) => ({ type, props });
  const modules = {
    "react": { useState: () => [states.shift(), () => {}], useSyncExternalStore: () => jobs },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@mui/material": {}, "@mui/icons-material": {},
    "@tanstack/react-query": {
      useQueryClient: () => ({ getQueryData: () => previousLogs }),
      useQuery: options => {
        queries.push(options);
        const data = options.queryKey[0] === "job-diagnostics-scheduler" ? [run] : undefined;
        return { data, isPending: false, isError: false };
      },
    },
    "../contexts/AuthProvider": { useAuth: () => ({ user: { user_id: "user", roles: admin ? ["ADMIN"] : [] } }) },
    "../services/jobRuns": { getTrackedJobs: () => jobs, subscribeTrackedJobs: () => () => {} },
    "../services/timestamps": { formatLogTimestamp: value => value },
    "../services/marketScreener": { getScreenerAnalysisProgress: async () => null },
    "../services/systemAdmin": {
      listSchedulerJobs: async () => [{ job_key: "scan", job_name: "Scan" }],
      listSchedulerJobRuns: async () => [run],
      listSchedulerRunLogs: async (...args) => {
        requests.push(args);
        return Array.from({ length: 500 }, (_, index) => ({ log_id: 1001 + index, message: "Log" }));
      },
    },
  };
  const exports = {};
  runInNewContext(panelCompiled, {
    exports, require: name => {
      assert.ok(name in modules, `Unexpected import ${name}`);
      return modules[name];
    },
  });
  const tree = exports.default();
  return { queries, requests, tree };
}

test("closed diagnostics do not poll, even for administrators", () => {
  const { queries } = panel({ admin: true, tab: "scheduler" });
  assert.ok(queries.every(query => !query.enabled && query.refetchInterval === false));
});

test("non-administrators never enable scheduler or log queries", () => {
  const { queries } = panel({ open: true, tab: "scheduler" });
  assert.equal(queries[0].enabled, false);
  assert.equal(queries[1].enabled, false);
});

test("open session diagnostics poll progress, not administrative logs", () => {
  const { queries } = panel({ open: true });
  assert.equal(queries[0].enabled, false);
  assert.equal(queries[1].enabled, false);
  assert.equal(queries[2].enabled, true);
  assert.equal(queries[2].refetchInterval, 2000);
});

test("admin logs use a cursor and retain at most 1000 entries", async () => {
  const previousLogs = Array.from({ length: 1000 }, (_, index) => ({ log_id: index + 1 }));
  const { queries, requests } = panel({ admin: true, open: true, tab: "scheduler", previousLogs });
  assert.equal(queries[0].enabled, true);
  assert.equal(queries[1].enabled, true);
  const result = await queries[1].queryFn();
  assert.equal(requests[0][0], "run-1");
  assert.equal(requests[0][1], 1000);
  assert.equal(requests[0][2], 500);
  assert.equal(result.length, 1000);
  assert.equal(result[0].log_id, 501);
  assert.equal(result.at(-1).log_id, 1500);
});