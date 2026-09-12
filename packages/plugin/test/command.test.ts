import { describe, expect, it } from 'vitest';
import CpqInventory from '../src/commands/cpq/inventory.js';

describe('sf cpq inventory', () => {
  it('declares the flags the README documents, with the spec defaults', () => {
    const flags = CpqInventory.flags as Record<string, { default?: unknown; char?: string }>;
    expect(Object.keys(flags).sort()).toEqual([
      'api-version',
      'no-open',
      'port',
      'target-org',
      'window',
    ]);
    expect(flags.window?.default).toBe(24);
    expect(flags.port?.default).toBe(3579);
  });
  it('loads its copy from the messages directory', () => {
    expect(CpqInventory.summary).toMatch(/Inventory a Salesforce CPQ org/);
    expect(CpqInventory.examples.length).toBeGreaterThanOrEqual(3);
  });
});
