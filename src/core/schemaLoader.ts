import { readFile } from 'node:fs/promises';
import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser';
import { CvarSchemaPackSchema, type CvarSchemaPack, type SchemaValidationResult } from './schemaTypes';

export async function loadSchemaFile(path: string): Promise<SchemaValidationResult> {
  try {
    const text = await readFile(path, 'utf8');
    return parseSchemaText(text);
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
}

export function parseSchemaText(text: string): SchemaValidationResult {
  const parseErrors: ParseError[] = [];
  const json = parse(text, parseErrors, { allowTrailingComma: true, disallowComments: false });
  if (parseErrors.length > 0) {
    return {
      ok: false,
      errors: parseErrors.map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`)
    };
  }

  const result = CvarSchemaPackSchema.safeParse(json);
  if (!result.success) {
    return { ok: false, errors: result.error.issues.map((issue) => issue.message) };
  }

  return { ok: true, pack: normalizePack(result.data), errors: [] };
}

export function normalizePack(pack: CvarSchemaPack): CvarSchemaPack {
  const cvars: CvarSchemaPack['cvars'] = {};
  for (const [name, entry] of Object.entries(pack.cvars)) {
    cvars[entry.name || name] = { ...entry, name: entry.name || name };
  }
  return { ...pack, cvars };
}
