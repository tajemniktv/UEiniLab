import * as vscode from 'vscode';
import type { SchemaStorage } from '../storage/schemaStorage';
import { activeScopeUri } from './commandUtils';

export async function searchActiveCvars(storage: SchemaStorage): Promise<void> {
  const scope = activeScopeUri();
  const query = await vscode.window.showInputBox({
    title: 'Search active CVars',
    prompt: 'Search by CVar name, help text, category, type, default/current value, or flag'
  });
  if (query === undefined) return;
  const registry = storage.registryFor(scope);
  const picks = registry.search(query, 200).map((entry) => ({
    label: entry.name,
    description: [entry.entry.type, entry.entry.defaultValue ? `default ${entry.entry.defaultValue}` : undefined, entry.entry.currentValue ? `current ${entry.entry.currentValue}` : undefined]
      .filter(Boolean)
      .join(' | '),
    detail: [sourceSummary(entry.sources), entry.entry.help].filter(Boolean).join('\n'),
    entry
  }));
  const selected = await vscode.window.showQuickPick(picks, {
    title: 'INI Tweak Lab CVar Explorer',
    placeHolder: picks.length ? 'Pick a CVar to insert into the active INI' : 'No matching CVars in the active schema',
    matchOnDescription: true,
    matchOnDetail: true
  });
  if (!selected) return;
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    await editor.insertSnippet(new vscode.SnippetString(`${selected.entry.name}=${selected.entry.entry.defaultValue ?? '$1'}`));
  }
}

function sourceSummary(sources: Array<{ role: string; packId: string }>): string {
  return sources.map((source) => `${source.role}: ${source.packId}`).join(' > ');
}
