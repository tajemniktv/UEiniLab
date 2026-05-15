import { describe, expect, it } from 'vitest';
import { mergeCvarEntries } from '../src/core/schemaMerge';

describe('mergeCvarEntries', () => {
  it('merges sparse high-priority entries over richer lower-priority entries', () => {
    const merged = mergeCvarEntries([
      {
        packId: 'game',
        role: 'game',
        priority: 20,
        entry: { name: 'r.Test', currentValue: '2', sources: [{ type: 'game-dump', label: 'Game' }] }
      },
      {
        packId: 'engine',
        role: 'engine',
        priority: 10,
        entry: {
          name: 'r.Test',
          type: 'int',
          defaultValue: '1',
          help: 'Engine help',
          knownValues: { '1': 'On' },
          sources: [{ type: 'engine-dump', label: 'Engine' }]
        }
      }
    ]);

    expect(merged.entry).toMatchObject({
      name: 'r.Test',
      currentValue: '2',
      defaultValue: '1',
      help: 'Engine help',
      type: 'int'
    });
    expect(merged.sources).toHaveLength(2);
  });

  it('lets lower-priority base schemas provide defaults and set-by flags when game dumps omit them', () => {
    const merged = mergeCvarEntries([
      {
        packId: 'game',
        role: 'game',
        priority: 20,
        entry: {
          name: 'r.Lumen.Reflections.DownsampleFactor',
          type: 'int',
          currentValue: '1',
          help: 'Game dump help',
          flags: ['SetByScalability']
        }
      },
      {
        packId: 'ue5.6-base',
        role: 'engine',
        priority: 10,
        entry: {
          name: 'r.Lumen.Reflections.DownsampleFactor',
          type: 'int',
          defaultValue: '2',
          help: 'Base docs help',
          flags: ['SetByConstructor']
        }
      }
    ]);

    expect(merged.entry.defaultValue).toBe('2');
    expect(merged.entry.currentValue).toBe('1');
    expect(merged.entry.help).toBe('Game dump help');
    expect(merged.entry.flags).toEqual(['SetByScalability', 'SetByConstructor']);
  });
});
