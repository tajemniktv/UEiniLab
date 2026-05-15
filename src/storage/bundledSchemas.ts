import * as fs from 'node:fs';
import * as path from 'node:path';

export interface BundledBaseSchema {
  engineVersion: string;
  id: string;
  displayName: string;
  relativePath: string;
  absolutePath: string;
}

const bundledBaseSchemaPattern = /^ue(\d+\.\d+)-base\.cvars\.jsonc$/;

export function listBundledBaseSchemas(extensionPath: string): BundledBaseSchema[] {
  const schemaDir = path.join(extensionPath, 'schemas');
  if (!fs.existsSync(schemaDir)) return [];

  return fs
    .readdirSync(schemaDir)
    .map((fileName) => {
      const match = fileName.match(bundledBaseSchemaPattern);
      if (!match) return undefined;
      const engineVersion = match[1];
      const relativePath = `schemas/${fileName}`;
      return {
        engineVersion,
        id: `ue${engineVersion}-base`,
        displayName: `Unreal Engine ${engineVersion} Base CVars`,
        relativePath,
        absolutePath: path.join(extensionPath, relativePath)
      };
    })
    .filter((schema): schema is BundledBaseSchema => Boolean(schema))
    .sort((a, b) => compareVersionsDescending(a.engineVersion, b.engineVersion));
}

export function latestBundledBaseSchema(extensionPath: string): BundledBaseSchema | undefined {
  return listBundledBaseSchemas(extensionPath)[0];
}

export function isBundledBaseSchemaPath(value: string): boolean {
  return /(?:^|[\\/])schemas[\\/]ue\d+\.\d+-base\.cvars\.jsonc$/i.test(value);
}

function compareVersionsDescending(a: string, b: string): number {
  const [aMajor, aMinor] = a.split('.').map(Number);
  const [bMajor, bMinor] = b.split('.').map(Number);
  return bMajor - aMajor || bMinor - aMinor;
}
