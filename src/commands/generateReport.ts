import * as vscode from 'vscode';
import { buildTweakReport } from '../core/reportBuilder';
import { parseIni } from '../core/iniParser';
import type { SchemaStorage } from '../storage/schemaStorage';
import { getConfig } from '../storage/workspaceConfig';
import { activeScopeUri } from './commandUtils';

export async function generateReport(storage: SchemaStorage): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const scope = activeScopeUri() ?? editor.document.uri;
  const config = getConfig(editor.document.uri);
  const parsed = parseIni(editor.document.getText(), {
    enableInlineCommentParsing: config.enableInlineCommentParsing
  });
  const report = buildTweakReport(parsed, storage.registryFor(scope), config);
  const document = await vscode.workspace.openTextDocument({ language: 'markdown', content: report });
  await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
}
