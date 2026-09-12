#!/usr/bin/env node
// Local development entry: `./bin/dev.js cpq inventory -o my-org` after `npm run build`.
import { execute } from '@oclif/core';

await execute({ development: true, dir: import.meta.url });
