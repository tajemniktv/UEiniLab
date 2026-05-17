import type { IniDocument } from './iniAst';
import { analyzeIniDocument, type DiagnosticOptions } from './diagnosticEngine';
import { analyzeEffectiveIni } from './effectiveIniAnalysis';
import type { SchemaRegistry } from './schemaRegistry';

export function buildTweakReport(
  document: IniDocument,
  registry: SchemaRegistry,
  options: DiagnosticOptions
): string {
  const diagnostics = analyzeIniDocument(document, registry, options);
  const effective = analyzeEffectiveIni(document, registry, { preferredRole: 'game' });
  const known = document.keyValues.filter((node) => registry.lookup(node.key));
  const unknown = document.keyValues.filter((node) => !registry.lookup(node.key));
  const changed = known.filter((node) => {
    const entry = registry.lookup(node.key)?.entry;
    return entry && node.value !== entry.defaultValue && node.value !== entry.currentValue;
  });
  const categories = new Map<string, number>();
  for (const node of known) {
    const category = registry.lookup(node.key)?.entry.category;
    if (category) categories.set(category, (categories.get(category) ?? 0) + 1);
  }

  const lines = [
    '# INI Tweak Lab Report',
    '',
    `- Sections: ${document.sections.length}`,
    `- Key-value tweaks: ${document.keyValues.length}`,
    `- Known CVars: ${known.length}`,
    `- Unknown keys/CVars: ${unknown.length}`,
    `- Diagnostics: ${diagnostics.length}`,
    `- Values differing from default/current: ${changed.length}`,
    `- Effective settings: ${effective.entries.size}`,
    '',
    '## Diagnostic Summary'
  ];

  const grouped = groupBy(diagnostics, (diagnostic) => diagnostic.code);
  if (Object.keys(grouped).length === 0) {
    lines.push('No diagnostics.');
  } else {
    for (const [code, items] of Object.entries(grouped)) {
      lines.push(`- ${code}: ${items.length}`);
    }
  }

  lines.push('', '## Unknown Keys');
  if (unknown.length === 0) {
    lines.push('None.');
  } else {
    for (const node of unknown) {
      const suggestions = registry.fuzzy(node.key, 3).map((entry) => entry.name);
      lines.push(`- Line ${node.line + 1}: \`${node.key}\`${suggestions.length ? ` (maybe ${suggestions.join(', ')})` : ''}`);
    }
  }

  lines.push('', '## Changed Values');
  if (changed.length === 0) {
    lines.push('None.');
  } else {
    for (const node of changed) {
      const entry = registry.lookup(node.key)?.entry;
      lines.push(
        `- Line ${node.line + 1}: \`${node.key}=${node.value}\` (default: \`${entry?.defaultValue ?? 'unknown'}\`, dump: \`${entry?.currentValue ?? 'unknown'}\`)`
      );
    }
  }

  lines.push('', '## Effective Values');
  if (effective.entries.size === 0) {
    lines.push('None.');
  } else {
    for (const entry of [...effective.entries.values()].slice(0, 200)) {
      const value =
        entry.finalArrayValue !== undefined
          ? `[${entry.finalArrayValue.map((item) => `\`${item}\``).join(', ')}]`
          : `\`${entry.finalValue ?? ''}\``;
      const notes = [
        entry.duplicates.length > 0 ? `${entry.duplicates.length} overridden duplicate(s)` : undefined,
        entry.matchesDefault ? 'matches default' : undefined,
        entry.matchesCurrent ? 'matches dump/current' : undefined
      ]
        .filter(Boolean)
        .join('; ');
      const scopedKey = entry.section ? `${entry.section}/${entry.key}` : entry.key;
      lines.push(`- \`${scopedKey}\` => ${value}${notes ? ` (${notes})` : ''}`);
    }
  }

  lines.push('', '## Top Categories');
  if (categories.size === 0) {
    lines.push('None.');
  } else {
    for (const [category, count] of [...categories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      lines.push(`- ${category}: ${count}`);
    }
  }

  return lines.join('\n');
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const group = key(item);
    result[group] ??= [];
    result[group].push(item);
  }
  return result;
}
