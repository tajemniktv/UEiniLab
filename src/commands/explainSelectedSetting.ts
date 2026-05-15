import * as vscode from 'vscode';
import { buildHoverMarkdown } from '../core/hoverText';
import { parseIni } from '../core/iniParser';
import type { SchemaStorage } from '../storage/schemaStorage';
import { getConfig } from '../storage/workspaceConfig';

export async function explainSelectedSetting(storage: SchemaStorage): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const offset = editor.document.offsetAt(editor.selection.active);
  const parsed = parseIni(editor.document.getText(), {
    enableInlineCommentParsing: getConfig().enableInlineCommentParsing
  });
  const node = parsed.keyValues.find((candidate) => offset >= candidate.startOffset && offset <= candidate.endOffset);
  if (!node) {
    void vscode.window.showInformationMessage('Place the cursor on an INI key first.');
    return;
  }
  const content = buildHoverMarkdown(node, storage.registry, {
    showSourceProvenance: getConfig().showHoverSourceProvenance
  });
  const document = await vscode.workspace.openTextDocument({ language: 'markdown', content });
  await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
}
