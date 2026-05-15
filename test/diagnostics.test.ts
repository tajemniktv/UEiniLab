import { describe, expect, it } from 'vitest';
import { analyzeIniDocument } from '../src/core/diagnosticEngine';
import { parseIni } from '../src/core/iniParser';
import { SchemaRegistry } from '../src/core/schemaRegistry';

describe('analyzeIniDocument', () => {
  it('reports duplicate keys, unknown cvars, type mismatches, and enum errors', () => {
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
          target: { engine: 'Unreal Engine' },
          cvars: {
            'r.BoolThing': { name: 'r.BoolThing', type: 'bool' },
            'r.EnumThing': { name: 'r.EnumThing', type: 'enum', knownValues: { '0': 'Off', '1': 'On' } }
          }
        }
      }
    ]);

    const doc = parseIni('[SystemSettings]\nr.BoolThing=maybe\nr.BoolThing=1\nr.EnumThing=3\nr.Unkown=1');
    const diagnostics = analyzeIniDocument(doc, registry, {
      warnDuplicateKeys: true,
      warnKnownInEngineButMissingFromGameDump: true,
      warnTypeMismatches: true,
      warnUnknownCvars: true
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(['duplicate-key', 'type-mismatch', 'invalid-enum', 'unknown-cvar'])
    );
  });

  it('does not report duplicate noise for common Unreal non-CVar keys or incomplete typed keys', () => {
    const registry = new SchemaRegistry();
    registry.setPacks([]);
    const doc = parseIni('[Core.System]\nPaths=../../../Engine\nPaths=../../../Game\nHistoryBuffer=stat fps\nHistoryBuffer=r.Shadow\nr.shad');
    const diagnostics = analyzeIniDocument(doc, registry, {
      warnDuplicateKeys: true,
      warnKnownInEngineButMissingFromGameDump: true,
      warnTypeMismatches: true,
      warnUnknownCvars: true
    });

    expect(diagnostics).toHaveLength(0);
  });
});
