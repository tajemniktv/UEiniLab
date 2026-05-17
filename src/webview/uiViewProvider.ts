import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import type { SchemaStorage } from '../storage/schemaStorage';

const SUPPORTED_WEBVIEW_COMMANDS: ReadonlySet<string> = new Set([
  'iniTweakLab.openSchemaStack',
  'iniTweakLab.importCvarDump',
  'iniTweakLab.importSchemaFile',
  'iniTweakLab.createWorkspaceSchema',
  'iniTweakLab.searchActiveCVars',
  'iniTweakLab.validateCurrentFile',
  'iniTweakLab.generateTweakReport',
  'iniTweakLab.compareCurrentIniAgainstActiveSchema',
  'iniTweakLab.explainSelectedSetting',
  'iniTweakLab.generateUnrealRendererBlock',
  'iniTweakLab.sortCurrentSection',
  'iniTweakLab.commentOutSelectedTweaks',
  'iniTweakLab.selectEngineVersion'
] as const);

interface WebviewMessage {
  command: string;
  engineVersion?: string;
}

export class IniTweakLabViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'iniTweakLab.panel';

  constructor(private readonly storage: SchemaStorage) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
    const disposables: vscode.Disposable[] = [];
    disposables.push(
      webviewView.webview.onDidReceiveMessage((message: unknown) => {
        if (!isSupportedWebviewMessage(message)) {
          this.storage.outputChannel().appendLine(`Ignored unsupported webview message: ${safeSerializeMessage(message)}`);
          return;
        }
        if (message.command === 'iniTweakLab.selectEngineVersion') {
          const isKnownVersion = this.storage
            .bundledBaseSchemas()
            .some((schema) => schema.engineVersion === message.engineVersion);
          if (!message.engineVersion || !isKnownVersion) return;
          void vscode.commands.executeCommand(message.command, message.engineVersion);
          return;
        }
        void executeSupportedWebviewCommand(message.command);
      })
    );
    const refresh = (): void => {
      webviewView.webview.html = this.render();
    };
    refresh();
    disposables.push(this.storage.onDidChange(refresh));
    disposables.push(
      webviewView.onDidDispose(() => {
        while (disposables.length > 0) {
          disposables.pop()?.dispose();
        }
      })
    );
  }

  private render(): string {
    const nonce = getNonce();
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
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
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
<script nonce="${nonce}">
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

function isSupportedWebviewMessage(message: unknown): message is WebviewMessage {
  if (!message || typeof message !== 'object') return false;
  const candidate = message as { command?: unknown; engineVersion?: unknown };
  if (typeof candidate.command !== 'string') return false;
  if (!SUPPORTED_WEBVIEW_COMMANDS.has(candidate.command)) return false;
  return candidate.engineVersion === undefined || typeof candidate.engineVersion === 'string';
}

async function executeSupportedWebviewCommand(command: string): Promise<void> {
  if (!SUPPORTED_WEBVIEW_COMMANDS.has(command)) {
    throw new Error(`Attempted to execute unsupported command: ${command}`);
  }
  switch (command) {
    case 'iniTweakLab.openSchemaStack':
      await vscode.commands.executeCommand('iniTweakLab.openSchemaStack');
      return;
    case 'iniTweakLab.importCvarDump':
      await vscode.commands.executeCommand('iniTweakLab.importCvarDump');
      return;
    case 'iniTweakLab.importSchemaFile':
      await vscode.commands.executeCommand('iniTweakLab.importSchemaFile');
      return;
    case 'iniTweakLab.createWorkspaceSchema':
      await vscode.commands.executeCommand('iniTweakLab.createWorkspaceSchema');
      return;
    case 'iniTweakLab.searchActiveCVars':
      await vscode.commands.executeCommand('iniTweakLab.searchActiveCVars');
      return;
    case 'iniTweakLab.validateCurrentFile':
      await vscode.commands.executeCommand('iniTweakLab.validateCurrentFile');
      return;
    case 'iniTweakLab.generateTweakReport':
      await vscode.commands.executeCommand('iniTweakLab.generateTweakReport');
      return;
    case 'iniTweakLab.compareCurrentIniAgainstActiveSchema':
      await vscode.commands.executeCommand('iniTweakLab.compareCurrentIniAgainstActiveSchema');
      return;
    case 'iniTweakLab.explainSelectedSetting':
      await vscode.commands.executeCommand('iniTweakLab.explainSelectedSetting');
      return;
    case 'iniTweakLab.generateUnrealRendererBlock':
      await vscode.commands.executeCommand('iniTweakLab.generateUnrealRendererBlock');
      return;
    case 'iniTweakLab.sortCurrentSection':
      await vscode.commands.executeCommand('iniTweakLab.sortCurrentSection');
      return;
    case 'iniTweakLab.commentOutSelectedTweaks':
      await vscode.commands.executeCommand('iniTweakLab.commentOutSelectedTweaks');
      return;
  }
}

function getNonce(): string {
  return randomBytes(16).toString('base64url');
}

function safeSerializeMessage(message: unknown): string {
  try {
    return JSON.stringify(message) ?? '<unserializable>';
  } catch {
    return '<unserializable>';
  }
}
