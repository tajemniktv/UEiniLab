import { describe, expect, it } from 'vitest';
import { fuzzyFind } from '../src/core/fuzzySearch';

describe('fuzzyFind', () => {
  it('ranks close Unreal CVar typos ahead of unrelated keys', () => {
    const results = fuzzyFind('r.DynamicGlobalIluminationMethod', [
      'r.DynamicGlobalIlluminationMethod',
      'r.ReflectionMethod',
      'sg.TextureQuality'
    ]);
    expect(results[0]?.item).toBe('r.DynamicGlobalIlluminationMethod');
  });
});
