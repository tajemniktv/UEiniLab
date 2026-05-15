import { describe, expect, it } from 'vitest';
import { parseIni } from '../src/core/iniParser';

describe('parseIni', () => {
  it('parses Unreal sections, root keys, comments, and array mutation syntax', () => {
    const doc = parseIni(
      [
        '; root comment',
        'r.RootKey=1',
        '',
        '[/Script/Engine.RendererSettings]',
        '+r.DynamicGlobalIlluminationMethod=1 ; inline',
        '-SomeArray=/Game/Old',
        '!ClearMe=ClearArray',
        'bad line without equals'
      ].join('\n')
    );

    expect(doc.nodes.map((node) => node.kind)).toEqual([
      'comment',
      'keyValue',
      'blank',
      'section',
      'keyValue',
      'keyValue',
      'keyValue',
      'invalid'
    ]);
    expect(doc.keyValues[0]).toMatchObject({ key: 'r.RootKey', value: '1', section: null });
    expect(doc.keyValues[1]).toMatchObject({
      operator: '+',
      key: 'r.DynamicGlobalIlluminationMethod',
      value: '1',
      section: '/Script/Engine.RendererSettings',
      inlineComment: 'inline'
    });
    expect(doc.keyValues[2].operator).toBe('-');
    expect(doc.keyValues[3].operator).toBe('!');
    expect(doc.invalid).toHaveLength(1);
  });

  it('keeps duplicate keys in the same section as separate nodes', () => {
    const doc = parseIni('[SystemSettings]\nr.Foo=0\nr.Foo=1\n[Other]\nr.Foo=2');
    expect(doc.keyValues.filter((node) => node.key === 'r.Foo')).toHaveLength(3);
    expect(doc.keyValues.map((node) => node.section)).toEqual([
      'SystemSettings',
      'SystemSettings',
      'Other'
    ]);
  });
});
