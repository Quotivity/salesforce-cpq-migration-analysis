# summary

Inventory a Salesforce CPQ org and map every construct to its Quotivity + HubSpot destination.

# description

Reads the org's CPQ configuration through the connection the CLI already holds, classifies every record into ten functional buckets, gives each construct a verdict — clear path, degraded, or no target — and serves the report at http://localhost in your browser, bound to loopback only. Nothing about the configuration leaves the machine; the only outbound requests are two user-initiated HubSpot form submissions (the email gate and the meeting request at the end). Every request to Salesforce is a read.

The command runs until you press Ctrl-C. The report's print control saves a PDF through the browser.

# examples

- Run against the default org:

  <%= config.bin %> <%= command.id %>

- Run against an alias with a 12-month dead-configuration window:

  <%= config.bin %> <%= command.id %> --target-org acme-prod --window 12

- Start the server without opening a browser:

  <%= config.bin %> <%= command.id %> --target-org acme-prod --no-open

# flags.window.summary

Dead-configuration window in months. Records not modified within it count as not alive.

# flags.window.description

Defaults to 24. Twelve months misclassifies renewal-only configuration as dead in any business with annual contracts. The window in force is printed next to every Alive value.

# flags.port.summary

Port to serve the report on, loopback only. Increments if taken.

# flags.no-open.summary

Do not open a browser; print the URL instead.

# info.ready

Report served at %s — loopback only, nothing is reachable off this machine. Press Ctrl-C to stop.

# error.assets

The compiled report is missing from this install (expected %s). Reinstall with `sf plugins install @quotivity/cpq-inventory`.
