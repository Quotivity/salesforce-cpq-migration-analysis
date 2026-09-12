// Links the built plugin into a Salesforce CLI and checks the command is discoverable.
// Requires `sf` on PATH (CI installs @salesforce/cli).
import { execSync } from 'node:child_process';

const run = (cmd) => {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
};

run('sf version');
run('sf plugins link packages/plugin --no-install');
const help = run('sf cpq inventory --help');
if (!/--target-org/.test(help) || !/--window/.test(help)) {
  console.error('sf cpq inventory --help did not list the expected flags');
  process.exit(1);
}
console.log('✓ sf cpq inventory is registered');
