import type { IniKeyValueNode } from './iniAst';
import { looksLikeUnrealCvar } from './profiles';
import type { SchemaRegistry } from './schemaRegistry';

export interface HoverOptions {
  showSourceProvenance: boolean;
}

export function buildHoverMarkdown(
  node: IniKeyValueNode,
  registry: SchemaRegistry,
  options: HoverOptions
): string {
  const resolved = registry.lookup(node.key);
  if (!resolved) {
    const suggestions = registry.fuzzy(node.key, 5).map((entry) => entry.name);
    return [
      `### Unknown CVar: \`${node.key}\``,
      '',
      looksLikeUnrealCvar(node.key)
        ? 'This looks like an Unreal/game CVar, but it is not present in the active schema stack.'
        : 'This key is not present in the active schema stack.',
      suggestions.length > 0 ? `Possible matches: ${suggestions.map((item) => `\`${item}\``).join(', ')}` : ''
    ]
      .filter(Boolean)
      .join('\n');
  }

  const entry = resolved.entry;
  const lines = [`### \`${entry.name}\``, ''];
  const meta = [
    entry.type ? `type: \`${entry.type}\`` : undefined,
    entry.kind ? `kind: \`${entry.kind}\`` : undefined,
    entry.defaultValue !== undefined ? `default: \`${entry.defaultValue}\`` : undefined,
    entry.currentValue !== undefined ? `dump/current: \`${entry.currentValue}\`` : undefined,
    `user value: \`${node.value}\``
  ].filter(Boolean);
  lines.push(meta.join(' | '), '');
  if (entry.category) lines.push(`**Category:** ${entry.category}`, '');
  if (entry.help) lines.push(entry.help, '');
  const setBy = setByLabels(entry.flags ?? []);
  if (setBy.length > 0) lines.push(`**Set by:** ${setBy.map((flag) => `\`${flag}\``).join(', ')}`, '');
  if (entry.flags?.length) lines.push(`**Flags:** ${entry.flags.map((flag) => `\`${flag}\``).join(', ')}`, '');
  if (entry.knownValues && Object.keys(entry.knownValues).length > 0) {
    lines.push('**Known values:**');
    for (const [value, label] of Object.entries(entry.knownValues)) {
      lines.push(`- \`${value}\`: ${label}`);
    }
    lines.push('');
  }
  if (entry.iniSections?.length) {
    lines.push(`**Suggested sections:** ${entry.iniSections.map((section) => `\`${section}\``).join(', ')}`, '');
  }
  if (entry.notes?.length) {
    lines.push('**Notes:**');
    for (const note of entry.notes) lines.push(`- ${note}`);
    lines.push('');
  }
  if (options.showSourceProvenance) {
    lines.push('**Provenance:**');
    for (const source of resolved.sources) {
      lines.push(`- ${source.role}: ${source.packId}${source.path ? ` (${source.path})` : ''}`);
    }
  }
  return lines.join('\n').trim();
}

function setByLabels(flags: string[]): string[] {
  return flags
    .map((flag) => flag.match(/^SetBy(.+)$/)?.[1])
    .filter((flag): flag is string => Boolean(flag))
    .map((flag) => flag.replace(/([a-z])([A-Z])/g, '$1 $2'));
}
