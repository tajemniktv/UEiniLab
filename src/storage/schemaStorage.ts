import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { loadSchemaFile } from '../core/schemaLoader';
import { SchemaRegistry } from '../core/schemaRegistry';
import type { LoadedSchemaPack, SchemaLayerRole } from '../core/schemaTypes';
import {
  isBundledBaseSchemaPath,
  latestBundledBaseSchema,
  listBundledBaseSchemas,
  type BundledBaseSchema
} from './bundledSchemas';
import { getConfig, workspaceFolder } from './workspaceConfig';

export class SchemaStorage implements vscode.Disposable {
  readonly registry = new SchemaRegistry();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.onDidChangeEmitter.event;
  private watchers: vscode.FileSystemWatcher[] = [];
  private readonly output: vscode.OutputChannel;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.output = vscode.window.createOutputChannel('INI Tweak Lab');
    this.disposables.push(this.output);
  }

  async reload(): Promise<void> {
    for (const watcher of this.watchers) watcher.dispose();
    this.watchers = [];

    const config = getConfig();
    const fallbackSchema =
      latestBundledBaseSchema(this.context.extensionPath)?.absolutePath ??
      path.join(this.context.extensionPath, 'schemas/examples/ue5-base.example.cvars.jsonc');
    const schemaStack =
      config.schemaStack.length > 0
        ? config.schemaStack
        : [fallbackSchema];
    const loaded: LoadedSchemaPack[] = [];

    for (let index = 0; index < schemaStack.length; index++) {
      const schemaPath = this.resolvePath(schemaStack[index]);
      const result = await loadSchemaFile(schemaPath);
      if (!result.ok || !result.pack) {
        this.output.appendLine(`Schema load failed: ${schemaPath}`);
        for (const error of result.errors) this.output.appendLine(`  ${error}`);
        continue;
      }
      loaded.push({
        pack: result.pack,
        path: schemaPath,
        role: inferRole(result.pack.id, result.pack.target?.game),
        priority: schemaStack.length - index
      });
      this.watchers.push(this.watchSchema(schemaPath));
    }

    this.registry.setPacks(loaded);
    this.onDidChangeEmitter.fire();
  }

  async ensureWorkspaceSchemaFolder(): Promise<string> {
    const folder = workspaceFolder();
    if (!folder) throw new Error('Open a workspace folder first.');
    const schemaFolder = path.join(folder.uri.fsPath, '.ini-lab', 'schemas');
    await fs.mkdir(schemaFolder, { recursive: true });
    return schemaFolder;
  }

  resolvePath(rawPath: string): string {
    if (path.isAbsolute(rawPath)) return rawPath;
    if (isBundledBaseSchemaPath(rawPath)) return path.join(this.context.extensionPath, rawPath);
    const folder = workspaceFolder();
    if (folder) return path.join(folder.uri.fsPath, rawPath);
    return path.join(this.context.extensionPath, rawPath);
  }

  outputChannel(): vscode.OutputChannel {
    return this.output;
  }

  bundledBaseSchemas(): BundledBaseSchema[] {
    return listBundledBaseSchemas(this.context.extensionPath);
  }

  dispose(): void {
    for (const disposable of this.disposables) disposable.dispose();
    for (const watcher of this.watchers) watcher.dispose();
    this.onDidChangeEmitter.dispose();
  }

  private watchSchema(schemaPath: string): vscode.FileSystemWatcher {
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(path.dirname(schemaPath), path.basename(schemaPath)));
    watcher.onDidChange(() => void this.reload(), undefined, this.disposables);
    watcher.onDidCreate(() => void this.reload(), undefined, this.disposables);
    watcher.onDidDelete(() => void this.reload(), undefined, this.disposables);
    this.disposables.push(watcher);
    return watcher;
  }
}

function inferRole(id: string, game: string | null | undefined): SchemaLayerRole {
  const lower = id.toLowerCase();
  if (lower.includes('user') || lower.includes('workspace')) return 'user';
  if (game || lower.includes('game') || lower.includes('dump')) return 'game';
  if (lower.includes('ue') || lower.includes('engine')) return 'engine';
  return 'generic';
}
