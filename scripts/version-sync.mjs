// Keeps every workspace on one version and pins internal dependency ranges to it.
// Usage: npm run version:sync -- <patch|minor|major|x.y.z>
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const bump = process.argv[2];
if (!bump) {
  console.error('usage: version-sync <patch|minor|major|x.y.z>');
  process.exit(1);
}
execSync(`npm version ${bump} --no-git-tag-version --workspaces --include-workspace-root`, {
  stdio: 'inherit',
});
const root = JSON.parse(readFileSync('package.json', 'utf8'));
const version = root.version;
const internal = ['@quotivity/cpq-inventory-core'];
for (const dir of ['packages/core', 'packages/report', 'packages/plugin', 'packages/standalone']) {
  const path = `${dir}/package.json`;
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  for (const key of ['dependencies', 'devDependencies']) {
    for (const name of internal) if (pkg[key]?.[name]) pkg[key][name] = version;
  }
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
}
execSync('npm install --package-lock-only --no-audit --no-fund', { stdio: 'inherit' });
console.log(`all workspaces at ${version}`);
