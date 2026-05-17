import * as vscode from 'vscode';
import { getLineCompletionContext, type CompletionTextRange } from '../core/completionContext';
import {
  getKeyCompletions,
  getSectionCompletions,
  getValueCompletions,
  type CompletionCandidate
} from '../core/completionEngine';
import type { SchemaRegistry } from '../core/schemaRegistry';
import { getConfig } from '../storage/workspaceConfig';

const KEY_TRIGGER_CHARACTERS = [
  '.',
  '=',
  '[',
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'.split('')
];

export function registerCompletionProvider(context: vscode.ExtensionContext, registry: SchemaRegistry): void {
  const debugChannel = vscode.window.createOutputChannel('INI Tweak Lab Completions');
  context.subscriptions.push(debugChannel);
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      'ini-tweak',
      {
        provideCompletionItems(document, position, token, completionContext) {
          if (token.isCancellationRequested) return undefined;
          const fullLine = document.lineAt(position.line).text;
          const line = fullLine.slice(0, position.character);
          const config = getConfig(document.uri);

          if (/^\s*\[[^\]]*$/.test(line)) {
            return getSectionCompletions(config.defaultIniSections).map((candidate) => toCompletionItem(candidate));
          }

          const currentContext = getLineCompletionContext(fullLine, position.character);
          if (token.isCancellationRequested) return undefined;

          if (!currentContext) {
            logCompletionDebug(debugChannel, config.debugCompletions, {
              fullLine,
              position,
              reason: 'no completion context'
            });
            return new vscode.CompletionList([], true);
          }

          if (currentContext.kind === 'value') {
            return new vscode.CompletionList(
              getValueCompletions(currentContext.key, registry).map((candidate) =>
                toCompletionItem(candidate, toVsCodeRange(position.line, currentContext.replaceRange))
              ),
              false
            );
          }

          if (line.includes('=')) {
            const key = findKeyFromCurrentLine(line);
            if (!key) return [];
            return new vscode.CompletionList(
              getValueCompletions(key, registry).map((candidate) => toCompletionItem(candidate)),
              false
            );
          }

          const cvarCandidates = getKeyCompletions(registry, currentContext.prefix, config.maxCompletionItems, {
            matchMode: config.completionMatchMode,
            fuzzyFallback:
              config.completionFuzzyFallback && completionContext.triggerKind === vscode.CompletionTriggerKind.Invoke
          });
          if (token.isCancellationRequested) return undefined;
          logCompletionDebug(debugChannel, config.debugCompletions, {
            fullLine,
            position,
            prefix: currentContext.prefix,
            insertRange: currentContext.insertRange,
            replaceRange: currentContext.replaceRange,
            candidateCount: cvarCandidates.length,
            firstCandidates: cvarCandidates.slice(0, 20).map((candidate) => candidate.label)
          });
          const replacementRange = toVsCodeInsertReplaceRange(
            position.line,
            currentContext.insertRange,
            currentContext.replaceRange
          );
          const cvarItems = cvarCandidates.map((candidate) => toCompletionItem(candidate, replacementRange));
          const snippets = [
            snippet('SystemSettings block', '[SystemSettings]\n${1:r.DynamicGlobalIlluminationMethod}=1'),
            snippet('Renderer settings block', '[/Script/Engine.RendererSettings]\n${1:r.ReflectionMethod}=1')
          ];
          return new vscode.CompletionList([...cvarItems, ...snippets], true);
        }
      },
      ...KEY_TRIGGER_CHARACTERS
    )
  );
}

function toCompletionItem(
  candidate: CompletionCandidate,
  range?: vscode.Range | { inserting: vscode.Range; replacing: vscode.Range }
): vscode.CompletionItem {
  const item = new vscode.CompletionItem(candidate.label);
  item.kind =
    candidate.kind === 'section'
      ? vscode.CompletionItemKind.Module
      : candidate.kind === 'value'
        ? vscode.CompletionItemKind.Value
        : vscode.CompletionItemKind.Property;
  item.detail = candidate.detail;
  item.documentation = candidate.documentation;
  item.insertText = candidate.insertText;
  item.filterText = candidate.filterText;
  item.sortText = candidate.sortText;
  if (range) {
    item.range = range;
  }
  return item;
}

function snippet(label: string, body: string): vscode.CompletionItem {
  const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Snippet);
  item.insertText = new vscode.SnippetString(body);
  item.sortText = `zzzz:${label}`;
  return item;
}

function toVsCodeRange(line: number, range: CompletionTextRange): vscode.Range {
  return new vscode.Range(line, range.start, line, range.end);
}

function toVsCodeInsertReplaceRange(
  line: number,
  insertRange: CompletionTextRange,
  replaceRange: CompletionTextRange
): { inserting: vscode.Range; replacing: vscode.Range } {
  return {
    inserting: toVsCodeRange(line, insertRange),
    replacing: toVsCodeRange(line, replaceRange)
  };
}

function findKeyFromCurrentLine(line: string): string | null {
  const keyMatch = line.match(/^\s*[+\-!]?\s*([^=;#\s][^=;#]*)=/);
  return keyMatch?.[1]?.trim() || null;
}

function logCompletionDebug(
  channel: vscode.OutputChannel,
  enabled: boolean,
  payload: Record<string, unknown>
): void {
  if (!enabled) return;
  channel.appendLine(JSON.stringify(payload, null, 2));
}
