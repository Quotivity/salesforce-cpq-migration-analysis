#!/usr/bin/env node
// Checks the Node version before importing anything, so the failure below the minimum is a clear
// sentence rather than a syntax error from a newer feature.
const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
  console.error(
    `Quotivity CPQ Inventory needs Node.js 22 or newer; this is ${process.versions.node}.`,
  );
  console.error('Install a current Node.js from https://nodejs.org and run the command again.');
  process.exit(1);
}
import('../lib/cli.js')
  .then((m) => m.main(process.argv.slice(2)))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
