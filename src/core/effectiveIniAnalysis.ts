import type { IniArrayOperator, IniDocument, IniKeyValueNode } from './iniAst';
import { looksLikeUnrealCvar } from './profiles';
import type { SchemaLayerRole } from './schemaTypes';
import type { SchemaRegistry } from './schemaRegistry';

export interface EffectiveIniOptions {
  preferredRole?: SchemaLayerRole;
}

export interface EffectiveArrayOperation {
  operator: IniArrayOperator;
  value: string;
  line: number;
}

export interface EffectiveIniEntry {
  section: string | null;
  key: string;
  occurrences: IniKeyValueNode[];
  duplicates: IniKeyValueNode[];
  winningOccurrence: IniKeyValueNode;
  finalValue?: string;
  finalArrayValue?: string[];
  arrayOperations: EffectiveArrayOperation[];
  matchesDefault?: boolean;
  matchesCurrent?: boolean;
}

export interface EffectiveIniAnalysis {
  entries: Map<string, EffectiveIniEntry>;
  unknownCvarLike: IniKeyValueNode[];
  knownInLowerLayerOnly: IniKeyValueNode[];
}

export function analyzeEffectiveIni(
  document: IniDocument,
  registry?: SchemaRegistry,
  options: EffectiveIniOptions = {}
): EffectiveIniAnalysis {
  const grouped = new Map<string, IniKeyValueNode[]>();
  for (const node of document.keyValues) {
    const key = entryKey(node.section, node.key);
    const list = grouped.get(key) ?? [];
    list.push(node);
    grouped.set(key, list);
  }

  const entries = new Map<string, EffectiveIniEntry>();
  const unknownCvarLike: IniKeyValueNode[] = [];
  const knownInLowerLayerOnly: IniKeyValueNode[] = [];

  for (const [key, occurrences] of grouped) {
    const winningOccurrence = occurrences[occurrences.length - 1];
    const arrayOperations = occurrences
      .filter((node) => node.operator)
      .map((node) => ({ operator: node.operator, value: node.value, line: node.line }));
    const finalArrayValue = arrayOperations.length > 0 ? applyArrayOperations(occurrences) : undefined;
    const resolved = registry?.lookup(winningOccurrence.key);

    if (!resolved && looksLikeUnrealCvar(winningOccurrence.key)) {
      unknownCvarLike.push(...occurrences);
    }
    if (registry && options.preferredRole && registry.isKnownInLowerLayerOnly(winningOccurrence.key, options.preferredRole)) {
      knownInLowerLayerOnly.push(winningOccurrence);
    }

    entries.set(key, {
      section: winningOccurrence.section,
      key: winningOccurrence.key,
      occurrences,
      duplicates: occurrences.slice(0, -1),
      winningOccurrence,
      finalValue: finalArrayValue ? undefined : winningOccurrence.value,
      finalArrayValue,
      arrayOperations,
      matchesDefault: resolved?.entry.defaultValue === undefined ? undefined : winningOccurrence.value === resolved.entry.defaultValue,
      matchesCurrent: resolved?.entry.currentValue === undefined ? undefined : winningOccurrence.value === resolved.entry.currentValue
    });
  }

  return { entries, unknownCvarLike, knownInLowerLayerOnly };
}

function entryKey(section: string | null, key: string): string {
  return `${section ?? '<root>'}/${key}`;
}

function applyArrayOperations(occurrences: IniKeyValueNode[]): string[] {
  let values: string[] = [];
  for (const node of occurrences) {
    if (node.operator === '+') {
      values.push(node.value);
      continue;
    }
    if (node.operator === '-') {
      values = values.filter((value) => value !== node.value);
      continue;
    }
    if (node.operator === '!') {
      values = [];
      continue;
    }
    values = [node.value];
  }
  return values;
}
