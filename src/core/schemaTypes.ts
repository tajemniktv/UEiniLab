import { z } from 'zod';

export type SchemaLayerRole = 'user' | 'game' | 'engine' | 'generic' | 'unknown';

export const CvarSourceSchema = z
  .object({
    type: z.string().optional(),
    label: z.string().optional(),
    url: z.string().optional()
  })
  .passthrough();

export const CvarEntrySchema = z
  .object({
    name: z.string(),
    kind: z.enum(['variable', 'command', 'exec', 'unknown']).optional(),
    type: z.enum(['bool', 'int', 'float', 'string', 'enum', 'command', 'unknown']).optional(),
    defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional().transform(stringifyOptional),
    currentValue: z.union([z.string(), z.number(), z.boolean()]).optional().transform(stringifyOptional),
    help: z.string().optional(),
    category: z.string().optional(),
    flags: z.array(z.string()).optional(),
    knownValues: z.record(z.string()).optional(),
    iniSections: z.array(z.string()).optional(),
    requiresRestart: z.union([z.boolean(), z.literal('unknown')]).optional(),
    availability: z.record(z.unknown()).optional(),
    notes: z.array(z.string()).optional(),
    sources: z.array(CvarSourceSchema).optional()
  })
  .passthrough();

export const CvarSchemaPackSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string(),
    displayName: z.string(),
    target: z
      .object({
        engine: z.string().nullable().optional(),
        engineVersion: z.string().nullable().optional(),
        game: z.string().nullable().optional(),
        gameBuild: z.string().nullable().optional()
      })
      .passthrough()
      .optional()
      .default({}),
    generatedFrom: z.record(z.unknown()).optional(),
    cvars: z.record(CvarEntrySchema)
  })
  .passthrough();

export type CvarSource = z.infer<typeof CvarSourceSchema>;
export type CvarEntry = z.infer<typeof CvarEntrySchema>;
export type CvarSchemaPack = z.infer<typeof CvarSchemaPackSchema>;

export interface LoadedSchemaPack {
  pack: CvarSchemaPack;
  path: string;
  role: SchemaLayerRole;
  priority: number;
}

export interface SchemaValidationResult {
  ok: boolean;
  pack?: CvarSchemaPack;
  errors: string[];
}

function stringifyOptional(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return String(value);
}
