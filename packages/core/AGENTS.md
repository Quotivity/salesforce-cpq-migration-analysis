# packages/core — analysis core

`@quotivity/cpq-inventory-core`. Takes an `OrgConnection`, returns `ReportData`, and serves the report locally. No dependency on the Salesforce CLI. **Zero runtime dependencies** — Node built-ins only.

## Pipeline

```
extract (src/extract/*)  →  classify (src/classify/*)  →  assemble (src/report/assemble.ts)  →  serve (src/server.ts)
```

- `src/connection.ts` — `OrgConnection` interface both distributions implement; `withRetry` gives three retries with backoff, then marks the object **unread** (never zero).
- `src/soql.ts` — `count()` for headline figures; `retrieve()` capped at 10,000 with a `partial` flag. Classifier-input objects throw on the cap.
- `src/extract/` — one module per bucket, each independently runnable with a connection. Field lists are in `queries.ts`; they are verified against a live CPQ org and must not be "tidied" (see the schema notes in the spec).
- `src/classify/rules.ts` — the spec's classification table as data. Each row has an id; classifiers assign row ids to records. A record has one primary bucket and may be cross-listed to a second; it is counted once.
- `src/classify/invariants.ts` — bucket totals sum to object totals; review rows never count toward needs-attention; residue is computed and printed.
- `src/liveness.ts` — Alive on `LastModifiedDate` within the window; >60% sharing one date marks the object unreliable.
- `src/ownership.ts` — package-owned filtering.
- `src/report/` — `ReportData` (the contract with the React app), assembly, the single-file print document, the share summary.
- `src/server.ts` — `http` on `127.0.0.1` (plus `::1` best effort) opened as `http://localhost:<port>`, port detection, SSE progress, `/report?print=1`. Makes no outbound request itself.
- `src/config/outbound.ts` — HubSpot portal and form GUIDs (compiled-in constants).

## Rules

- Read `SBQQ__TargetObject__c` before either evaluation-event field on price rules.
- `SBQQ__Field__c` is the tested field on `PriceCondition` and the target field on `PriceAction`. Never share a column.
- `PriceCondition` and `ErrorCondition` have different field sets; never template a query across them.
- Custom condition logic (`ConditionsMet__c = Custom`) is parsed from `AdvancedCondition__c` over `Index__c`; `NOT` is invalid there.
- Discount tiers are half-open; preserve bounds as read.
- Price determination counts mechanisms, not records.
- Add a fixture record and a test for every new discriminator row.
