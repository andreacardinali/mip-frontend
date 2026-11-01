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

const dashboardCompiled = ts.transpileModule(readFileSync(new URL("../src/pages/DashboardPage.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function renderDashboard({ admin = true, status = "SUCCESS", pending = false, jobsAvailable = true } = {}) {
  const requests = [];
  const exports = {};
  const element = (type, props) => ({ type, props });
  runInNewContext(dashboardCompiled, {
    exports,
    require: name => {
      if (name === "react/jsx-runtime") return { jsx: element, jsxs: element };
      if (name === "react") return { useState: () => [null, () => {}] };
      if (name === "react-router-dom") return { Link: "Link" };
      if (name === "@tanstack/react-query") return {
        useQueryClient: () => ({}),
        useMutation: () => ({ isPending: pending, mutate: jobKey => requests.push(jobKey) }),
        useQuery: ({ queryKey }) => {
          if (queryKey[0] === "market-screener-contexts") return { data: [], isSuccess: true };
          if (queryKey[0] === "market-screener-runs") return { isSuccess: true, data: [1, 2].map(index => ({
            screener_run_id: `run-${index}`, job_run_id: `job-${index}`, job_key: "historical-job", status: "SUCCESS",
          })) };
          if (queryKey[0] === "scheduler-jobs") return { isSuccess: jobsAvailable, data: jobsAvailable ? [{
            job_key: "market_screener_pipeline", last_status: status, request_only: false,
          }] : undefined };
          return {};
        },
      };
      if (name === "@mui/material") return Object.fromEntries([
        "Alert", "Box", "Button", "Chip", "Dialog", "DialogContent", "DialogTitle", "IconButton", "LinearProgress", "Stack", "Table", "TableBody", "TableCell", "TableContainer", "TableHead", "TableRow", "Tooltip", "Typography",
      ].map(component => [component, component]));
      if (name === "@mui/icons-material") return Object.fromEntries(["ArrowForward", "Close", "Description", "PlayArrow", "Refresh"].map(icon => [icon, icon]));
      if (name === "../contexts/AuthProvider") return { useAuth: () => ({ user: { roles: admin ? ["ADMIN"] : [] } }) };
      if (name === "../services/timestamps") return { formatTimestamp: value => value };
      if (["../services/marketScreener", "../services/systemAdmin", "../services/operationFeedback"].includes(name)) return {};
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  const nodes = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    nodes.push(node);
    visit(node.props?.children);
  }
  visit(exports.default());
  return { nodes, requests };
}

test("dashboard has one pipeline run button and only log buttons in historical rows", () => {
  const { nodes, requests } = renderDashboard();
  const buttons = nodes.filter(node => node.type === "Button" && node.props.children === "Esegui job");
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].props.disabled, false);
  buttons[0].props.onClick();
  assert.deepEqual(requests, ["market_screener_pipeline"]);
  assert.equal(nodes.filter(node => node.type === "IconButton" && node.props["aria-label"] === "Esegui job").length, 0);
  assert.equal(nodes.filter(node => node.type === "IconButton" && node.props["aria-label"] === "Visualizza log").length, 2);
});

test("dashboard prevents starting an active job or a job without available scheduler state", () => {
  for (const settings of [{ status: "RUNNING" }, { status: "QUEUED" }, { pending: true }, { jobsAvailable: false }]) {
    const { nodes, requests } = renderDashboard(settings);
    const button = nodes.find(node => node.type === "Button" && node.props.children === "Esegui job");
    assert.equal(button.props.disabled, true);
    button.props.onClick();
    assert.deepEqual(requests, []);
  }
});

test("dashboard hides the run control from non-admin users", () => {
  const { nodes } = renderDashboard({ admin: false });
  assert.equal(nodes.filter(node => node.type === "Button" && node.props.children === "Esegui job").length, 0);
});

const entitiesCompiled = ts.transpileModule(readFileSync(new URL("../src/pages/EntitiesPage.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function renderEntities(pending) {
  const exports = {};
  const queries = [];
  const invalidations = [];
  let mutation;
  const element = (type, props) => ({ type, props });
  runInNewContext(entitiesCompiled, {
    exports,
    require: name => {
      if (name === "react/jsx-runtime") return { jsx: element, jsxs: element };
      if (name === "react") return { useState: initial => [initial, () => {}], useDeferredValue: value => value };
      if (name === "react-router-dom") return { Link: "Link", useParams: () => ({ id: "entity" }) };
      if (name === "@tanstack/react-query") return {
        useIsMutating: () => pending ? 1 : 0,
        useQueryClient: () => ({ invalidateQueries: async options => { invalidations.push(options); } }),
        useMutation: options => { mutation = options; return {}; },
        useQuery: options => { queries.push(options); return {}; },
      };
      if (name === "@mui/material") return Object.fromEntries([
        "Accordion", "AccordionDetails", "AccordionSummary", "Alert", "Box", "Button", "Chip", "LinearProgress", "Link", "MenuItem", "Stack", "TextField", "Typography",
      ].map(component => [component, component]));
      if (name === "@mui/x-data-grid") return { DataGrid: "DataGrid" };
      if (name.startsWith("@mui/icons-material/")) return { __esModule: true, default: name };
      if (name === "../services/timestamps") return { formatTimestamp: value => value };
      if (name === "../services/entities" || name === "../services/marketScreener") return {};
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  exports.default();
  return { queries, mutation, invalidations };
}

test("entity queries refresh while analysis is running and stop polling afterward", () => {
  for (const pending of [true, false]) {
    const { queries } = renderEntities(pending);
    assert.equal(queries.length, 2);
    assert.ok(queries.every(query => query.refetchInterval === (pending ? 2000 : false)));
    assert.equal(queries.find(query => query.queryKey[0] === "entity-overview").enabled, true);
  }
});

test("entity queries invalidate on settlement including failed analyses with committed results", async () => {
  const { mutation, invalidations } = renderEntities(false);
  await mutation.onSettled(undefined, new Error("enrichment unavailable"));
  assert.equal(invalidations.length, 1);
  const { predicate } = invalidations[0];
  for (const key of ["entities", "entity-overview", "market-screener", "market-screener-detail"]) {
    assert.equal(predicate({ queryKey: [key] }), true);
  }
  assert.equal(predicate({ queryKey: ["news"] }), false);
});