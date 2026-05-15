import { describe, expect, it } from 'vitest';
import { getKeyCompletions, getValueCompletions } from '../src/core/completionEngine';
import { buildHoverMarkdown } from '../src/core/hoverText';
import { parseIni } from '../src/core/iniParser';
import { SchemaRegistry } from '../src/core/schemaRegistry';

function registryWithExample(): SchemaRegistry {
  const registry = new SchemaRegistry();
  registry.setPacks([
    {
      role: 'engine',
      priority: 1,
      path: 'example.jsonc',
      pack: {
        schemaVersion: 1,
        id: 'example',
        displayName: 'Example',
        target: { engine: 'Unreal Engine' },
        cvars: {
          'fx.Niagara.MeshRenderer.CalcMeshUsedParticleCount': {
            name: 'fx.Niagara.MeshRenderer.CalcMeshUsedParticleCount',
            type: 'bool',
            help: 'Niagara mesh renderer debug setting.'
          },
          'r.Shadow.Virtual.Enable': {
            name: 'r.Shadow.Virtual.Enable',
            type: 'bool',
            help: 'Enables virtual shadow maps.'
          },
          'r.Shadow.CSM.MaxCascades': {
            name: 'r.Shadow.CSM.MaxCascades',
            type: 'int',
            help: 'Controls shadow cascade count.'
          },
          'r.Shadow.RectLightDepthBias': {
            name: 'r.Shadow.RectLightDepthBias',
            type: 'float',
            help: 'Depth bias for rect light shadows.'
          },
          'r.ShaderCompiler.DumpWorkerDiagnostics': {
            name: 'r.ShaderCompiler.DumpWorkerDiagnostics',
            type: 'bool',
            help: 'Dumps shader compiler worker diagnostics.'
          },
          'r.Lumen.Reflections.DownsampleFactor': {
            name: 'r.Lumen.Reflections.DownsampleFactor',
            type: 'int',
            help: 'Lumen reflection downsample factor.'
          },
          'r.Scene.LumenSomething': {
            name: 'r.Scene.LumenSomething',
            type: 'int',
            help: 'Example non-prefix Lumen rendering CVar.'
          },
          'sg.LumenQuality': {
            name: 'sg.LumenQuality',
            type: 'int',
            help: 'Example Lumen scalability CVar.'
          },
          'r.AllowLandscapeShadows': {
            name: 'r.AllowLandscapeShadows',
            type: 'bool',
            help: 'Allows landscape shadows.'
          },
          'r.AllowPointLightCubemapShadows': {
            name: 'r.AllowPointLightCubemapShadows',
            type: 'bool',
            help: 'Allows point light cubemap shadows.'
          },
          'r.DynamicGlobalIlluminationMethod': {
            name: 'r.DynamicGlobalIlluminationMethod',
            type: 'int',
            defaultValue: '1',
            currentValue: '0',
            help: 'Selects the dynamic global illumination method.',
            flags: ['SetByScalability', 'RenderThreadSafe'],
            knownValues: { '0': 'Disabled', '1': 'Lumen' }
          },
          'sg.TextureQuality': {
            name: 'sg.TextureQuality',
            type: 'int',
            help: 'Texture scalability quality.'
          }
        }
      }
    }
  ]);
  return registry;
}

describe('hover and completion helpers', () => {
  it('renders known CVar hover markdown with value and provenance details', () => {
    const registry = registryWithExample();
    const node = parseIni('r.DynamicGlobalIlluminationMethod=1').keyValues[0];
    const markdown = buildHoverMarkdown(node, registry, { showSourceProvenance: true });
    expect(markdown).toContain('r.DynamicGlobalIlluminationMethod');
    expect(markdown).toContain('dump/current: `0`');
    expect(markdown).toContain('Selects the dynamic global illumination method.');
    expect(markdown).toContain('**Set by:** `Scalability`');
    expect(markdown).toContain('engine: example');
  });

  it('returns key and enum value completions from the registry', () => {
    const registry = registryWithExample();
    expect(getKeyCompletions(registry, 'r.Dynamic', 10)[0]?.label).toBe('r.DynamicGlobalIlluminationMethod');
    expect(getValueCompletions('r.DynamicGlobalIlluminationMethod', registry).map((item) => item.label)).toEqual(['0', '1']);
  });

  it('prioritizes current key prefix matches over broad help/category matches', () => {
    const registry = registryWithExample();
    const labels = getKeyCompletions(registry, 'r.shad', 10).map((item) => item.label);

    expect(labels.every((label) => label.toLowerCase().startsWith('r.shad'))).toBe(true);
    expect(labels).not.toContain('fx.Niagara.MeshRenderer.CalcMeshUsedParticleCount');
  });

  it('keeps exact CVar family completions above shader and contains-only shadow matches', () => {
    const registry = registryWithExample();
    const completions = getKeyCompletions(registry, 'r.Shadow', 10);
    const labels = completions.map((item) => item.label);

    expect(labels.slice(0, 3).sort()).toEqual([
      'r.Shadow.CSM.MaxCascades',
      'r.Shadow.RectLightDepthBias',
      'r.Shadow.Virtual.Enable'
    ]);
    const shaderIndex = labels.indexOf('r.ShaderCompiler.DumpWorkerDiagnostics');
    const containsOnlyShadowIndex = labels.indexOf('r.AllowLandscapeShadows');
    expect(shaderIndex === -1 || shaderIndex > 1).toBe(true);
    expect(containsOnlyShadowIndex === -1 || containsOnlyShadowIndex > 1).toBe(true);
    expect(completions[0]?.sortText).toMatch(/^0_/);
  });

  it('strictly filters CVar key completions by canonical prefix', () => {
    const registry = registryWithExample();
    const shaderLabels = getKeyCompletions(registry, 'r.Shader', 10).map((item) => item.label);
    const rLabels = getKeyCompletions(registry, 'r.', 10).map((item) => item.label);

    expect(shaderLabels).toContain('r.ShaderCompiler.DumpWorkerDiagnostics');
    expect(shaderLabels).not.toContain('r.Shadow.Virtual.Enable');
    expect(shaderLabels).not.toContain('r.Shadow.CSM.MaxCascades');
    expect(rLabels).toContain('r.ShaderCompiler.DumpWorkerDiagnostics');
    expect(rLabels).toContain('r.Shadow.Virtual.Enable');
  });

  it('keeps CVar namespace prefixes isolated', () => {
    const registry = registryWithExample();
    const labels = getKeyCompletions(registry, 'sg.', 10, { matchMode: 'strictPrefix' }).map((item) => item.label);

    expect(labels.sort()).toEqual(['sg.LumenQuality', 'sg.TextureQuality']);
  });

  it('supports smart token discovery without typo-style shader/shadow bleed', () => {
    const registry = registryWithExample();
    const shaderLabels = getKeyCompletions(registry, 'r.Shader', 10, { matchMode: 'smart' }).map((item) => item.label);
    const lumenLabels = getKeyCompletions(registry, 'r.Lumen', 10, { matchMode: 'smart' }).map((item) => item.label);
    const bareLumenLabels = getKeyCompletions(registry, 'lumen', 10, { matchMode: 'smart' }).map((item) => item.label);

    expect(shaderLabels).toContain('r.ShaderCompiler.DumpWorkerDiagnostics');
    expect(shaderLabels).not.toContain('r.Shadow.RectLightDepthBias');
    expect(lumenLabels.indexOf('r.Lumen.Reflections.DownsampleFactor')).toBeLessThan(
      lumenLabels.indexOf('r.Scene.LumenSomething')
    );
    expect(lumenLabels).toContain('r.Scene.LumenSomething');
    expect(bareLumenLabels).toContain('r.Lumen.Reflections.DownsampleFactor');
    expect(bareLumenLabels).toContain('sg.LumenQuality');
    expect(getKeyCompletions(registry, 'shader', 10, { matchMode: 'smart' }).map((item) => item.label)).not.toContain(
      'r.Shadow.RectLightDepthBias'
    );
  });
});
