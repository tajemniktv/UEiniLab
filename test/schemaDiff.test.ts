import { describe, expect, it } from 'vitest';
import { diffSchemaPacks, renderSchemaDiffMarkdown } from '../src/core/schemaDiff';
import type { CvarSchemaPack } from '../src/core/schemaTypes';

const before: CvarSchemaPack = {
  schemaVersion: 1,
  id: 'ue5.6-base',
  displayName: 'UE 5.6 Base',
  target: { engine: 'Unreal Engine', engineVersion: '5.6' },
  cvars: {
    'r.Removed': { name: 'r.Removed', type: 'bool', defaultValue: '0', help: 'Removed help' },
    'r.Changed': {
      name: 'r.Changed',
      type: 'int',
      defaultValue: '1',
      help: 'Old help',
      knownValues: { '0': 'Off', '1': 'Old' },
      flags: ['RenderThreadSafe']
    },
    'r.Same': { name: 'r.Same', type: 'float', defaultValue: '0.5' }
  }
};

const after: CvarSchemaPack = {
  schemaVersion: 1,
  id: 'ue5.7-base',
  displayName: 'UE 5.7 Base',
  target: { engine: 'Unreal Engine', engineVersion: '5.7' },
  cvars: {
    'r.Added': { name: 'r.Added', type: 'string', defaultValue: 'New', help: 'Added help' },
    'r.Changed': {
      name: 'r.Changed',
      type: 'float',
      defaultValue: '2',
      help: 'New help',
      knownValues: { '0': 'Off', '2': 'New' },
      flags: ['Scalability']
    },
    'r.Same': { name: 'r.Same', type: 'float', defaultValue: '0.5' }
  }
};

describe('diffSchemaPacks', () => {
  it('reports added, removed, and changed CVars with changed field details', () => {
    const diff = diffSchemaPacks(before, after);

    expect(diff.summary).toEqual({ added: 1, removed: 1, changed: 1, unchanged: 1 });
    expect(diff.added.map((entry) => entry.name)).toEqual(['r.Added']);
    expect(diff.removed.map((entry) => entry.name)).toEqual(['r.Removed']);
    expect(diff.changed[0]?.name).toBe('r.Changed');
    expect(diff.changed[0]?.changes.map((change) => change.field)).toEqual(
      expect.arrayContaining(['type', 'defaultValue', 'help', 'knownValues', 'flags'])
    );
  });

  it('renders a Markdown report suitable for opening in VS Code', () => {
    const markdown = renderSchemaDiffMarkdown(diffSchemaPacks(before, after));

    expect(markdown).toContain('# Schema Diff');
    expect(markdown).toContain('UE 5.6 Base -> UE 5.7 Base');
    expect(markdown).toContain('- Added CVars: 1');
    expect(markdown).toContain('`r.Added`');
    expect(markdown).toContain('`r.Changed`');
    expect(markdown).toContain('defaultValue');
  });
});
