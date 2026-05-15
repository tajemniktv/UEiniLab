import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { importCvarDumpText, toJsonc } from '../importers/cvarDumpImporter';
import type { SchemaStorage } from '../storage/schemaStorage';
import { updateSchemaStack, workspaceFolder } from '../storage/workspaceConfig';

export async function importCvarDump(storage: SchemaStorage): Promise<void> {
  const selected = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { 'CVar dumps': ['json', 'jsonc', 'txt', 'log', 'csv'], 'All files': ['*'] },
    title: 'Import CVar Dump'
  });
  const source = selected?.[0];
  if (!source) return;

  const text = await fs.readFile(source.fsPath, 'utf8');
  const baseName = path.basename(source.fsPath, path.extname(source.fsPath));
  const id = sanitizeId(baseName);
  const pack = importCvarDumpText(text, {
    id,
    displayName: `${baseName} CVar Dump`,
    sourcePath: source.fsPath,
    game: inferGameName(source.fsPath)
  });
  const schemaFolder = await storage.ensureWorkspaceSchemaFolder();
  const target = path.join(schemaFolder, `${id}.cvars.jsonc`);
  await fs.writeFile(target, toJsonc(pack), 'utf8');

  const folder = workspaceFolder();
  const relative = folder ? path.relative(folder.uri.fsPath, target).replace(/\\/g, '/') : target;
  const existing = vscode.workspace.getConfiguration('iniTweakLab').get<string[]>('schemaStack', []);
  await updateSchemaStack([relative, ...existing.filter((item) => item !== relative)]);
  await storage.reload();
  void vscode.window.showInformationMessage(`Imported ${Object.keys(pack.cvars).length} CVars into ${relative}.`);
}

function sanitizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-|-$/g, '') || 'imported-cvars';
}

function inferGameName(filePath: string): string | null {
  const parts = filePath.split(/[\\/]/);
  const steamIndex = parts.findIndex((part) => part.toLowerCase() === 'common');
  return steamIndex >= 0 ? parts[steamIndex + 1] ?? null : null;
}
