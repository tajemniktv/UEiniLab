const assert = require('node:assert/strict');
const path = require('node:path');
const vscode = require('vscode');

suite('INI Tweak Lab extension host smoke tests', () => {
  test('activates the extension', async () => {
    const extension = vscode.extensions.getExtension('TajemnikTV.tajs-ue-ini-lab');

    assert.ok(extension, 'extension should be discoverable by publisher/name');
    await extension.activate();
    assert.equal(extension.isActive, true);
  });

  test('contributes expected commands', async () => {
    const commands = await vscode.commands.getCommands(true);

    for (const command of [
      'iniTweakLab.importCvarDump',
      'iniTweakLab.importSchemaFile',
      'iniTweakLab.openSchemaStack',
      'iniTweakLab.selectEngineVersion',
      'iniTweakLab.createWorkspaceSchema',
      'iniTweakLab.searchActiveCVars'
    ]) {
      assert.ok(commands.includes(command), `${command} should be registered`);
    }
  });

  test('associates known Unreal filenames with ini-tweak', async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, 'fixture workspace should be open');

    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(folder.uri.fsPath, 'Engine.ini')));

    assert.equal(document.languageId, 'ini-tweak');
  });

  test('reports diagnostics for an unknown CVar-looking key', async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, 'fixture workspace should be open');
    const uri = vscode.Uri.file(path.join(folder.uri.fsPath, 'Unknown.ini'));
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.languages.setTextDocumentLanguage(document, 'ini-tweak');
    await vscode.window.showTextDocument(document);

    const diagnostics = await waitForDiagnostics(uri);

    assert.ok(
      diagnostics.some((diagnostic) => diagnostic.code === 'unknown-cvar'),
      'expected an unknown-cvar diagnostic'
    );
  });

  test('returns a known CVar completion from the fixture schema', async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, 'fixture workspace should be open');
    const uri = vscode.Uri.file(path.join(folder.uri.fsPath, 'Completion.engineini'));
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);

    const completions = await vscode.commands.executeCommand(
      'vscode.executeCompletionItemProvider',
      uri,
      new vscode.Position(1, 7)
    );

    assert.ok(
      completions.items.some((item) => item.label === 'r.IntegrationKnown'),
      'expected fixture schema CVar in completion results'
    );
  });
});

async function waitForDiagnostics(uri) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    if (diagnostics.length > 0) return diagnostics;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return vscode.languages.getDiagnostics(uri);
}
