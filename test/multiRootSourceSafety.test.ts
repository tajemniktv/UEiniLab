import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

async function source(path: string): Promise<string> {
  return readFile(resolve(root, path), 'utf8');
}

describe('multi-root schema routing source contracts', () => {
  it('schema storage exposes URI-scoped registries and reloads scoped schema stacks', async () => {
    const storage = await source('src/storage/schemaStorage.ts');

    expect(storage).toContain('registryFor(scope?: vscode.Uri)');
    expect(storage).toContain('reload(scope?: vscode.Uri)');
    expect(storage).toContain('scopeKey(scope)');
    expect(storage).toContain('watchSchema(schemaPath, key)');
    expect(storage).toContain('resolvePath(rawPath: string, scope?: vscode.Uri)');
    expect(storage).not.toContain('readonly registry = new SchemaRegistry()');
  });

  it('cleans removed workspace folder state and keeps single-file reload scoped to the active document', async () => {
    const storage = await source('src/storage/schemaStorage.ts');

    expect(storage).toContain('onDidChangeWorkspaceFolders');
    expect(storage).toContain('disposeScope(folder.uri)');
    expect(storage).toContain('scope = activeConfigurationScope()');
    expect(storage).toContain('if (!scope) {');
  });

  it('language providers resolve the registry from each document URI', async () => {
    const files = [
      'src/features/hover.ts',
      'src/features/completion.ts',
      'src/features/diagnostics.ts',
      'src/features/inlayHints.ts',
      'src/features/codeActions.ts'
    ];

    for (const file of files) {
      const text = await source(file);
      expect(text, file).toContain('registryFor(document.uri)');
    }
  });

  it('active-editor commands and webviews use the active scope registry', async () => {
    const files = [
      'src/commands/generateReport.ts',
      'src/commands/explainSelectedSetting.ts',
      'src/commands/searchCvars.ts',
      'src/webview/uiViewProvider.ts',
      'src/webview/cvarBrowserPanel.ts'
    ];

    for (const file of files) {
      const text = await source(file);
      expect(text, file).toContain('activeScopeUri');
      expect(text, file).toContain('registryFor(');
    }
  });

  it('schema stack panel captures its opening scope instead of recomputing focus-sensitive active scope', async () => {
    const panel = await source('src/webview/schemaStackPanel.ts');

    expect(panel).toContain('const scope = activeScopeUri();');
    expect(panel).toContain('renderHtml(storage, scope)');
    expect(panel).toContain('selectEngineVersionForScope(storage, scope, message.engineVersion)');
    expect(panel).not.toContain('function renderHtml(storage: SchemaStorage): string');
  });

  it('configuration changes reload only affected workspace folders where possible', async () => {
    const extension = await source('src/extension.ts');

    expect(extension).toContain("event.affectsConfiguration('iniTweakLab', folder.uri)");
    expect(extension).toContain('storage.reload(folder.uri)');
    expect(extension).toContain('storage.reload()');
  });
});
