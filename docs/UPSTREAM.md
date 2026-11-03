# Upstream OpenCode pins

Reviewed against the public upstream repository and npm registry on **2026-11-03**.

| Channel | npm package | Exact version | Purpose |
| --- | --- | --- | --- |
| `v1` | `opencode-ai` | `1.19.5` | Default OpenCode 1 CLI channel |
| `v2` | `@opencode/cli` | `2.2.5` | Optional OpenCode 2 CLI channel |

Upstream repository: <https://github.com/anomalyco/opencode>

## Reviewed SHA-512 integrity

```text
opencode-ai@1.19.5
sha512-tEqMvQahfhdDj8vceYpXtoIrvjPXm5XRfetWnPN5YISueU7adNx9JcUA3zZ+2GKuDVgDpGdQe1ZLtCZDjqodvA==

@opencode/cli@2.2.5
sha512-sJAwrwuVa5b+pA3O1UOiSDcC9DgdPVmtkWv6aF6q3+rOiOTCqrE41tkz1kyyE2O8BYPs4eOvBuzkQ6oEm8w5Mw==
```

These constants live in `src/core/paths.ts`. The installer rejects a default pinned release whose registry metadata no longer matches the reviewed integrity. Custom exact versions are still fetched from the official registry and installed through npm's integrity-checked package pipeline; their resolved integrity is recorded in the receipt.

## Updating a pin

1. Read the upstream release notes and CLI command docs.
2. Fetch exact-version metadata from `https://registry.npmjs.org/<package>/<version>`.
3. Inspect the package launcher and platform binary layout.
4. Update `RELEASES` in `src/core/paths.ts` and the install tests.
5. Run `npm run check` and `npm run build`.
6. Test `nullx install --dry-run`, a real isolated install, `nullx doctor`, and a harmless `--help` passthrough.
7. Update this document and the changelog.

OpenCode 1 and OpenCode 2 both use the `opencode` command upstream. Nullx avoids replacing a global installation by keeping managed channels in separate versioned directories and selecting the binary explicitly.
