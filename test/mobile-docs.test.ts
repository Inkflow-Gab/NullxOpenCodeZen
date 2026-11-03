import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/** Copy-paste blocks must stay sudo-free, including on Windows CRLF checkouts. */
function blocks(markdown: string): string[] {
  return [...markdown.matchAll(/```(?:bash|sh|shell|powershell|pwsh)\r?\n([\s\S]*?)```/g)]
    .map((match) => (match[1] ?? "").replace(/\r/g, ""));
}

test("mobile proot guide never puts sudo in copy-paste command blocks", async () => {
  const markdown = await readFile(new URL("../docs/MOBILE-PROOT.md", import.meta.url), "utf8");
  const found = blocks(markdown);
  assert.ok(found.length > 3, "expected the mobile fast path to include command blocks");
  for (const block of found) assert.doesNotMatch(block, /\bsudo\b/);
  assert.match(markdown, /bash scripts\/setup\.sh/);
  assert.match(markdown, /tmux/);
});

test("the manual mobile steps are preserved and still sudo-free", async () => {
  const markdown = await readFile(new URL("../docs/SETUP-MANUAL.md", import.meta.url), "utf8");
  const found = blocks(markdown);
  assert.ok(found.length > 20, "manual guide should keep the detailed steps");
  // Only the proot section must be sudo-free; desktop Linux legitimately uses sudo.
  const mobile = markdown.slice(markdown.indexOf("# Mobile proot, manual steps"));
  assert.ok(mobile.length > 500, "mobile section must be present");
  for (const block of blocks(mobile)) assert.doesNotMatch(block, /\bsudo\b/);
  assert.match(mobile, /proot-distro login ubuntu/);
});

test("README stays short and leads with the one-command install", async () => {
  const markdown = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const lines = markdown.split(/\r?\n/);
  assert.ok(lines.length <= 180, `README should stay scannable, got ${lines.length} lines`);
  const install = markdown.indexOf("bash scripts/setup.sh");
  assert.ok(install > 0 && install < 1600, "the install command must appear near the top");
  assert.match(markdown, /Database is not empty and has no session table/);
  assert.match(markdown, /docs\/TROUBLESHOOTING\.md/);
  assert.match(markdown, /local launch counters/);
  // Every referenced local doc must exist.
  for (const match of markdown.matchAll(/\]\((docs\/[A-Z-]+\.md)\)/g)) {
    const target = new URL(`../${match[1]}`, import.meta.url);
    await readFile(target, "utf8");
  }
});
