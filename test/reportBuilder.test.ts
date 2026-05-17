import { describe, expect, it } from 'vitest';
import { buildTweakReport } from '../src/core/reportBuilder';
import { parseIni } from '../src/core/iniParser';
import { SchemaRegistry } from '../src/core/schemaRegistry';

describe('buildTweakReport', () => {
  it('includes effective value analysis with duplicate winner notes', () => {
    const registry = new SchemaRegistry();
    registry.setPacks([
      {
        role: 'game',
        priority: 1,
        path: 'game.jsonc',
        pack: {
          schemaVersion: 1,
          id: 'game',
          displayName: 'Game',
          target: { engine: 'Unreal Engine', game: 'Example' },
          cvars: {
            'r.Known': { name: 'r.Known', type: 'int', defaultValue: '1', currentValue: '2' }
          }
        }
      }
    ]);

    const report = buildTweakReport(parseIni('[SystemSettings]\nr.Known=1\nr.Known=2'), registry, {
      warnDuplicateKeys: true,
      warnKnownInEngineButMissingFromGameDump: true,
      warnTypeMismatches: true,
      warnUnknownCvars: true
    });

    expect(report).toContain('## Effective Values');
    expect(report).toContain('`r.Known` => `2`');
    expect(report).toContain('1 overridden duplicate(s)');
    expect(report).toContain('matches dump/current');
  });
});
