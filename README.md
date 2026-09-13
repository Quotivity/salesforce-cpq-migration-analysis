# Quotivity CPQ Inventory & Migration Analysis

A free tool a Salesforce admin runs against their own org. It reads the Salesforce CPQ configuration, sorts it into ten functional buckets, maps every construct to its Quotivity or HubSpot destination, and gives each one a verdict on a single question: **does the behaviour survive the move?**

It runs entirely on your machine. Nothing about your configuration is transmitted unless you click the share button at the end.

Published for review. We're not accepting pull requests.

## Install

**Salesforce CLI plugin** — for orgs with SFDX and someone technical on the Salesforce side:

```sh
sf plugins install @quotivity/cpq-inventory
sf cpq inventory --target-org <alias>
```

The CLI will warn that the plugin is not signed by Salesforce and ask you to confirm. That prompt is expected: we ship unsigned and accept it. If your policy does not allow unsigned plugins, use the standalone script instead.

**Standalone script** — no Salesforce CLI needed:

```sh
npx @quotivity/cpq-inventory-standalone --instance-url https://acme.my.salesforce.com --access-token <token>
```

Get the two values from `sf org display --target-org <alias>` or any authenticated session. Both packages need Node.js 22 or newer and serve the same report.

Options on both: `--window <months>` (dead-configuration window, default 24), `--port <port>` (default 3579, bound to 127.0.0.1), `--no-open`.

## What happens when you run it

1. The terminal prints which org it is connected to and opens your browser on `http://127.0.0.1:3579`.
2. The landing screens explain what the tool does. **No query runs yet.**
3. The email gate. Submitting it posts your name and email, the plugin version, a run identifier and the lead source to a HubSpot form — nothing about your configuration. If that request cannot get out (proxy, VPN, egress rule), the analysis runs anyway and the report says so.
4. The first SOQL call is made when the gate is submitted. Progress is shown per bucket. Every request is a read; there is no DML and no Metadata deploy.
5. **Stage 1 — Inventory**: ten buckets, each with Exists, Alive (over the window in force), Needs attention and, where it applies, Requires review.
6. **Stage 2 — Migration analysis**: the same buckets with a verdict per construct — Clear path, Degraded, No target — plus a separate *Requires further review* section, prerequisites, and the notes that explain the edges.
7. The close: **Share this analysis and schedule a free consultation** sends the rendered report summary through a second HubSpot form and books the call. **Print the Report as a PDF** opens a self-contained copy in a new tab and hands it to your browser's print dialog; the tab is served from localhost and stays open.

Press Ctrl-C in the terminal to stop the server. The query results stay on your disk until you delete them.

## Privacy, specifically

- The Salesforce credential is the one the CLI already holds (plugin) or the token you pass (standalone). It is held in memory for the run, never written, never transmitted, and no Quotivity connected app or OAuth grant is involved.
- Exactly two outbound requests exist, both user-initiated, both HubSpot form submissions made from your browser: the email gate (name and email) and the meeting request. The meeting request carries the report summary (bucket counts, verdicts, mapping rows, the names of scripts flagged for review) — never the query results, product names, prices, customers, code or org access.
- The server binds `127.0.0.1` only.
- Apex classes and Flows are not scanned; the report says so.

The source is here so you can check all of that before running it.

## Repository layout

| Path | Package | Role |
|---|---|---|
| `packages/core` | `@quotivity/cpq-inventory-core` | Extraction, classification, mapping, report assembly, local server. No runtime dependencies. |
| `packages/report` | private | Vite + React report UI, pre-built at publish time into core's `assets/report`. |
| `packages/plugin` | `@quotivity/cpq-inventory` | `sf cpq inventory` — Salesforce CLI plugin over core. |
| `packages/standalone` | `@quotivity/cpq-inventory-standalone` | `cpq-inventory` bin over core. |
| `docs/cpq-inventory-spec.md` | — | The build spec: the master for every functional mapping. |
| `docs/design/` | — | The report mockup the UI implements. |

## Developing

```sh
npm install          # workspaces; installs a Biome pre-commit hook
npm run build        # core → report bundle → plugin manifest
npm run lint         # Biome (lint + format check)
npm run typecheck
npm test             # vitest across packages
npm run test:e2e     # Playwright: the full flow and the print document, on fixture data
npm run pack:check   # each tarball carries its assets and manifest
npm run smoke:plugin # links the plugin into a local sf and checks --help
```

Run the plugin from source: `npm run build && sf plugins link packages/plugin && sf cpq inventory -o <alias>`.

Run the report UI on fixture data without an org: `node packages/report/e2e/server.mjs` and open the printed URL.

The HubSpot portal ID, the two form GUIDs and the summary property name are compiled in at `packages/core/src/config/outbound.ts`; the HubSpot field names the forms use are in `packages/report/src/api.ts`. Confirm the consent wording with whoever owns form consent language before the first release.

## Releasing

One version across every workspace. Run the **Version** workflow (patch, minor, major or an explicit version); it bumps, commits and tags. The tag triggers **Release**, which re-runs every check and publishes core, standalone and plugin to npm.

Publishing uses **npm trusted publishing** (OIDC): no token is stored anywhere. One-time setup on npmjs.com, for each of the three packages, under *Settings → Trusted publisher*: provider GitHub Actions, organization `Quotivity`, repository `salesforce-cpq-migration-analysis`, workflow filename `release.yml`, environment left blank. The workflow's `id-token: write` permission and the current npm CLI do the rest, and provenance attestations are generated automatically.

## License

Apache-2.0. See `LICENSE`.
