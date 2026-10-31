import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(
  readFileSync(new URL("../src/pages/NewsPage.tsx", import.meta.url), "utf8"),
  { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } },
).outputText;

function newsPage(rows, selected = null) {
  const exports = {};
  const state = [];
  let stateIndex = 0;
  const scopes = [];
  const element = (type, props) => ({ type, props });
  runInNewContext(compiled, {
    exports,
    require: name => {
      if (name === "react/jsx-runtime") return { jsx: element, jsxs: element };
      if (name === "react") return {
        useMemo: compute => compute(),
        useState: initial => {
          const index = stateIndex++;
          if (!(index in state)) state[index] = index === 7 ? selected : initial;
          return [state[index], value => { state[index] = value; }];
        },
      };
      if (name === "@mui/material") return Object.fromEntries([
        "Alert", "Box", "Button", "Chip", "Dialog", "DialogActions", "DialogContent", "DialogTitle",
        "Divider", "Link", "MenuItem", "Paper", "Stack", "TextField", "Typography",
      ].map(component => [component, component]));
      if (name === "@mui/x-data-grid") return { DataGrid: "DataGrid" };
      if (name.startsWith("@mui/icons-material/")) return { __esModule: true, default: name };
      if (name === "../services/timestamps") return { formatTimestamp: () => "N/D" };
      if (name === "../services/news") return {};
      assert.equal(name, "@tanstack/react-query");
      return { useQuery: ({ queryKey }) => {
        if (queryKey[0] === "news") {
          scopes.push(queryKey[1].scope);
          return { data: queryKey[1].scope === "ALL" ? rows : [], isError: false };
        }
        return { data: { sources: [] } };
      } };
    },
  });
  function render() {
    stateIndex = 0;
    const nodes = [];
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object") return;
      nodes.push(node);
      visit(node.props?.children);
    }
    visit(exports.default());
    return nodes;
  }
  render().find(node => node.type === "TextField" && node.props.label === "Ambito")
    .props.onChange({ target: { value: "ALL" } });
  const nodes = render();
  const grid = nodes.find(node => node.type === "DataGrid");
  const rowIds = new Set();
  for (const row of grid.props.rows) {
    const rowId = grid.props.getRowId(row);
    assert.ok(rowId != null, "DataGrid row IDs must not be null or undefined");
    assert.ok(!rowIds.has(rowId), "DataGrid row IDs must be unique");
    rowIds.add(rowId);
    for (const column of grid.props.columns) {
      column.valueGetter?.(undefined, row);
      column.renderCell?.({ row });
    }
  }
  return { nodes, scopes, grid };
}

const globalNews = {
  news_id: "global-news", title: "Global news", published_at: null, source: null,
  symbols: null, sentiment: null, impact: null, in_portfolio: false,
  in_watchlist: false, asset_scope: "GLOBAL", raw_json: null,
};

test("switching to ALL renders global news without symbol associations", () => {
  const { scopes, grid } = newsPage([globalNews]);
  assert.deepEqual(scopes, ["MY_ASSETS", "ALL"]);
  assert.equal(grid.props.rows.length, 1);
  const symbols = grid.props.columns.find(column => column.field === "symbols");
  assert.equal(symbols.valueGetter(undefined, globalNews), "");
});

test("ALL keeps news with null or missing IDs using unique view-only identities", () => {
  const missingId = { ...globalNews };
  delete missingId.news_id;
  const input = [globalNews, { ...globalNews, news_id: null },
    { ...globalNews, news_id: null }, missingId];
  const { grid } = newsPage(input);
  assert.equal(grid.props.rows.length, input.length);
  assert.deepEqual(Array.from(grid.props.rows, row => row.news_id),
    input.map(row => row.news_id));
  assert.equal(new Set(grid.props.rows.map(grid.props.getRowId)).size, input.length);
  assert.equal(input[1].gridRowId, undefined);
});

test("nullable asset matches and missing portfolio arrays cannot crash grid or details", () => {
  const row = { ...globalNews, symbols: [], in_portfolio: true, raw_json: {
    asset_matches: [null, { in_portfolio: true, portfolio_match_type: "SAME_ENTITY" }],
  } };
  const { nodes, grid } = newsPage([row], row);
  const portfolio = grid.props.columns.find(column => column.field === "portfolio_match");
  assert.equal(portfolio.valueGetter(undefined, row), "");
  assert.ok(nodes.some(node => node.type === "Dialog" && node.props.open));
});

test("valid news retain symbol and portfolio labels", () => {
  const row = { ...globalNews, symbols: [{ symbol: "ABC", exchange: "TEST" }],
    in_portfolio: true, raw_json: { asset_matches: [{
      in_portfolio: true, portfolio_match_type: "SAME_ENTITY", portfolio_symbols: ["ABC"],
      portfolio_positions: [],
    }] },
  };
  const { grid } = newsPage([row], row);
  assert.equal(grid.props.columns.find(column => column.field === "symbols").valueGetter(undefined, row), "ABC");
  assert.match(grid.props.columns.find(column => column.field === "portfolio_match").valueGetter(undefined, row), /ABC/);
});

test("News error boundary exposes the actual error and can recover without losing navigation", () => {
  const boundaryCode = ts.transpileModule(
    readFileSync(new URL("../src/components/NewsErrorBoundary.tsx", import.meta.url), "utf8"),
    { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } },
  ).outputText;
  const exports = {};
  const logged = [];
  const element = (type, props) => ({ type, props });
  class Component {
    constructor(props) { this.props = props; }
    setState(update) { this.state = { ...this.state, ...update }; }
  }
  runInNewContext(boundaryCode, {
    exports,
    console: { error: (...args) => logged.push(args) },
    require: name => {
      if (name === "react") return { Component };
      if (name === "react/jsx-runtime") return { jsx: element, jsxs: element };
      if (name === "@mui/material") return Object.fromEntries(
        ["Alert", "AlertTitle", "Box", "Button", "Typography"].map(component => [component, component]),
      );
      assert.equal(name, "@mui/icons-material/Refresh");
      return { __esModule: true, default: "RefreshIcon" };
    },
  });
  const Boundary = exports.default;
  const page = element("NewsPage", {});
  const boundary = new Boundary({ children: page });
  assert.equal(boundary.render(), page);
  const error = new Error("Actual grid rendering failure");
  boundary.state = Boundary.getDerivedStateFromError(error);
  boundary.componentDidCatch(error, { componentStack: "DataGrid > NewsPage" });
  assert.equal(logged[0][1], error);
  assert.equal(logged[0][2], "DataGrid > NewsPage");
  const fallback = boundary.render();
  const alert = fallback.props.children.find(node => node.type === "Alert");
  assert.equal(alert.props.children[1].props.children, error.message);
  fallback.props.children.find(node => node.type === "Button").props.onClick();
  assert.equal(boundary.render(), page);
});