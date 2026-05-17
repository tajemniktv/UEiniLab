import * as vscode from 'vscode';
import type { SchemaStorage } from '../storage/schemaStorage';
import { updateSchemaStack } from '../storage/workspaceConfig';
import { showSchemaStackPanel } from '../webview/schemaStackPanel';
import { activeScopeUri, runStorageCommandWithErrorHandling } from './commandUtils';

export async function openSchemaStack(storage: SchemaStorage): Promise<void> {
  await runStorageCommandWithErrorHandling(storage, 'Open Schema Stack', async () => {
    const choice = await vscode.window.showQuickPick(['Show schema stack', 'Select Unreal Engine version', 'Select active schema files'], {
      title: 'INI Tweak Lab Schema Stack'
    });
    if (choice === 'Select Unreal Engine version') {
      await vscode.commands.executeCommand('iniTweakLab.selectEngineVersion');
    }
    if (choice === 'Select active schema files') {
      const selected = await vscode.window.showOpenDialog({
        canSelectMany: true,
        filters: { 'Schema files': ['jsonc', 'json'], 'All files': ['*'] },
        title: 'Select active schema files in priority order'
      });
      if (selected) {
        await updateSchemaStack(
          selected.map((uri) => uri.fsPath),
          activeScopeUri()
        );
        await storage.reload(activeScopeUri());
      }
    }
    showSchemaStackPanel(storage);
  });
}
