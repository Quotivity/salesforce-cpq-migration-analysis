# packages/standalone — standalone Node script

`@quotivity/cpq-inventory-standalone`, bin `cpq-inventory`. For orgs without SFDX. The admin supplies `--instance-url` and `--access-token` (or `SF_ACCESS_TOKEN`).

## Rules

- `FetchConnection` implements core's `OrgConnection` over Node's global `fetch` against the REST and Tooling query endpoints. No jsforce, no other dependency beyond core and `open`.
- Declares Node ≥ 22 and fails with a clear message below it (`bin/cpq-inventory.js` checks before importing anything).
- The token lives in memory for the run only. Never logged, never written.
- Behaviour after a connection exists must be identical to the plugin: same server, same report, same print control.
