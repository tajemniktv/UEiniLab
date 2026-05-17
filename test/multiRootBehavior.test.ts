import { describe, expect, it } from 'vitest';
import { getKeyCompletions } from '../src/core/completionEngine';
import { analyzeIniDocument } from '../src/core/diagnosticEngine';
import { buildHoverMarkdown } from '../src/core/hoverText';
import { parseIni } from '../src/core/iniParser';
import { SchemaRegistry } from '../src/core/schemaRegistry';

function scopedRegistry(id: string, cvarName: string, help: string): SchemaRegistry {
  const registry = new SchemaRegistry();
  registry.setPacks([
    {
      role: 'game',
      priority: 10,
      path: `${id}.jsonc`,
      pack: {
        schemaVersion: 1,
        id,
        displayName: id,
        target: { engine: 'Unreal Engine', game: id },
        cvars: {
          [cvarName]: { name: cvarName, type: 'int', help }
        }
      }
    }
  ]);
  return registry;
}

describe('multi-root registry behavior boundary', () => {
  it('lets hover, completion, and diagnostics differ by selected registry', () => {
    const folderA = scopedRegistry('folder-a', 'r.FolderAOnly', 'Folder A help.');
    const folderB = scopedRegistry('folder-b', 'r.FolderBOnly', 'Folder B help.');
    const parsed = parseIni('[SystemSettings]\nr.FolderAOnly=1');
    const node = parsed.keyValues[0];
    const options = {
      warnDuplicateKeys: true,
      warnKnownInEngineButMissingFromGameDump: true,
      warnTypeMismatches: true,
      warnUnknownCvars: true
    };

    expect(buildHoverMarkdown(node, folderA, { showSourceProvenance: true })).toContain('Folder A help.');
    expect(buildHoverMarkdown(node, folderB, { showSourceProvenance: true })).toContain('Unknown CVar');
    expect(getKeyCompletions(folderA, 'r.Folder', 10).map((item) => item.label)).toEqual(['r.FolderAOnly']);
    expect(getKeyCompletions(folderB, 'r.Folder', 10).map((item) => item.label)).toEqual(['r.FolderBOnly']);
    expect(analyzeIniDocument(parsed, folderA, options).map((diagnostic) => diagnostic.code)).not.toContain('unknown-cvar');
    expect(analyzeIniDocument(parsed, folderB, options).map((diagnostic) => diagnostic.code)).toContain('unknown-cvar');
  });
});
