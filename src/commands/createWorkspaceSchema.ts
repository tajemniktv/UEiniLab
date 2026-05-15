import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { SchemaStorage } from '../storage/schemaStorage';
import { updateSchemaStack, workspaceFolder } from '../storage/workspaceConfig';

export async function createWorkspaceSchema(storage: SchemaStorage): Promise<void> {
  const schemaFolder = await storage.ensureWorkspaceSchemaFolder();
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
  const folder = workspaceFolder();
  const relative = folder ? path.relative(folder.uri.fsPath, target).replace(/\\/g, '/') : target;
  const existing = vscode.workspace.getConfiguration('iniTweakLab').get<string[]>('schemaStack', []);
  await updateSchemaStack([relative, ...existing.filter((item) => item !== relative)]);
  await storage.reload();
  const document = await vscode.workspace.openTextDocument(target);
  await vscode.window.showTextDocument(document);
}
