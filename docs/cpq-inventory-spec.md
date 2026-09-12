# CPQ Inventory & Migration Analysis — Build Spec

**v3 — 12 September 2026**
Free tool. Runs locally in the customer's environment. No Salesforce data reaches us.
The call to action for the Salesforce CPQ migration service.

**Changes in v3.** Stage 1 inventory is organised into ten functional buckets. A classification layer sits between extraction and presentation. Usage metrics moved inside each bucket. Dead-configuration window defaults to 24 months.

**Changes in v3.2.** *Requires further review* becomes its own section with its own count, absorbing the custom-code rows. Summary variable mapping corrected against the object's real fields. Quote line groups and configuration rules are read and classified.

**Changes in v3.1.** The verdict scale is three levels — *Reshape* is gone. It answered a different question from the other three (how much work?) on an axis the tool declares out of scope, and every migration reshapes something, so it discriminated nothing. What it carried now lives in a separate *Shape* marker. Package-owned records are filtered out of every count. The report is printed to PDF rather than downloaded as HTML.

---

## What it is

A tool a Salesforce admin downloads and runs against their own org. It reads their CPQ configuration, maps every piece of it to its Quotivity or HubSpot equivalent, and produces a migration feasibility report.

**It answers the only question a Salesforce CPQ owner actually has:** can what we've built survive the move?

Not a census. A mapping. "You have 47 product rules" is an accounting fact. "44 map directly, 3 depend on a QCP with no equivalent, here's the alternative" is a decision.

**Out of scope: cost, effort and ROI.** The tool reports what exists and where it lands. It does not price the migration, estimate duration, or compare licence costs. That is the conversation they schedule at the close.

---

## Privacy requirements

The tool runs entirely on the customer's machine. Nothing about their configuration is transmitted unless and until the user permits it.

- The Salesforce CLI supplies the authenticated org connection to the plugin. In the standalone script the admin supplies an access token and instance URL. Either way the credential is held in memory for the run only — never written to disk, never transmitted, and no Quotivity connected app is involved.
- The tool makes two outbound requests, both user-initiated.
  - **The email gate form post** to HubSpot. Carries the email address, plugin version, a run identifier, and the lead source. No counts, no object names, nothing about their configuration.
  - **The share action at the close.** Sends the rendered report, and only when the user clicks it. Never the underlying query results.
- Absent those two actions, all query results, intermediate data and rendered output stay on disk.
- The source is published. The privacy claim is only credible if an admin can read the tool before running it.

**Required copy — landing screen:** *Your data never leaves your machine. Run it, read it, and decide for yourself whether to talk to us.*

**Required copy — email gate:** *Your Salesforce data stays on this machine. The only thing sent to Quotivity is your email address.*

**Required copy — email gate, consent:** *By submitting, you agree to receive communications from Quotivity. Unsubscribe at any time. See our Privacy Policy.*

Match the consent wording and the HubSpot subscription type already used on the quoting diagnostic form, so both forms sit on the same legal basis. Confirm the final wording with whoever owns form consent language.

State what is sent, specifically. A blanket "nothing leaves your machine" next to a required email field is the thing this audience checks, and the source is public.

---

## The inventory model

### Pipeline

```
extract  →  classify each record by function  →  assign to bucket  →  render
```

Classification reads discriminator fields already present on the records — primarily `SBQQ__PriceAction__c.SBQQ__Field__c` and `SBQQ__ProductRule__c.SBQQ__Type__c`. No inference.

**Cross-listing.** Some records belong to two functions. Each record has one primary bucket for counting and may appear in a second with a cross-reference marker. A record is counted once and shown twice. Bucket totals must sum to object totals.

**Child records count with their parent.** Conditions, actions and tiers — `SBQQ__ErrorCondition__c`, `SBQQ__PriceCondition__c`, `SBQQ__ProductAction__c` where it does not carry its own discriminator, `SBQQ__ProcessInputCondition__c`, `SBQQ__DiscountTier__c`, `sbaa__ApprovalCondition__c` — are retrieved in full because the classifier reads them, but they are not counted as constructs in their own right. They contribute to the count of the rule, schedule or process they belong to. The totals invariant applies to parent objects.

### The ten buckets

#### Before the quote

| Bucket | The question it answers | What's in it | Where it lands |
|---|---|---|---|
| **Catalog** | What do we sell, and in which currencies? | Count of `Product2` and `Pricebook2`, enabled currencies | HubSpot product library + Quotivity price books |
| **Configuration** | What can be sold together, and what does the rep choose? | Bundles, features → bundle options, option products, nesting depth, option cardinality, constraints, filter-driven option sets | Bundles + Compatibility Rules |
| **Discovery & capture** | What do we ask before or while quoting? | `ConfigurationAttribute`, `QuoteProcess` / `ProcessInput`, required line fields, rules that default a field | Guided Selling + Dynamic Property Sets + Update Line Items |

#### The quote

| Bucket | The question it answers | What's in it | Where it lands |
|---|---|---|---|
| **Price determination** | How does a price get to the line? | `PricingMethod` per product, volume & block pricing, attribute-driven price, subscription term, MDQ segments, price actions writing price fields | Price book adjustments · Calculated pricing · Ramp pricing |
| **Discounting** | Who gets off list, and by how much? | `DiscountSchedule` + tiers, aggregation scope, `ContractedPrice`, price actions writing discount fields | Volume tiers · price books assigned to companies · one-time discounts |
| **Guardrails** | What can a rep not do? | Validation and Alert rules, quote-scope rules, margin floors, discount ceilings, non-discountable and price-editable flags, required fields | Block · Notify · required property-set fields |
| **Approvals** | Who has to sign off, and in what order? | `sbaa__` rules / chains / approvers, or native `ApprovalProcess`; fixed vs derived approvers; median cycle time from history | Require Approval + queues · HubSpot workflow for ordering |
| **Quote output** | What does the customer actually receive? | `QuoteTemplate`, sections, content, `LineColumn`, `QuoteTerm`, languages, signature setup | Quotivity Templates · Terms Library · e-signature |

#### After signature

| Bucket | The question it answers | What's in it | Where it lands |
|---|---|---|---|
| **Contract lifecycle** | What happens to the deal after it's won? | `Contract`, `SBQQ__Subscription__c`, quote Type = Amendment / Renewal, co-terming, uplift, proration settings | HubSpot Contracts + change and renewal quotes |

#### Outside the configuration

| Bucket | The question it answers | What's in it | Where it lands |
|---|---|---|---|
| **Custom code & UI** | What has been customised on top of the CPQ objects? | `SBQQ__CustomScript__c` (QCP), `ApexTrigger` where `TableEnumOrId` is an SBQQ object, `SBQQ__CustomAction__c`, page layouts, custom buttons and links, Lightning record pages on SBQQ objects | Listed by name, flagged for review |

**Naming.** CPQ's **Product Feature** is Quotivity's **bundle option**. CPQ's **Product Option** is Quotivity's **option product**. The Configuration bucket counts features as the bundle option number.

### Classification rules

This table is the report's detail view. **Each row renders with a count, inside its bucket.** The discriminator row — not the object — is the unit of counting, and the unit a verdict attaches to. A bucket's *Exists* value is the sum of its rows; rows whose verdict is Degraded or No target sum to its *Needs attention* value; rows marked *Further review* are counted separately and appear in the **Requires further review** section as well as under their bucket.

| Source | Discriminator | Bucket | Lands as | Verdict |
|---|---|---|---|---|
| `Product2` | active | Catalog | HubSpot product | Clear path |
| `Pricebook2` | — | Catalog | Quotivity price book | Clear path |
| `CurrencyType` | more than one enabled | Catalog | Price book entry prices per enabled portal currency | Clear path |
| `DatedConversionRate` | one rate period per currency | Catalog | A manually set exchange rate — equivalent to a static rate | Clear path |
| `DatedConversionRate` | multiple maintained rate periods per currency | Catalog | HubSpot holds one current rate per currency. There is no way to author a rate for a named past or future period | Degraded |
| `ProductFeature__c` | — | Configuration | Bundle option | Clear path |
| `ProductOption__c` | OptionalSKU is not configurable | Configuration | Option product | Clear path |
| `ProductOption__c` | OptionalSKU is itself configurable | Configuration — nesting | — | No target |
| `ProductFeature__c` | MinOptionCount = 1, MaxOptionCount = 1 | Configuration | Included option with a default product — "Pick one" | Clear path |
| `ProductFeature__c` | MinOptionCount = 1, MaxOptionCount blank | Configuration | Included option, allow multiple — "Pick one or more" | Clear path |
| `ProductFeature__c` | MinOptionCount > 1, or MaxOptionCount is a finite number > 1 | Configuration | Allow-multiple, plus roll-up + Block to enforce the count | Degraded |
| `ConfigurationRule__c` | — | Configuration | Absorbed — scope is implicit, since Compatibility Rules execute within the bundle | Clear path |
| `OptionConstraint__c` | Type = Exclusion | Configuration | Compatibility Rule (Incompatible) | Clear path |
| `OptionConstraint__c` | Type = Dependency, required option is on an included option with a default | Configuration | Already satisfied — the option is always present | Clear path |
| `OptionConstraint__c` | Type = Dependency, any other shape | Configuration | Add add-on bundle product, or Block | Degraded |
| `ProductRule__c` | Type = Validation | Guardrails | Block outcome | Clear path |
| `ProductRule__c` | Type = Alert | Guardrails | Notify outcome | Clear path |
| `ProductRule__c` | Scope = Quote, no bundle context | Guardrails | Block or Require Approval outcome | Clear path |
| `ProductRule__c` | Type = Selection | Configuration | Add add-on bundle product / Swap bundle product | Clear path |
| `ProductRule__c` | Type = Filter | Configuration — dynamic option set | — | No target |
| `ProductRule__c`, `PriceRule__c` | `ConditionsMet__c` = Custom | follows the rule that uses it | Condition groups, the expression expanded to disjunctive normal form | Clear path |
| `ProductAction__c` | Type contains Remove or Disable, replacement exists in the option | Configuration | Swap bundle product | Clear path |
| `ProductAction__c` | Type contains Remove or Disable, no replacement | Configuration | — | No target |
| `ValidationRule` | on an SBQQ object, `NamespacePrefix` null | Guardrails, cross-listed to Custom code & UI | Block outcome | Clear path |
| `Product2` | NonDiscountable, PriceEditable = false | Guardrails | Price book unit price editability | Clear path |
| `ConfigurationAttribute__c` | not applied to product options | Discovery & capture | Guided Selling question | Clear path |
| `ConfigurationAttribute__c` | applied to product options | Discovery & capture + Configuration | Bundle header property + Update Bundle Members | Clear path |
| `QuoteProcess__c` / `ProcessInput__c` | — | Discovery & capture | Guided Selling flow + questions | Clear path |
| `PriceRule__c` | actions write a non-money field | Discovery & capture — defaulting | Update Line Items | Clear path |
| `PriceRule__c` | actions write unit / list / net price, or a price formula | Price determination | Calculated pricing formula | Clear path |
| `PriceRule__c` | actions write a field a validation rule then tests | Guardrails — floor or ceiling | Roll-up + Block outcome | Clear path |
| `PriceRule__c` | `TargetObject__c` = Configurator | Configuration | Compatibility Rules and Dynamic Property Sets do evaluate in the configurator; *pricing* does not resolve until the bundle lands on the quote | Degraded |
| `PriceRule__c` | actions write a discount or markup field | Discounting | Volume tiers or Add One-time Discount | Clear path |
| `PriceAction__c` | formula outside the supported grammar, or over the IF / length / nesting limits | Price determination | — | No target |
| `PriceAction__c` | TargetObject = Quote, `SBQQ__SourceVariable__c` populated | Price determination | Roll-up, which writes its result to the quote | Clear path |
| `PriceAction__c` | TargetObject = Quote, `SBQQ__SourceVariable__c` empty | Price determination | — no outcome writes an arbitrary quote property | No target |
| `SummaryVariable__c` | `TargetObject` = Quote Line, no constraint field | follows the rule that uses it | Roll-up field, with conditions when `FilterField` is set | Clear path |
| `SummaryVariable__c` | `ConstraintField__c` populated | follows the rule that uses it | Roll-up conditions compare a line property to a static value, not to a quote property. Needs Update Line Items to stamp the quote value onto lines first, then filter on it | Degraded |
| `SummaryVariable__c` | `CombineWith__c` or `ValueElement__c` populated | follows the rule that uses it | Two roll-ups, composed in a calculated pricing formula | Clear path |
| `SummaryVariable__c` | `TargetObject` = Product Option | follows the rule that uses it | Aggregates catalog records at configuration time; roll-ups aggregate quote lines | Degraded |
| `SummaryVariable__c` | `TargetObject` = Asset or Subscription, or `Scope` = Assets | follows the rule that uses it | — no asset model | No target |
| `LookupQuery__c` | on a product rule | Configuration + Custom code & UI | The tool cannot read the custom object the lookup targets, so its size and shape are unknown | Further review |
| `LookupQuery__c` | on a price rule | Price determination + Custom code & UI | Same, and custom object values cannot be inputs to a pricing formula — a multi-input price matrix has to be re-expressed as variants or as products | Further review |
| `Product2` | PricingMethod = Cost | Price determination | Calculated pricing formula | Clear path |
| `Product2` | PricingMethod = Percent Of Total | Price determination | Roll-up + calculated pricing formula | Clear path |
| `Product2` | PricingMethod = Block, or `BlockPrice__c` rows | Price determination | Calculated pricing formula | Clear path |
| `Product2` | attribute-driven price | Price determination | Pricing table (value or range), or product variants | Clear path |
| `Product2` | SubscriptionPricing, SubscriptionTerm, not a bundle option | Price determination + Contract lifecycle | Ramp pricing | Degraded |
| `Product2` | SubscriptionPricing, and the product is a bundle header or option product | Price determination + Contract lifecycle | Stepped periods built with Update Bundle Members rules — the Ramp Pricing feature itself cannot be applied to a bundle | Degraded |
| `Product2` | ChargeType = Usage | Price determination | — | No target |
| `Dimension__c` | MDQ segments, same quantity in every segment | Price determination | Ramp pricing; Update Bundle Members rules when the product is bundled | Clear path |
| `Dimension__c` | MDQ segments with differing quantities | Price determination | Quantity is locked across ramp periods — stepped quantity does not carry | Degraded |
| `DiscountSchedule__c` | on `Product2` or `ProductOption`, per-line | Discounting | Volume pricing tiers | Clear path |
| `DiscountSchedule__c` | AggregationScope = Quote | Discounting | Quote-wide roll-up, then a calculated pricing formula over it | Clear path |
| `DiscountSchedule__c` | AggregationScope = Group | Discounting | Roll-ups aggregate quote-wide or per bundle. Line item grouping is a template display feature and carries no functional aggregate | Degraded |
| `DiscountSchedule__c` | Type = Slab | Discounting | Volume tiers, converted to per-unit | Degraded |
| `ContractedPrice__c` | — | Discounting — negotiated | Price book assigned to a company | Clear path |
| `sbaa__ApprovalRule__c` + conditions | — | Approvals | Require Approval outcome + approval queue | Clear path |
| `sbaa__ApprovalChain__c` | step gated on a prior step | Approvals | HubSpot workflow orchestration | Clear path |
| `sbaa__Approver__c` | approver derived from a field | Approvals | Workflow routing | Degraded |
| `sbaa__TrackedField__c` | — | Approvals | Rule conditions + roll-ups | Degraded |
| `sbaa__ApprovalVariable__c` | — | Approvals | Roll-up field, read by the rule's conditions | Clear path |
| `ApprovalProcess` | native, on Quote or Opportunity | Approvals | Require Approval + HubSpot workflow | Clear path |
| QuoteTemplate family | — | Quote output | Quotivity Template + Terms Library | Clear path |
| `QuoteLineGroup__c` | groups used for presentation | Quote output | Template grouping of line items by a line item property | Clear path |
| `QuoteLineGroup__c` | referenced by a discount schedule, rule or approval | Discounting + Guardrails | Grouping is display-only; anything that aggregates or gates by group has to be rebuilt on a quote-wide or per-bundle roll-up | Degraded |
| `QuoteTerm__c` | — | Quote output | Terms Library + Insert Template Terms | Clear path |
| `TermCondition__c` | — | Quote output | Template module visibility — condition groups combined with AND / OR | Clear path |
| `LineColumn__c` | — | Quote output | Line item columns + Dynamic Property Sets | Clear path |
| `Contract`, `Subscription__c` | active | Contract lifecycle | HubSpot Contract + contract line items | Clear path |
| `Quote.Type` | Amendment, Renewal | Contract lifecycle | Change quote, renewal quote | Clear path |
| Orders, assets | — | Contract lifecycle | — | No target |
| `CustomScript__c` | — | Custom code & UI | Flagged for review — likely calculated pricing | Further review |
| `ApexTrigger` | `TableEnumOrId` is an SBQQ object, `NamespacePrefix` null | Custom code & UI | Flagged for review | Further review |
| `CustomAction__c`, layouts, buttons, record pages | on an SBQQ object, not package-owned | Custom code & UI | Flagged for review | Further review |
| any object | record group whose `CreatedById` resolves to no `User` | reported separately, no bucket | shipped with CPQ — not customer configuration | n/a |
| `FieldDefinition` on Quote / QuoteLine | referenced by a migrated rule or formula | prerequisites list, not a bucket | HubSpot property to create | Clear path |
| `FieldDefinition` on Quote / QuoteLine | written by a QCP or an Apex trigger | prerequisites list, not a bucket | No declarative source until the code question is settled | Further review |

### Bucket rendering

Every bucket renders the same three values plus one summary sentence.

| Value | Definition |
|---|---|
| **Exists** | Records of that function in the org |
| **Alive** | Records touched within the trailing window (see *Dead configuration* below) |
| **Needs attention** | Records whose verdict is Degraded or No target |
| **Requires review** | Records the tool could not give a verdict. Its own figure, never added to *Needs attention* |

A bucket with no review rows prints no review figure rather than a zero.

**Summary sentence format.** One line per bucket, in the admin's vocabulary, counts first:

```
Configuration        38 bundles, 412 bundle options, deepest 3 levels.
                     8 not configured since 2024. 2 use dynamic option sets.
Price determination  9 distinct ways a price reaches a line.
                     2 of them run through a Quote Calculator Plugin.
Guardrails           61 rules that stop or warn a rep. 47 fired in the last 12 months.
Contract lifecycle   1,103 active contracts.
                     61% of last year's quotes were renewals or amendments.
```

Price determination counts **mechanisms**, not records.

### Dead configuration

**Window defaults to 24 months.** Configurable by flag. The window in force is printed in the report next to every Alive value.

12 months misclassifies renewal-only configuration as dead in any business with annual contracts.

**Configuration liveness reads `LastModifiedDate`. Never `CreatedDate`.** `CreatedDate` is the date a record entered *this* org, which for any org that was itself migrated, loaded through Data Loader, or refreshed from a sandbox is the load date. An inventory keyed on `CreatedDate` reports a decade-old catalogue as built last quarter.

**Quote volume reads business dates, not system dates.** Group quotes by `SBQQ__Quote__c.SBQQ__StartDate__c`, falling back to `SBQQ__ExpirationDate__c`, then to `CreatedDate`. Print which field was used. A verified org held quotes with business dates spanning 2024 to 2026 and a single identical `CreatedDate` for all of them — a `CreatedDate` grouping put three years of quoting in one bar.

**A bulk touch invalidates an Alive value.** Package upgrades and mass updates rewrite `LastModifiedDate` across whole objects. When more than 60% of an object's records share one `LastModifiedDate`, mark that object's Alive value unreliable and print the date rather than the count.

---

## The migration analysis

Stage 2 is the same ten buckets with a verdict per construct. Their counts on the left, destination and verdict on the right.

### Verdict scale

**One question decides every verdict: does the behaviour survive?**

Not whether the structure changes — it always does, the two products have different data models — and not how much work it is. Effort is out of scope for this tool, so it cannot be what separates one verdict from another.

| Verdict | Meaning |
|---|---|
| **Clear path** | The behaviour survives and the route to it is known |
| **Degraded** | The behaviour survives in part. The report names what is lost |
| **No target** | The behaviour does not survive. Needs a redesign or a product change |

**Clear path is not a claim that it is easy.** It says there is a known route and nothing about how the quote behaves is given up along the way. A quote template that has to be rebuilt from scratch is a clear path: the finished document is reproducible, every part of it has a destination, and the work is a project plan rather than an open question.

**Shape is a separate fact, and it is where the work shows.** Every Clear path row carries one of three markers. Shape never changes the verdict.

| Shape | Meaning |
|---|---|
| **1:1** | One record becomes one record |
| **Fan-out** | One construct becomes several records, or several constructs collapse into one. The report states the resulting cardinality |
| **Rebuild** | Authored fresh in the target rather than imported. Same outcome, no import file |

### Requires further review

Not a verdict. Its own section, and its own number — these rows are never folded into Clear path, and never into a bucket's *Needs attention* figure either. They are counted and shown separately.

**A row qualifies only if a short answer from the customer would change which verdict it gets.** Not "it is hard," not "there is a workaround." If you cannot name the answer that would flip it, it is not review — it is Degraded, and Degraded has to keep meaning *we know exactly what you lose*.

Two reasons a row lands here. The report labels which:

| Reason | What it means |
|---|---|
| **Unread** | The answer exists in the org and the tool cannot extract it — QCP JavaScript, Apex trigger bodies, the custom object behind a lookup query |
| **Intent** | The configuration is fully visible, but what it is *for* decides the verdict |

No row in the current classification uses **Intent** — every review row today is Unread. The label is the rule for rows that arrive later, not a description of the present state. If it still has no occupants when the classifier is calibrated against a real org, drop it.

**Every row states the question and both outcomes.** "If your lookup table keys on one product property, this is a pricing table and a direct port. If it keys on three, it becomes product variants or an expanded catalogue." A row that cannot be written that way does not belong in the section — it is hedging, and it reads as one.

**Calibration.** Most of a healthy CPQ org lands on Clear path — a product built to receive these migrations should absorb most of what a CPQ org contains, and a report that says otherwise is either wrong or describing an org that should not migrate. So a high Clear path share is not the bug signal. These are:

- **No Degraded and no No-target rows at all.** Every org of any age has something that does not carry. A clean sweep means the detectors are not firing.
- **Fewer Fan-out and Rebuild markers than Clear path rows containing contracted pricing, approval chains or quote templates.** Those three always change shape.
- **More than about 5% unclassifiable residue.** Print it either way; 30% means the model needs another bucket.

### Mapping rows

| Bucket | Their Salesforce CPQ | Where it lands | Verdict | Shape |
|---|---|---|---|---|
| Catalog | Products, price books | HubSpot product library, Quotivity price books | Clear path | 1:1 |
| Catalog | Multi-currency price books | Price book entries carry a price per enabled portal currency | Clear path | 1:1 |
| Catalog | Dated conversion rates, a single static rate | A manually set HubSpot exchange rate | Clear path | 1:1 |
| Catalog | Dated conversion rates, a maintained rate table | HubSpot holds one current rate per currency — a rate cannot be authored against a period | Degraded | — |
| Configuration | Bundles, features, options, quantity bounds | Bundles, bundle options, option products | Clear path | 1:1 |
| Configuration | Option constraints — exclusion | Compatibility Rules | Clear path | 1:1 |
| Configuration | Option constraints — dependency ("requires") | Already satisfied when the required option is included with a default; otherwise Add add-on or Block | Degraded | — |
| Configuration | Feature min/max option counts | "Pick one" and "Pick one or more" are native; a numeric cap needs a roll-up + Block | Degraded | — |
| Configuration | Nested bundles | — | No target | — |
| Configuration | Dynamic option sets (filter rules) | — | No target | — |
| Configuration | Lookup queries on a product rule | Depends on the custom object behind them, which the tool cannot read | Further review | — |
| Discovery & capture | Configuration attributes | Header property + Update Bundle Members, or Guided Selling | Clear path | 1:1 |
| Discovery & capture | Guided selling processes | Guided Selling flows + questions | Clear path | 1:1 |
| Price determination | Volume and tier pricing, attribute pricing | Price book adjustments, pricing tables, variants | Clear path | 1:1 |
| Price determination | Cost-plus, percent-of-total, block pricing | Calculated pricing (+ roll-ups) | Clear path | Fan-out |
| Price determination | MDQ / segmented subscription pricing | Ramp pricing; Update Bundle Members rules when bundled. Stepped *quantity* does not carry | Degraded | — |
| Price determination | Subscription term and proration maths | — | No target | — |
| Price determination | Lookup queries on a price rule | Depends on the custom object behind them, which the tool cannot read | Further review | — |
| Discounting | Discount schedules, per-line tiers | Volume pricing tiers | Clear path | 1:1 |
| Discounting | Schedules aggregating across the quote | Quote-wide roll-up + calculated pricing formula | Clear path | Fan-out |
| Discounting | Schedules aggregating across a quote line group | Roll-up quote-wide or per bundle — grouping itself carries no functional aggregate | Degraded | — |
| Discounting | Contracted pricing | Price books assigned to companies | Clear path | Fan-out |
| Guardrails | Validation rules | Block | Clear path | 1:1 |
| Guardrails | Alert rules | Notify | Clear path | 1:1 |
| Guardrails | Non-discountable, price-not-editable | Price book editability, property-set rules | Clear path | 1:1 |
| Guardrails | Custom boolean condition logic on a rule | Condition groups, the expression flattened | Clear path | Fan-out |
| Approvals | Approval rules and conditions | Require Approval + approval queue | Clear path | 1:1 |
| Approvals | Approval chains, ordering | Stacked Request Quote Approval (v2) actions in a HubSpot workflow | Clear path | Rebuild |
| Approvals | Derived approvers, escalation | Workflow routing | Degraded | — |
| Quote output | Quote line groups | Template grouping of line items by a line item property | Clear path | 1:1 |
| Quote output | Quote templates, sections, columns, terms | Quotivity Templates, Terms Library | Clear path | Rebuild |
| Contract lifecycle | Amendments, prorations, renewals | HubSpot Contracts, change and renewal quotes | Clear path | 1:1 |
| Contract lifecycle | Orders, assets | — | No target | — |
| Custom code & UI | QCP, triggers and UI customisations on CPQ objects | Calculated pricing \* | Further review | — |

**Distribution on this set:** 21 Clear path, 6 Degraded, 4 No target, and 3 Requires further review — reported as its own figure, never inside Needs attention.

**Ramp pricing has hard edges, and a route around them.** A ramp needs at least two periods, applies only to recurring line items, and the Ramp Pricing feature **cannot be applied to a bundle header or an option product**. That is not a dead end: stepped periods on a bundled product are buildable with **Update Bundle Members** rules. The outcome is reproducible; what is lost is the native feature's grouping, period badges, and starting/ending MRR handling — so it is Degraded, and the report says which route applies. The detector checks whether the subscription product is also a `ProductOption__c`.

**Quantity is locked across ramp periods.** Within a ramp, name, SKU, quantity, unit price, cost, billing frequency and variant stay identical across periods — only discount, term and billing start vary. CPQ MDQ segments can carry a different *quantity* per segment (100 seats in year 1, 150 in year 2). That case does not carry, and it is the most common reason a segmented subscription lands on Degraded rather than Clear path.

**Dated conversion rates: quoting carries, authoring does not.** HubSpot holds **one current rate per currency**. An admin can set it manually, or turn on automatic updates on a monthly, quarterly or annual schedule from Open Exchange Rates. A deal's rate is stamped at its close date and closed deals are not retroactively re-rated, so point-in-time quoting carries. HubSpot also keeps a viewable currency history, so past rates are not lost.

What does not carry is the **authoring**, which is the whole point of `DatedConversionRate`: there is no interface for entering a rate against a named past or future period. An org that sets a fixed planning rate for a fiscal year, or backfills rates for closed periods, cannot reproduce that. History accrues in HubSpot; it cannot be written.

So the discriminator is whether they maintain a rate table at all. One period per currency means a static rate that a manual entry reproduces. Several maintained periods means a real practice that does not.

**Name the formula limits, don't just say "outside the grammar."** Calculated pricing supports `IF`, `CASE`, `AND`, `OR`, `NOT`, `ISBLANK`, `BLANKVALUE`, `MIN` and `MAX`, and `AND` / `OR` take **2 to 5 arguments each**. A CPQ price action formula that ANDs six conditions is over the limit even though every function it uses is supported. The report prints the specific limit a formula breaches.

**Quote templates are rebuilt on Revenue Cloud Advanced too.** Say so. An admin weighing this migration against Salesforce's own forward path is comparing a rebuild to a rebuild, not a rebuild to a port.

**\* Custom code is listed, not interpreted.** Most QCP logic does something Quotivity's calculated pricing handles declaratively, so the report names that as the likely landing place. The report does not claim to have read their JavaScript — it names each script, names the calculator hooks it implements, and flags it for review on a call.

**Discount tiers are half-open.** CPQ validates that each tier's lower bound equals the previous tier's upper bound, so a schedule reads 1–5, 5–10, 10–25, 25–blank rather than 1–4, 5–9, 10–24. Converting to Quotivity volume tiers must preserve that convention; reading the bounds as inclusive ranges shifts every boundary by one unit and silently misprices the tier edges.

**Multi-currency** carries as explicit per-currency prices on price book entries, one value per currency enabled in the HubSpot portal. Dated conversion rates are not supported: a product priced by conversion rather than by an explicit value has to have that value computed at import, and historical rate-based reporting stays in Salesforce. An entry with no value for a quote's currency cannot be priced on that quote, so the report flags currencies that would arrive empty.

**Contracted pricing** lands as a price book assigned to a company, which also locks the quote so reps can't switch away from negotiated pricing. The report states the resulting cardinality: *N* contracted prices across *M* accounts becomes *M* price books and *N* entries, expressed as import file rows.

**Configuration attributes** split by whether the answer is pushed onto product options. Those that are land as a header property plus an Update Bundle Members rule copying from the bundle header. Those that aren't land as Guided Selling questions.

---

## What it reads

Standard and managed-package objects via SOQL, plus two Metadata API retrieves. Read-only throughout.

**Catalogue** — `Product2` (including `SBQQ__PricingMethod__c`, `SBQQ__SubscriptionPricing__c`, `SBQQ__SubscriptionTerm__c`, `SBQQ__ChargeType__c`, `SBQQ__NonDiscountable__c`, `SBQQ__PriceEditable__c`, `SBQQ__OptionSelectionMethod__c`), `Pricebook2`

**Currency** — `CurrencyType` for the enabled currencies; `DatedConversionRate` grouped by currency, to count how many rate periods each one actually maintains. `PricebookEntry` records are not retrieved at all.

**A product with no price in a currency is not a migration finding.** In HubSpot a product priced in the company currency resolves in an enabled second currency through the exchange rate, so a product with no price anywhere is a catalogue data problem the customer already has. The report does not raise it.

**Bundles** — `SBQQ__ProductOption__c`, `SBQQ__ProductFeature__c`, `SBQQ__OptionConstraint__c`, `SBQQ__ConfigurationAttribute__c`, `SBQQ__ConfigurationRule__c`

**Grouping** — `SBQQ__QuoteLineGroup__c`, and whether any discount schedule, rule or approval references a group

**Logic** — `SBQQ__ProductRule__c`, `SBQQ__ErrorCondition__c`, `SBQQ__ProductAction__c`, `SBQQ__PriceRule__c`, `SBQQ__PriceCondition__c`, `SBQQ__PriceAction__c`, `SBQQ__SummaryVariable__c`, `SBQQ__LookupQuery__c`

Rule retrieval must include `SBQQ__ConditionsMet__c` and `SBQQ__AdvancedCondition__c` on both rule objects, and `SBQQ__Index__c` on every condition.

Query `PriceAction.Field` and `ProductRule.Type` in full, not just parent record counts. They are the classifier's primary discriminators.

### Schema notes, verified against a live CPQ org

What the documentation does not make obvious. All confirmed against a CPQ org on package v67.

- **Price rule evaluation scope lives in `SBQQ__TargetObject__c`**, labelled "Evaluation Scope", values Configurator / Calculator. There is no `EvaluationScope__c` field. Easy to query the wrong name and get nothing.
- **Two evaluation-event fields, and the wrong one is always populated.** On `SBQQ__PriceRule__c`, `SBQQ__EvaluationEvent__c` is a *multipicklist* (On Initialization / Before Calculate / On Calculate / After Calculate) belonging to Calculator scope; Configurator-scope timing lives in `SBQQ__ConfiguratorEvaluationEvent__c` (Save / Edit). CPQ populates `SBQQ__EvaluationEvent__c` by default on every rule, Configurator rules included — a verified Configurator-scope rule carried `EvaluationEvent = On Calculate` *and* `ConfiguratorEvaluationEvent = Edit` at the same time. **Required read order: `SBQQ__TargetObject__c` first, then only the event field that matches it.** A detector reading `SBQQ__EvaluationEvent__c` alone classifies every Configurator rule as Calculator-timed. The multipicklist also means one Calculator rule can carry several events.
- **`SBQQ__EvaluationEvent__c` exists on `SBQQ__ProductRule__c` as well, with a different picklist** — Always / Save / Edit, single-select. Same API name, different domain. Price-rule timing logic cannot be reused on product rules.
- **`SBQQ__PriceCondition__c` and `SBQQ__ErrorCondition__c` are not field-compatible.** Price conditions use `SBQQ__Object__c` / `SBQQ__Field__c` / `SBQQ__Value__c`; error conditions use `SBQQ__TestedObject__c` / `SBQQ__TestedField__c` / `SBQQ__FilterValue__c`. The extraction queries cannot be templated across the two.
- **`SBQQ__Field__c` means opposite things on two objects.** On `SBQQ__PriceCondition__c` it is the *tested* field; on `SBQQ__PriceAction__c` it is the *target* field. The classifier keys on the price action's value, so a query that treats the two as one column silently mixes inputs with outputs.
- **`SBQQ__ErrorCondition__c.SBQQ__TestedField__c` is a dependent picklist that describe does not fully expose.** It described as two values and accepted a third without complaint. Valid values cannot be enumerated from schema — read what is in the records.
- **`SBQQ__SummaryVariable__c` has no grouping field.** Its scoping is `SBQQ__FilterField__c` / `SBQQ__Operator__c` / `SBQQ__FilterValue__c` for a static filter, and `SBQQ__ConstraintField__c` for "include only records whose value of this field matches **the quote's** value of the same field" — not a self-referencing group-by. `SBQQ__Scope__c` is Quote or Assets; `SBQQ__TargetObject__c` is Quote Line, Product Option, Asset or Subscription. Variables compose through `SBQQ__CombineWith__c` + `SBQQ__CompositeOperator__c`, or with a constant through `SBQQ__ValueElement__c`.
- **Summary variables are consumed by four objects, and the report should follow every one.** `SBQQ__ErrorCondition__c` (`TestedVariable__c`, `FilterVariable__c`), `SBQQ__PriceCondition__c` (same two), `SBQQ__PriceAction__c` (`SourceVariable__c`) and `SBQQ__TermCondition__c` (`TestedVariable__c`). A variable with no inbound reference from any of them is dead configuration.
- **Rule conditions are not always ANDed.** `SBQQ__ConditionsMet__c` is All / Any / **Custom** on both `SBQQ__ProductRule__c` and `SBQQ__PriceRule__c`. When Custom, the logic lives in `SBQQ__AdvancedCondition__c` as a boolean expression over the conditions' `SBQQ__Index__c` values — `(1 AND 2) OR 3`. Verified grammar: `AND` and `OR` with parentheses, nesting to any depth, an index may appear more than once; `NOT` is rejected outright — *"Only the following logical operators are accepted: AND, OR."* Retrieve `SBQQ__ConditionsMet__c`, `SBQQ__AdvancedCondition__c` and every condition's `SBQQ__Index__c`. Without them the tool reads every rule as an AND of all its conditions, which is wrong for Custom and over-restrictive for Any, and the expression is unreadable without the indexes it references.

**Pricing** — `SBQQ__DiscountSchedule__c`, `SBQQ__DiscountTier__c`, `SBQQ__BlockPrice__c`, `SBQQ__ContractedPrice__c`, `SBQQ__Dimension__c`

**Discovery** — `SBQQ__QuoteProcess__c`, `SBQQ__ProcessInput__c`, `SBQQ__ProcessInputCondition__c`

**Approvals** — `sbaa__ApprovalRule__c`, `sbaa__ApprovalCondition__c`, `sbaa__ApprovalChain__c`, `sbaa__Approver__c`, `sbaa__ApprovalVariable__c`, `sbaa__TrackedField__c`. If the namespace is absent they are on native approval processes — detect and say so rather than reporting zero. Also retrieve native **`ApprovalProcess`** metadata on Quote and Opportunity; orgs commonly run both engines, and a SOQL-only inventory misses half the approval surface.

**Approval history** — `sbaa__Approval__c` and `ProcessInstance`, trailing 12 months. Yields which steps fire, who approves, and median cycle time.

**Templates** — `SBQQ__QuoteTemplate__c`, `SBQQ__TemplateContent__c`, `SBQQ__TemplateSection__c`, `SBQQ__LineColumn__c`, `SBQQ__QuoteTerm__c`

**Custom code & UI** — `SBQQ__CustomScript__c` (Quote Calculator Plugins) and `SBQQ__CustomAction__c` via SOQL; `ApexTrigger` filtered on `TableEnumOrId` **and `NamespacePrefix = null`**; page layouts, custom buttons and links, Lightning record pages and validation rules on SBQQ objects via a Metadata API retrieve scoped to those objects. Every one of these is filtered per *Package-owned records* below — unfiltered, this bucket reports the package's own code as the customer's.

**Out of scope: `ApexClass` and Flows.** Neither can be reliably attributed to an object — a class's effect on CPQ is only discoverable by matching strings in its body, which over-matches on incidental references and under-matches on dynamic SOQL. Rather than guess, the report states that Apex classes and Flows were not scanned and that logic may exist there.

> **Quote Calculator Plugin (QCP)** — a JavaScript hook in Salesforce CPQ. When a quote recalculates, CPQ fires through a lifecycle and a QCP lets a developer inject custom JavaScript at those points. It exists because declarative price rules can only express so much; when pricing needs a lookup against another system, a margin floor computed across the whole quote, or bespoke rounding, someone writes a QCP.
>
> Most orgs have zero to three. Several means their pricing outgrew Salesforce's rules engine years ago — which is itself a finding.

**Contract lifecycle** — `SBQQ__Subscription__c`, `Contract`, and `SBQQ__Quote__c.SBQQ__Type__c` grouped by year for the amendment and renewal share of quoting

**Volume** — `SBQQ__Quote__c`, `SBQQ__QuoteLine__c` by year on a business date (`SBQQ__StartDate__c`, see *Dead configuration*); distinct products actually quoted

**Custom fields** — `FieldDefinition` on `SBQQ__Quote__c` and `SBQQ__QuoteLine__c`, cross-referenced against fields any migrated rule or formula touches. Output as a prerequisites list: nothing else can be built until these HubSpot properties exist.

### Package-owned records are not customer configuration

Salesforce CPQ ships its own metadata and its own configuration records into every org it is installed in. Counted naively, they become the customer's "customisation" and the Custom code & UI bucket becomes almost entirely noise. Measured on a clean CPQ org with one admin-built fixture:

| Object | Shipped by the package | Built by the admin |
|---|---|---|
| `ApexTrigger` | 73 | 2 |
| `WebLink` | 52 | 6 |
| `ValidationRule` on `SBQQ__Quote__c` | 3 | 1 |
| `SBQQ__CustomAction__c` | 36 | 1 |

Two different filters are needed, because the package delivers two different kinds of thing.

**Metadata components carry a namespace. Filter on it.** `ApexTrigger`, `ApexClass`, `WebLink`, `ValidationRule`, `Layout` and `FlexiPage` all expose `NamespacePrefix`. Package-delivered components return `SBQQ`; admin-authored components return null. **Every query against a metadata-backed object filters `NamespacePrefix = null`, and the report counts only those.** Without it the trigger count above reads 75 instead of 2.

- `ManageableState` is *not* queryable on `ApexTrigger` through the data API — `NamespacePrefix` is the only filter available there.
- The Object Manager UI lists managed validation rules **without** the namespace prefix in the Rule Name column, so the names look admin-authored. The detail page is where "(Managed)", the namespace and the installed package appear. Do not infer ownership from a name.

**Configuration records have no namespace. Use the install signature.** `SBQQ__CustomAction__c` and the other configuration objects hold data records, so `NamespacePrefix` does not exist on them. The package seeds them through a post-install process, which leaves a signature: every seeded record shares one `CreatedById`, and their `CreatedDate` values fall inside a one- or two-second window. In the measured org the 36 seeded actions were all created by `005aj00000duVkDAAU` — **a user id that returns no row from `User`**, because the install user is not visible to SOQL.

The rule: **for each configuration object, group by `CreatedById` and treat a group whose creator does not resolve to a `User` record as package seed data.** Report seeded records as a separate line ("36 shipped with CPQ") rather than folding them into the customer's count, and never assign them a verdict — they have no migration target because the customer never built them.

**This check runs on every object the tool reads, not just the custom-code ones.** Any object CPQ seeds inflates its bucket the same way.

### Query limits

- Headline counts come from aggregate `COUNT()` queries, so a count is never constrained by how many records are retrieved.
- Detail retrieval is capped at **10,000 records per object**. Past the cap the report shows the exact count from the aggregate query and marks that bucket's discriminator breakdown as partial.
- **Every request is a read, so every request is retryable.** The tool issues no DML and no Metadata API deploys, which means a timeout, a 503 or an expired session can be retried without checking what happened first. Retry three times with backoff, then report the object as unread rather than reporting zero.
- **Classifier inputs are not truncatable.** `ProductRule`, `ProductAction`, `ErrorCondition`, `PriceRule` and `PriceAction` must be retrieved in full — a partial set produces wrong bucket assignments. If any exceeds 10,000, stop and report it rather than classifying a partial set.

---

## Distribution

Two packages over one analysis core.

**The analysis core.** Extraction, classification, mapping and report assembly. Takes an authenticated connection object and returns the data set. No dependency on the Salesforce CLI.

| Package | How it authenticates | For |
|---|---|---|
| **SFDX plugin** — `sf plugins install @quotivity/cpq-inventory` | The CLI supplies the authenticated org connection | Orgs with SFDX and someone technical on the Salesforce side |
| **Standalone Node script** | The admin supplies an access token and instance URL | Orgs without SFDX, or where installing a plugin needs an approval nobody wants to chase |

Both packages serve the same report and the same print control. Behaviour is identical once a connection exists.

**No OAuth grant to Quotivity, in either package.** If a browser-based auth flow is added later it must run through a connected app in the customer's own org, so there is still nothing to grant us and nothing for a security review to assess.

**Node version.** The plugin runs under the CLI's Node and inherits its version. The standalone script declares its own minimum and fails with a clear message below it.

**Accepted risk — unsigned plugin.** Salesforce prompts on install for plugins not on their allowlist. We ship unsigned and accept the prompt. The install instructions say the prompt is expected and what it means, so it reads as a known property of the tool rather than a warning sign. The standalone script is the route for an admin who won't accept it.

---

## The output

A React app, rendered locally. The plugin runs the queries, writes the data, starts a local server on `127.0.0.1`, opens the browser, and runs until Ctrl-C.

**Print control.** The report carries one control that produces the shareable artifact — for their team, their boss, or us. It does **not** download an HTML file. It opens the report in a new browser tab and triggers the print dialog, so the admin saves a PDF.

An HTML file is a poor artifact to hand to a VP: it opens in a browser, looks like a web page, and nobody forwards it. A PDF attaches to an email and survives the trip.

**Behaviour**

1. The local server assembles a single self-contained HTML file from the same data and compiled assets it is already serving — data inlined, no client-side bundling — and serves it at `/report?print=1`.
2. The control calls `window.open` on that URL **synchronously inside the click handler**. Not after an `await` — a window opened from an async continuation loses its user-gesture credit and the popup blocker eats it. Assemble the file before the click, or open the tab first and navigate it.
3. The assembled page calls `window.print()` on load, after `document.fonts.ready` resolves and after every chart has finished rendering. Printing early produces missing glyphs and blank chart areas.
4. The tab stays open after printing. The admin may want to print again, adjust the page range, or read it. Do not close it on `afterprint`.
5. If `window.open` returns null, the popup blocker won. Show the URL inline as a plain link with one line of instruction rather than failing silently.

**The PDF's filename comes from the document `<title>`**, not from a header. Set it to `quotivity-cpq-inventory-<org>-<date>` so the saved file names itself.

**Nothing leaves the machine.** The print tab is served from `127.0.0.1` and the browser's Save as PDF writes to their own disk. This control is not one of the two outbound requests.

**Print stylesheet.** The printed report is a different document from the interactive one and needs its own rules. Without them the PDF arrives with a navigation bar on every page and half the content collapsed.

| Rule | Why |
|---|---|
| Hide nav, filters, the print control itself, and the share button | They are dead weight on paper |
| Expand everything — no accordions, no tabs, no "show more" | A section behind a click does not exist in a PDF |
| `break-inside: avoid` on bucket cards, mapping rows and classification rows | A verdict split across a page break is unreadable |
| `thead { display: table-header-group }` | Long tables repeat their headers on every page |
| `print-color-adjust: exact` | Verdict and flag colours are load-bearing; browsers strip backgrounds by default |
| `@page` size and margins set explicitly | Do not inherit whatever the admin last printed |
| Org name, run date and the dead-configuration window repeated at the top of each stage | Browser headers and footers cannot be controlled, so the document carries its own identification |

### Flow

**1 · Launch, in the terminal**

```
Quotivity CPQ Inventory
Connected to: acme-prod (admin@acme.com)

This runs entirely on your machine. Opening your browser...
```

**2 · Landing screen**

Quotivity logo and palette. Restrained — this is a utility.

- What the tool does, in three lines
- The privacy copy
- **About Quotivity** as a button, not a section
- **Start analysis**

**3 · Email gate**

Hard gate. No email, no analysis. Submits to a HubSpot form; the analysis unlocks on success.

| | |
|---|---|
| **Fields** | Email required. Company domain optional — derivable from the email, so don't ask twice |
| **Consent** | Communications consent line displayed with the form. Copy under *Privacy requirements* |
| **Payload** | Lead source, plugin version, run identifier. No counts, no object names, nothing about their configuration |
| **On success** | Unlock stage 1 |
| **On network failure** | Run the analysis locally. Tell them plainly that the email couldn't be registered and they can share the output directly |

Portal ID and form GUID are public and compiled into the plugin.

The analysis does not run before submission. The gate is real, and a reader of the source will check.

**Offline handling is a requirement, not a nicety.** Corporate proxies, VPNs and egress rules are most common at the companies most likely to have serious CPQ complexity. A dead-end on form failure makes the tool appear broken to exactly that set.

**4 · Stage 1 — Inventory**

The ten buckets, each with Exists / Alive / Needs attention and its summary sentence. A confirmation step: *does this look like your org?*

Requirements:

- Show query progress. A large org takes time and silence reads as failure.
- Print the dead-configuration window alongside every Alive value.

Closing line: *Does this match what you expected? Most teams find something here they'd forgotten about.*

**5 · Stage 2 — Migration analysis**

Same ten buckets, verdict per construct, four-level scale.

Closing line: *Every part of your configuration has either a destination or a decision — and this report names which.*

**6 · Close**

One action: **Share this analysis and schedule a free consultation.** Sends the report, not the underlying data, and books the call in the same step.

The button states what it sends. The print control is the alternative — someone who won't click a send button will often attach a PDF.

### Runtime constraints

| Constraint | Handling |
|---|---|
| **The Node runtime isn't ours** | The plugin runs under the CLI's Node (currently 24.x). Pure-JS dependencies only. Native modules needing compilation are where this breaks — verify early |
| **Install weight** | `sf plugins install` pulls the whole dependency tree. Pre-build the React app at publish time and ship compiled assets. No vite, webpack or babel in the plugin's dependencies |
| **Serving** | Node's built-in `http` serving static files. No framework at runtime |
| **Port binding** | Bind `127.0.0.1` explicitly, never `0.0.0.0`. Avoids the OS firewall prompt on most systems, and nothing is reachable off the machine. Detect a taken port and increment |

There is no dependency allowlist for Salesforce CLI plugins — it's a Node package and can do anything Node can.

---

## Lead capture

The npm install can't be gated; it's a public package. Capture happens inside the tool.

**The email gate.** Strong intent on its own — nobody runs a CPQ migration analyser against their production org idly. Route it as its own lead source to measure the campaign.

**The share, at the close.** One button, sending the report and booking the call together. The print control is the manual alternative.

The CTA is earned by stage 1: by the end of the inventory the admin should have seen something they didn't know. With Alive reported inside every bucket there are ten chances at that — dormant bundles, approval rules that never fired, unremembered custom scripts, products never quoted.

---

## Build sequence

1. **Get a Salesforce CPQ developer org** with the package installed. Nothing below is real until this exists
2. **Verify the schema** against a live org. The object list above is from documentation
3. **Verify the classifier's discriminators.** Real-world `PriceAction.Field` and `ProductRule.Type` contents are messier than the documentation — custom fields, renamed picklist values, one mechanism used for three purposes
4. **Write the queries**, one per bucket, each independently runnable
5. **Build the analysis core** — queries, classification, mapping, report assembly — taking a connection object, with no dependency on the Salesforce CLI
6. **Build the SFDX plugin** around the core. `sf plugins install @quotivity/cpq-inventory`
7. **Build the React report**, pre-built at publish time, plus the single-file print document the print control opens — including its print stylesheet, which is tested by actually saving a PDF, not by eyeballing print preview
8. **Build the standalone Node script** over the same core
9. **Publish the source**
10. **Run it against a real client org and calibrate.** Report the unclassifiable residue. 5% is acceptable and worth printing; 30% means the model needs another bucket

### Fixture org notes

Steps 1–3 build a CPQ org holding one instance of every discriminator so each detector has something to match. Two constraints on that build, verified:

- **`ConditionsMet = Custom` is rejected at insert** — *"No condition can currently be used with Custom Conditions Met."* Create the rule with `All`, insert the indexed conditions, then update the rule to `Custom` and write `SBQQ__AdvancedCondition__c`.
- **A transport error is an unknown outcome, not a failure.** An expired-session error was returned on a create that had already committed, producing a duplicate record. Fixture provisioning must re-query by name before retrying any write.
- **Apex is write-once through the API.** `ApexTrigger` can be created through a data/Tooling connection, but updating its `Body` is rejected with `INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY` — an update needs a `MetadataContainer` deployment. Delete and recreate instead.
- **Fixture reachability, by object.** `SBQQ__CustomScript__c` (QCP) and `SBQQ__CustomAction__c` are ordinary custom objects — create them with the data API. `ApexTrigger` and `WebLink` create through the Tooling API. `ValidationRule` and native `ApprovalProcess` reach neither, and need the Setup UI or a Metadata API deploy. A validation rule can be produced quickly by cloning one of CPQ's own — the clone saves unmanaged.

---

## Open decisions

**Multi-org.** Out of scope for v1. Price separately.

**Contact, deal, or both** on gate submission.

**Closed: *Requires further review* is its own section with its own number.** It absorbs the custom-code rows and any row where a short answer from the customer would change the verdict. Its rows never count toward a bucket's *Needs attention*. A Remove action with no replacement still reads as a gap, not a question.
