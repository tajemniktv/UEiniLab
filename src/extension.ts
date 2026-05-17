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

const LAST_ACTIVATED_VERSION_KEY = 'iniTweakLab.lastActivatedVersion';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const storage = new SchemaStorage(context);
  const workbench = new IniTweakLabViewProvider(storage);
  const runtimeSummary = describeRuntimeContribution(context);
  storage.outputChannel().appendLine(runtimeSummary);
  console.info(runtimeSummary);
  void promptForReloadAfterVersionChange(context, storage.outputChannel()).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    storage.outputChannel().appendLine(`Version-change reload prompt failed: ${message}`);
  });
  context.subscriptions.push(storage);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(IniTweakLabViewProvider.viewType, workbench, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  const diagnostics = new IniDiagnostics(storage);
  diagnostics.register(context);

  registerHoverProvider(context, storage);
  registerCompletionProvider(context, storage);
  registerInlayHintsProvider(context, storage);
  registerCodeActionsProvider(context, storage);
  registerDocumentSymbolsProvider(context);
  registerCommands(context, storage, diagnostics, workbench);

  context.subscriptions.push(
    storage.onDidChange((scope) => {
      for (const document of vscode.workspace.textDocuments) {
        if (!scope || vscode.workspace.getWorkspaceFolder(document.uri)?.uri.toString() === scope.toString()) {
          diagnostics.update(document);
        }
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      const folders = vscode.workspace.workspaceFolders;
      if (folders?.length) {
        for (const folder of folders) {
          if (event.affectsConfiguration('iniTweakLab', folder.uri)) void storage.reload(folder.uri);
        }
        return;
      }
      if (event.affectsConfiguration('iniTweakLab')) void storage.reload();
    })
  );

  await storage.reload().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    storage.outputChannel().appendLine(`Initial schema reload failed: ${message}`);
    void vscode.window.showErrorMessage(`INI Tweak Lab failed to load schemas: ${message}`);
    workbench.setWorkbenchResult({
      kind: 'error',
      title: 'Schema reload failed',
      markdown: message
    });
  });
}

export function deactivate(): void {}

async function promptForReloadAfterVersionChange(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const manifest = context.extension.packageJSON as ExtensionManifest;
  const currentVersion = manifest.version;
  if (!currentVersion) return;

  const previousVersion = context.globalState.get<string>(LAST_ACTIVATED_VERSION_KEY);
  await context.globalState.update(LAST_ACTIVATED_VERSION_KEY, currentVersion);
  if (!previousVersion || previousVersion === currentVersion) return;

  outputChannel.appendLine(`Extension version changed from ${previousVersion} to ${currentVersion}; offering window reload.`);
  const reload = 'Reload Window';
  const selected = await vscode.window.showInformationMessage(
    `INI Tweak Lab updated from ${previousVersion} to ${currentVersion}. Reload the window so VS Code refreshes extension UI contributions.`,
    reload
  );
  if (selected === reload) {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}

function describeRuntimeContribution(context: vscode.ExtensionContext): string {
  const manifest = context.extension.packageJSON as ExtensionManifest;
  const view = manifest.contributes?.views?.iniTweakLab?.find((item) => item.id === IniTweakLabViewProvider.viewType);
  return [
    `INI Tweak Lab ${manifest.version ?? '<unknown version>'} activated from ${context.extensionPath}`,
    `Workbench contribution: ${JSON.stringify(view ?? null)}`
  ].join('\n');
}

interface ExtensionManifest {
  version?: string;
  contributes?: {
    views?: {
      iniTweakLab?: Array<{
        id?: string;
        name?: string;
        type?: string;
        icon?: string;
      }>;
    };
  };
}
