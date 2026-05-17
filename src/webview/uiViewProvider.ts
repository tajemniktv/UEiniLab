import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { activeScopeUri } from '../commands/commandUtils';
import type { ResolvedCvarEntry } from '../core/schemaMerge';
import type { LoadedSchemaPack } from '../core/schemaTypes';
import { isBundledBaseSchemaPath } from '../storage/bundledSchemas';
import type { SchemaStorage } from '../storage/schemaStorage';
import { getSchemaStack, updateSchemaStack } from '../storage/workspaceConfig';
import {
  isSupportedWorkbenchMessage,
  WORKBENCH_RUN_COMMANDS,
  type WorkbenchMessage,
  type WorkbenchResult,
  type WorkbenchView
} from './workbenchMessages';

export interface WorkbenchController {
  focusWorkbench(view?: WorkbenchView): Promise<void>;
  setWorkbenchResult(result: WorkbenchResult): void;
  refreshWorkbench(): void;
}

interface WorkbenchState {
  activeView: WorkbenchView;
  cvarQuery: string;
  result?: WorkbenchResult;
}

interface WorkbenchCvarResult {
  name: string;
  meta: string;
  help?: string;
}

const MAX_CVAR_SEARCH_QUERY_LENGTH = 1000;

export class IniTweakLabViewProvider implements vscode.WebviewViewProvider, WorkbenchController {
  static readonly viewType = 'iniTweakLab.panel';

  private readonly state: WorkbenchState = {
    activeView: 'overview',
    cvarQuery: ''
  };
  private webviewView?: vscode.WebviewView;

  constructor(private readonly storage: SchemaStorage) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.storage.outputChannel().appendLine(`Workbench webview resolved: ${IniTweakLabViewProvider.viewType}`);
    console.info(`Workbench webview resolved: ${IniTweakLabViewProvider.viewType}`);
    this.webviewView = webviewView;
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
    const disposables: vscode.Disposable[] = [];
    disposables.push(
      webviewView.webview.onDidReceiveMessage((message: unknown) => {
        if (!isSupportedWorkbenchMessage(message)) {
          this.storage.outputChannel().appendLine(`Ignored unsupported Workbench message: ${safeSerializeMessage(message)}`);
          return;
        }
        this.handleMessage(message).catch((error: unknown) => {
          const detail = error instanceof Error ? error.message : String(error);
          this.storage.outputChannel().appendLine(`Error handling Workbench message ${safeSerializeMessage(message)}: ${detail}`);
        });
      })
    );
    const refresh = (): void => this.refreshWorkbench();
    refresh();
    disposables.push(this.storage.onDidChange(refresh));
    disposables.push(vscode.window.onDidChangeActiveTextEditor(refresh));
    disposables.push(
      webviewView.onDidDispose(() => {
        this.webviewView = undefined;
        while (disposables.length > 0) {
          disposables.pop()?.dispose();
        }
      })
    );
  }

  async focusWorkbench(view: WorkbenchView = 'overview'): Promise<void> {
    this.state.activeView = view;
    this.refreshWorkbench();
    await vscode.commands.executeCommand(`${IniTweakLabViewProvider.viewType}.focus`);
    this.storage.outputChannel().appendLine(`Workbench focus requested: ${view}`);
  }

  setWorkbenchResult(result: WorkbenchResult): void {
    this.state.result = result;
    this.state.activeView = result.kind === 'error' ? 'actions' : result.kind;
    this.refreshWorkbench();
  }

  refreshWorkbench(): void {
    if (!this.webviewView) return;
    this.webviewView.webview.html = this.render();
  }

  private postCvarResults(): void {
    if (!this.webviewView) return;
    const cvarResults = this.storage.registryFor(activeScopeUri()).search(this.state.cvarQuery, 100);
    void this.webviewView.webview.postMessage({
      command: 'replaceCvarResults',
      results: cvarResults.map(toWorkbenchCvarResult)
    });
  }

  private async handleMessage(message: WorkbenchMessage): Promise<void> {
    switch (message.command) {
      case 'setView':
        this.state.activeView = message.view;
        this.refreshWorkbench();
        return;
      case 'selectEngineVersion':
        await this.selectEngineVersion(message.engineVersion);
        return;
      case 'searchCvars':
        this.state.cvarQuery = (message.query ?? '').slice(0, MAX_CVAR_SEARCH_QUERY_LENGTH);
        this.state.activeView = 'cvars';
        this.postCvarResults();
        return;
      case 'insertCvar':
        await this.insertCvar(message.name);
        return;
      case 'generateReport':
        await vscode.commands.executeCommand('iniTweakLab.generateTweakReport');
        return;
      case 'showDiff':
        await vscode.commands.executeCommand('iniTweakLab.diffSchemaPacks');
        return;
      case 'explainSelection':
        await vscode.commands.executeCommand('iniTweakLab.explainSelectedSetting');
        return;
      case 'runCommand':
        if (WORKBENCH_RUN_COMMANDS.has(message.extensionCommand)) {
          await vscode.commands.executeCommand(message.extensionCommand);
        }
        return;
    }
  }

  private async selectEngineVersion(engineVersion: string | undefined): Promise<void> {
    if (!engineVersion) return;
    if (!vscode.workspace.isTrusted) {
      this.setWorkbenchResult({
        kind: 'error',
        title: 'Workspace trust required',
        markdown: 'Trust this workspace to update the active schema stack.'
      });
      return;
    }
    const selected = this.storage.bundledBaseSchemas().find((schema) => schema.engineVersion === engineVersion);
    if (!selected) return;
    const scope = activeScopeUri();
    const currentStack = getSchemaStack(scope);
    const withoutBundledBase = currentStack.filter((item) => !isBundledBaseSchemaPath(item));
    await updateSchemaStack([...withoutBundledBase, selected.relativePath], scope);
    await this.storage.reload(scope);
    this.state.activeView = 'schemaStack';
    this.refreshWorkbench();
  }

  private async insertCvar(name: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.setWorkbenchResult({
        kind: 'error',
        title: 'No active editor',
        markdown: `Open an INI file before inserting \`${name}\`.`
      });
      return;
    }
    const entry = this.storage.registryFor(activeScopeUri() ?? editor.document.uri).lookup(name);
    const snippet = new vscode.SnippetString();
    snippet.appendText(`${name}=`);
    if (entry?.entry.defaultValue !== undefined) {
      snippet.appendText(entry.entry.defaultValue);
    } else {
      snippet.appendTabstop(1);
    }
    await editor.insertSnippet(snippet);
  }

  private render(): string {
    const nonce = getNonce();
    const scope = activeScopeUri();
    const registry = this.storage.registryFor(scope);
    const packs = registry.getPacks().sort((a, b) => b.priority - a.priority);
    const activeBase = packs.find((pack) => /^ue\d+\.\d+-base$/i.test(pack.pack.id));
    const cvarCount = registry.all().length;
    const activeScope = scope ? (vscode.workspace.getWorkspaceFolder(scope)?.name ?? scope.fsPath) : 'Workspace';
    const query = this.state.cvarQuery;
    const cvarResults = registry.search(query, 100);
    return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
:root{color-scheme:dark light}
body{font-family:var(--vscode-font-family);font-size:12px;margin:0;color:var(--vscode-foreground);background:var(--vscode-sideBar-background)}
button,input{font:inherit}
.shell{display:flex;flex-direction:column;min-height:100vh}
.tabs{display:flex;gap:2px;overflow:auto;border-bottom:1px solid var(--vscode-panel-border);background:var(--vscode-sideBarSectionHeader-background)}
.tab{border:0;border-radius:0;padding:8px 10px;background:transparent;color:var(--vscode-descriptionForeground);cursor:pointer;white-space:nowrap}
.tab:hover,.tab:focus{background:var(--vscode-list-hoverBackground);color:var(--vscode-foreground);outline:1px solid var(--vscode-focusBorder);outline-offset:-1px}
.tab.active{background:var(--vscode-list-activeSelectionBackground);color:var(--vscode-list-activeSelectionForeground)}
main{padding:12px;display:flex;flex-direction:column;gap:12px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}
.stat,.empty,.result,.section{border:1px solid var(--vscode-panel-border);background:var(--vscode-editor-background);border-radius:6px;padding:10px}
.stat strong,.eyebrow{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--vscode-descriptionForeground);margin-bottom:4px}
.stat span{font-size:15px;font-variant-numeric:tabular-nums}
h1,h2{margin:0 0 8px}h1{font-size:16px}h2{font-size:13px}.muted{color:var(--vscode-descriptionForeground)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.actions{display:grid;grid-template-columns:1fr;gap:6px}
.button{border:0;border-radius:4px;padding:8px;text-align:left;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);cursor:pointer}
.button:hover,.button:focus{background:var(--vscode-button-secondaryHoverBackground);outline:1px solid var(--vscode-focusBorder);outline-offset:1px}.button.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
table{width:100%;border-collapse:collapse;font-size:11px}td,th{border:1px solid var(--vscode-panel-border);padding:5px;text-align:left;vertical-align:top}code,pre{font-family:var(--vscode-editor-font-family)}
.search{display:flex;gap:6px}.search input{min-width:0;flex:1;border:1px solid var(--vscode-input-border,var(--vscode-panel-border));background:var(--vscode-input-background);color:var(--vscode-input-foreground);padding:7px;border-radius:4px}
.results{display:grid;gap:6px}.cvar{border:1px solid var(--vscode-panel-border);border-radius:6px;padding:8px;background:var(--vscode-editor-background)}.cvar header{display:flex;gap:8px;align-items:flex-start;justify-content:space-between}
.meta{color:var(--vscode-descriptionForeground);font-size:11px}.markdown{white-space:normal}.markdown pre{white-space:pre-wrap}.markdown li{margin-bottom:3px}
</style></head><body>
<div class="shell">
${this.renderTabs()}
<main>
${this.renderStats(activeBase?.pack.displayName ?? 'None selected', activeScope, cvarCount)}
${this.renderActiveView(packs, cvarResults)}
</main>
</div>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => vscode.postMessage({ command: 'setView', view: button.dataset.view }));
});
document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.engineVersion) {
    vscode.postMessage({ command: 'selectEngineVersion', engineVersion: button.dataset.engineVersion });
    return;
  }
  if (button.dataset.insertCvar) {
    vscode.postMessage({ command: 'insertCvar', name: button.dataset.insertCvar });
    return;
  }
  if (button.dataset.runCommand) {
    vscode.postMessage({ command: 'runCommand', extensionCommand: button.dataset.runCommand });
    return;
  }
  if (button.dataset.workbenchCommand) {
    vscode.postMessage({ command: button.dataset.workbenchCommand });
  }
});
const search = document.querySelector('[data-cvar-search]');
if (search) {
  search.addEventListener('input', () => vscode.postMessage({ command: 'searchCvars', query: search.value }));
}
window.addEventListener('message', (event) => {
  if (event.data?.command !== 'replaceCvarResults') return;
  const results = document.querySelector('[data-cvar-results]');
  if (!results || !Array.isArray(event.data.results)) return;
  if (event.data.results.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No matching CVars in the active schema.';
    results.replaceChildren(empty);
    return;
  }
  results.replaceChildren(...event.data.results.map((entry) => {
    const article = document.createElement('article');
    article.className = 'cvar';
    const header = document.createElement('header');
    const body = document.createElement('div');
    const name = document.createElement('code');
    name.textContent = entry.name;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = entry.meta || '';
    body.append(name, meta);
    const insert = document.createElement('button');
    insert.className = 'button';
    insert.dataset.insertCvar = entry.name;
    insert.type = 'button';
    insert.textContent = 'Insert';
    header.append(body, insert);
    article.append(header);
    if (entry.help) {
      const help = document.createElement('p');
      help.textContent = entry.help;
      article.append(help);
    }
    return article;
  }));
});
</script>
</body></html>`;
  }

  private renderTabs(): string {
    const tabs: Array<[WorkbenchView, string]> = [
      ['overview', 'Overview'],
      ['cvars', 'CVars'],
      ['schemaStack', 'Schema Stack'],
      ['report', 'Report'],
      ['diff', 'Diff'],
      ['explain', 'Explain'],
      ['actions', 'Actions']
    ];
    return `<nav class="tabs" aria-label="Workbench views">${tabs
      .map(
        ([view, label]) =>
          `<button class="tab ${this.state.activeView === view ? 'active' : ''}" data-view="${view}" type="button">${label}</button>`
      )
      .join('')}</nav>`;
  }

  private renderStats(baseSchema: string, activeScope: string, cvarCount: number): string {
    return `<section class="stats" aria-label="Active schema summary">
<div class="stat"><strong>Base schema</strong><span>${escapeHtml(baseSchema)}</span></div>
<div class="stat"><strong>Scope</strong><span>${escapeHtml(activeScope)}</span></div>
<div class="stat"><strong>Active CVars</strong><span>${cvarCount}</span></div>
</section>`;
  }

  private renderActiveView(packs: LoadedSchemaPack[], cvarResults: ResolvedCvarEntry[]): string {
    switch (this.state.activeView) {
      case 'cvars':
        return this.renderCvars(cvarResults);
      case 'schemaStack':
        return this.renderSchemaStack(packs);
      case 'report':
      case 'diff':
      case 'explain':
        return this.renderResult(this.state.activeView);
      case 'actions':
        return this.renderActions();
      default:
        return this.renderOverview(packs, cvarResults);
    }
  }

  private renderOverview(packs: LoadedSchemaPack[], cvarResults: ResolvedCvarEntry[]): string {
    return `<section class="section">
<h1>INI Tweak Lab Workbench</h1>
<p class="muted">Schema inspection, CVar search, reports, and command shortcuts are available in this single panel.</p>
<div class="grid">
  <button class="button primary" data-view="cvars" type="button">Search active CVars</button>
  <button class="button" data-view="schemaStack" type="button">Inspect schema stack</button>
  <button class="button" data-workbench-command="generateReport" type="button">Generate current-file report</button>
  <button class="button" data-workbench-command="explainSelection" type="button">Explain selected setting</button>
</div>
</section>
${this.renderSchemaStack(packs, true)}
${this.renderCvars(cvarResults.slice(0, 12), true)}`;
  }

  private renderSchemaStack(packs: LoadedSchemaPack[], compact = false): string {
    const bundled = this.storage.bundledBaseSchemas();
    const activeEngineVersion = packs.find((pack) => /^ue\d+\.\d+-base$/i.test(pack.pack.id))?.pack.target?.engineVersion;
    const versionButtons = bundled
      .map((schema) => {
        const active = schema.engineVersion === activeEngineVersion;
        return `<button class="button ${active ? 'primary' : ''}" data-engine-version="${escapeHtml(schema.engineVersion)}" type="button">UE ${escapeHtml(schema.engineVersion)}${active ? ' - active' : ''}</button>`;
      })
      .join('');
    const rows = packs
      .map(
        (pack) =>
          `<tr><td>${escapeHtml(pack.role)}</td><td>${escapeHtml(pack.pack.displayName)}</td><td>${Object.keys(pack.pack.cvars).length}</td><td><code>${escapeHtml(pack.path)}</code></td></tr>`
      )
      .join('');
    return `<section class="section">
<h2>${compact ? 'Schema stack' : 'Active schema stack'}</h2>
<div class="grid">${versionButtons || '<div class="empty">No bundled Unreal Engine base schemas were found.</div>'}</div>
${packs.length ? `<table><thead><tr><th>Role</th><th>Name</th><th>CVars</th><th>Path</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No schemas are loaded. Select a bundled Unreal Engine version or import a schema.</div>'}
</section>`;
  }

  private renderCvars(cvarResults: ResolvedCvarEntry[], compact = false): string {
    return `<section class="section">
<h2>${compact ? 'CVar search' : 'Search active CVars'}</h2>
<label class="search"><span class="eyebrow">Search</span><input data-cvar-search value="${escapeHtml(this.state.cvarQuery)}" placeholder="Name, help text, category, type, default, flag" /></label>
<div class="results" data-cvar-results>${this.renderCvarResults(cvarResults)}</div>
</section>`;
  }

  private renderCvarResults(cvarResults: ResolvedCvarEntry[]): string {
    return cvarResults.length ? cvarResults.map((entry) => renderCvar(entry)).join('') : '<div class="empty">No matching CVars in the active schema.</div>';
  }

  private renderResult(view: WorkbenchResult['kind']): string {
    const resultActions: Record<WorkbenchResult['kind'], string> = {
      report: '<button class="button primary" data-workbench-command="generateReport" type="button">Generate report for active file</button>',
      diff: '<button class="button primary" data-workbench-command="showDiff" type="button">Choose schema packs to diff</button>',
      explain: '<button class="button primary" data-workbench-command="explainSelection" type="button">Explain selected INI setting</button>',
      error: ''
    };
    const action = resultActions[view];
    if (!this.state.result || this.state.result.kind !== view) {
      return `<section class="empty"><h2>No ${view} yet</h2>${action}</section>`;
    }
    return `<section class="result">${action}<h1>${escapeHtml(this.state.result.title)}</h1><div class="markdown">${markdownToHtml(this.state.result.markdown)}</div></section>`;
  }

  private renderActions(): string {
    const result = this.state.result?.kind === 'error' ? this.renderResult('error') : '';
    return `${result}<section class="section"><h2>Commands</h2><div class="actions">
<button class="button" data-run-command="iniTweakLab.validateCurrentFile" type="button">Validate current file</button>
<button class="button" data-run-command="iniTweakLab.importCvarDump" type="button">Import CVar dump</button>
<button class="button" data-run-command="iniTweakLab.importSchemaFile" type="button">Import schema file</button>
<button class="button" data-run-command="iniTweakLab.createWorkspaceSchema" type="button">Create workspace schema</button>
<button class="button" data-run-command="iniTweakLab.generateUnrealRendererBlock" type="button">Generate renderer block</button>
<button class="button" data-run-command="iniTweakLab.sortCurrentSection" type="button">Sort current section</button>
<button class="button" data-run-command="iniTweakLab.commentOutSelectedTweaks" type="button">Comment selected tweaks</button>
</div></section>`;
  }
}

function renderCvar(entry: ResolvedCvarEntry): string {
  const result = toWorkbenchCvarResult(entry);
  return `<article class="cvar"><header><div><code>${escapeHtml(result.name)}</code><div class="meta">${escapeHtml(result.meta)}</div></div><button class="button" data-insert-cvar="${escapeHtml(result.name)}" type="button">Insert</button></header>${result.help ? `<p>${escapeHtml(result.help)}</p>` : ''}</article>`;
}

function toWorkbenchCvarResult(entry: ResolvedCvarEntry): WorkbenchCvarResult {
  return {
    name: entry.name,
    meta: [
      entry.entry.type,
      entry.entry.defaultValue ? `default ${entry.entry.defaultValue}` : undefined,
      entry.entry.currentValue ? `current ${entry.entry.currentValue}` : undefined,
      entry.entry.category
    ]
      .filter(Boolean)
      .join(' | '),
    help: entry.entry.help
  };
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let inList = false;
  let inTable = false;
  let inCodeBlock = false;
  const closeList = (): void => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };
  const closeTable = (): void => {
    if (inTable) {
      html.push('</tbody></table>');
      inTable = false;
    }
  };
  for (const line of lines) {
    if (line.startsWith('```')) {
      closeList();
      closeTable();
      if (inCodeBlock) {
        html.push('</code></pre>');
        inCodeBlock = false;
      } else {
        html.push('<pre><code>');
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      html.push(`${escapeHtml(line)}\n`);
      continue;
    }
    if (line.startsWith('# ')) {
      closeList();
      closeTable();
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      closeList();
      closeTable();
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      closeList();
      closeTable();
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }
    if (/^\s*\|/.test(line)) {
      closeList();
      const cells = parseTableCells(line);
      if (cells.length === 0 || cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))) continue;
      if (!inTable) {
        html.push('<table><tbody>');
        inTable = true;
      }
      html.push(`<tr>${cells.map((cell) => `<td>${inlineMarkdown(cell.trim())}</td>`).join('')}</tr>`);
      continue;
    }
    const listItem = line.match(/^\s*-\s+(.+)$/);
    if (listItem) {
      closeTable();
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(listItem[1])}</li>`);
      continue;
    }
    if (!line.trim()) {
      closeList();
      closeTable();
      continue;
    }
    closeList();
    closeTable();
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  closeList();
  closeTable();
  if (inCodeBlock) html.push('</code></pre>');
  return html.join('');
}

function parseTableCells(line: string): string[] {
  const trimmed = line.trim();
  const withoutOuterPipes = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return withoutOuterPipes.split('|').map((cell) => cell.trim());
}

function inlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => renderMarkdownLink(label, href));
}

function renderMarkdownLink(label: string, href: string): string {
  const safeHref = toSafeMarkdownHref(href);
  if (!safeHref) return label;
  return `<a href="${safeHref}">${label}</a>`;
}

function toSafeMarkdownHref(href: string): string | undefined {
  const decoded = decodeHtmlEntities(href.trim());
  if (!/^https?:\/\//i.test(decoded)) return undefined;
  return escapeHtml(decoded);
function inlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
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
