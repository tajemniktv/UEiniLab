import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('VS Code feature adapters performance safety', () => {
  it('writes folder-scoped schema stack updates to folder settings', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/storage/workspaceConfig.ts'), 'utf8');

    expect(source).toContain('ConfigurationTarget.WorkspaceFolder');
    expect(source).toContain('configurationTargetForScope');
  });

  it('debounces diagnostics updates and clears pending work on close/dispose', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/features/diagnostics.ts'), 'utf8');

    expect(source).toContain('pendingUpdates');
    expect(source).toContain('setTimeout');
    expect(source).toContain('clearPendingUpdate');
    expect(source).toContain('this.collection.delete(document.uri)');
    expect(source).toContain('getConfig(document.uri)');
  });

  it('checks cancellation and avoids full-document parsing before line-only completion contexts', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/features/completion.ts'), 'utf8');

    expect(source).toContain('token.isCancellationRequested');
    expect(source).toContain('getLineCompletionContext(fullLine, position.character)');
    expect(source).toContain('getConfig(document.uri)');
    expect(source).toContain("currentContext.kind === 'value'");
    expect(source).not.toContain("line.includes('=')");
    expect(source).not.toContain('findKeyFromCurrentLine');
  });

  it('does not build unused schema registry indexes', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/core/schemaRegistry.ts'), 'utf8');

    expect(source).not.toContain('lowercaseNames');
    expect(source).not.toContain('tokenIndex');
    expect(source).not.toContain('lowerNames');
    expect(source).not.toContain('entriesForToken');
  });

  it('keeps schema file watchers out of long-lived extension disposables', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/storage/schemaStorage.ts'), 'utf8');

    expect(source).toContain('schemaWatchDisposables');
    expect(source).toContain('disposeSchemaWatchers');
    expect(source).not.toContain('this.disposables.push(watcher)');
  });

  it('debounces schema watcher reloads instead of reloading directly from each event', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/storage/schemaStorage.ts'), 'utf8');

    expect(source).toContain('scheduleReload');
    expect(source).toContain('setTimeout');
    expect(source).toContain('disposed');
    expect(source).toContain('Background schema reload failed');
    expect(source).not.toContain('watcher.onDidChange(() => void this.reload())');
    expect(source).not.toContain('watcher.onDidCreate(() => void this.reload())');
    expect(source).not.toContain('watcher.onDidDelete(() => void this.reload())');
  });

  it('gates workspace-writing commands behind Workspace Trust', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/commands/index.ts'), 'utf8');

    expect(source).toContain('requireWorkspaceTrust');
    expect(source).toContain('vscode.workspace.isTrusted');
    expect(source).toContain('workbench.trust.manage');
    expect(source).toContain("'iniTweakLab.importCvarDump'");
    expect(source).toContain("'iniTweakLab.importSchemaFile'");
    expect(source).toContain("'iniTweakLab.selectEngineVersion'");
    expect(source).toContain("'iniTweakLab.createWorkspaceSchema'");
  });

  it('routes display-oriented commands through the unified Workbench', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/commands/index.ts'), 'utf8');

    expect(source).toContain('workbench');
    expect(source).toContain("workbench.focusWorkbench('schemaStack')");
    expect(source).toContain("workbench.focusWorkbench('cvars')");
    expect(source).toContain('generateReport(storage, workbench)');
    expect(source).toContain('diffSchemaPacks(storage, workbench)');
    expect(source).toContain('explainSelectedSetting(storage, workbench)');
  });

  it('keeps schema diff as a read-only command', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/commands/index.ts'), 'utf8');

    expect(source).toContain("'iniTweakLab.diffSchemaPacks'");
    expect(source).toContain('diffSchemaPacks(storage, workbench)');
    expect(source).not.toContain("requireWorkspaceTrust('diff schema packs'");
  });

  it('does not use separate display panels for Workbench-owned views', async () => {
    for (const relativePath of [
      'src/commands/openSchemaStack.ts',
      'src/commands/searchCvars.ts',
      'src/commands/generateReport.ts',
      'src/commands/diffSchemaPacks.ts',
      'src/commands/explainSelectedSetting.ts'
    ]) {
      const source = await readFile(resolve(process.cwd(), relativePath), 'utf8');

      expect(source, relativePath).not.toContain('createWebviewPanel');
      expect(source, relativePath).not.toContain('showTextDocument');
    }
  });
});
