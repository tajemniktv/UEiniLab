import type { CvarEntry } from '../core/schemaTypes';

const cvarLine = /^\s*([A-Za-z_][\w.:-]+)\s*(?:=|:)?\s*([^|;\r\n]*)?(?:\|\s*)?(.*)$/;

export function parseDumpConsoleCommandsText(text: string): Record<string, CvarEntry> {
  const cvars: Record<string, CvarEntry> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(cvarLine);
    if (!match?.[1]?.includes('.')) continue;
    const name = match[1].trim();
    const possibleValue = match[2]?.trim();
    const rest = match[3]?.trim() ?? '';
    const defaultMatch = rest.match(/default\s*[:=]\s*([^|]+)/i);
    const helpMatch = rest.match(/help\s*[:=]\s*(.+)$/i);
    cvars[name] = {
      name,
      kind: 'variable',
      currentValue: possibleValue || undefined,
      defaultValue: defaultMatch?.[1]?.trim(),
      help: helpMatch?.[1]?.trim() || (rest && !defaultMatch ? rest : undefined),
      sources: [{ type: 'text-dump', label: 'Best-effort DumpConsoleCommands text import' }]
    };
  }
  return cvars;
}
