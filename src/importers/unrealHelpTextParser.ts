import type { CvarEntry } from '../core/schemaTypes';

export function parseUnrealHelpText(text: string): Record<string, CvarEntry> {
  const cvars: Record<string, CvarEntry> = {};
  const blocks = text.split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const first = lines[0];
    if (!first) continue;
    const name = first.match(/^([A-Za-z_][\w.:-]+)/)?.[1];
    if (!name || !name.includes('.')) continue;
    const help = lines.slice(1).join(' ');
    cvars[name] = {
      name,
      kind: 'variable',
      help: help || undefined,
      sources: [{ type: 'text-dump', label: 'Best-effort Unreal help text import' }]
    };
  }
  return cvars;
}
