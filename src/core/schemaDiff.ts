import type { CvarEntry, CvarSchemaPack } from './schemaTypes';

export type SchemaDiffField =
  | 'kind'
  | 'type'
  | 'defaultValue'
  | 'currentValue'
  | 'help'
  | 'category'
  | 'knownValues'
  | 'flags'
  | 'iniSections'
  | 'requiresRestart'
  | 'availability'
  | 'notes'
  | 'sources';

export interface SchemaFieldChange {
  field: SchemaDiffField;
  before: unknown;
  after: unknown;
}

export interface ChangedCvar {
  name: string;
  before: CvarEntry;
  after: CvarEntry;
  changes: SchemaFieldChange[];
}

export interface SchemaDiffResult {
  before: SchemaDiffPackSummary;
  after: SchemaDiffPackSummary;
  summary: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
  };
  added: CvarEntry[];
  removed: CvarEntry[];
  changed: ChangedCvar[];
}

export interface SchemaDiffPackSummary {
  id: string;
  displayName: string;
  engineVersion?: string | null;
  game?: string | null;
  cvarCount: number;
}

const comparedFields: SchemaDiffField[] = [
  'kind',
  'type',
  'defaultValue',
  'currentValue',
  'help',
  'category',
  'knownValues',
  'flags',
  'iniSections',
  'requiresRestart',
  'availability',
  'notes',
  'sources'
];

export function diffSchemaPacks(before: CvarSchemaPack, after: CvarSchemaPack): SchemaDiffResult {
  const beforeEntries = normalizedEntries(before);
  const afterEntries = normalizedEntries(after);
  const allNames = [...new Set([...beforeEntries.keys(), ...afterEntries.keys()])].sort((a, b) => a.localeCompare(b));
  const added: CvarEntry[] = [];
  const removed: CvarEntry[] = [];
  const changed: ChangedCvar[] = [];
  let unchanged = 0;

  for (const key of allNames) {
    const beforeEntry = beforeEntries.get(key);
    const afterEntry = afterEntries.get(key);
    if (!beforeEntry && afterEntry) {
      added.push(afterEntry);
      continue;
    }
    if (beforeEntry && !afterEntry) {
      removed.push(beforeEntry);
      continue;
    }
    if (!beforeEntry || !afterEntry) continue;

    const changes = changedFields(beforeEntry, afterEntry);
    if (changes.length > 0) {
      changed.push({ name: afterEntry.name, before: beforeEntry, after: afterEntry, changes });
    } else {
      unchanged++;
    }
  }

  return {
    before: summarizePack(before),
    after: summarizePack(after),
    summary: {
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged
    },
    added,
    removed,
    changed
  };
}

export function renderSchemaDiffMarkdown(diff: SchemaDiffResult): string {
  const title = `${diff.before.displayName} -> ${diff.after.displayName}`;
  const lines = [
    '# Schema Diff',
    '',
    `**${title}**`,
    '',
    `- Before: ${packLabel(diff.before)}`,
    `- After: ${packLabel(diff.after)}`,
    `- Added CVars: ${diff.summary.added}`,
    `- Removed CVars: ${diff.summary.removed}`,
    `- Changed CVars: ${diff.summary.changed}`,
    `- Unchanged CVars: ${diff.summary.unchanged}`,
    '',
    '## Added CVars'
  ];

  pushEntryList(lines, diff.added);
  lines.push('', '## Removed CVars');
  pushEntryList(lines, diff.removed);
  lines.push('', '## Changed CVars');
  if (diff.changed.length === 0) {
    lines.push('None.');
  } else {
    for (const item of diff.changed.slice(0, 250)) {
      lines.push(`- \`${item.name}\``);
      for (const change of item.changes) {
        lines.push(`  - ${change.field}: ${formatValue(change.before)} -> ${formatValue(change.after)}`);
      }
    }
    if (diff.changed.length > 250) {
      lines.push(`- ...and ${diff.changed.length - 250} more changed CVars.`);
    }
  }

  return lines.join('\n');
}

function normalizedEntries(pack: CvarSchemaPack): Map<string, CvarEntry> {
  const entries = new Map<string, CvarEntry>();
  for (const [key, entry] of Object.entries(pack.cvars)) {
    const name = (entry.name || key).trim();
    entries.set(name.toLowerCase(), { ...entry, name });
  }
  return entries;
}

function changedFields(before: CvarEntry, after: CvarEntry): SchemaFieldChange[] {
  return comparedFields
    .map((field) => {
      const beforeValue = normalizedValue(before[field]);
      const afterValue = normalizedValue(after[field]);
      return valuesEqual(beforeValue, afterValue) ? undefined : { field, before: beforeValue, after: afterValue };
    })
    .filter((change): change is SchemaFieldChange => Boolean(change));
}

function normalizedValue(value: unknown): unknown {
  if (Array.isArray(value)) return [...value].sort();
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, normalizedValue(item)])
    );
  }
  return value;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function summarizePack(pack: CvarSchemaPack): SchemaDiffPackSummary {
  return {
    id: pack.id,
    displayName: pack.displayName,
    engineVersion: pack.target?.engineVersion,
    game: pack.target?.game,
    cvarCount: Object.keys(pack.cvars).length
  };
}

function packLabel(summary: SchemaDiffPackSummary): string {
  return [
    summary.displayName,
    summary.engineVersion ? `UE ${summary.engineVersion}` : undefined,
    summary.game ?? undefined,
    `${summary.cvarCount} CVars`
  ]
    .filter(Boolean)
    .join(' | ');
}

function pushEntryList(lines: string[], entries: CvarEntry[]): void {
  if (entries.length === 0) {
    lines.push('None.');
    return;
  }
  for (const entry of entries.slice(0, 250)) {
    const details = [entry.type, entry.defaultValue !== undefined ? `default: ${entry.defaultValue}` : undefined, entry.help]
      .filter(Boolean)
      .join(' | ');
    lines.push(`- \`${entry.name}\`${details ? ` - ${details}` : ''}`);
  }
  if (entries.length > 250) {
    lines.push(`- ...and ${entries.length - 250} more CVars.`);
  }
}

function formatValue(value: unknown): string {
  if (value === undefined) return '`<missing>`';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return `\`${String(value)}\``;
  return `\`${JSON.stringify(value)}\``;
}
