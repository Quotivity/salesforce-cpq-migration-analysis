// Installs a pre-commit hook that runs Biome on staged files. No husky, no extra dependency.
// Skipped when not in a git checkout (e.g. `npm install` of a published package) or in CI.
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const gitDir = join(root, '.git');
if (!existsSync(gitDir) || process.env.CI) process.exit(0);

const hooksDir = join(gitDir, 'hooks');
mkdirSync(hooksDir, { recursive: true });
const hook = `#!/bin/sh
# Installed by scripts/install-hooks.mjs — runs Biome on staged files.
exec npx --no biome check --staged --no-errors-on-unmatched
`;
writeFileSync(join(hooksDir, 'pre-commit'), hook);
chmodSync(join(hooksDir, 'pre-commit'), 0o755);
