import type { CvarEntry, CvarSchemaPack } from '../core/schemaTypes';

export interface EpicCvarReferenceOptions {
  engineVersion: string;
  id: string;
  displayName: string;
  sourcePath?: string;
}

interface HtmlBlock {
  category: string;
  tableHtml: string;
}

export function parseEpicCvarReferenceHtml(
  html: string,
  options: EpicCvarReferenceOptions
): CvarSchemaPack {
  const cvars: Record<string, CvarEntry> = {};

  for (const block of extractCategoryTables(html)) {
    for (const row of extractRows(block.tableHtml)) {
      const cells = extractCells(row);
      if (cells.length < 3) continue;
      const name = cleanCell(cells[0]);
      if (!isLikelyCvarName(name)) continue;

      const defaultValue = cleanCell(cells[1]);
      const help = cleanCell(cells.slice(2).join(' '));
      cvars[name] = {
        name,
        kind: 'variable',
        type: inferType(defaultValue),
        defaultValue: defaultValue || undefined,
        help: help || undefined,
        category: block.category,
        availability: {
          engineVersions: [options.engineVersion]
        },
        sources: [
          {
            type: 'engine-docs',
            label: `Epic Unreal Engine ${options.engineVersion} Console Variables Reference`
          }
        ]
      };
    }
  }

  return {
    schemaVersion: 1,
    id: options.id,
    displayName: options.displayName,
    target: {
      engine: 'Unreal Engine',
      engineVersion: options.engineVersion,
      game: null,
      gameBuild: null
    },
    generatedFrom: {
      source: options.sourcePath ?? 'Epic Developer Community HTML export',
      generatedAt: new Date().toISOString()
    },
    cvars
  };
}

function extractCategoryTables(html: string): HtmlBlock[] {
  const blocks: HtmlBlock[] = [];
  const headingPattern = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  const headings = [...html.matchAll(headingPattern)].map((match) => ({
    category: cleanCell(match[1]),
    index: match.index ?? 0
  }));

  for (let index = 0; index < headings.length; index++) {
    const current = headings[index];
    const next = headings[index + 1]?.index ?? html.length;
    const sectionHtml = html.slice(current.index, next);
    const tableMatches = sectionHtml.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi);
    for (const tableMatch of tableMatches) {
      blocks.push({ category: current.category, tableHtml: tableMatch[0] });
    }
  }

  return blocks;
}

function extractRows(tableHtml: string): string[] {
  return [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
}

function extractCells(rowHtml: string): string[] {
  return [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
}

function stripHtmlTagsFully(value: string): string {
  let previous: string;
  let current = value;
  do {
    previous = current;
    current = current.replace(/<[^>]+>/g, '');
  } while (current !== previous);
  return current;
}

function cleanCell(html: string): string {
  return decodeHtmlEntities(
    stripHtmlTagsFully(
      html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p\b[^>]*>/gi, '\n')
    )
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' '
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, entity: string) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named[entity.toLowerCase()] ?? `&${entity};`;
  });
}

function isLikelyCvarName(value: string): boolean {
  return /^[A-Za-z_][\w.:-]*$/.test(value) && value.includes('.');
}

function inferType(defaultValue: string): CvarEntry['type'] {
  const value = defaultValue.trim();
  if (!value || value === '[]' || value === '""') return 'unknown';
  if (/^(?:true|false)$/i.test(value)) return 'bool';
  if (/^[+-]?\d+$/.test(value)) return 'int';
  if (/^[+-]?(?:\d+\.\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return 'float';
  return 'string';
}
