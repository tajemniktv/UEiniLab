import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { registerCodeActionsProvider } from './features/codeActions';
import { registerCompletionProvider } from './features/completion';
import { IniDiagnostics } from './features/diagnostics';
import { registerDocumentSymbolsProvider } from './features/documentSymbols';
import { registerHoverProvider } from './features/hover';
import { registerInlayHintsProvider } from './features/inlayHints';
import { SchemaStorage } from './storage/schemaStorage';
import { IniTweakLabViewProvider } from './webview/uiViewProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const storage = new SchemaStorage(context);
  context.subscriptions.push(storage);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(IniTweakLabViewProvider.viewType, new IniTweakLabViewProvider(storage))
  );

  const diagnostics = new IniDiagnostics(storage.registry);
  diagnostics.register(context);

  registerHoverProvider(context, storage.registry);
  registerCompletionProvider(context, storage.registry);
  registerInlayHintsProvider(context, storage.registry);
  registerCodeActionsProvider(context, storage.registry);
  registerDocumentSymbolsProvider(context);
  registerCommands(context, storage, diagnostics);

  context.subscriptions.push(
    storage.onDidChange(() => {
      for (const document of vscode.workspace.textDocuments) diagnostics.update(document);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('iniTweakLab')) void storage.reload();
    })
  );

  await storage.reload();
}

export function deactivate(): void {}
