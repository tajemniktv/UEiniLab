import { describe, expect, it } from 'vitest';
import { importCvarDumpText } from '../src/importers/cvarDumpImporter';

describe('importCvarDumpText', () => {
  it('normalizes existing schema JSONC', () => {
    const pack = importCvarDumpText(
      '{ "schemaVersion": 1, "id": "x", "displayName": "X", "target": {}, "cvars": { "r.Foo": { "name": "r.Foo" } } }',
      { id: 'fallback', displayName: 'Fallback' }
    );
    expect(pack.id).toBe('x');
    expect(pack.cvars['r.Foo']?.name).toBe('r.Foo');
  });

  it('normalizes UUU-style JSON object dumps', () => {
    const pack = importCvarDumpText(
      JSON.stringify({
        'r.DynamicGlobalIlluminationMethod': {
          value: '1',
          default: '1',
          help: 'Selects GI',
          flags: ['RenderThreadSafe']
        }
      }),
      { id: 'subnautica2', displayName: 'Subnautica 2 UUU Dump' }
    );

    expect(pack.cvars['r.DynamicGlobalIlluminationMethod']).toMatchObject({
      currentValue: '1',
      defaultValue: '1',
      help: 'Selects GI'
    });
  });

  it('preserves UUU Helptext and normalizes Unreal dump type names', () => {
    const pack = importCvarDumpText(
      JSON.stringify({
        'AbilitySystem.Ability.Activate': {
          Flags: ['SetByConstructor'],
          Helptext: 'Activate a Gameplay Ability.',
          type: 'Command'
        },
        'AbilitySystem.AbilityTask.Debug.SourceRecordingEnabled': {
          Helptext: 'Set to 0 to disable, 1 to enable.',
          type: 'Boolean',
          value: true
        },
        'AMF.KeyframeInterval': {
          Helptext: 'Every N frames an IDR frame is sent.',
          type: 'Int32',
          value: 300
        }
      }),
      { id: 'uuu', displayName: 'UUU Dump' }
    );

    expect(pack.cvars['AbilitySystem.Ability.Activate']).toMatchObject({
      kind: 'command',
      type: 'command',
      help: 'Activate a Gameplay Ability.'
    });
    expect(pack.cvars['AbilitySystem.AbilityTask.Debug.SourceRecordingEnabled']).toMatchObject({
      type: 'bool',
      currentValue: 'true',
      help: 'Set to 0 to disable, 1 to enable.'
    });
    expect(pack.cvars['AMF.KeyframeInterval']).toMatchObject({
      type: 'int',
      currentValue: '300',
      help: 'Every N frames an IDR frame is sent.'
    });
  });

  it('best-effort parses line based DumpConsoleCommands text', () => {
    const pack = importCvarDumpText(
      'r.ReflectionMethod = 1 | default: 1 | help: Selects reflection method',
      { id: 'text', displayName: 'Text Dump' }
    );
    expect(pack.cvars['r.ReflectionMethod']?.help).toContain('Selects reflection');
  });
});
