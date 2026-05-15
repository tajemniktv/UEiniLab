import * as vscode from 'vscode';
import { buildHoverMarkdown } from '../core/hoverText';
import { parseIni } from '../core/iniParser';
import type { SchemaRegistry } from '../core/schemaRegistry';
import { getConfig } from '../storage/workspaceConfig';
import { rangeFromOffsets } from './diagnostics';

export function registerHoverProvider(context: vscode.ExtensionContext, registry: SchemaRegistry): void {
  context.subscriptions.push(
    vscode.languages.registerHoverProvider('ini-tweak', {
      provideHover(document, position) {
        const offset = document.offsetAt(position);
        const parsed = parseIni(document.getText(), {
          enableInlineCommentParsing: getConfig().enableInlineCommentParsing
        });
        const node = parsed.keyValues.find((candidate) => offset >= candidate.keyRange.start && offset <= candidate.keyRange.end);
        if (!node) return undefined;
        return new vscode.Hover(
          new vscode.MarkdownString(
            buildHoverMarkdown(node, registry, {
              showSourceProvenance: getConfig().showHoverSourceProvenance
            }),
            true
          ),
          rangeFromOffsets(document, node.keyRange.start, node.keyRange.end)
        );
      }
    })
  );
}
