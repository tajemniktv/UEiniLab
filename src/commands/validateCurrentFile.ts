import * as vscode from 'vscode';
import type { IniDiagnostics } from '../features/diagnostics';

export async function validateCurrentFile(diagnostics: IniDiagnostics): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  diagnostics.update(editor.document);
  void vscode.window.showInformationMessage('INI Tweak Lab validation refreshed.');
}
