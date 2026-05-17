import { describe, expect, it } from 'vitest';
import { SchemaRegistry } from '../src/core/schemaRegistry';
import type { CvarSchemaPack } from '../src/core/schemaTypes';

const enginePack: CvarSchemaPack = {
  schemaVersion: 1,
  id: 'ue-base',
  displayName: 'UE Base',
  target: { engine: 'Unreal Engine', engineVersion: '5.5', game: null, gameBuild: null },
  generatedFrom: { source: 'example' },
  cvars: {
    'r.Foo': {
      name: 'r.Foo',
      kind: 'variable',
      type: 'int',
      defaultValue: '1',
      help: 'Base help',
      sources: [{ type: 'engine-dump', label: 'UE Base' }]
    },
    'r.EngineOnly': {
      name: 'r.EngineOnly',
      kind: 'variable',
      type: 'bool',
      defaultValue: '0',
      sources: [{ type: 'engine-dump', label: 'UE Base' }]
    }
  }
};

const gamePack: CvarSchemaPack = {
  schemaVersion: 1,
  id: 'game',
  displayName: 'Game Dump',
  target: { engine: 'Unreal Engine', engineVersion: '5.5', game: 'Example', gameBuild: '1' },
  generatedFrom: { source: 'UUU' },
  cvars: {
    'r.Foo': {
      name: 'r.Foo',
      kind: 'variable',
      type: 'int',
      currentValue: '2',
      help: 'Game help',
      sources: [{ type: 'game-dump', label: 'Game Dump' }]
    }
  }
};

describe('SchemaRegistry', () => {
  it('resolves higher priority schema entries while retaining provenance', () => {
    const registry = new SchemaRegistry();
    registry.setPacks([
      { pack: enginePack, role: 'engine', priority: 10, path: 'engine.jsonc' },
      { pack: gamePack, role: 'game', priority: 20, path: 'game.jsonc' }
    ]);

    const resolved = registry.lookup('r.Foo');
    expect(resolved?.entry.help).toBe('Game help');
    expect(resolved?.entry.defaultValue).toBe('1');
    expect(resolved?.entry.currentValue).toBe('2');
    expect(resolved?.sources.map((source) => source.packId)).toEqual(['game', 'ue-base']);
    expect(registry.isKnownInLowerLayerOnly('r.EngineOnly', 'game')).toBe(true);
  });

  it('searches by name and help text', () => {
    const registry = new SchemaRegistry();
    registry.setPacks([{ pack: gamePack, role: 'game', priority: 1, path: 'game.jsonc' }]);
    expect(registry.search('foo')[0]?.name).toBe('r.Foo');
    expect(registry.search('game help')[0]?.name).toBe('r.Foo');
  });

  it('returns defensive copies of precomputed sorted entries and names', () => {
    const registry = new SchemaRegistry();
    registry.setPacks([
      { pack: enginePack, role: 'engine', priority: 1, path: 'engine.jsonc' },
      { pack: gamePack, role: 'game', priority: 2, path: 'game.jsonc' }
    ]);

    const firstAll = registry.all();
    const firstNames = registry.names();
    firstAll.pop();
    firstNames.push('r.Mutated');

    expect(registry.all().map((entry) => entry.name)).toEqual(['r.EngineOnly', 'r.Foo']);
    expect(registry.names()).toEqual(['r.EngineOnly', 'r.Foo']);
  });

});
