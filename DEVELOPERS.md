# Developer notes

This repository is published so the tool can be read before it is run. **We are not accepting pull requests.** Issues are welcome; changes are made by the Quotivity team.

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

The HubSpot portal ID, the two form GUIDs and the summary property name are compiled in at `packages/core/src/config/outbound.ts`; the HubSpot field names the forms use are in `packages/report/src/api.ts`. The consent statement shown with the gate is in `packages/report/src/screens/Gate.tsx`.

## Releasing

One version across every workspace. Run the **Version** workflow (patch, minor, major or an explicit version); it bumps, commits and tags. The tag triggers **Release**, which re-runs every check and publishes core and then plugin to npm.

Publishing uses **npm trusted publishing** (OIDC): no token is stored anywhere. A trusted publisher attaches to an existing package, so the first version of each is published manually from a logged-in machine (`npm run build`, then `npm publish --workspace packages/core --access public`, then the same for `packages/plugin`). One-time setup on npmjs.com, for each of the two packages, under *Settings → Trusted publisher*: provider GitHub Actions, organization `Quotivity`, repository `salesforce-cpq-migration-analysis`, workflow filename `release.yml`, environment left blank. The workflow's `id-token: write` permission and the current npm CLI do the rest, and provenance attestations are generated automatically.
