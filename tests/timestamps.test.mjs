import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/services/timestamps.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { formatLogTimestamp, formatTimestamp } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
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
    assert.equal(formatLogTimestamp(value), "N/D");
  }
});

test("log timestamps retain the full local date, seconds and milliseconds regardless of age", () => {
  const formatter = new Intl.DateTimeFormat("it-IT", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    fractionalSecondDigits: 3, hourCycle: "h23",
  });
  for (const timestamp of [now - 10000, now - 86400000, now - 31 * 86400000, now + 10000]) {
    const date = new Date(timestamp + 123);
    for (const value of [date, date.getTime(), date.toISOString()]) {
      assert.equal(formatLogTimestamp(value), formatter.format(date));
    }
  }
  assert.notEqual(formatLogTimestamp(now), formatLogTimestamp(now + 1));
  assert.notEqual(formatLogTimestamp(now), formatLogTimestamp(now + 1000));
});

test("job log rows use precise timestamps instead of relative labels", () => {
  const page = readFileSync(new URL("../src/pages/SystemSettingsPage.tsx", import.meta.url), "utf8");
  assert.match(page, /formatLogTimestamp\(entry\.logged_at\)/);
  assert.doesNotMatch(page, /formatTimestamp\(entry\.logged_at\)/);
});