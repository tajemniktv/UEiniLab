import * as vscode from 'vscode';
import { parseIni } from '../core/iniParser';

export function registerDocumentSymbolsProvider(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider('ini-tweak', {
      provideDocumentSymbols(document) {
        const parsed = parseIni(document.getText());
        return parsed.sections.map((section) => {
          const range = new vscode.Range(document.positionAt(section.startOffset), document.positionAt(section.endOffset));
          return new vscode.DocumentSymbol(section.name, 'INI section', vscode.SymbolKind.Namespace, range, range);
        });
      }
    })
  );
}
