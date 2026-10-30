import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/services/timestamps.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { formatTimestamp } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const now = Date.parse("2026-10-30T12:00:00Z");

test("recent timestamps use Italian relative time in both directions", () => {
  assert.equal(formatTimestamp(now - 10000, now), "ora");
  assert.equal(formatTimestamp(now - 60000, now), "1 minuto fa");
  assert.equal(formatTimestamp(now - 3600000, now), "1 ora fa");
  assert.equal(formatTimestamp(now - 2 * 86400000, now), "2 giorni fa");
  assert.equal(formatTimestamp(now + 3600000, now), "tra 1 ora");
  assert.equal(formatTimestamp(new Date(now - 3600000), now), "1 ora fa");
  assert.equal(formatTimestamp("2026-10-30T11:00:00Z", now), "1 ora fa");
  assert.equal(formatTimestamp(now - 3599000, now), "59 minuti fa");
  assert.equal(formatTimestamp(now - 29 * 86400000, now), "29 giorni fa");
});

test("old timestamps retain the complete date and time", () => {
  const date = new Date(now - 30 * 86400000);
  assert.equal(formatTimestamp(date, now), new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short", timeStyle: "short",
  }).format(date));
});

test("missing and invalid timestamps have a stable placeholder", () => {
  for (const value of [null, undefined, "", "invalid", new Date(NaN), NaN]) {
    assert.equal(formatTimestamp(value, now), "N/D");
  }
});