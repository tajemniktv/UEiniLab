import * as vscode from 'vscode';
import { buildHoverMarkdown } from '../core/hoverText';
import { parseIni } from '../core/iniParser';
import type { SchemaStorage } from '../storage/schemaStorage';
import { getConfig } from '../storage/workspaceConfig';
import { rangeFromOffsets } from './diagnostics';

export function registerHoverProvider(context: vscode.ExtensionContext, storage: SchemaStorage): void {
  context.subscriptions.push(
    vscode.languages.registerHoverProvider('ini-tweak', {
      provideHover(document, position) {
        const offset = document.offsetAt(position);
        const config = getConfig(document.uri);
        const parsed = parseIni(document.getText(), {
          enableInlineCommentParsing: config.enableInlineCommentParsing
        });
        const node = parsed.keyValues.find((candidate) => offset >= candidate.keyRange.start && offset <= candidate.keyRange.end);
        if (!node) return undefined;
        const registry = storage.registryFor(document.uri);
        return new vscode.Hover(
          new vscode.MarkdownString(
            buildHoverMarkdown(node, registry, {
              showSourceProvenance: config.showHoverSourceProvenance
            }),
            true
          ),
          rangeFromOffsets(document, node.keyRange.start, node.keyRange.end)
        );
      }
    })
  );
}
