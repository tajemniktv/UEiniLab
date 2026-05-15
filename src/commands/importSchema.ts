import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { SchemaStorage } from '../storage/schemaStorage';
import { updateSchemaStack, workspaceFolder } from '../storage/workspaceConfig';

export async function importSchemaFile(storage: SchemaStorage): Promise<void> {
  const selected = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { 'INI Tweak Lab schema': ['jsonc', 'json'], 'All files': ['*'] },
    title: 'Import Schema File'
  });
  const source = selected?.[0];
  if (!source) return;

  const schemaFolder = await storage.ensureWorkspaceSchemaFolder();
  const target = path.join(schemaFolder, path.basename(source.fsPath));
  await fs.copyFile(source.fsPath, target);
  const folder = workspaceFolder();
  const relative = folder ? path.relative(folder.uri.fsPath, target).replace(/\\/g, '/') : target;
  const existing = vscode.workspace.getConfiguration('iniTweakLab').get<string[]>('schemaStack', []);
  await updateSchemaStack([relative, ...existing.filter((item) => item !== relative)]);
  await storage.reload();
  void vscode.window.showInformationMessage(`Imported schema ${relative}.`);
}
