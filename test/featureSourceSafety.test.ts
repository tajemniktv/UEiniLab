import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = fileURLToPath(new URL('.', import.meta.url));

describe('VS Code feature adapters performance safety', () => {
  it('writes folder-scoped schema stack updates to folder settings', async () => {
    const source = await readFile(resolve(here, '../src/storage/workspaceConfig.ts'), 'utf8');

    expect(source).toContain('ConfigurationTarget.WorkspaceFolder');
    expect(source).toContain('configurationTargetForScope');
  });

  it('debounces diagnostics updates and clears pending work on close/dispose', async () => {
    const source = await readFile(resolve(here, '../src/features/diagnostics.ts'), 'utf8');

    expect(source).toContain('pendingUpdates');
    expect(source).toContain('setTimeout');
    expect(source).toContain('clearPendingUpdate');
    expect(source).toContain('this.collection.delete(document.uri)');
    expect(source).toContain('getConfig(document.uri)');
  });

  it('checks cancellation and avoids full-document parsing before line-only completion contexts', async () => {
    const source = await readFile(resolve(here, '../src/features/completion.ts'), 'utf8');

    expect(source).toContain('token.isCancellationRequested');
    expect(source).toContain('getLineCompletionContext(fullLine, position.character)');
    expect(source).toContain('getConfig(document.uri)');
    expect(source).toContain("currentContext.kind === 'value'");
    expect(source).not.toContain("line.includes('=')");
    expect(source).not.toContain('findKeyFromCurrentLine');
  });

  it('keeps schema file watchers out of long-lived extension disposables', async () => {
    const source = await readFile(resolve(here, '../src/storage/schemaStorage.ts'), 'utf8');

    expect(source).toContain('schemaWatchDisposables');
    expect(source).toContain('disposeSchemaWatchers');
    expect(source).not.toContain('this.disposables.push(watcher)');
  });

  it('debounces schema watcher reloads instead of reloading directly from each event', async () => {
    const source = await readFile(resolve(here, '../src/storage/schemaStorage.ts'), 'utf8');

    expect(source).toContain('scheduleReload');
    expect(source).toContain('setTimeout');
    expect(source).not.toContain('watcher.onDidChange(() => void this.reload())');
    expect(source).not.toContain('watcher.onDidCreate(() => void this.reload())');
    expect(source).not.toContain('watcher.onDidDelete(() => void this.reload())');
  });

  it('gates workspace-writing commands behind Workspace Trust', async () => {
    const source = await readFile(resolve(here, '../src/commands/index.ts'), 'utf8');

    expect(source).toContain('requireWorkspaceTrust');
    expect(source).toContain('vscode.workspace.isTrusted');
    expect(source).toContain('workbench.trust.manage');
    expect(source).toContain("'iniTweakLab.importCvarDump'");
    expect(source).toContain("'iniTweakLab.importSchemaFile'");
    expect(source).toContain("'iniTweakLab.createWorkspaceSchema'");
  });
});
