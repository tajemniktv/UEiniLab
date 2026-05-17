import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { SchemaStorage } from '../storage/schemaStorage';
import { activeScopeUri, pathForSchemaStack, prependSchemaStackEntry, runStorageCommandWithErrorHandling, withSchemaProgress } from './commandUtils';

export async function createWorkspaceSchema(storage: SchemaStorage): Promise<void> {
  await runStorageCommandWithErrorHandling(storage, 'Create Workspace Schema', async () => {
    await withSchemaProgress('Creating workspace schema', async () => {
      const scope = activeScopeUri();
      const schemaFolder = await storage.ensureWorkspaceSchemaFolder(scope);
      const target = path.join(schemaFolder, 'workspace-overrides.cvars.jsonc');
      try {
        await fs.access(target);
      } catch {
        await fs.writeFile(
          target,
          [
            '// Workspace/user overrides have highest priority when placed first in iniTweakLab.schemaStack.',
            '{',
            '  "schemaVersion": 1,',
            '  "id": "workspace-overrides",',
            '  "displayName": "Workspace CVar Overrides",',
            '  "target": { "engine": "Unreal Engine", "game": null, "gameBuild": null },',
            '  "cvars": {}',
            '}'
          ].join('\n'),
          'utf8'
        );
      }
      const relative = pathForSchemaStack(target, scope);
      await prependSchemaStackEntry(relative, scope);
      await storage.reload(scope);
      const document = await vscode.workspace.openTextDocument(target);
      await vscode.window.showTextDocument(document);
    });
  });
}
