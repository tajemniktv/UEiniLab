import type { CvarEntry } from '../core/schemaTypes';

export function parseFallbackLines(text: string): Record<string, CvarEntry> {
  const cvars: Record<string, CvarEntry> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/\b([A-Za-z_][\w.:-]+\.[\w.:-]+)\b(?:\s*[=:]\s*([^\s#;]+))?/);
    if (!match) continue;
    cvars[match[1]] = {
      name: match[1],
      currentValue: match[2],
      sources: [{ type: 'text-dump', label: 'Fallback line import' }]
    };
  }
  return cvars;
}
