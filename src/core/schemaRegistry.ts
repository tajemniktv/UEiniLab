import type { LoadedSchemaPack, SchemaLayerRole } from './schemaTypes';
import type { ResolvedCvarEntry } from './schemaMerge';
import { mergeCvarEntries, type LayeredCvarEntry } from './schemaMerge';
import { fuzzyFind } from './fuzzySearch';

export class SchemaRegistry {
  private packs: LoadedSchemaPack[] = [];
  private resolved = new Map<string, ResolvedCvarEntry>();
  private sourceIndex = new Map<string, LayeredCvarEntry[]>();

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
    return [...this.resolved.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  names(): string[] {
    return this.all().map((entry) => entry.name);
  }

  fuzzy(name: string, limit = 5): ResolvedCvarEntry[] {
    return fuzzyFind(name, this.names(), limit)
      .map((result) => this.lookup(result.item))
      .filter((entry): entry is ResolvedCvarEntry => Boolean(entry));
  }

  search(query: string, limit = 100): ResolvedCvarEntry[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return this.all().slice(0, limit);
    }
    return this.all()
      .filter((resolved) => {
        const entry = resolved.entry;
        return (
          entry.name.toLowerCase().includes(normalized) ||
          entry.help?.toLowerCase().includes(normalized) ||
          entry.category?.toLowerCase().includes(normalized)
        );
      })
      .slice(0, limit);
  }

  isKnownInLowerLayerOnly(name: string, preferredRole: SchemaLayerRole): boolean {
    const layers = this.sourceIndex.get(name.toLowerCase()) ?? [];
    return layers.length > 0 && !layers.some((layer) => layer.role === preferredRole);
  }

  private rebuild(): void {
    this.resolved.clear();
    this.sourceIndex.clear();
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
  }
}
