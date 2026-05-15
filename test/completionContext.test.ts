import { describe, expect, it } from 'vitest';
import { getLineCompletionContext } from '../src/core/completionContext';

describe('completion context detection', () => {
  it('detects strict CVar key prefixes and keeps Unreal operators out of the replacement range', () => {
    expect(getLineCompletionContext('+r.Shadow', 9)).toMatchObject({
      kind: 'key',
      prefix: 'r.Shadow',
      insertRange: { start: 1, end: 9 },
      replaceRange: { start: 1, end: 9 }
    });
    expect(getLineCompletionContext('!SomeArray', 10)).toMatchObject({
      kind: 'key',
      prefix: 'SomeArray',
      insertRange: { start: 1, end: 10 },
      replaceRange: { start: 1, end: 10 }
    });
  });

  it('does not offer key completions in comments or section headers', () => {
    expect(getLineCompletionContext('; r.Shadow', 10)).toBeUndefined();
    expect(getLineCompletionContext('# r.Shadow', 10)).toBeUndefined();
    expect(getLineCompletionContext('[SystemSettings', 15)).toBeUndefined();
  });

  it('detects value completion context after an assignment', () => {
    expect(getLineCompletionContext('r.Shadow.MaxResolution=', 23)).toMatchObject({
      kind: 'value',
      key: 'r.Shadow.MaxResolution',
      valuePrefix: '',
      insertRange: { start: 23, end: 23 },
      replaceRange: { start: 23, end: 23 }
    });
  });
});
