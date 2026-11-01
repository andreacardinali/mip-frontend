import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(readFileSync(new URL("../src/components/ScreenerRunLogDialog.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function renderLogs({ admin = true, jobRunId = "job-1", cached = [], batches = [], queryState = {} } = {}) {
  let options;
  const requests = [];
  const exports = {};
  const element = (type, props) => ({ type, props });
  runInNewContext(compiled, {
    exports,
    require: name => {
      if (name === "react/jsx-runtime") return { jsx: element, jsxs: element };
      if (name === "react") return { useState: () => [true, () => {}], useRef: () => ({ current: null }), useEffect: () => {} };
      if (name === "@tanstack/react-query") return {
        useQueryClient: () => ({ getQueryData: () => cached }),
        useQuery: config => { options = config; return { ...queryState, refetch: () => {} }; },
      };
      if (name === "@mui/material") return Object.fromEntries([
        "Alert", "Box", "Button", "Dialog", "DialogActions", "DialogContent", "DialogTitle", "FormControlLabel", "LinearProgress", "Stack", "Switch", "Typography",
      ].map(component => [component, component]));
      if (name === "../contexts/AuthProvider") return { useAuth: () => ({ user: { roles: admin ? ["ADMIN"] : [] } }) };
      if (name === "../services/systemAdmin") return { listSchedulerRunLogs: async (...args) => { requests.push(args); return batches.shift() ?? []; } };
      assert.equal(name, "../services/timestamps");
      return { formatLogTimestamp: value => value, formatTimestamp: value => value };
    },
  });
  const tree = exports.default({ run: {
    screener_run_id: "run-1", job_run_id: jobRunId, status: "RUNNING", started_at: "2026-01-01",
    phase_results: { ranking: "completed" }, error_message: null,
  }, onClose: () => {} });
  return { options, tree, requests };
}

test("admin log reader appends pages using the last cached log ID", async () => {
  const page = Array.from({ length: 500 }, (_, index) => ({ log_id: index + 8 }));
  const { options, requests } = renderLogs({ cached: [{ log_id: 7 }], batches: [page, [{ log_id: 508 }]] });
  assert.equal(options.enabled, true);
  assert.equal(options.refetchInterval, 2000);
  const entries = await options.queryFn();
  assert.equal(entries.length, 502);
  assert.equal(entries[0].log_id, 7);
  assert.equal(entries.at(-1).log_id, 508);
  assert.deepEqual(requests, [["job-1", 7], ["job-1", 507]]);
});

test("non-admin users do not request scheduler logs and see phase results", () => {
  const { options, tree, requests } = renderLogs({ admin: false });
  assert.equal(options.enabled, false);
  assert.deepEqual(requests, []);
  assert.match(JSON.stringify(tree), /riservato agli amministratori/);
  assert.match(JSON.stringify(tree), /ranking/);
});

test("legacy runs without a scheduler ID show phase results without a log request", () => {
  const { options, tree } = renderLogs({ jobRunId: null });
  assert.equal(options.enabled, false);
  assert.match(JSON.stringify(tree), /non ha un log scheduler/);
});

test("log query errors and empty results are explicit", () => {
  assert.match(JSON.stringify(renderLogs({ queryState: { isError: true } }).tree), /Impossibile caricare/);
  assert.match(JSON.stringify(renderLogs({ queryState: { isSuccess: true, data: [] } }).tree), /Nessun log disponibile/);
});