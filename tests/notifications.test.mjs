import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/services/notifications.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function service(api) {
  const exports = {};
  runInNewContext(compiled, {
    exports,
    require: name => {
      assert.equal(name, "../api/api");
      return { __esModule: true, default: api };
    },
  });
  return exports;
}

test("collection listing preserves all collection types and category selections", async () => {
  const collections = ["PORTFOLIO", "WATCHLIST", "UNIVERSE"].map((collection_type, index) => ({
    collection_type,
    collection_id: `collection-${index}`,
    collection_name: `Collection ${index}`,
    enabled_categories: index ? [] : ["DAILY_MOVER", "NEWS"],
    notification_source_id: null,
  }));
  const api = service({
    get: async path => {
      assert.equal(path, "/notification-preferences/collections");
      return { data: { collections } };
    },
  });
  assert.deepEqual(await api.getMonitoringCollections(), { collections });
});

test("saving targets the selected collection and sends exactly its categories", async () => {
  for (const collectionType of ["PORTFOLIO", "WATCHLIST", "UNIVERSE"]) {
    for (const enabledCategories of [[], ["NEWS"], ["DAILY_MOVER", "UPCOMING_CATALYST", "BREAKING_CATALYST", "NEWS"]]) {
      const result = { saved: true };
      const api = service({
        put: async (path, payload) => {
          assert.equal(path, `/notification-preferences/collections/${collectionType}/collection-id`);
          assert.deepEqual(Object.keys(payload), ["enabled_categories", "notification_source_id"]);
          assert.strictEqual(payload.enabled_categories, enabledCategories);
          assert.strictEqual(payload.notification_source_id, "source-id");
          return { data: result };
        },
      });
      assert.strictEqual(await api.updateCollectionIntelligence(collectionType, "collection-id", enabledCategories, "source-id"), result);
    }
  }
});

test("delivery saves one default destination and the global pause", async () => {
  for (const paused of [true, false]) {
    for (const default_source_id of [null, "source-id"]) {
      const delivery = { paused, default_source_id };
      const result = { delivery };
      const api = service({
        put: async (path, payload) => {
          assert.equal(path, "/notification-preferences/delivery");
          assert.strictEqual(payload, delivery);
          return { data: result };
        },
      });
      assert.strictEqual(await api.updateNotificationDelivery(delivery), result);
    }
  }
});

test("listing and saving failures propagate instead of reporting success", async () => {
  const error = new Error("Collection not found");
  const api = service({
    get: async () => { throw error; },
    put: async () => { throw error; },
  });
  await assert.rejects(api.getMonitoringCollections(), error);
  await assert.rejects(api.updateNotificationDelivery({ paused: true, default_source_id: null }), error);
  await assert.rejects(api.updateCollectionIntelligence("PORTFOLIO", "missing-id", [], null), error);
});

const collectionComponent = ts.transpileModule(
  readFileSync(new URL("../src/components/CollectionIntelligenceSettings.tsx", import.meta.url), "utf8"),
  { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } },
).outputText;

function collectionSettings(saveCollection = async () => {}) {
  let data = { collections: ["PORTFOLIO", "WATCHLIST", "UNIVERSE"].map(collection_type => ({
    collection_type, collection_id: "shared-id", collection_name: collection_type, enabled_categories: [], notification_source_id: null,
  })) };
  let drafts = {};
  let mutation;
  let pending = false;
  let failed = false;
  let completion;
  const requests = [];
  const exports = {};
  const element = (type, props, key) => ({ type, props, key });
  const queryClient = {
    cancelQueries: async () => {},
    setQueryData: (key, update) => {
      assert.deepEqual(Array.from(key), ["monitoring-collections", "owner"]);
      data = update(data);
    },
  };
  runInNewContext(collectionComponent, {
    exports,
    require: name => {
      if (name === "react/jsx-runtime") return { jsx: element, jsxs: element };
      if (name === "react") return { useState: () => [drafts, update => {
        drafts = typeof update === "function" ? update(drafts) : update;
      }] };
      if (name === "@mui/material") return Object.fromEntries([
        "Alert", "Box", "Button", "Checkbox", "CircularProgress", "FormControl", "FormControlLabel", "InputLabel", "MenuItem", "Select", "Stack", "Typography",
      ].map(component => [component, component]));
      if (name.startsWith("@mui/icons-material/")) return { __esModule: true, default: name };
      if (name === "../contexts/AuthProvider") return { useAuth: () => ({ user: { user_id: "owner" } }) };
      if (name === "../services/operationFeedback") return { notifyOperationError: () => {} };
      if (name === "../services/notifications") return {
        getMonitoringCollections: async () => data,
        getNotificationPreferences: async () => ({ sources: [{ source_id: "source-1", source_name: "Telegram lavoro", channel: "TELEGRAM", enabled: true }] }),
        updateCollectionIntelligence: async (...args) => {
          requests.push(JSON.parse(JSON.stringify(args)));
          await saveCollection(...args);
        },
      };
      assert.equal(name, "@tanstack/react-query");
      return {
        useQueryClient: () => queryClient,
        useQuery: options => options.queryKey[0] === "notification-preferences"
          ? { data: { sources: [{ source_id: "source-1", source_name: "Telegram lavoro", channel: "TELEGRAM", enabled: true }] }, isSuccess: true }
          : { data, isSuccess: true },
        useMutation: options => {
          mutation = options;
          return { isPending: pending, isError: failed, reset: () => { failed = false; },
            mutate: changed => {
              pending = true;
              failed = false;
              completion = mutation.mutationFn(changed).catch(error => {
                failed = true;
                mutation.onError(error);
              }).finally(() => { pending = false; });
            },
          };
        },
      };
    },
  });
  function render() {
    const elements = [];
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object") return;
      if (typeof node.type === "function") return visit(node.type(node.props));
      elements.push(node);
      visit(node.props?.children);
      visit(node.props?.control);
    }
    visit(exports.default());
    return elements;
  }
  return {
    render, requests, complete: () => completion,
    button: () => render().find(node => node.type === "Button"),
    checkbox: (collection, category = 0) => render().filter(node => node.type === "Checkbox")[
      collection === 0 ? category : 5 + (collection - 1) * 4 + category
    ],
    select: collection => render().filter(node => node.type === "Select")[collection],
    data: () => data,
  };
}

test("collections have one save button enabled only by effective changes", () => {
  const settings = collectionSettings();
  assert.equal(settings.render().filter(node => node.type === "Button").length, 1);
  assert.equal(settings.button().props.disabled, true);
  for (let collection = 0; collection < 3; collection++) {
    settings.checkbox(collection).props.onChange(null, true);
    assert.equal(settings.button().props.disabled, false);
    assert.equal(settings.checkbox(collection).props.checked, true);
    settings.checkbox(collection).props.onChange(null, false);
    assert.equal(settings.button().props.disabled, true);
  }
});

test("one save persists all changed collections and leaves unchanged collections alone", async () => {
  const settings = collectionSettings();
  settings.checkbox(0).props.onChange(null, true);
  settings.checkbox(1, 3).props.onChange(null, true);
  settings.button().props.onClick();
  assert.equal(settings.button().props.disabled, true);
  assert.ok(settings.render().filter(node => node.type === "Checkbox").every(node => node.props.disabled));
  await settings.complete();
  assert.deepEqual(settings.requests, [
    ["PORTFOLIO", "shared-id", ["DAILY_MOVER"], null], ["WATCHLIST", "shared-id", ["NEWS"], null],
  ]);
  assert.equal(settings.button().props.disabled, true);
  assert.equal(settings.checkbox(0).props.checked, true);
  assert.equal(settings.checkbox(1, 3).props.checked, true);
});

test("partial failures retain unsaved drafts and retry only remaining collections", async () => {
  let fail = true;
  const settings = collectionSettings(async collectionType => {
    if (collectionType === "WATCHLIST" && fail) throw new Error("Save failed");
  });
  for (let collection = 0; collection < 3; collection++) settings.checkbox(collection).props.onChange(null, true);
  settings.button().props.onClick();
  await settings.complete();
  assert.equal(settings.button().props.disabled, false);
  assert.ok(settings.render().some(node => node.type === "Alert" && node.props.severity === "error"));
  assert.ok(settings.data().collections[0].enabled_categories.includes("DAILY_MOVER"));
  assert.equal(settings.data().collections[1].enabled_categories.length, 0);
  for (let collection = 0; collection < 3; collection++) assert.equal(settings.checkbox(collection).props.checked, true);
  fail = false;
  settings.button().props.onClick();
  await settings.complete();
  assert.deepEqual(settings.requests.map(request => request[0]), ["PORTFOLIO", "WATCHLIST", "WATCHLIST", "UNIVERSE"]);
  assert.equal(settings.button().props.disabled, true);
  assert.ok(!settings.render().some(node => node.type === "Alert"));
});

test("a collection can select and save its own notification destination", async () => {
  const settings = collectionSettings();
  assert.equal(settings.select(0).props.value, "");
  settings.select(0).props.onChange({ target: { value: "source-1" } });
  assert.equal(settings.select(0).props.value, "source-1");
  settings.button().props.onClick();
  await settings.complete();
  assert.deepEqual(settings.requests, [["PORTFOLIO", "shared-id", [], "source-1"]]);
  assert.equal(settings.data().collections[0].notification_source_id, "source-1");
});

test("daily portfolio report is portfolio-only and saves its own category", async () => {
  const settings = collectionSettings();
  assert.equal(settings.render().filter(node => node.type === "Checkbox").length, 13);
  settings.checkbox(0, 4).props.onChange(null, true);
  assert.equal(settings.checkbox(0, 4).props.checked, true);
  settings.button().props.onClick();
  await settings.complete();
  assert.deepEqual(settings.requests, [["PORTFOLIO", "shared-id", ["DAILY_PORTFOLIO_REPORT"], null]]);
});