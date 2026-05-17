import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { importCvarDumpText, toJsonc } from '../importers/cvarDumpImporter';
import type { SchemaStorage } from '../storage/schemaStorage';
import { activeScopeUri, pathForSchemaStack, prependSchemaStackEntry, runStorageCommandWithErrorHandling, withSchemaProgress } from './commandUtils';

export async function importCvarDump(storage: SchemaStorage): Promise<void> {
  await runStorageCommandWithErrorHandling(storage, 'Import CVar Dump', async () => {
    const selected = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { 'CVar dumps': ['json', 'jsonc', 'txt', 'log', 'csv'], 'All files': ['*'] },
      title: 'Import CVar Dump'
    });
    const source = selected?.[0];
    if (!source) return;

    await withSchemaProgress('Importing CVar dump', async () => {
      const scope = activeScopeUri();
      const text = await fs.readFile(source.fsPath, 'utf8');
      const baseName = path.basename(source.fsPath, path.extname(source.fsPath));
      const id = sanitizeId(baseName);
      const pack = importCvarDumpText(text, {
        id,
        displayName: `${baseName} CVar Dump`,
        sourcePath: source.fsPath,
        game: inferGameName(source.fsPath)
      });
      const schemaFolder = await storage.ensureWorkspaceSchemaFolder(scope);
      const target = path.join(schemaFolder, `${id}.cvars.jsonc`);
      await fs.writeFile(target, toJsonc(pack), 'utf8');

      const relative = pathForSchemaStack(target, scope);
      await prependSchemaStackEntry(relative, scope);
      await storage.reload();
      void vscode.window.showInformationMessage(`Imported ${Object.keys(pack.cvars).length} CVars into ${relative}.`);
    });
  });
}

function sanitizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-|-$/g, '') || 'imported-cvars';
}

function inferGameName(filePath: string): string | null {
  const parts = filePath.split(/[\\/]/);
  const steamIndex = parts.findIndex((part) => part.toLowerCase() === 'common');
  return steamIndex >= 0 ? parts[steamIndex + 1] ?? null : null;
}
