# packages/report — React report UI

Private Vite + React 19 app. `npm run build` here writes to `../core/assets/report`, which core serves and inlines into the print document. Nothing in this package runs at plugin runtime except the compiled bundle.

## Rules

- The mockup (`docs/design/CPQ Inventory Report.dc.html`) is the design. Implement its screens, copy, colours and spacing literally. Product copy is not paraphrased.
- Screens: Landing (4 slides) → Gate → Scanning → Inventory → Analysis → Close. The rail appears only once the inventory is unlocked.
- Colour and type tokens live in `src/theme.css`. Verdict colours: Clear path `#047251`/`#07AE77`, Degraded `#A9611C`/`#D97230`, No target `#B23A2E`/`#C0392B`, Further review `#1F6FA8`/`#3E8DC4`.
- `src/print.css` owns the printed document: hide chrome and controls, expand everything, `break-inside: avoid` on cards and rows, repeat org/date/window per stage, `print-color-adjust: exact`, explicit `@page`.
- Data comes from `ReportData` (`@quotivity/cpq-inventory-core`). In `?print=1` mode it is inlined as `window.__CPQ_REPORT__`.
- Two outbound requests only, both from `src/api.ts`, both user-initiated: the gate form (first name, last name, email, version, run id, lead source) and the meeting-request form (the same plus the report summary). The print control is not an outbound request.
- `window.open` for print runs synchronously inside the click handler. Never after an `await`.
- No UI library, no icon font. Inline SVG for the few icons the mockup uses. No emoji.
- `src/fixture/acme-prod.json` is the mockup's data as `ReportData`; `vite dev` and the Playwright e2e use it.
