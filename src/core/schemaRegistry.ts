import type { LoadedSchemaPack, SchemaLayerRole } from './schemaTypes';
import type { ResolvedCvarEntry } from './schemaMerge';
import { mergeCvarEntries, type LayeredCvarEntry } from './schemaMerge';
import { fuzzyFind } from './fuzzySearch';

export class SchemaRegistry {
  private packs: LoadedSchemaPack[] = [];
  private resolved = new Map<string, ResolvedCvarEntry>();
  private sourceIndex = new Map<string, LayeredCvarEntry[]>();
  private sortedEntries: ResolvedCvarEntry[] = [];
  private sortedNames: string[] = [];
  private namespaceBuckets = new Map<string, ResolvedCvarEntry[]>();
  private searchEntries: Array<{ text: string; entry: ResolvedCvarEntry }> = [];

  setPacks(packs: LoadedSchemaPack[]): void {
    this.packs = [...packs].sort((a, b) => a.priority - b.priority);
    this.rebuild();
  }

  getPacks(): LoadedSchemaPack[] {
    return [...this.packs];
  }

  lookup(name: string): ResolvedCvarEntry | undefined {
    return this.resolved.get(name.toLowerCase());
  }

  all(): ResolvedCvarEntry[] {
    return [...this.sortedEntries];
  }

  names(): string[] {
    return [...this.sortedNames];
  }

  entriesForNamespace(namespace: string): ResolvedCvarEntry[] {
    return [...(this.namespaceBuckets.get(namespace.toLowerCase()) ?? [])];
  }

  entriesForCanonicalPrefix(prefix: string): ResolvedCvarEntry[] {
    const normalizedPrefix = prefix.trim().toLowerCase();
    if (!normalizedPrefix) return this.all();
    const namespace = /[._\-\s]/.test(normalizedPrefix)
      ? normalizedPrefix.split(/[._\-\s]+/, 1)[0]
      : undefined;
    const candidates = namespace ? this.entriesForNamespace(namespace) : this.sortedEntries;
    return candidates.filter((entry) => entry.name.toLowerCase().startsWith(normalizedPrefix));
  }

  fuzzy(name: string, limit = 5): ResolvedCvarEntry[] {
    return fuzzyFind(name, this.names(), limit)
      .map((result) => this.lookup(result.item))
      .filter((entry): entry is ResolvedCvarEntry => Boolean(entry));
  }

  search(query: string, limit = 100): ResolvedCvarEntry[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return this.sortedEntries.slice(0, limit);
    }
    const terms = normalized.split(/\s+/).filter(Boolean);
    return this.searchEntries
      .filter((indexed) => terms.every((term) => indexed.text.includes(term)))
      .map((indexed) => indexed.entry)
      .slice(0, limit);
  }

  isKnownInLowerLayerOnly(name: string, preferredRole: SchemaLayerRole): boolean {
    const layers = this.sourceIndex.get(name.toLowerCase()) ?? [];
    return layers.length > 0 && !layers.some((layer) => layer.role === preferredRole);
  }

  debugIndexStats(): { sortedEntries: number; sortedNames: number; namespaceBuckets: number; searchEntries: number } {
    return {
      sortedEntries: this.sortedEntries.length,
      sortedNames: this.sortedNames.length,
      namespaceBuckets: this.namespaceBuckets.size,
      searchEntries: this.searchEntries.length
    };
  }

  private rebuild(): void {
    this.resolved.clear();
    this.sourceIndex.clear();
    this.sortedEntries = [];
    this.sortedNames = [];
    this.namespaceBuckets.clear();
    this.searchEntries = [];
    for (const loaded of this.packs) {
      for (const [name, entry] of Object.entries(loaded.pack.cvars)) {
        const normalizedName = (entry.name || name).trim();
        const key = normalizedName.toLowerCase();
        const layer: LayeredCvarEntry = {
          packId: loaded.pack.id,
          role: loaded.role,
          priority: loaded.priority,
          path: loaded.path,
          entry: { ...entry, name: normalizedName }
        };
        const existing = this.sourceIndex.get(key) ?? [];
        existing.push(layer);
        this.sourceIndex.set(key, existing);
      }
    }

    for (const [key, layers] of this.sourceIndex) {
      this.resolved.set(key, mergeCvarEntries(layers));
    }

    this.sortedEntries = [...this.resolved.values()].sort((a, b) => a.name.localeCompare(b.name));
    this.sortedNames = this.sortedEntries.map((entry) => entry.name);

    for (const entry of this.sortedEntries) {
      const namespace = entry.name.split(/[._\-\s]+/, 1)[0]?.toLowerCase();
      if (namespace) {
        const bucket = this.namespaceBuckets.get(namespace) ?? [];
        bucket.push(entry);
        this.namespaceBuckets.set(namespace, bucket);
      }
      this.searchEntries.push({ entry, text: searchTextFor(entry) });
    }
  }
}

function searchTextFor(resolved: ResolvedCvarEntry): string {
  return [
    resolved.name,
    resolved.entry.help,
    resolved.entry.category,
    resolved.entry.type,
    resolved.entry.defaultValue,
    resolved.entry.currentValue,
    ...(resolved.entry.flags ?? [])
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase();
}
