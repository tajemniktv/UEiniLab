import type { CvarEntry, SchemaLayerRole } from './schemaTypes';

export interface LayeredCvarEntry {
  packId: string;
  role: SchemaLayerRole;
  priority: number;
  path?: string;
  entry: CvarEntry;
}

export interface ResolvedCvarEntry {
  name: string;
  entry: CvarEntry;
  sources: LayeredCvarEntry[];
  primaryRole: SchemaLayerRole;
}

const scalarFields: (keyof CvarEntry)[] = [
  'kind',
  'type',
  'defaultValue',
  'currentValue',
  'help',
  'category',
  'requiresRestart'
];

export function mergeCvarEntries(entries: LayeredCvarEntry[]): ResolvedCvarEntry {
  if (entries.length === 0) {
    throw new Error('Cannot merge an empty CVar entry list.');
  }

  const sorted = [...entries].sort((a, b) => b.priority - a.priority);
  const merged: CvarEntry = { name: sorted[0].entry.name };

  for (const field of scalarFields) {
    const provider = sorted.find((source) => source.entry[field] !== undefined && source.entry[field] !== null);
    if (provider) {
      (merged as Record<string, unknown>)[field] = provider.entry[field];
    }
  }

  const flags = uniqueFlat(sorted.flatMap((source) => source.entry.flags ?? []));
  const iniSections = uniqueFlat(sorted.flatMap((source) => source.entry.iniSections ?? []));
  const notes = uniqueFlat(sorted.flatMap((source) => source.entry.notes ?? []));
  const sources = sorted.flatMap((source) => source.entry.sources ?? []);
  const knownValues = Object.assign({}, ...[...sorted].reverse().map((source) => source.entry.knownValues ?? {}));

  if (flags.length > 0) merged.flags = flags;
  if (iniSections.length > 0) merged.iniSections = iniSections;
  if (notes.length > 0) merged.notes = notes;
  if (sources.length > 0) merged.sources = sources;
  if (Object.keys(knownValues).length > 0) merged.knownValues = knownValues;

  const availability = Object.assign(
    {},
    ...[...sorted].reverse().map((source) => source.entry.availability ?? {})
  );
  if (Object.keys(availability).length > 0) {
    merged.availability = availability;
  }

  return {
    name: merged.name,
    entry: merged,
    sources: sorted,
    primaryRole: sorted[0].role
  };
}

function uniqueFlat(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
