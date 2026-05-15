import * as vscode from 'vscode';
import type { SchemaStorage } from '../storage/schemaStorage';

export function showCvarBrowserPanel(storage: SchemaStorage): void {
  const panel = vscode.window.createWebviewPanel('iniTweakLabCvarBrowser', 'INI Tweak Lab CVars', vscode.ViewColumn.Beside, {});
  const items = storage.registry
    .all()
    .slice(0, 500)
    .map((entry) => `<li><code>${entry.name}</code> ${entry.entry.help ? escapeHtml(entry.entry.help) : ''}</li>`)
    .join('');
  panel.webview.html = `<!doctype html><html><body><h1>Active CVars</h1><ul>${items}</ul></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}
