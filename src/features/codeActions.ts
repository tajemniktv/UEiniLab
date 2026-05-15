import * as vscode from 'vscode';
import { parseIni } from '../core/iniParser';
import type { SchemaRegistry } from '../core/schemaRegistry';
import { normalizeBoolean } from '../core/valueInference';

export function registerCodeActionsProvider(context: vscode.ExtensionContext, registry: SchemaRegistry): void {
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      'ini-tweak',
      {
        provideCodeActions(document, range, codeActionContext) {
          const actions: vscode.CodeAction[] = [];
          const parsed = parseIni(document.getText());
          const offset = document.offsetAt(range.start);
          const node = parsed.keyValues.find((candidate) => offset >= candidate.startOffset && offset <= candidate.endOffset);

          for (const diagnostic of codeActionContext.diagnostics) {
            if (diagnostic.code === 'unknown-cvar' && node) {
              for (const suggestion of registry.fuzzy(node.key, 3)) {
                const action = new vscode.CodeAction(`Replace with ${suggestion.name}`, vscode.CodeActionKind.QuickFix);
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(document.uri, new vscode.Range(document.positionAt(node.keyRange.start), document.positionAt(node.keyRange.end)), suggestion.name);
                actions.push(action);
              }
            }
          }

          if (node) {
            const entry = registry.lookup(node.key)?.entry;
            if (entry?.defaultValue !== undefined) {
              actions.push(replaceValueAction('Insert known default value', document, node.valueRange.start, node.valueRange.end, entry.defaultValue));
            }
            if (entry?.currentValue !== undefined) {
              actions.push(replaceValueAction('Insert dumped current value', document, node.valueRange.start, node.valueRange.end, entry.currentValue));
            }
            const normalized = normalizeBoolean(node.value);
            if (normalized !== undefined && normalized !== node.value) {
              actions.push(replaceValueAction('Normalize boolean value', document, node.valueRange.start, node.valueRange.end, normalized));
            }
            actions.push(commentLineAction('Comment out selected tweak', document, node.line));
            actions.push(helpCommentAction(document, node.line, node.key, entry?.help));
          }

          return actions;
        }
      },
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.RefactorRewrite] }
    )
  );
}

function replaceValueAction(title: string, document: vscode.TextDocument, start: number, end: number, value: string): vscode.CodeAction {
  const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
  action.edit = new vscode.WorkspaceEdit();
  action.edit.replace(document.uri, new vscode.Range(document.positionAt(start), document.positionAt(end)), value);
  return action;
}

function commentLineAction(title: string, document: vscode.TextDocument, line: number): vscode.CodeAction {
  const action = new vscode.CodeAction(title, vscode.CodeActionKind.RefactorRewrite);
  action.edit = new vscode.WorkspaceEdit();
  action.edit.insert(document.uri, new vscode.Position(line, 0), '; ');
  return action;
}

function helpCommentAction(document: vscode.TextDocument, line: number, key: string, help?: string): vscode.CodeAction {
  const action = new vscode.CodeAction('Generate comment block from schema help', vscode.CodeActionKind.RefactorRewrite);
  action.edit = new vscode.WorkspaceEdit();
  const text = help ? `; ${key}: ${help}\n` : `; ${key}: no schema help available\n`;
  action.edit.insert(document.uri, new vscode.Position(line, 0), text);
  return action;
}
