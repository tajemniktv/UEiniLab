import { describe, expect, it } from 'vitest';
import { parseEpicCvarReferenceHtml } from '../src/importers/epicCvarReferenceHtmlParser';

describe('parseEpicCvarReferenceHtml', () => {
  it('extracts category, default value, inferred type, and help from Epic docs tables', () => {
    const pack = parseEpicCvarReferenceHtml(
      `
      <title>Unreal Engine Console Variables Reference | Unreal Engine 5.7 Documentation</title>
      <h2 id="animation">Animation</h2>
      <table>
        <thead><tr><th>Variable</th><th>Default Value</th><th>Description</th></tr></thead>
        <tbody>
          <tr>
            <td><code>a.AnimNode.AimOffsetLookAt.Enable</code></td>
            <td><code>1</code></td>
            <td>Enable/Disable LookAt AimOffset</td>
          </tr>
          <tr>
            <td><code>a.UseBaked</code></td>
            <td><code>true</code></td>
            <td>Whether to use baked data &amp; cache it.</td>
          </tr>
        </tbody>
      </table>
      `,
      { engineVersion: '5.7', id: 'ue5.7-base', displayName: 'UE 5.7 Base' }
    );

    if (!pack.target) throw new Error('Expected parsed pack target metadata.');
    expect(pack.target.engineVersion).toBe('5.7');
    expect(pack.cvars['a.AnimNode.AimOffsetLookAt.Enable']).toMatchObject({
      name: 'a.AnimNode.AimOffsetLookAt.Enable',
      kind: 'variable',
      type: 'int',
      defaultValue: '1',
      help: 'Enable/Disable LookAt AimOffset',
      category: 'Animation'
    });
    expect(pack.cvars['a.UseBaked']).toMatchObject({
      type: 'bool',
      defaultValue: 'true',
      help: 'Whether to use baked data & cache it.'
    });
  });

  it('extracts every table under the same category heading', () => {
    const pack = parseEpicCvarReferenceHtml(
      `
      <h2 id="rendering">Rendering</h2>
      <table><tbody>
        <tr><td><code>r.First</code></td><td><code>0</code></td><td>First table entry</td></tr>
      </tbody></table>
      <h3>Temporal Super Resolution</h3>
      <table><tbody>
        <tr><td><code>r.TSR.History.SampleCount</code></td><td><code>16</code></td><td>TSR history samples.</td></tr>
      </tbody></table>
      <h2 id="audio">Audio</h2>
      <table><tbody>
        <tr><td><code>au.Debug</code></td><td><code>0</code></td><td>Audio debug.</td></tr>
      </tbody></table>
      `,
      { engineVersion: '5.7', id: 'ue5.7-base', displayName: 'UE 5.7 Base' }
    );

    expect(pack.cvars['r.First']?.category).toBe('Rendering');
    expect(pack.cvars['r.TSR.History.SampleCount']).toMatchObject({
      defaultValue: '16',
      help: 'TSR history samples.',
      category: 'Rendering'
    });
    expect(pack.cvars['au.Debug']?.category).toBe('Audio');
  });
});
