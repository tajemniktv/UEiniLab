import { describe, expect, it } from 'vitest';
import { analyzeEffectiveIni } from '../src/core/effectiveIniAnalysis';
import { parseIni } from '../src/core/iniParser';
import { SchemaRegistry } from '../src/core/schemaRegistry';

function registry(): SchemaRegistry {
  const registry = new SchemaRegistry();
  registry.setPacks([
    {
      role: 'engine',
      priority: 1,
      path: 'engine.jsonc',
      pack: {
        schemaVersion: 1,
        id: 'engine',
        displayName: 'Engine',
        target: { engine: 'Unreal Engine' },
        cvars: {
          'r.Known': { name: 'r.Known', type: 'int', defaultValue: '1', currentValue: '3' },
          'r.Array': { name: 'r.Array', type: 'string' },
          'r.EngineOnly': { name: 'r.EngineOnly', type: 'bool', defaultValue: '0' }
        }
      }
    }
  ]);
  return registry;
}

describe('analyzeEffectiveIni', () => {
  it('computes winning scalar values and marks schema default/current matches', () => {
    const result = analyzeEffectiveIni(parseIni('[SystemSettings]\nr.Known=1\nr.Known=3\nr.Unknown=5'), registry(), {
      preferredRole: 'game'
    });

    const known = result.entries.get('SystemSettings/r.Known');
    expect(known?.finalValue).toBe('3');
    expect(known?.winningOccurrence.line).toBe(2);
    expect(known?.duplicates.map((node) => node.line)).toEqual([1]);
    expect(known?.matchesDefault).toBe(false);
    expect(known?.matchesCurrent).toBe(true);
    expect(result.unknownCvarLike.map((node) => node.key)).toEqual(['r.Unknown']);
    expect(result.knownInLowerLayerOnly.map((node) => node.key)).toEqual(['r.Known']);
  });

  it('interprets basic Unreal array mutation operators', () => {
    const result = analyzeEffectiveIni(parseIni('[SystemSettings]\n+r.Array=A\n+r.Array=B\n-r.Array=A\n!r.Array='), registry());

    const array = result.entries.get('SystemSettings/r.Array');
    expect(array?.finalArrayValue).toEqual([]);
    expect(array?.arrayOperations.map((operation) => operation.operator)).toEqual(['+', '+', '-', '!']);
    expect(array?.winningOccurrence.line).toBe(4);
  });
});
