import type { IniDocument } from './iniAst';
import type { SchemaRegistry } from './schemaRegistry';

export interface CompletionCandidate {
  label: string;
  detail?: string;
  documentation?: string;
  insertText?: string;
  filterText?: string;
  sortText?: string;
  kind: 'key' | 'section' | 'value' | 'snippet';
}

export type CompletionMatchMode = 'strictPrefix' | 'smart' | 'fuzzy';
export type CompletionMatchKind = 'exact-prefix' | 'namespace-token' | 'contains-token' | 'fuzzy-fallback';

export interface KeyCompletionOptions {
  matchMode?: CompletionMatchMode;
  fuzzyFallback?: boolean;
}

export function getKeyCompletions(
  registry: SchemaRegistry,
  prefix: string,
  limit: number,
  options: KeyCompletionOptions = {}
): CompletionCandidate[] {
  const normalizedPrefix = prefix.trim().toLowerCase();
  const matchMode = options.matchMode ?? 'smart';
  const all = matchMode === 'strictPrefix' ? entriesForStrictPrefix(registry, normalizedPrefix) : registry.all();
  const ranked = normalizedPrefix
    ? all
        .map((resolved) => {
          const match = matchCvarForCompletion(resolved.name, normalizedPrefix, matchMode);
          return match ? { resolved, match } : undefined;
        })
        .filter((candidate): candidate is { resolved: (typeof all)[number]; match: CvarCompletionMatch } =>
          Boolean(candidate)
        )
        .sort(
          (a, b) =>
            b.match.score - a.match.score ||
            a.resolved.name.length - b.resolved.name.length ||
            a.resolved.name.localeCompare(b.resolved.name)
        )
    : all.map((resolved) => ({
        resolved,
        match: { kind: 'exact-prefix' as const, score: 1000 }
      }));
  const finalRanked =
    normalizedPrefix && ranked.length === 0 && (options.fuzzyFallback || matchMode === 'fuzzy')
      ? registry.fuzzy(prefix, limit).map((resolved) => ({
          resolved,
          match: { kind: 'fuzzy-fallback' as const, score: 100 }
        }))
      : ranked;

  const seen = new Set<string>();
  return finalRanked
    .filter(({ resolved }) => {
      const key = resolved.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map(({ resolved, match }, index) => ({
      label: resolved.name,
      insertText: resolved.name,
      filterText: resolved.name,
      sortText: makeCvarSortText(resolved.name, match, index),
      detail: [
        detailForMatch(match.kind),
        resolved.entry.type,
        resolved.entry.defaultValue ? `default ${resolved.entry.defaultValue}` : undefined
      ]
        .filter(Boolean)
        .join(' | '),
      documentation: resolved.entry.help,
      kind: 'key' as const
    }));
}

function entriesForStrictPrefix(registry: SchemaRegistry, normalizedPrefix: string) {
  if (!/[._\-\s]/.test(normalizedPrefix)) return registry.all();
  const namespace = normalizedPrefix.split(/[._\-\s]+/, 1)[0];
  return namespace ? registry.entriesForNamespace(namespace) : registry.all();
}

interface CvarCompletionMatch {
  kind: CompletionMatchKind;
  score: number;
}

export function matchCvarForCompletion(
  cvarName: string,
  rawQuery: string,
  matchMode: CompletionMatchMode = 'smart'
): CvarCompletionMatch | undefined {
  const name = cvarName.toLowerCase();
  const query = rawQuery.trim().toLowerCase();

  if (!query || name.startsWith(query)) {
    return { kind: 'exact-prefix', score: 1000 };
  }

  if (matchMode === 'strictPrefix') {
    return undefined;
  }

  const queryParts = tokenizeForCompletion(query);
  const nameParts = tokenizeForCompletion(name);
  const queryNamespace = queryParts[0];
  const candidateNamespace = nameParts[0];

  if (queryNamespace && candidateNamespace === queryNamespace && queryParts.length > 1) {
    const terms = queryParts.slice(1);
    if (allTermsPresent(terms, nameParts)) {
      return { kind: 'namespace-token', score: 700 };
    }
  }

  if (allTermsPresent(queryParts, nameParts)) {
    return { kind: 'contains-token', score: 500 };
  }

  return undefined;
}

function tokenizeForCompletion(value: string): string[] {
  return value.split(/[._\-\s]+/).filter(Boolean);
}

function allTermsPresent(terms: string[], nameParts: string[]): boolean {
  return terms.length > 0 && terms.every((term) => term.length >= 5 && nameParts.some((part) => part.includes(term)));
}

function detailForMatch(kind: CompletionMatchKind): string {
  if (kind === 'namespace-token') return 'CVar - token match';
  if (kind === 'contains-token') return 'CVar - contains match';
  if (kind === 'fuzzy-fallback') return 'CVar - fuzzy suggestion';
  return 'CVar';
}

function makeCvarSortText(name: string, match: CvarCompletionMatch, index: number): string {
  const bucket =
    match.kind === 'exact-prefix'
      ? '0'
      : match.kind === 'namespace-token'
        ? '1'
        : match.kind === 'contains-token'
          ? '2'
          : '9';
  return `${bucket}_${String(index).padStart(5, '0')}_${String(name.length).padStart(5, '0')}_${name.toLowerCase()}`;
}

export function getValueCompletions(
  key: string,
  registry: SchemaRegistry
): CompletionCandidate[] {
  const entry = registry.lookup(key)?.entry;
  if (!entry) return [];
  if (entry.knownValues) {
    return Object.entries(entry.knownValues).map(([value, label]) => ({
      label: value,
      insertText: value,
      detail: label,
      kind: 'value' as const
    }));
  }
  if (entry.type === 'bool') {
    return [
      { label: '0', insertText: '0', detail: 'false / disabled', kind: 'value' },
      { label: '1', insertText: '1', detail: 'true / enabled', kind: 'value' }
    ];
  }
  return [];
}

export function getSectionCompletions(sections: string[]): CompletionCandidate[] {
  return sections.map((section) => ({
    label: section,
    insertText: `[${section}]`,
    detail: 'INI section',
    kind: 'section'
  }));
}

export function findKeyAtLine(document: IniDocument, line: number): string | undefined {
  return document.keyValues.find((node) => node.line === line)?.key;
}
