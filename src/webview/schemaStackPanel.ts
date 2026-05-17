import * as vscode from 'vscode';
import type { BundledBaseSchema } from '../storage/bundledSchemas';
import type { SchemaStorage } from '../storage/schemaStorage';
import { activeScopeUri } from '../commands/commandUtils';

export function showSchemaStackPanel(storage: SchemaStorage): void {
  const panel = vscode.window.createWebviewPanel('iniTweakLabSchemaStack', 'INI Tweak Lab Schema Stack', vscode.ViewColumn.Beside, {
    enableScripts: true
  });
  panel.webview.onDidReceiveMessage(async (message: { command?: string; engineVersion?: string }) => {
    if (message.command === 'selectEngineVersion' && message.engineVersion) {
      await vscode.commands.executeCommand('iniTweakLab.selectEngineVersion', message.engineVersion);
      panel.webview.html = renderHtml(storage);
    }
  });
  panel.webview.html = renderHtml(storage);
}

function renderHtml(storage: SchemaStorage): string {
  const scope = activeScopeUri();
  const bundled: BundledBaseSchema[] = storage.bundledBaseSchemas();
  const bundledPaths = new Map(bundled.map((schema) => [schema.absolutePath.toLowerCase(), schema.relativePath]));
  const packs = storage
    .registryFor(scope)
    .getPacks()
    .sort((a, b) => b.priority - a.priority);
  const rows = packs
    .map(
      (pack) => {
        const displayPath = bundledPaths.get(pack.path.toLowerCase()) ?? pack.path;
        return `<tr><td>${escapeHtml(pack.role)}</td><td>${escapeHtml(pack.pack.displayName)}</td><td>${Object.keys(pack.pack.cvars).length}</td><td><code>${escapeHtml(displayPath)}</code></td></tr>`;
      }
    )
    .join('');

  const activeEngineVersion = packs.find((pack) => /^ue\d+\.\d+-base$/i.test(pack.pack.id))?.pack.target?.engineVersion;
  const activeScope = scope ? (vscode.workspace.getWorkspaceFolder(scope)?.name ?? scope.fsPath) : 'Workspace';
  const versionCards = bundled
    .map((schema) => {
      const active = schema.engineVersion === activeEngineVersion;
      return `<button class="version ${active ? 'active' : ''}" data-engine-version="${escapeHtml(schema.engineVersion)}">
        <span>UE ${escapeHtml(schema.engineVersion)}</span>
        <small>${active ? 'Active base schema' : 'Use this version'}</small>
      </button>`;
    })
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
body{font-family:var(--vscode-font-family);padding:20px;color:var(--vscode-foreground);background:var(--vscode-editor-background)}
h1{font-size:20px;margin:0 0 6px}h2{font-size:14px;margin:22px 0 8px;text-transform:uppercase;letter-spacing:.04em;color:var(--vscode-descriptionForeground)}
p{color:var(--vscode-descriptionForeground);max-width:760px}.versions{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;max-width:760px}
.version{display:flex;flex-direction:column;gap:4px;text-align:left;border:1px solid var(--vscode-button-border,var(--vscode-panel-border));border-radius:6px;padding:10px;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);cursor:pointer}
.version:hover{background:var(--vscode-button-secondaryHoverBackground)}.version.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.version span{font-weight:600}.version small{opacity:.85}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid var(--vscode-panel-border);padding:6px;text-align:left;vertical-align:top}
code{font-family:var(--vscode-editor-font-family)}
</style></head><body>
<h1>Schema Stack</h1>
<p><strong>Active scope:</strong> ${escapeHtml(activeScope)}</p>
<p>Choose the bundled Unreal Engine base schema for engine-level CVar documentation, then layer game dumps and workspace overrides above it. Higher priority schemas override sparse fields from lower layers while preserving provenance.</p>
<h2>Bundled Unreal Engine Versions</h2>
<div class="versions">${versionCards || '<p>No bundled base schemas found.</p>'}</div>
<h2>Active Stack</h2>
${packs.length > 0 ? `<table><thead><tr><th>Role</th><th>Name</th><th>CVars</th><th>Path</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>No schemas are loaded. Select a bundled Unreal Engine version or import a game dump.</p>'}
<script>
const vscode = acquireVsCodeApi();
document.querySelectorAll('[data-engine-version]').forEach((button) => {
  button.addEventListener('click', () => {
    vscode.postMessage({ command: 'selectEngineVersion', engineVersion: button.dataset.engineVersion });
  });
});
</script>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}
