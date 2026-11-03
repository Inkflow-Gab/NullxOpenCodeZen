import { appendFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
if (args[0] === "--version") {
  process.stdout.write(`${process.env.FAKE_OPENCODE_VERSION ?? "1.19.5"}\n`);
  process.exit(0);
}
if (process.env.FAKE_ARGS_FILE) {
  appendFileSync(process.env.FAKE_ARGS_FILE, `${JSON.stringify(args)}\n`);
}
if (process.env.FAKE_STDOUT_FILE) {
  writeFileSync(process.env.FAKE_STDOUT_FILE, args.join(" "));
}
process.stdout.write(`fake-opencode:${args.join(" ")}\n`);
process.exitCode = Number(process.env.FAKE_EXIT_CODE ?? "0");
