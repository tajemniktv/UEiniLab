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
import { activeConfigurationScope, getConfig, workspaceFolder } from './workspaceConfig';

export class SchemaStorage implements vscode.Disposable {
  readonly registry = new SchemaRegistry();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.onDidChangeEmitter.event;
  private schemaWatchDisposables: vscode.Disposable[] = [];
  private reloadTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  private reloadQueue: Promise<void> = Promise.resolve();
  private readonly output: vscode.OutputChannel;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.output = vscode.window.createOutputChannel('INI Tweak Lab');
    this.disposables.push(this.output);
  }

  async reload(): Promise<void> {
    const reload = this.reloadQueue.then(() => this.doReload());
    this.reloadQueue = reload.catch(() => undefined);
    await reload;
  }

  private async doReload(): Promise<void> {
    this.disposeSchemaWatchers();

    const scope = activeConfigurationScope();
    const config = getConfig(scope);
    const fallbackSchema =
      latestBundledBaseSchema(this.context.extensionPath)?.absolutePath ??
      path.join(this.context.extensionPath, 'schemas/examples/ue5-base.example.cvars.jsonc');
    const schemaStack =
      config.schemaStack.length > 0
        ? config.schemaStack
        : [fallbackSchema];
    const loaded: LoadedSchemaPack[] = [];

    for (let index = 0; index < schemaStack.length; index++) {
      const schemaPath = this.resolvePath(schemaStack[index], scope);
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
      this.watchSchema(schemaPath);
    }

    this.registry.setPacks(loaded);
    this.onDidChangeEmitter.fire();
  }

  async ensureWorkspaceSchemaFolder(scope?: vscode.Uri): Promise<string> {
    const folder = workspaceFolder(scope);
    if (!folder) throw new Error('Open a workspace folder first.');
    const schemaFolder = path.join(folder.uri.fsPath, '.ini-lab', 'schemas');
    await fs.mkdir(schemaFolder, { recursive: true });
    return schemaFolder;
  }

  resolvePath(rawPath: string, scope?: vscode.Uri): string {
    if (path.isAbsolute(rawPath)) return rawPath;
    if (isBundledBaseSchemaPath(rawPath)) return path.join(this.context.extensionPath, rawPath);
    const folder = workspaceFolder(scope ?? activeConfigurationScope());
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
    if (this.reloadTimer) globalThis.clearTimeout(this.reloadTimer);
    this.disposeSchemaWatchers();
    for (const disposable of this.disposables) disposable.dispose();
    this.onDidChangeEmitter.dispose();
  }

  private watchSchema(schemaPath: string): void {
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(path.dirname(schemaPath), path.basename(schemaPath)));
    this.schemaWatchDisposables.push(
      watcher,
      watcher.onDidChange(() => this.scheduleReload()),
      watcher.onDidCreate(() => this.scheduleReload()),
      watcher.onDidDelete(() => this.scheduleReload())
    );
  }

  private scheduleReload(): void {
    if (this.reloadTimer) globalThis.clearTimeout(this.reloadTimer);
    this.reloadTimer = globalThis.setTimeout(() => {
      this.reloadTimer = undefined;
      void this.reload();
    }, 100);
  }

  private disposeSchemaWatchers(): void {
    for (const disposable of this.schemaWatchDisposables) disposable.dispose();
    this.schemaWatchDisposables = [];
  }
}

function inferRole(id: string, game: string | null | undefined): SchemaLayerRole {
  const lower = id.toLowerCase();
  if (lower.includes('user') || lower.includes('workspace')) return 'user';
  if (game || lower.includes('game') || lower.includes('dump')) return 'game';
  if (lower.includes('ue') || lower.includes('engine')) return 'engine';
  return 'generic';
}
