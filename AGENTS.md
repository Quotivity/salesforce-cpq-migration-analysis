# CPQ Inventory & Migration Analysis — agent guide

A free tool a Salesforce admin runs against their own org. It reads Salesforce CPQ configuration, classifies every record into ten functional buckets, maps each construct to its Quotivity / HubSpot destination with a verdict, and renders a local React report that prints to PDF. It is the call to action for Quotivity's CPQ migration service.

## Source of truth

- `docs/cpq-inventory-spec.md` is the MASTER for every functional mapping: buckets, classification rows, verdicts, shapes, copy, privacy rules. If code and spec disagree, the spec wins; change the code.
- `docs/design/CPQ Inventory Report.dc.html` is the UI mockup. The report implements it literally: same screens, copy, colours, spacing.

## Non-negotiables

- **Nothing leaves the machine except two user-initiated HubSpot form posts** (email gate, meeting request). No other outbound request anywhere. The server binds `127.0.0.1` only.
- **No query runs before the email gate is submitted.** The first SOQL call happens in `POST /api/run`.
- Every Salesforce request is read-only (SOQL, Tooling SOQL). No DML, no Metadata deploys.
- Liveness reads `LastModifiedDate`, never `CreatedDate`. Quote volume reads business dates.
- Package-owned records are filtered everywhere (`NamespacePrefix = null` on metadata objects; unresolved `CreatedById` on configuration objects).
- Classifier inputs (`ProductRule`, `ProductAction`, `ErrorCondition`, `PriceRule`, `PriceAction`) are never classified from a partial set.
- "Requires further review" is its own count. It is never folded into Clear path or Needs attention.
- No runtime dependency on a bundler. The React app is pre-built at publish time into `packages/core/assets/report`.
- No native modules. The plugin runs under the Salesforce CLI's Node.

## Layout

| Path | Package | Role |
|---|---|---|
| `packages/core` | `@quotivity/cpq-inventory-core` | Extraction, classification, mapping, report assembly, local server. Zero runtime deps. |
| `packages/report` | private | Vite + React report UI. Built into core's `assets/report`. |
| `packages/plugin` | `@quotivity/cpq-inventory` | `sf cpq inventory` — Salesforce CLI plugin over core. |
| `packages/standalone` | `@quotivity/cpq-inventory-standalone` | `cpq-inventory` bin over core, token + instance URL, zero deps beyond core. |

Each package has its own `AGENTS.md` with package-specific rules.

## Commands

```
npm install          # workspaces; installs the Biome pre-commit hook
npm run lint         # biome check .
npm run format       # biome check --write .
npm run typecheck    # tsc -b
npm test             # vitest (all packages)
npm run build        # report → core/assets, tsc -b, oclif manifest
npm run test:e2e     # Playwright against the local server with fixture data
npm run pack:check   # asserts each tarball carries its assets/manifest
npm run smoke:plugin # links the plugin into sf and checks --help
```

## Conventions

- TypeScript, ESM, Node ≥ 22. Biome is the only linter/formatter (single quotes, 2 spaces, 100 cols).
- Tests live in `packages/<pkg>/test/**/*.test.ts` (vitest). Fixtures hold one instance of every classifier discriminator.
- Copy in the UI is product copy; do not paraphrase it. Title Case on buttons, sentence case elsewhere. No emoji.
- Never commit a model identifier, credential, or org data.

## Releasing

One lockstep version across workspaces. `version.yml` (workflow_dispatch) bumps, commits and tags; `release.yml` publishes on a `v*` tag in the order core → standalone → plugin, using npm trusted publishing (OIDC — no token) with provenance.
