import type { CvarEntry } from './schemaTypes';

export interface ValueValidationResult {
  ok: boolean;
  code?: 'type-mismatch' | 'invalid-enum';
  message?: string;
  normalized?: string;
}

export function validateCvarValue(entry: CvarEntry, rawValue: string): ValueValidationResult {
  const value = rawValue.trim();
  if (!entry.type || entry.type === 'unknown' || entry.type === 'string' || entry.type === 'command') {
    return { ok: true };
  }

  if (entry.knownValues && Object.keys(entry.knownValues).length > 0) {
    if (!Object.hasOwn(entry.knownValues, value)) {
      return {
        ok: false,
        code: 'invalid-enum',
        message: `Value "${value}" is not one of: ${Object.keys(entry.knownValues).join(', ')}.`
      };
    }
    return { ok: true };
  }

  if (entry.type === 'bool') {
    const normalized = normalizeBoolean(value);
    if (normalized === undefined) {
      return { ok: false, code: 'type-mismatch', message: `Expected a boolean value.` };
    }
    return { ok: true, normalized };
  }

  if (entry.type === 'int' && !/^[+-]?\d+$/.test(value)) {
    return { ok: false, code: 'type-mismatch', message: `Expected an integer value.` };
  }

  if (entry.type === 'float' && !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
    return { ok: false, code: 'type-mismatch', message: `Expected a floating-point value.` };
  }

  return { ok: true };
}

export function normalizeBoolean(value: string): string | undefined {
  const lower = value.trim().toLowerCase();
  if (['true', 'yes', 'on', '1'].includes(lower)) return '1';
  if (['false', 'no', 'off', '0'].includes(lower)) return '0';
  return undefined;
}
