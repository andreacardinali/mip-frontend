import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const marketScreenerLabelsExports = {};
runInNewContext(ts.transpileModule(readFileSync(new URL("../src/services/marketScreenerLabels.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: marketScreenerLabelsExports });

const opportunityColumnsExports = {};
runInNewContext(ts.transpileModule(readFileSync(new URL("../src/components/screenerOpportunityColumns.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, {
  exports: opportunityColumnsExports,
  require: name => {
    if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === "react-router-dom") return { Link: "Link" };
    if (name === "@mui/material") return Object.fromEntries(["Chip", "IconButton", "Link", "Stack", "Tooltip", "Typography"].map(component => [component, component]));
    if (name.startsWith("@mui/icons-material/")) return { __esModule: true, default: name };
    if (name === "../services/timestamps") return { formatTimestamp: value => value };
    if (name === "../services/marketScreenerLabels") return marketScreenerLabelsExports;
    throw new Error(`Unexpected module: ${name}`);
  },
});

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

function renderEntities(pending, overview, mutationState = {}) {
  const exports = {};
  const queries = [];
  const invalidations = [];
  const navigations = [];
  let mutation;
  const element = (type, props) => ({ type, props });
  runInNewContext(entitiesCompiled, {
    exports,
    require: name => {
      if (name === "react/jsx-runtime") return { jsx: element, jsxs: element };
      if (name === "react") return { useState: initial => [initial, () => {}], useDeferredValue: value => value };
      if (name === "react-router-dom") return { Link: "Link", useParams: () => ({ id: "entity" }), useNavigate: () => destination => navigations.push(destination) };
      if (name === "../components/screenerOpportunityColumns") return opportunityColumnsExports;
      if (name === "../services/marketScreenerLabels") return marketScreenerLabelsExports;
      if (name === "@tanstack/react-query") return {
        useIsMutating: () => pending ? 1 : 0,
        useQueryClient: () => ({ invalidateQueries: async options => { invalidations.push(options); } }),
        useMutation: options => { mutation = options; return mutationState; },
        useQuery: options => { queries.push(options); return { data: options.queryKey[0] === "entity-overview" ? overview : undefined }; },
      };
      if (name === "@mui/material") return Object.fromEntries([
        "Accordion", "AccordionDetails", "AccordionSummary", "Alert", "Box", "Button", "Chip", "LinearProgress", "Link", "MenuItem", "Stack", "TextField", "Tooltip", "Typography",
      ].map(component => [component, component]));
      if (name === "@mui/x-data-grid") return { DataGrid: "DataGrid" };
      if (name.startsWith("@mui/icons-material/")) return { __esModule: true, default: name };
      if (name === "../services/timestamps") return { formatTimestamp: value => value };
      if (name === "../services/marketScreenerLabels") return marketScreenerLabelsExports;
      if (name === "../services/entities" || name === "../services/marketScreener") return {};
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  const tree = exports.default();
  return { queries, mutation, invalidations, navigations, tree };
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

const entityOverview = {
  entity: { entity_id: "entity", name: "Example", entity_type: "COMPANY" },
  asset_match: { portfolio_positions: [], watchlist_names: [], watchlist_items: [] },
  instruments: [], universes: [], news: [], news_count: 0, catalysts: [], catalyst_count: 0,
  opportunities: [{
    opportunity_id: "opportunity", entity_id: "entity", entity_name: "Example & Co", source_symbol: "EXAMPLE", symbol: "EXAMPLE", strategy_code: "MOMENTUM", direction: "LONG",
    signal_type: "BUY", origin: "CORE", consensus_direction: "LONG", strategy_count: 2,
    portfolio_match: false, portfolio_match_type: "NO_MATCH", portfolio_symbols: [],
    attention_score: 70, composite_score: 82.25, verdict: null, summary: null,
    technical_score: 75, quant_score: 60, llm_score: null, reference_price: 100,
    invalidation_price: 95, target_price: 110, signal_reasons: ["Trend positivo"], technical_evidence: { rsi: 55 },
  }],
};

function entityNodes(overview = entityOverview, mutationState = {}) {
  const nodes = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    nodes.push(node);
    visit(node.props?.children);
  }
  visit(renderEntities(false, overview, mutationState).tree);
  return nodes;
}

test("entity retains explicit analysis outcomes even when no signal is produced", () => {
  for (const [scan, status, severity, message] of [
    [{ evaluated_instrument_ids: ["instrument"], candidates: 0, skipped: 0, failures: 0 }, "SUCCESS", "success", "Analisi tecnica completata: nessun segnale prodotto."],
    [{ evaluated_instrument_ids: ["instrument"], candidates: 0, skipped: 1, failures: 0, skipped_by_reason: { NO_TECHNICAL_SIGNAL: 1, INSUFFICIENT_HISTORY: 0 } }, "SUCCESS", "success", "Analisi tecnica completata: nessun segnale prodotto."],
    [{ evaluated_instrument_ids: [], candidates: 0, skipped: 1, failures: 0, skipped_by_reason: { INSUFFICIENT_HISTORY: 1 } }, "SUCCESS", "warning", "nessuno strumento valutato"],
    [{ evaluated_instrument_ids: ["instrument"], candidates: 0, skipped: 1, failures: 0 }, "PARTIAL", "warning", "Analisi tecnica parziale: nessun segnale prodotto."],
    [{ evaluated_instrument_ids: ["instrument"], candidates: 2, skipped: 0, failures: 0 }, "SUCCESS", "success", "Analisi tecnica completata."],
    [{}, "SUCCESS", "warning", "numero di strumenti valutati non e' disponibile"],
    [{ evaluated_instrument_ids: [], candidates: 0, skipped: 0, failures: 1 }, "FAILED", "error", "analisi fallita."],
  ]) {
    const nodes = entityNodes(entityOverview, {
      variables: { context_type: "ENTITY", context_id: "entity" },
      data: { status, run_id: "run", scan },
    });
    const alert = nodes.find(node => node.type === "Alert");
    assert.equal(alert.props.severity, severity);
    const content = JSON.stringify(alert);
    assert.ok(content.includes(message), message);
    assert.ok(content.includes("Strumenti valutati:"));
    assert.ok(content.includes("Segnali prodotti:"));
    assert.ok(content.includes("Esclusi dalla generazione di segnali:"));
    assert.ok(content.includes("Dettagli dell'esecuzione"));
    if (scan.skipped_by_reason) {
      assert.ok(content.includes("Non valutati per storico insufficiente:"));
      assert.ok(content.includes("Valutati senza segnale tecnico:"));
    }
  }
});

test("entity exposes pending and failed requests without claiming completion", () => {
  for (const mutationState of [
    { isPending: true },
    { isError: true, error: new Error("Storico non disponibile") },
  ]) {
    const nodes = entityNodes(entityOverview, { ...mutationState, variables: { context_type: "ENTITY", context_id: "entity" } });
    const alert = nodes.find(node => node.type === "Alert");
    assert.equal(alert.props.severity, mutationState.isPending ? "info" : "error");
    assert.ok(JSON.stringify(alert).includes(mutationState.isPending ? "in attesa dell'esito" : "Storico non disponibile"));
  }
});

test("entity scopes the analysis outcome to the requested entity or instrument", () => {
  const mutationState = { isPending: true, variables: { context_type: "INSTRUMENT", context_id: "instrument" } };
  const overview = { ...entityOverview, instruments: [{ instrument_id: "instrument", symbol: "EXAMPLE" }] };
  assert.ok(JSON.stringify(entityNodes(overview, mutationState)).includes("Analisi richiesta per "));
  assert.equal(entityNodes(entityOverview, mutationState).some(node => node.type === "Alert"), false);
  assert.equal(entityNodes(overview, { isPending: true, variables: { context_type: "ENTITY", context_id: "other-entity" } }).some(node => node.type === "Alert"), false);
});

test("entity labels distinguish loading from completed technical evaluations", () => {
  for (const lastAnalysis of [null, undefined, "2026-11-01T21:30:00Z"]) {
    const nodes = entityNodes({
      ...entityOverview,
      observed_at: "2026-11-01T21:45:00Z",
      last_analysis_at: lastAnalysis,
      instruments: [{ instrument_id: "instrument", symbol: "EXAMPLE" }],
    });
    const content = JSON.stringify(nodes);
    assert.ok(content.includes("Scheda caricata: "));
    assert.ok(nodes.some(node => node.type === "Button" && node.props.children === "Ricarica scheda"));
    assert.ok(!content.includes("Scheda aggiornata:"));
    assert.ok(!content.includes("Ultima analisi strumenti:"));
    if (lastAnalysis) {
      assert.ok(content.includes(`Ultima analisi tecnica registrata (almeno uno strumento): ${lastAnalysis}`));
      assert.ok(content.includes("Non certifica l'analisi di tutti gli strumenti."));
    } else {
      assert.ok(content.includes("Analisi tecnica: nessuna valutazione completata registrata"));
      assert.ok(content.includes("Non indica un errore di caricamento dei dati"));
      assert.ok(content.includes("non coprono necessariamente tutti gli strumenti"));
    }
    for (const tooltip of nodes.filter(node => node.type === "Tooltip")) {
      assert.equal(tooltip.props.describeChild, true);
      assert.equal(tooltip.props.children.props.tabIndex, 0);
    }
  }
});

test("entity without instruments has an explicit technical analysis state", () => {
  const nodes = entityNodes({ ...entityOverview, last_analysis_at: null });
  assert.ok(nodes.some(node => node.props.children === "Analisi tecnica: nessuno strumento associato"));
});

test("entity counters link to section anchors and catalysts precede news", () => {
  const nodes = entityNodes();
  for (const section of ["entity-catalysts", "entity-news", "entity-signals"]) {
    const counter = nodes.find(node => node.type === "Chip" && node.props.href === `#${section}`);
    assert.equal(counter.props.component, "a");
    assert.equal(counter.props.clickable, true);
    const heading = nodes.find(node => node.props.id === section);
    assert.equal(heading.props.component, "h2");
    assert.ok(heading.props.sx.scrollMarginTop > 0);
  }
  assert.ok(nodes.findIndex(node => node.props.id === "entity-catalysts") < nodes.findIndex(node => node.props.id === "entity-news"));
});

test("entity analysis results expose quantitative data and separate unavailable AI", () => {
  const nodes = entityNodes();
  const grid = nodes.find(node => node.type === "DataGrid" && node.props.rows === entityOverview.opportunities);
  for (const field of ["technical_score", "quant_score", "llm_score", "composite_score"]) {
    assert.ok(grid.props.columns.some(column => column.field === field));
  }
  const details = nodes.find(node => node.type === "AccordionDetails" && node.props.id === "analysis-opportunity");
  const content = JSON.stringify(details);
  for (const expected of ["Analisi tecnica e quantitativa", "Trend positivo", "100", "95", "110", "rsi", "Arricchimento AI", "Nessun arricchimento AI disponibile."]) {
    assert.ok(content.includes(expected), expected);
  }
});

test("entity empty results retain navigation anchors without creating analysis details", () => {
  const nodes = entityNodes({ ...entityOverview, opportunities: [] });
  assert.ok(nodes.some(node => node.props.id === "entity-signals"));
  assert.ok(nodes.some(node => node.props.children === "Nessun segnale attivo."));
  assert.equal(nodes.some(node => node.props.id === "analysis-opportunity"), false);
});

test("entity memberships use consistent labels and link each distinct watchlist by ID", () => {
  const nodes = entityNodes({
    ...entityOverview,
    asset_match: {
      ...entityOverview.asset_match,
      in_portfolio: true,
      portfolio_positions: [{ position_id: "position", portfolio_id: "portfolio", portfolio_name: "Core", symbol: "EXAMPLE", quantity: 2, match_type: "EXACT_INSTRUMENT" }],
      watchlist_names: ["Preferiti"],
      watchlist_items: [
        { watchlist_item_id: "item-one", watchlist_id: "first", watchlist_name: "Preferiti", entity_id: "entity" },
        { watchlist_item_id: "item-two", watchlist_id: "first", watchlist_name: "Preferiti", entity_id: "entity" },
        { watchlist_item_id: "item-three", watchlist_id: "second", watchlist_name: "Preferiti", entity_id: "entity" },
      ],
    },
    universes: [{ universe_id: "universe", name: "Mercato", code: "MARKET", universe_type: "CUSTOM" }],
  });
  const links = nodes.filter(node => node.type === "Link" && node.props.to);
  for (const [destination, label] of [
    ["/portfolios/portfolio", "Portafoglio: Core"],
    ["/watchlists/first", "Watchlist: Preferiti"],
    ["/watchlists/second", "Watchlist: Preferiti"],
    ["/universes/universe", "Universo: Mercato"],
  ]) {
    const matching = links.filter(node => node.props.to === destination);
    assert.equal(matching.length, 1, destination);
    assert.equal(matching[0].props.children.join(""), label);
    assert.equal(matching[0].props.component, "Link");
  }
  assert.equal(nodes.some(node => node.props.children === "Watchlist: Nessuna"), false);
});

test("entity memberships show an explicit empty watchlist state without links", () => {
  const nodes = entityNodes();
  assert.ok(nodes.some(node => node.props.children === "Watchlist: Nessuna"));
  assert.equal(nodes.some(node => node.type === "Link" && node.props.to?.startsWith("/watchlists/")), false);
});

test("signal chips preserve screener labels and colors for all directions and AI verdicts", () => {
  const columns = opportunityColumnsExports.screenerOpportunityColumns(() => {});
  const row = entityOverview.opportunities[0];
  const cell = (field, overrides) => {
    const tooltip = columns.find(column => column.field === field).renderCell({ row: { ...row, ...overrides } });
    assert.equal(tooltip.type, "Tooltip");
    assert.equal(tooltip.props.describeChild, true);
    assert.ok(tooltip.props.title.length > 20);
    assert.equal(tooltip.props.children.props.tabIndex, 0);
    return tooltip.props.children.props;
  };
  for (const [signal_type, color] of [["BUY", "success"], ["STRONG_BUY", "success"], ["SELL", "error"], ["STRONG_SELL", "error"], [null, "default"]]) {
    assert.equal(cell("signal_type", { signal_type }).color, color);
    assert.equal(cell("signal_type", { signal_type }).label, `${marketScreenerLabelsExports.signalTypeLabel(signal_type)} · ${marketScreenerLabelsExports.strategyLabel("MOMENTUM")}`);
  }
  for (const [direction, color] of [["LONG", "success"], ["SHORT", "error"], ["NEUTRAL", "default"]]) {
    assert.equal(cell("direction", { direction }).color, color);
  }
  for (const [origin, color] of [["CORE", "primary"], ["DISCOVERY", "secondary"], ["OTHER", "default"]]) {
    assert.equal(cell("origin", { origin }).color, color);
  }
  for (const [consensus_direction, color] of [["LONG", "success"], ["SHORT", "error"], ["CONFLICT", "warning"], ["NEUTRAL", "default"]]) {
    const chip = cell("consensus_direction", { consensus_direction });
    assert.equal(chip.color, color);
    assert.equal(chip.label, `${marketScreenerLabelsExports.consensusLabel(consensus_direction)} · 2`);
  }
  for (const [verdict, color, label] of [["CONFIRM", "success", "Confermato dall'AI"], ["REVIEW", "warning", "Da approfondire"], ["REJECT", "error", "Non confermato dall'AI"], [null, "default", "Non disponibile"]]) {
    assert.equal(cell("verdict", { verdict }).color, color);
    assert.equal(cell("verdict", { verdict }).label, label);
  }
  for (const [portfolio_match_type, color, label] of [["EXACT_INSTRUMENT", "success", "Strumento posseduto"], ["SAME_ISIN", "primary", "Stesso ISIN"], ["SAME_ENTITY", "info", "Stessa entità"]]) {
    const chip = cell("portfolio_match_type", { portfolio_match: true, portfolio_match_type, portfolio_symbols: ["EXAMPLE"] });
    assert.equal(chip.color, color);
    assert.equal(chip.label, `${label} · EXAMPLE`);
  }
});

test("signal scores retain screener thresholds and unavailable AI presentation", () => {
  const columns = opportunityColumnsExports.screenerOpportunityColumns(() => {});
  const row = entityOverview.opportunities[0];
  for (const field of ["attention_score", "technical_score", "quant_score", "llm_score", "composite_score"]) {
    for (const [value, color, text] of [[null, "text.secondary", "–"], [39.9, "error.main", "39.9"], [40, "warning.main", "40.0"], [69.9, "warning.main", "69.9"], [70, "success.main", "70.0"]]) {
      const tooltip = columns.find(column => column.field === field).renderCell({ row: { ...row, [field]: value } });
      assert.match(tooltip.props.title, /0-100/);
      if (value === null) assert.match(tooltip.props.title, /Dato non disponibile/);
      const cell = tooltip.props.children;
      assert.equal(cell.props.sx.color, color);
      assert.equal(cell.props.children, text);
      assert.equal(cell.props.sx.fontWeight, field === "composite_score" ? 700 : 600);
    }
  }
  const summary = columns.find(column => column.field === "summary");
  assert.equal(summary.renderCell({ row }).props.children.props.children, "Non analizzato con AI");
  assert.equal(summary.renderCell({ row: { ...row, llm_score: 50 } }).props.children.props.children, "Sintesi non disponibile");
  assert.equal(summary.renderCell({ row: { ...row, summary: "AI summary" } }).props.children.props.children, "AI summary");
});

test("entity signal row and detail icon open the same analysis while the entity link stays independent", () => {
  const { tree, navigations } = renderEntities(false, entityOverview);
  const findGrid = node => {
    if (Array.isArray(node)) return node.map(findGrid).find(Boolean);
    if (!node || typeof node !== "object") return;
    if (node.type === "DataGrid" && node.props.rows === entityOverview.opportunities) return node;
    return findGrid(node.props?.children);
  };
  const grid = findGrid(tree);
  const row = entityOverview.opportunities[0];
  grid.props.onRowClick({ row });
  const icon = grid.props.columns.find(column => column.field === "detail").renderCell({ row }).props.children;
  let stopped = 0;
  icon.props.onClick({ stopPropagation: () => stopped++ });
  assert.equal(icon.props["aria-label"], "Apri analisi di EXAMPLE");
  assert.equal(navigations.length, 2);
  for (const destination of navigations) {
    const url = new URL(destination, "http://localhost");
    assert.equal(url.pathname, "/screener");
    assert.equal(url.searchParams.get("context"), "ENTITY:entity");
    assert.equal(url.searchParams.get("context_name"), "Example & Co");
    assert.equal(url.searchParams.get("opportunity"), "opportunity");
  }
  const link = grid.props.columns.find(column => column.field === "entity_name").renderCell({ row });
  assert.equal(link.props.to, "/entities/entity");
  link.props.onClick({ stopPropagation: () => stopped++ });
  assert.equal(stopped, 2);
  assert.equal(navigations.length, 2);
  assert.equal(grid.props.initialState, opportunityColumnsExports.screenerOpportunityInitialState);
  assert.equal(grid.props.showToolbar, true);
});

const screenerCompiled = ts.transpileModule(readFileSync(new URL("../src/pages/ScreenerPage.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function renderScreener(destination, detail, queryStates = {}) {
  const exports = {};
  const queries = [];
  const requests = [];
  const stateUpdates = [];
  runInNewContext(screenerCompiled, {
    exports,
    URLSearchParams,
    require: name => {
      if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (name === "react") return {
        useState: initial => [typeof initial === "function" ? initial() : initial, value => stateUpdates.push(value)],
        useEffect: () => {}, useMemo: factory => factory(),
      };
      if (name === "react-router-dom") return { useSearchParams: () => [new URL(destination, "http://localhost").searchParams, () => {}] };
      if (name === "../components/screenerOpportunityColumns") return opportunityColumnsExports;
      if (name === "../services/marketScreenerLabels") return marketScreenerLabelsExports;
      if (name === "@tanstack/react-query") return {
        useIsMutating: () => 0, useQueryClient: () => ({}), useMutation: () => ({}),
        useQuery: options => { queries.push(options); return queryStates[options.queryKey[0]] ?? { data: options.queryKey[0] === "market-screener-detail" ? detail : options.queryKey[0] === "context-instruments" ? [] : undefined }; },
      };
      if (name === "@mui/material") return Object.fromEntries([
        "Alert", "Box", "Button", "Chip", "Collapse", "Dialog", "DialogActions", "DialogContent", "DialogTitle", "IconButton", "FormControlLabel", "LinearProgress", "MenuItem", "Paper", "Stack", "Switch", "Tab", "Tabs", "TextField", "Tooltip", "Typography",
      ].map(component => [component, component]));
      if (name === "@mui/x-data-grid") return { DataGrid: "DataGrid" };
      if (name.startsWith("@mui/icons-material/") || ["../components/AlertRuleSettings", "../components/SignalPerformanceHistory", "../components/ScreenerRunLogDialog"].includes(name)) return { __esModule: true, default: name };
      if (name === "../services/timestamps") return { formatTimestamp: value => value };
      if (name === "../services/marketScreener") return { getScreenerOpportunity: id => requests.push(id) };
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  const nodes = [];
  const visit = node => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    nodes.push(node);
    visit(node.props?.children);
  };
  visit(exports.default());
  return { nodes, queries, requests, stateUpdates };
}

test("screener uses the shared grid and opens analysis from the entity navigation URL", () => {
  for (const opportunity of ["opportunity", null]) {
    const destination = opportunity ? "/screener?context=ENTITY:entity&context_name=Example&opportunity=opportunity" : "/screener";
    const { nodes, queries, requests, stateUpdates } = renderScreener(destination);
    const detailQuery = queries.find(query => query.queryKey[0] === "market-screener-detail");
    assert.equal(detailQuery.queryKey[1], opportunity);
    assert.equal(detailQuery.enabled, Boolean(opportunity));
    const dialog = nodes.find(node => node.type === "Dialog" && node.props.children.some(child => child?.type === "DialogTitle" && child.props.children === "Dettaglio opportunità"));
    assert.equal(dialog.props.open, Boolean(opportunity));
    if (opportunity) {
      detailQuery.queryFn();
      assert.deepEqual(requests, [opportunity]);
    }
    const grid = nodes.find(node => node.type === "DataGrid" && node.props.showToolbar);
    assert.equal(grid.props.initialState, opportunityColumnsExports.screenerOpportunityInitialState);
    assert.deepEqual(Array.from(grid.props.columns, column => column.headerName), Array.from(opportunityColumnsExports.screenerOpportunityColumns(() => {}), column => column.headerName));
    grid.props.columns.find(column => column.field === "detail").renderCell({ row: entityOverview.opportunities[0] }).props.children.props.onClick({ stopPropagation: () => {} });
    assert.deepEqual(stateUpdates, ["overview", "opportunity"]);
  }
});

test("screener keeps the last context run outcome and timestamps above an empty table", () => {
  for (const [status, label, severity] of [["SUCCESS", "completato", "success"], ["PARTIAL", "completato parzialmente", "warning"], ["FAILED", "fallito", "error"]]) {
    const { nodes } = renderScreener("/screener?context=ENTITY:entity&context_name=Example", undefined, {
      "market-screener-progress": { data: { screener_run_id: "run", status, started_at: "2026-11-01T09:00:00Z", completed_at: "2026-11-01T09:01:00Z", error_message: status === "FAILED" ? "History unavailable" : null } },
    });
    const alert = nodes.find(node => node.type === "Alert" && JSON.stringify(node).includes("Ultimo run analisi"));
    assert.equal(alert.props.severity, severity);
    const content = JSON.stringify(alert);
    assert.ok(content.includes(label));
    assert.ok(content.includes("Avviato:"));
    assert.ok(content.includes("Terminato:"));
    assert.ok(content.includes("2026-11-01T09:00:00Z"));
    assert.ok(content.includes("2026-11-01T09:01:00Z"));
    if (status === "FAILED") assert.ok(content.includes("History unavailable"));
    const grid = nodes.find(node => node.type === "DataGrid" && node.props.showToolbar);
    assert.equal(grid.props.rows.length, 0);
  }
});

test("screener distinguishes no signals from no instrument evaluation using the persisted scan", () => {
  for (const [summary, message, severity] of [
    [{ evaluated_instrument_ids: ["instrument"], candidates: 0 }, "Nessun segnale tecnico prodotto", "success"],
    [{ evaluated_instrument_ids: [], candidates: 0 }, "Nessuno strumento valutato", "warning"],
    [{ evaluated_instrument_ids: ["instrument"], candidates: 2 }, "Segnali prodotti:", "success"],
  ]) {
    const { nodes } = renderScreener("/screener?context=ENTITY:entity", undefined, {
      "market-screener-progress": { data: { screener_run_id: "run", status: "SUCCESS", phase_results: { analysis_scan: summary } } },
    });
    const alert = nodes.find(node => node.type === "Alert" && JSON.stringify(node).includes("Ultimo run analisi"));
    assert.equal(alert.props.severity, severity);
    assert.ok(JSON.stringify(alert).includes(message));
    assert.ok(JSON.stringify(alert).includes("Strumenti valutati:"));
    assert.ok(JSON.stringify(alert).includes("non disponibile"));
    const grid = nodes.find(node => node.type === "DataGrid" && node.props.showToolbar);
    assert.equal(grid.props.rows.length, 0);
  }
  const { nodes } = renderScreener("/screener?context=ENTITY:entity", undefined, {
    "market-screener-progress": { data: { screener_run_id: "run", status: "SUCCESS", phase_results: {} } },
  });
  assert.equal(JSON.stringify(nodes).includes("Nessun segnale tecnico prodotto"), false);
  assert.equal(JSON.stringify(nodes).includes("Nessuno strumento valutato"), false);
  assert.equal(JSON.stringify(nodes).includes("Strumenti valutati:"), false);
});

test("screener distinguishes missing run history from pending or failed retrieval", () => {
  for (const [state, text] of [
    [{ data: { screener_run_id: null } }, "nessuna esecuzione registrata"],
    [{ isPending: true }, "lettura in corso"],
    [{ isError: true }, "esito non disponibile"],
  ]) {
    const { nodes } = renderScreener("/screener?context=ENTITY:entity&context_name=Example", undefined, { "market-screener-progress": state });
    assert.ok(JSON.stringify(nodes).includes(text));
  }
  const { nodes } = renderScreener("/screener");
  assert.equal(JSON.stringify(nodes).includes("Ultimo run analisi"), false);
});

test("screener shows progress instead of a completed run while queued or running", () => {
  for (const status of ["QUEUED", "RUNNING"]) {
    const { nodes } = renderScreener("/screener?context=ENTITY:entity", undefined, { "market-screener-progress": { data: { screener_run_id: "run", status, phase_results: {} } } });
    assert.equal(JSON.stringify(nodes).includes("Ultimo run analisi"), false);
    assert.ok(nodes.some(node => node.type === "LinearProgress"));
  }
});

test("screener exposes separate phase timestamps with explicit missing values", () => {
  const columns = opportunityColumnsExports.screenerOpportunityColumns(() => {});
  const phases = [
    ["price_as_of", "Ultimo aggiornamento prezzo"],
    ["last_analysis_at", "Ultimo calcolo indicatori"],
    ["signal_observed_at", "Ultimo segnale"],
    ["last_llm_analysis_at", "Ultima analisi AI"],
  ];
  for (const [field, label] of phases) {
    const column = columns.find(item => item.field === field);
    assert.equal(column.headerName, label);
    assert.equal(column.type, "dateTime");
    assert.equal(column.valueFormatter(null), "Non registrata");
    assert.equal(column.renderHeader().props.children.props.children, label);
    for (const value of [null, "2026-11-01T09:01:00Z"]) {
      const cell = column.renderCell({ row: { [field]: value } });
      assert.equal(cell.props.children.props.children, value ?? "Non registrata");
      assert.equal(cell.props.describeChild, true);
      assert.equal(cell.props.children.props.tabIndex, 0);
      assert.ok(value ? cell.props.title.length > 20 : cell.props.title.includes("Nessun dato registrato"));
    }
  }
});

test("analysis descriptions explain strong signals, unavailable values and unknown codes", () => {
  const describe = opportunityColumnsExports.analysisDescription;
  assert.match(describe("signal_type", "STRONG_BUY"), /non una garanzia/);
  assert.match(describe("signal_type", "STRONG_SELL"), /ribassista/);
  assert.match(describe("signal_type", "CUSTOM"), /descrizione non disponibile/);
  assert.match(describe("verdict", null), /Dato non disponibile/);
  assert.match(describe("signal_confidence", 0.8), /Non e una probabilita/);
  assert.match(describe("composite_score", 80), /componenti disponibili/);
  assert.match(describe("strategy_code", "SWING_EXIT"), /non indica qui un ingresso SHORT/);
  assert.match(describe("strategy_code", "UNKNOWN"), /descrizione non disponibile/);
  for (const code of ["TREND_PULLBACK", "SUPERTREND", "PULLBACK_DEEP_OVERSOLD", "SMC_CHOCH", "SMC_BOS", "CALL_ENTRY_SETUP", "SWING_EXIT"]) {
    assert.doesNotMatch(describe("strategy_code", code), /non disponibile/);
  }
});

test("analysis dialog shares accessible descriptions for its signal and AI chips", () => {
  const detail = {
    ...entityOverview.opportunities[0], strategy_code: "SWING_EXIT", signal_type: "SELL",
    signal_trend: "STRONG_BULLISH", signal_timeframe: "1D", signal_confidence: 0.8,
    supporting_strategies: [], opposing_strategies: [], portfolio_positions: [],
    alternative_instruments: [{ instrument_id: "alternative", symbol: "ALT", exchange: "EX", currency_code: "EUR", is_source: false, same_isin: true }],
  };
  const { nodes } = renderScreener("/screener?opportunity=opportunity", detail);
  const tooltips = nodes.filter(node => node.type === "Tooltip" && node.props.children?.type === "Chip");
  for (const [label, field, value] of [
    ["Uscita da swing rialzista", "strategy_code", "SWING_EXIT"], ["Vendita", "signal_type", "SELL"],
    ["Trend: Fortemente rialzista", "signal_trend", "STRONG_BULLISH"],
    ["Timeframe: 1D", "signal_timeframe", "1D"], ["Affidabilità: 80.0%", "signal_confidence", 0.8],
    ["Punteggio AI: –", "llm_score", null], ["Nessun match", "portfolio_match_type", "NO_MATCH"],
  ]) {
    const tooltip = tooltips.find(node => node.props.children.props.label === label);
    assert.ok(tooltip, label);
    assert.equal(tooltip.props.title, opportunityColumnsExports.analysisDescription(field, value));
    assert.equal(tooltip.props.describeChild, true);
    assert.equal(tooltip.props.children.props.tabIndex, 0);
  }
  const alternativeTooltip = tooltips.find(node => node.props.children.props.label === "ALT · EX · EUR · stesso ISIN");
  assert.match(alternativeTooltip.props.title, /stesso ISIN/);
  assert.doesNotMatch(alternativeTooltip.props.title, /portafoglio/);
  const consensusTooltip = nodes.find(node => node.type === "Tooltip" && node.props.children?.type === "Typography" && node.props.title === opportunityColumnsExports.analysisDescription("consensus_direction", "LONG"));
  assert.equal(consensusTooltip.props.children.props.tabIndex, 0);
});