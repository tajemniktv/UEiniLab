import * as vscode from 'vscode';
import type { SchemaStorage } from '../storage/schemaStorage';

export class IniTweakLabViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'iniTweakLab.panel';

  constructor(private readonly storage: SchemaStorage) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage((message: { command?: string; engineVersion?: string }) => {
      if (message.command === 'iniTweakLab.selectEngineVersion' && message.engineVersion) {
        void vscode.commands.executeCommand(message.command, message.engineVersion);
        return;
      }
      if (message.command) void vscode.commands.executeCommand(message.command);
    });
    const refresh = () => {
      webviewView.webview.html = this.render();
    };
    refresh();
    this.storage.onDidChange(refresh);
  }

  private render(): string {
    const packs = this.storage.registry.getPacks();
    const activeBase = packs.find((pack) => /^ue\d+\.\d+-base$/i.test(pack.pack.id));
    const cvarCount = this.storage.registry.all().length;
    const versions = this.storage
      .bundledBaseSchemas()
      .map((schema) => {
        const active = schema.engineVersion === activeBase?.pack.target?.engineVersion;
        return `<button class="version ${active ? 'active' : ''}" data-engine-version="${escapeHtml(schema.engineVersion)}">UE ${escapeHtml(schema.engineVersion)}</button>`;
      })
      .join('');
    const stackRows = packs
      .sort((a, b) => b.priority - a.priority)
      .map(
        (pack) =>
          `<tr><td>${escapeHtml(pack.role)}</td><td>${escapeHtml(pack.pack.displayName)}</td><td>${Object.keys(pack.pack.cvars).length}</td></tr>`
      )
      .join('');
    const actions = [
      ['Open Schema Stack', 'iniTweakLab.openSchemaStack'],
      ['Import CVar Dump', 'iniTweakLab.importCvarDump'],
      ['Import Schema File', 'iniTweakLab.importSchemaFile'],
      ['Create Workspace Schema', 'iniTweakLab.createWorkspaceSchema'],
      ['Search Active CVars', 'iniTweakLab.searchActiveCVars'],
      ['Validate Current File', 'iniTweakLab.validateCurrentFile'],
      ['Generate Tweak Report', 'iniTweakLab.generateTweakReport'],
      ['Compare Current INI Against Active Schema', 'iniTweakLab.compareCurrentIniAgainstActiveSchema'],
      ['Explain Selected Setting', 'iniTweakLab.explainSelectedSetting'],
      ['Generate Unreal Renderer Block', 'iniTweakLab.generateUnrealRendererBlock'],
      ['Sort Current Section', 'iniTweakLab.sortCurrentSection'],
      ['Comment Out Selected Tweaks', 'iniTweakLab.commentOutSelectedTweaks']
    ];
    const actionButtons = actions
      .map(
        ([label, command]) =>
          `<button data-command="${escapeHtml(command)}">${escapeHtml(label)}</button>`
      )
      .join('');
    return `<!doctype html>
<html><head><meta charset="utf-8"><style>
body{font-family:var(--vscode-font-family);padding:12px;color:var(--vscode-foreground)}
.stat{border:1px solid var(--vscode-panel-border);border-radius:6px;padding:8px;margin-bottom:10px}
.stat strong{display:block;font-size:12px;color:var(--vscode-descriptionForeground);text-transform:uppercase;letter-spacing:.04em}
.stat span{font-size:16px}.actions,.versions{display:flex;flex-direction:column;gap:6px}.versions{margin-bottom:12px}
button{width:100%;text-align:left;border:0;border-radius:4px;padding:8px;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);cursor:pointer}
h2{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--vscode-descriptionForeground);margin:14px 0 6px}
button:hover{background:var(--vscode-button-secondaryHoverBackground)}button.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px}td,th{border:1px solid var(--vscode-panel-border);padding:4px;text-align:left;vertical-align:top}
</style></head><body>
<div class="stat"><strong>Base Schema</strong><span>${escapeHtml(activeBase?.pack.displayName ?? 'None selected')}</span></div>
<div class="stat"><strong>Active CVars</strong><span>${cvarCount}</span></div>
<h2>Bundled Base</h2>
<div class="versions">${versions || '<div class="stat"><span>No bundled schemas found</span></div>'}</div>
<h2>Active Stack</h2>
${stackRows ? `<table><thead><tr><th>Role</th><th>Name</th><th>CVars</th></tr></thead><tbody>${stackRows}</tbody></table>` : '<div class="stat"><span>No schemas loaded</span></div>'}
<h2>Commands</h2>
<div class="actions">
  ${actionButtons}
</div>
<script>
const vscode = acquireVsCodeApi();
document.querySelectorAll('[data-command]').forEach((button) => {
  button.addEventListener('click', () => vscode.postMessage({ command: button.dataset.command }));
});
document.querySelectorAll('[data-engine-version]').forEach((button) => {
  button.addEventListener('click', () => vscode.postMessage({ command: 'iniTweakLab.selectEngineVersion', engineVersion: button.dataset.engineVersion }));
});
</script>
</body></html>`;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}
