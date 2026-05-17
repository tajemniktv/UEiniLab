import * as vscode from 'vscode';
import { parseIni } from '../core/iniParser';
import { buildTweakReport } from '../core/reportBuilder';
import type { SchemaStorage } from '../storage/schemaStorage';
import { getConfig } from '../storage/workspaceConfig';
import type { WorkbenchController } from '../webview/uiViewProvider';
import { activeScopeUri } from './commandUtils';

export async function generateReport(storage: SchemaStorage, workbench: WorkbenchController): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    workbench.setWorkbenchResult({
      kind: 'error',
      title: 'No active editor',
      markdown: 'Open an INI file before generating a report.'
    });
    await workbench.focusWorkbench('actions');
    return;
  }
  const scope = activeScopeUri() ?? editor.document.uri;
  const config = getConfig(editor.document.uri);
  const parsed = parseIni(editor.document.getText(), {
    enableInlineCommentParsing: config.enableInlineCommentParsing
  });
  const report = buildTweakReport(parsed, storage.registryFor(scope), config);
  workbench.setWorkbenchResult({ kind: 'report', title: 'Current INI report', markdown: report });
  await workbench.focusWorkbench('report');
}
