import * as vscode from 'vscode';
import { isBundledBaseSchemaPath } from '../storage/bundledSchemas';
import type { SchemaStorage } from '../storage/schemaStorage';
import { updateSchemaStack } from '../storage/workspaceConfig';

export async function selectEngineVersion(storage: SchemaStorage, engineVersion?: string): Promise<void> {
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

  const currentStack = vscode.workspace.getConfiguration('iniTweakLab').get<string[]>('schemaStack', []);
  const withoutBundledBase = currentStack.filter((item) => !isBundledBasePath(item));
  await updateSchemaStack([...withoutBundledBase, selected.relativePath]);
  await storage.reload();
  void vscode.window.showInformationMessage(`INI Tweak Lab is now using Unreal Engine ${selected.engineVersion} base CVars.`);
}

function isBundledBasePath(value: string): boolean {
  return isBundledBaseSchemaPath(value);
}
