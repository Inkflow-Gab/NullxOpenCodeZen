import assert from "node:assert/strict";
import test from "node:test";
import { dayKey, nextReset } from "../src/core/clock.js";

test("calendar days use the configured IANA timezone", () => {
  const date = new Date("2026-11-03T17:30:00.000Z");
  assert.equal(dayKey(date, "UTC"), "2026-11-03");
  assert.equal(dayKey(date, "Asia/Manila"), "2026-11-04");
  assert.equal(nextReset(date, "Asia/Manila").toISOString(), "2026-11-04T16:00:00.000Z");
});

test("reset finds the first instant after a DST spring-forward day", () => {
  const date = new Date("2026-03-08T12:00:00.000Z");
  const reset = nextReset(date, "America/New_York");
  assert.equal(reset.toISOString(), "2026-03-09T04:00:00.000Z");
  assert.equal(dayKey(reset, "America/New_York"), "2026-03-09");
});
