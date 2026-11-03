# Quotas and local budgets

There are two different controls:

1. **Provider/account quota** — enforced by OpenCode Zen or another model provider on its servers. It may depend on tokens, requests, model, subscription, billing, or account policy.
2. **Nullx local launch budget** — enforced on this machine before the wrapper starts OpenCode. It counts wrapper launches, not remote tokens or account balance.

Nullx does not query a private Zen quota endpoint, reset remote quotas, change network identity, rotate accounts, or route around provider enforcement. A local counter cannot grant additional provider capacity.

## What Nullx counts

| Launch | Counter | Meaning |
| --- | --- | --- |
| `nullx run ...` | runs | One non-interactive OpenCode invocation |
| `nullx start ...` | sessions | One interactive TUI invocation |
| `nullx auth`, `models`, `stats` | none | Management/read-only passthrough |
| `--help` / `--version` passthrough | none | No model launch |

Prompts typed inside a TUI session are not individually visible to the wrapper. Use `nullx stats` for OpenCode's own token/cost statistics, and use the provider console for authoritative account quota and billing.

## When a local budget is reached

`nullx run` and `nullx start` exit with code 6 before starting OpenCode. The message includes the next local reset time. You can:

- Wait for the next local calendar day.
- Adjust your own local guardrail with `nullx budget set`.
- Explicitly clear today's local counters with `nullx budget reset --yes`.

None of these actions changes a provider's server-side quota.

## When a provider quota is reached

Use the provider's documented reset/billing path, or explicitly configure another provider you are entitled to use:

```bash
nullx auth login
nullx models
nullx model set <provider/model>
nullx run "Continue the task"
```

Nullx does not automatically retry quota failures through another network or account.

## Timezones and daylight saving

Daily keys use the configured IANA timezone. The reset instant is the first millisecond of the next local calendar day, computed across daylight-saving transitions. Changing timezone changes how future launches are grouped; historical journal events keep their original day labels.

## Failure behavior

- A launch unit is persisted before the child process starts.
- Nonzero provider exits still count as attempts.
- A corrupt journal blocks budgeted launches instead of silently resetting counters.
- Concurrent wrapper processes use a local lock so reservations cannot oversubscribe a limit.
- Older history is compacted; all current-day records are retained until rollover.
