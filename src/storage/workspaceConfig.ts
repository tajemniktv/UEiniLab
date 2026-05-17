import * as vscode from 'vscode';

export interface IniTweakLabConfig {
  profile: string;
  schemaStack: string[];
  enableDiagnostics: boolean;
  warnUnknownCvars: boolean;
  warnDuplicateKeys: boolean;
  warnTypeMismatches: boolean;
  warnKnownInEngineButMissingFromGameDump: boolean;
  showHoverSourceProvenance: boolean;
  showDumpValuesAsInlayHints: boolean;
  maxCompletionItems: number;
  completionMatchMode: 'strictPrefix' | 'smart' | 'fuzzy';
  completionFuzzyFallback: boolean;
  debugCompletions: boolean;
  schemaSearchPaths: string[];
  defaultIniSections: string[];
  assumeUnrealSyntax: boolean;
  enableInlineCommentParsing: boolean;
}

export function getConfig(scope?: vscode.ConfigurationScope): IniTweakLabConfig {
  const config = vscode.workspace.getConfiguration('iniTweakLab', scope);
  return {
    profile: config.get('profile', 'unreal-engine'),
    schemaStack: config.get('schemaStack', []),
    enableDiagnostics: config.get('enableDiagnostics', true),
    warnUnknownCvars: config.get('warnUnknownCvars', true),
    warnDuplicateKeys: config.get('warnDuplicateKeys', true),
    warnTypeMismatches: config.get('warnTypeMismatches', true),
    warnKnownInEngineButMissingFromGameDump: config.get('warnKnownInEngineButMissingFromGameDump', true),
    showHoverSourceProvenance: config.get('showHoverSourceProvenance', true),
    showDumpValuesAsInlayHints: config.get('showDumpValuesAsInlayHints', true),
    maxCompletionItems: config.get('maxCompletionItems', 100),
    completionMatchMode: config.get('completion.matchMode', 'smart'),
    completionFuzzyFallback: config.get('completion.fuzzyFallback', false),
    debugCompletions: config.get('debug.completions', false),
    schemaSearchPaths: config.get('schemaSearchPaths', ['.ini-lab/schemas', 'schemas/examples']),
    defaultIniSections: config.get('defaultIniSections', [
      'SystemSettings',
      '/Script/Engine.RendererSettings',
      '/Script/Engine.Engine',
      '/Script/Engine.GameUserSettings'
    ]),
    assumeUnrealSyntax: config.get('assumeUnrealSyntax', true),
    enableInlineCommentParsing: config.get('enableInlineCommentParsing', true)
  };
}

export async function updateSchemaStack(schemaStack: string[], scope?: vscode.ConfigurationScope): Promise<void> {
  await vscode.workspace
    .getConfiguration('iniTweakLab', scope)
    .update('schemaStack', schemaStack, vscode.ConfigurationTarget.Workspace);
}

export function getSchemaStack(scope?: vscode.ConfigurationScope): string[] {
  return vscode.workspace.getConfiguration('iniTweakLab', scope).get<string[]>('schemaStack', []);
}

export function workspaceFolder(uri?: vscode.Uri): vscode.WorkspaceFolder | undefined {
  return workspaceFolderForUri(uri);
}

export function workspaceFolderForUri(uri?: vscode.Uri): vscode.WorkspaceFolder | undefined {
  if (uri) return vscode.workspace.getWorkspaceFolder(uri);
  return activeWorkspaceFolder();
}

export function activeWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri) {
    const activeFolder = vscode.workspace.getWorkspaceFolder(activeUri);
    if (activeFolder) return activeFolder;
  }
  return vscode.workspace.workspaceFolders?.[0];
}

export function activeConfigurationScope(): vscode.Uri | undefined {
  return activeWorkspaceFolder()?.uri ?? vscode.window.activeTextEditor?.document.uri;
}
