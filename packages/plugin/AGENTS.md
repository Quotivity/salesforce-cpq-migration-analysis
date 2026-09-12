# packages/plugin — Salesforce CLI plugin

`@quotivity/cpq-inventory`. Installed with `sf plugins install @quotivity/cpq-inventory`. One command: `sf cpq inventory`.

## Rules

- Follow `@salesforce/sf-plugins-core` conventions: `SfCommand`, `Flags.requiredOrg()`, summaries/descriptions/examples from `messages/cpq.inventory.md` via `Messages.importMessagesDirectoryFromMetaUrl`.
- The command only adapts the CLI's `Connection` to core's `OrgConnection`, prints the launch banner, starts the server and opens the browser. All analysis logic belongs in core.
- The org connection is held in memory for the run; never write a token to disk or log it.
- `oclif manifest` runs in `prepack`; `files` ships `lib`, `messages`, `oclif.manifest.json` only.
- We ship unsigned. The README explains the install prompt; do not try to work around it.
