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

export function getConfig(): IniTweakLabConfig {
  const config = vscode.workspace.getConfiguration('iniTweakLab');
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

export async function updateSchemaStack(schemaStack: string[]): Promise<void> {
  await vscode.workspace
    .getConfiguration('iniTweakLab')
    .update('schemaStack', schemaStack, vscode.ConfigurationTarget.Workspace);
}

export function workspaceFolder(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}
