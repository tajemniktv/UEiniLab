import * as vscode from 'vscode';
import { buildHoverMarkdown } from '../core/hoverText';
import { parseIni } from '../core/iniParser';
import type { SchemaStorage } from '../storage/schemaStorage';
import { getConfig } from '../storage/workspaceConfig';
import type { WorkbenchController } from '../webview/uiViewProvider';
import { activeScopeUri } from './commandUtils';

export async function explainSelectedSetting(storage: SchemaStorage, workbench: WorkbenchController): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    workbench.setWorkbenchResult({
      kind: 'error',
      title: 'No active editor',
      markdown: 'Open an INI file before explaining a setting.'
    });
    await workbench.focusWorkbench('actions');
    return;
  }
  const offset = editor.document.offsetAt(editor.selection.active);
  const config = getConfig(editor.document.uri);
  const parsed = parseIni(editor.document.getText(), {
    enableInlineCommentParsing: config.enableInlineCommentParsing
  });
  const node = parsed.keyValues.find((candidate) => offset >= candidate.startOffset && offset <= candidate.endOffset);
  if (!node) {
    workbench.setWorkbenchResult({
      kind: 'error',
      title: 'No INI key selected',
      markdown: 'Place the cursor on an INI key first.'
    });
    await workbench.focusWorkbench('actions');
    return;
  }
  const content = buildHoverMarkdown(node, storage.registryFor(activeScopeUri() ?? editor.document.uri), {
    showSourceProvenance: config.showHoverSourceProvenance
  });
  workbench.setWorkbenchResult({ kind: 'explain', title: node.key, markdown: content });
  await workbench.focusWorkbench('explain');
}
