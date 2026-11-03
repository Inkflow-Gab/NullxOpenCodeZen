import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile proot guide never puts sudo in copy-paste command blocks", async () => {
  const markdown = await readFile(new URL("../docs/MOBILE-PROOT.md", import.meta.url), "utf8");
  const blocks = [...markdown.matchAll(/```(?:bash|sh|shell)\n([\s\S]*?)```/g)].map((match) => match[1] ?? "");
  assert.ok(blocks.length > 5);
  for (const block of blocks) assert.doesNotMatch(block, /\bsudo\b/);
  assert.match(markdown, /proot-distro login ubuntu/);
  assert.match(markdown, /tmux/);
});
