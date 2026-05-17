import { clearTimeout, setTimeout } from 'node:timers';
import * as vscode from 'vscode';
import { analyzeIniDocument, type IniDiagnosticSeverity } from '../core/diagnosticEngine';
import { parseIni } from '../core/iniParser';
import type { SchemaStorage } from '../storage/schemaStorage';
import { getConfig } from '../storage/workspaceConfig';

export class IniDiagnostics implements vscode.Disposable {
  private static readonly debounceMs = 150;
  private readonly collection = vscode.languages.createDiagnosticCollection('ini-tweak-lab');
  private readonly disposables: vscode.Disposable[] = [this.collection];
  private readonly pendingUpdates = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly storage: SchemaStorage) {}

  register(context: vscode.ExtensionContext): void {
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((document) => this.update(document)),
      vscode.workspace.onDidChangeTextDocument((event) => this.update(event.document)),
      vscode.workspace.onDidCloseTextDocument((document) => {
        this.clearPendingUpdate(document.uri);
        this.collection.delete(document.uri);
      })
    );
    context.subscriptions.push(this);
    for (const document of vscode.workspace.textDocuments) this.update(document);
  }

  update(document: vscode.TextDocument): void {
    if (document.languageId !== 'ini-tweak') return;
    this.clearPendingUpdate(document.uri);
    const timer = setTimeout(() => {
      this.pendingUpdates.delete(document.uri.toString());
      this.updateNow(document);
    }, IniDiagnostics.debounceMs);
    this.pendingUpdates.set(document.uri.toString(), timer);
  }

  updateNow(document: vscode.TextDocument): void {
    this.clearPendingUpdate(document.uri);
    if (document.languageId !== 'ini-tweak') return;
    const config = getConfig(document.uri);
    if (!config.enableDiagnostics) {
      this.collection.delete(document.uri);
      return;
    }
    const parsed = parseIni(document.getText(), {
      enableInlineCommentParsing: config.enableInlineCommentParsing
    });
    const diagnostics = analyzeIniDocument(parsed, this.storage.registryFor(document.uri), config).map((diagnostic) => {
      const vscodeDiagnostic = new vscode.Diagnostic(
        rangeFromOffsets(document, diagnostic.startOffset, diagnostic.endOffset),
        diagnostic.message,
        toSeverity(diagnostic.severity)
      );
      vscodeDiagnostic.code = diagnostic.code;
      vscodeDiagnostic.source = 'INI Tweak Lab';
      return vscodeDiagnostic;
    });
    this.collection.set(document.uri, diagnostics);
  }

  dispose(): void {
    for (const timer of this.pendingUpdates.values()) clearTimeout(timer);
    this.pendingUpdates.clear();
    this.collection.clear();
    for (const disposable of this.disposables) disposable.dispose();
  }

  private clearPendingUpdate(uri: vscode.Uri): void {
    const key = uri.toString();
    const timer = this.pendingUpdates.get(key);
    if (!timer) return;
    clearTimeout(timer);
    this.pendingUpdates.delete(key);
  }
}

export function rangeFromOffsets(document: vscode.TextDocument, start: number, end: number): vscode.Range {
  return new vscode.Range(document.positionAt(start), document.positionAt(Math.max(start, end)));
}

function toSeverity(severity: IniDiagnosticSeverity): vscode.DiagnosticSeverity {
  if (severity === 'error') return vscode.DiagnosticSeverity.Error;
  if (severity === 'information') return vscode.DiagnosticSeverity.Information;
  return vscode.DiagnosticSeverity.Warning;
}
