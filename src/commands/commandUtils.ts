import * as path from 'node:path';
import * as vscode from 'vscode';
import type { SchemaStorage } from '../storage/schemaStorage';
import { activeConfigurationScope, getSchemaStack, updateSchemaStack, workspaceFolder } from '../storage/workspaceConfig';

export async function runStorageCommandWithErrorHandling<T>(
  storage: SchemaStorage,
  title: string,
  operation: () => Promise<T>
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    logCommandError(storage, title, error);
    void vscode.window.showErrorMessage(`${title} failed. See the INI Tweak Lab output channel for details.`);
    return undefined;
  }
}

export async function withSchemaProgress<T>(title: string, task: () => Promise<T>): Promise<T> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: false
    },
    task
  );
}

export function activeScopeUri(): vscode.Uri | undefined {
  return activeConfigurationScope();
}

export function pathForSchemaStack(filePath: string, scope?: vscode.Uri): string {
  const folder = workspaceFolder(scope);
  return folder ? path.relative(folder.uri.fsPath, filePath).replace(/\\/g, '/') : filePath;
}

export async function prependSchemaStackEntry(entry: string, scope?: vscode.Uri): Promise<void> {
  const existing = getSchemaStack(scope);
  await updateSchemaStack([entry, ...existing.filter((item) => item !== entry)], scope);
}

export function logCommandError(storage: SchemaStorage, title: string, error: unknown): void {
  const channel = storage.outputChannel();
  channel.appendLine(`[${new Date().toISOString()}] ${title} failed`);
  if (error instanceof Error) {
    channel.appendLine(error.stack ?? error.message);
    return;
  }
  channel.appendLine(String(error));
}
