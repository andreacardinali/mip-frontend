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
          assert.deepEqual(Object.keys(payload), ["enabled_categories"]);
          assert.strictEqual(payload.enabled_categories, enabledCategories);
          return { data: result };
        },
      });
      assert.strictEqual(await api.updateCollectionIntelligence(collectionType, "collection-id", enabledCategories), result);
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
  await assert.rejects(api.updateCollectionIntelligence("PORTFOLIO", "missing-id", []), error);
});