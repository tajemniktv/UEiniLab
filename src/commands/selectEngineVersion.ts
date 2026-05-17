import * as vscode from 'vscode';
import { isBundledBaseSchemaPath } from '../storage/bundledSchemas';
import type { SchemaStorage } from '../storage/schemaStorage';
import { activeScopeUri, runStorageCommandWithErrorHandling, withSchemaProgress } from './commandUtils';
import { getSchemaStack, updateSchemaStack } from '../storage/workspaceConfig';

export async function selectEngineVersion(storage: SchemaStorage, engineVersion?: string): Promise<void> {
  await runStorageCommandWithErrorHandling(storage, 'Select Unreal Engine Version', async () => {
    const bundled = storage.bundledBaseSchemas();
    if (bundled.length === 0) {
      void vscode.window.showWarningMessage('No bundled Unreal Engine base schemas were found.');
      return;
    }

    const selected =
      engineVersion !== undefined
        ? bundled.find((schema) => schema.engineVersion === engineVersion)
        : (
            await vscode.window.showQuickPick(
              bundled.map((schema) => ({
                label: `Unreal Engine ${schema.engineVersion}`,
                description: schema.relativePath,
                detail: 'Use this bundled base CVar schema as the engine layer.',
                schema
              })),
              { title: 'Select Unreal Engine version for INI Tweak Lab' }
            )
          )?.schema;

    if (!selected) return;

    await withSchemaProgress('Selecting Unreal Engine base schema', async () => {
      const scope = activeScopeUri();
      const currentStack = getSchemaStack(scope);
      const withoutBundledBase = currentStack.filter((item) => !isBundledBasePath(item));
      await updateSchemaStack([...withoutBundledBase, selected.relativePath], scope);
      await storage.reload(scope);
      void vscode.window.showInformationMessage(
        `INI Tweak Lab is now using Unreal Engine ${selected.engineVersion} base CVars.`
      );
    });
  });
}

function isBundledBasePath(value: string): boolean {
  return isBundledBaseSchemaPath(value);
}
