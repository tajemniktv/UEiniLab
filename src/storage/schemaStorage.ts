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

interface RegistryScopeState {
  registry: SchemaRegistry;
  schemaWatchDisposables: vscode.Disposable[];
  reloadTimer?: ReturnType<typeof globalThis.setTimeout>;
  reloadQueue: Promise<void>;
}

export class SchemaStorage implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri | undefined>();
  readonly onDidChange = this.onDidChangeEmitter.event;
  private readonly scopes = new Map<string, RegistryScopeState>();
  private disposed = false;
  private readonly output: vscode.OutputChannel;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.output = vscode.window.createOutputChannel('INI Tweak Lab');
    this.disposables.push(this.output);
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders((event) => {
        for (const folder of event.removed) {
          this.disposeScope(folder.uri);
        }
      })
    );
  }

  get registry(): SchemaRegistry {
    return this.registryFor(activeConfigurationScope());
  }

  registryFor(scope?: vscode.Uri): SchemaRegistry {
    return this.stateFor(scope).registry;
  }

  async reload(scope?: vscode.Uri): Promise<void> {
    if (this.disposed) return;
    if (!scope) {
      const folders = vscode.workspace.workspaceFolders;
      if (folders?.length) {
        await Promise.all(folders.map((folder) => this.reload(folder.uri)));
        return;
      }
      scope = activeConfigurationScope();
    }
    const state = this.stateFor(scope);
    const reload = state.reloadQueue.then(() => (this.disposed ? undefined : this.doReload(scope)));
    state.reloadQueue = reload.catch(() => undefined);
    await reload;
  }

  private async doReload(scope?: vscode.Uri): Promise<void> {
    if (this.disposed) return;
    const key = scopeKey(scope);
    const state = this.stateFor(scope);
    this.disposeSchemaWatchers(key);

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
      if (this.disposed) return;
      const schemaPath = this.resolvePath(schemaStack[index], scope);
      const result = await loadSchemaFile(schemaPath);
      if (this.disposed) return;
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
      this.watchSchema(schemaPath, key);
    }

    if (this.disposed) return;
    state.registry.setPacks(loaded);
    this.onDidChangeEmitter.fire(scope);
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
    this.disposed = true;
    for (const key of [...this.scopes.keys()]) {
      this.disposeScopeByKey(key);
    }
    for (const disposable of this.disposables) disposable.dispose();
    this.onDidChangeEmitter.dispose();
  }

  private stateFor(scope?: vscode.Uri): RegistryScopeState {
    const key = scopeKey(scope);
    const existing = this.scopes.get(key);
    if (existing) return existing;
    const state: RegistryScopeState = {
      registry: new SchemaRegistry(),
      schemaWatchDisposables: [],
      reloadQueue: Promise.resolve()
    };
    this.scopes.set(key, state);
    return state;
  }

  private watchSchema(schemaPath: string, key: string): void {
    if (this.disposed) return;
    const state = this.stateForKey(key);
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(path.dirname(schemaPath), path.basename(schemaPath)));
    state.schemaWatchDisposables.push(
      watcher,
      watcher.onDidChange(() => this.scheduleReload(key)),
      watcher.onDidCreate(() => this.scheduleReload(key)),
      watcher.onDidDelete(() => this.scheduleReload(key))
    );
  }

  private scheduleReload(key: string): void {
    if (this.disposed) return;
    const state = this.stateForKey(key);
    if (state.reloadTimer) globalThis.clearTimeout(state.reloadTimer);
    state.reloadTimer = globalThis.setTimeout(() => {
      state.reloadTimer = undefined;
      void this.reload(scopeFromKey(key)).catch((error) => {
        if (!this.disposed) this.output.appendLine(`Background schema reload failed: ${String(error)}`);
      });
    }, 100);
  }

  private disposeSchemaWatchers(key: string): void {
    const state = this.scopes.get(key);
    if (!state) return;
    for (const disposable of state.schemaWatchDisposables) disposable.dispose();
    state.schemaWatchDisposables = [];
  }

  private disposeScope(scope: vscode.Uri): void {
    this.disposeScopeByKey(scopeKey(scope));
  }

  private disposeScopeByKey(key: string): void {
    const state = this.scopes.get(key);
    if (!state) return;
    if (state.reloadTimer) globalThis.clearTimeout(state.reloadTimer);
    this.disposeSchemaWatchers(key);
    this.scopes.delete(key);
  }

  private stateForKey(key: string): RegistryScopeState {
    const existing = this.scopes.get(key);
    if (existing) return existing;
    const uri = scopeFromKey(key);
    return this.stateFor(uri);
  }
}

function scopeKey(scope?: vscode.Uri): string {
  const folder = workspaceFolder(scope);
  return folder?.uri.toString() ?? scope?.toString() ?? '<workspace>';
}

function scopeFromKey(key: string): vscode.Uri | undefined {
  return key === '<workspace>' ? undefined : vscode.Uri.parse(key);
}

function inferRole(id: string, game: string | null | undefined): SchemaLayerRole {
  const lower = id.toLowerCase();
  if (lower.includes('user') || lower.includes('workspace')) return 'user';
  if (game || lower.includes('game') || lower.includes('dump')) return 'game';
  if (lower.includes('ue') || lower.includes('engine')) return 'engine';
  return 'generic';
}
