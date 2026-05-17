import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { SchemaStorage } from '../storage/schemaStorage';
import { activeScopeUri, pathForSchemaStack, prependSchemaStackEntry, runStorageCommandWithErrorHandling, withSchemaProgress } from './commandUtils';

export async function importSchemaFile(storage: SchemaStorage): Promise<void> {
  await runStorageCommandWithErrorHandling(storage, 'Import Schema File', async () => {
    const selected = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { 'INI Tweak Lab schema': ['jsonc', 'json'], 'All files': ['*'] },
      title: 'Import Schema File'
    });
    const source = selected?.[0];
    if (!source) return;

    await withSchemaProgress('Importing schema file', async () => {
      const scope = activeScopeUri();
      const schemaFolder = await storage.ensureWorkspaceSchemaFolder(scope);
      const target = path.join(schemaFolder, path.basename(source.fsPath));
      await fs.copyFile(source.fsPath, target);
      const relative = pathForSchemaStack(target, scope);
      await prependSchemaStackEntry(relative, scope);
      await storage.reload();
      void vscode.window.showInformationMessage(`Imported schema ${relative}.`);
    });
  });
}
