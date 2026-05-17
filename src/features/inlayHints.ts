import * as vscode from 'vscode';
import { parseIni } from '../core/iniParser';
import type { SchemaStorage } from '../storage/schemaStorage';
import { getConfig } from '../storage/workspaceConfig';

export function registerInlayHintsProvider(context: vscode.ExtensionContext, storage: SchemaStorage): void {
  context.subscriptions.push(
    vscode.languages.registerInlayHintsProvider('ini-tweak', {
      provideInlayHints(document) {
        const config = getConfig(document.uri);
        if (!config.showDumpValuesAsInlayHints) return [];
        const parsed = parseIni(document.getText(), {
          enableInlineCommentParsing: config.enableInlineCommentParsing
        });
        const registry = storage.registryFor(document.uri);
        const hints: vscode.InlayHint[] = [];
        for (const node of parsed.keyValues) {
          const entry = registry.lookup(node.key)?.entry;
          if (!entry) continue;
          const parts = [
            entry.type ? `type: ${entry.type}` : undefined,
            entry.defaultValue !== undefined ? `default: ${entry.defaultValue}` : undefined,
            entry.currentValue !== undefined ? `dump: ${entry.currentValue}` : undefined
          ].filter(Boolean);
          if (parts.length === 0) continue;
          hints.push(
            new vscode.InlayHint(
              document.positionAt(node.endOffset),
              ` ${parts.join(', ')}`,
              vscode.InlayHintKind.Type
            )
          );
        }
        return hints;
      }
    })
  );
}
