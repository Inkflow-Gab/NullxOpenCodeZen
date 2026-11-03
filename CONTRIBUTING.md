# Contributing

## Development loop

```bash
npm ci
npm run check
npm run build
node dist/cli.js --help
```

Keep changes small and covered by tests. Do not add runtime dependencies unless they remove substantial, well-tested complexity. Do not pad the project to hit a line-count target.

## Code standards

- TypeScript strict mode, Node.js 22+, ESM.
- No shell interpolation for user-supplied arguments.
- Validate config and journal input at the boundary.
- Keep prompts, credentials, and model output out of the journal.
- Use atomic writes for config/receipts and locked append for budget reservations.
- Preserve OpenCode exit codes and forwarded arguments.
- Keep upstream version pins and integrity constants together.

## Tests

Tests must run without a real OpenCode account. Use temporary `NULLX_HOME` directories, injected executors, and fixture binaries. Add regression tests for budget rollover, corrupt state, install integrity, Windows path handling, and argument passthrough when touching those areas.

## Pull requests

Include the problem, the change, the test command output, and any upstream compatibility impact. Update docs when command behavior or storage format changes.
