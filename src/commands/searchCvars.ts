import * as vscode from 'vscode';
import type { SchemaStorage } from '../storage/schemaStorage';

export async function searchActiveCvars(storage: SchemaStorage): Promise<void> {
  const query = await vscode.window.showInputBox({ title: 'Search active CVars', prompt: 'Search by CVar name, help text, or category' });
  if (query === undefined) return;
  const picks = storage.registry.search(query, 200).map((entry) => ({
    label: entry.name,
    description: entry.entry.type,
    detail: entry.entry.help,
    entry
  }));
  const selected = await vscode.window.showQuickPick(picks, { matchOnDescription: true, matchOnDetail: true });
  if (!selected) return;
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    await editor.insertSnippet(new vscode.SnippetString(`${selected.entry.name}=${selected.entry.entry.defaultValue ?? '$1'}`));
  }
}
