// Verifies each publishable tarball carries what its consumers need. Fails the build if not.
import { execSync } from 'node:child_process';

const expectations = {
  'packages/core': ['lib/index.js', 'lib/index.d.ts', 'assets/report/index.html'],
  'packages/plugin': [
    'lib/commands/cpq/inventory.js',
    'messages/cpq.inventory.md',
    'oclif.manifest.json',
  ],
};

let failed = false;
for (const [dir, required] of Object.entries(expectations)) {
  // --ignore-scripts: the build already produced lib/, assets/ and the oclif manifest, and a prepack
  // hook would print into the JSON we parse.
  const out = execSync(`npm pack --dry-run --json --ignore-scripts -w ${dir}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const [info] = JSON.parse(out);
  const files = new Set(info.files.map((f) => f.path));
  const missing = required.filter((f) => !files.has(f));
  const kb = Math.round(info.size / 1024);
  if (missing.length) {
    failed = true;
    console.error(`✗ ${info.name}@${info.version} (${kb} KB) missing: ${missing.join(', ')}`);
  } else {
    console.log(`✓ ${info.name}@${info.version} (${kb} KB, ${files.size} files)`);
  }
}
process.exit(failed ? 1 : 0);
