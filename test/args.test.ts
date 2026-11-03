import assert from "node:assert/strict";
import test from "node:test";
import { hasModelFlag, isHelpOrVersion, modelFromArgs, parseFlags } from "../src/utils/args.js";

test("parseFlags separates wrapper flags from forwarded arguments", () => {
  const parsed = parseFlags(["--runs", "4", "--json", "--", "--model", "x/y"], [
    { names: ["--runs"], takesValue: true },
    { names: ["--json"], takesValue: false },
  ]);
  assert.equal(parsed.values.get("--runs"), "4");
  assert.ok(parsed.flags.has("--json"));
  assert.deepEqual(parsed.forwarded, ["--model", "x/y"]);
});

test("parseFlags rejects unknown wrapper options and missing values", () => {
  assert.throws(() => parseFlags(["--unknown"], []), /Unknown option/);
  assert.throws(() => parseFlags(["--runs"], [{ names: ["--runs"], takesValue: true }]), /requires a value/);
});

test("model helpers respect the passthrough separator", () => {
  assert.equal(hasModelFlag(["--model", "opencode/example"]), true);
  assert.equal(hasModelFlag(["--", "--model", "opencode/example"]), false);
  assert.equal(modelFromArgs(["-m=openrouter/vendor/model"]), "openrouter/vendor/model");
  assert.equal(isHelpOrVersion(["--", "--help"]), false);
});
