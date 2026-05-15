import { parse } from 'jsonc-parser';
import type { CvarEntry, CvarSchemaPack } from '../core/schemaTypes';

export function parseJsonCvarDump(text: string): Record<string, CvarEntry> {
  let data: unknown;
  try {
    data = parse(text, [], { allowTrailingComma: true, disallowComments: false });
  } catch {
    return {};
  }

  if (!data || typeof data !== 'object') return {};
  if (isSchemaPack(data)) return data.cvars;

  if (Array.isArray(data)) {
    return Object.fromEntries(data.map(normalizeArrayItem).filter(Boolean) as [string, CvarEntry][]);
  }

  const result: Record<string, CvarEntry> = {};
  for (const [name, value] of Object.entries(data as Record<string, unknown>)) {
    if (!looksLikeName(name)) continue;
    result[name] = normalizeObjectEntry(name, value);
  }
  return result;
}

function isSchemaPack(value: unknown): value is CvarSchemaPack {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { schemaVersion?: unknown }).schemaVersion === 1 &&
      typeof (value as { cvars?: unknown }).cvars === 'object'
  );
}

function normalizeArrayItem(value: unknown): [string, CvarEntry] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const name = stringField(record, ['name', 'cvar', 'command']);
  if (!name || !looksLikeName(name)) return undefined;
  return [name, normalizeObjectEntry(name, record)];
}

function normalizeObjectEntry(name: string, value: unknown): CvarEntry {
  if (!value || typeof value !== 'object') {
    return { name, currentValue: value === undefined ? undefined : String(value) };
  }

  const record = value as Record<string, unknown>;
  const typeName = stringField(record, ['type', 'Type', 'valueType', 'ValueType']);
  const normalizedType = normalizeType(typeName);
  return {
    name,
    kind: normalizeKind(stringField(record, ['kind', 'Kind', 'typeName']), normalizedType),
    type: normalizedType,
    defaultValue: stringField(record, ['defaultValue', 'default', 'DefaultValue']),
    currentValue: stringField(record, ['currentValue', 'value', 'Value', 'current']),
    help: stringField(record, ['help', 'Help', 'HelpText', 'Helptext', 'helpText', 'description', 'Description', 'desc']),
    category: stringField(record, ['category', 'group']),
    flags: arrayStringField(record, ['flags', 'Flags']),
    sources: [{ type: 'game-dump', label: 'Imported JSON/UUU dump' }]
  };
}

function looksLikeName(name: string): boolean {
  return /^[A-Za-z_][\w.:-]+$/.test(name) && name.includes('.');
}

function stringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return String(value);
  }
  return undefined;
}

function arrayStringField(record: Record<string, unknown>, keys: string[]): string[] | undefined {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') return value.split(/[|,]/).map((item) => item.trim()).filter(Boolean);
  }
  return undefined;
}

function normalizeKind(value: string | undefined, normalizedType?: CvarEntry['type']): CvarEntry['kind'] {
  if (normalizedType === 'command') return 'command';
  const lower = value?.toLowerCase();
  if (lower === 'command' || lower === 'exec' || lower === 'variable') return lower;
  return 'variable';
}

function normalizeType(value: string | undefined): CvarEntry['type'] {
  const lower = value?.toLowerCase().replace(/\s+/g, '');
  if (!lower) return undefined;
  if (['bool', 'boolean'].includes(lower)) return 'bool';
  if (['int', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64', 'integer'].includes(lower)) {
    return 'int';
  }
  if (['float', 'double', 'number', 'float32', 'float64'].includes(lower)) return 'float';
  if (['str', 'string', 'fstring', 'name', 'fname'].includes(lower)) return 'string';
  if (['enum'].includes(lower)) return 'enum';
  if (['command', 'cmd', 'exec'].includes(lower)) return 'command';
  return undefined;
}
