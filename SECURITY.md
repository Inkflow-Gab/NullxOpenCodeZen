# Security

Nullx is a local CLI wrapper. It does not operate a hosted service or collect telemetry.

## Reporting

Open a GitHub issue with a minimal reproduction and omit API keys, prompts, private source code, and personal paths. If a report requires sensitive details, do not post them publicly; contact the repository maintainers through GitHub first.

## Design boundaries

- Provider authentication is delegated to OpenCode.
- The local journal excludes prompt text, source code, credentials, and model responses.
- Child processes are spawned without a shell.
- Managed installs use exact versions from the official npm registry and verify SHA-512 metadata and the installed binary version.
- Corrupt budget state fails closed.

## Scope

Reports about OpenCode itself, model providers, or upstream authentication should go to the corresponding upstream project. Reports about Nullx argument handling, state integrity, install verification, or local data exposure belong here.
