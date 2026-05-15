import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  isBundledBaseSchemaPath,
  latestBundledBaseSchema,
  listBundledBaseSchemas
} from '../src/storage/bundledSchemas';

const tempDirs: string[] = [];

describe('bundled schema catalog', () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('lists bundled UE base schemas newest first and ignores examples', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ini-lab-schemas-'));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, 'schemas'));
    fs.writeFileSync(path.join(root, 'schemas', 'ue5.5-base.cvars.jsonc'), '{}');
    fs.writeFileSync(path.join(root, 'schemas', 'ue5.7-base.cvars.jsonc'), '{}');
    fs.writeFileSync(path.join(root, 'schemas', 'ue5.6-base.cvars.jsonc'), '{}');
    fs.writeFileSync(path.join(root, 'schemas', 'ini-tweak-lab.schema.json'), '{}');

    const schemas = listBundledBaseSchemas(root);

    expect(schemas.map((schema) => schema.engineVersion)).toEqual(['5.7', '5.6', '5.5']);
    expect(schemas[0]).toMatchObject({
      id: 'ue5.7-base',
      displayName: 'Unreal Engine 5.7 Base CVars',
      relativePath: 'schemas/ue5.7-base.cvars.jsonc'
    });
    expect(latestBundledBaseSchema(root)?.engineVersion).toBe('5.7');
  });

  it('recognizes bundled base schema paths across path styles', () => {
    expect(isBundledBaseSchemaPath('schemas/ue5.7-base.cvars.jsonc')).toBe(true);
    expect(isBundledBaseSchemaPath('schemas\\ue5.6-base.cvars.jsonc')).toBe(true);
    expect(isBundledBaseSchemaPath('D:\\x\\schemas\\ue5.5-base.cvars.jsonc')).toBe(true);
    expect(isBundledBaseSchemaPath('.ini-lab/schemas/uuu-cvarsdump.cvars.jsonc')).toBe(false);
  });
});
