export type WorkbenchView = 'overview' | 'cvars' | 'schemaStack' | 'report' | 'diff' | 'explain' | 'actions';

export type WorkbenchResult = {
  kind: 'report' | 'diff' | 'explain' | 'error';
  title: string;
  markdown: string;
};

export type WorkbenchMessage =
  | { command: 'setView'; view: WorkbenchView }
  | { command: 'selectEngineVersion'; engineVersion?: string }
  | { command: 'searchCvars'; query?: string }
  | { command: 'insertCvar'; name: string }
  | { command: 'generateReport' }
  | { command: 'showDiff' }
  | { command: 'explainSelection' }
  | { command: 'runCommand'; extensionCommand: string };

export const WORKBENCH_VIEWS: readonly WorkbenchView[] = [
  'overview',
  'cvars',
  'schemaStack',
  'report',
  'diff',
  'explain',
  'actions'
];

export const WORKBENCH_RUN_COMMANDS: ReadonlySet<string> = new Set([
  'iniTweakLab.importCvarDump',
  'iniTweakLab.importSchemaFile',
  'iniTweakLab.createWorkspaceSchema',
  'iniTweakLab.validateCurrentFile',
  'iniTweakLab.generateUnrealRendererBlock',
  'iniTweakLab.sortCurrentSection',
  'iniTweakLab.commentOutSelectedTweaks'
] as const);

export function isWorkbenchView(value: unknown): value is WorkbenchView {
  return typeof value === 'string' && WORKBENCH_VIEWS.includes(value as WorkbenchView);
}

export function isSupportedWorkbenchMessage(message: unknown): message is WorkbenchMessage {
  if (!message || typeof message !== 'object') return false;
  const candidate = message as {
    command?: unknown;
    engineVersion?: unknown;
    extensionCommand?: unknown;
    name?: unknown;
    query?: unknown;
    view?: unknown;
  };
  if (typeof candidate.command !== 'string') return false;
  switch (candidate.command) {
    case 'setView':
      return isWorkbenchView(candidate.view);
    case 'selectEngineVersion':
      return candidate.engineVersion === undefined || typeof candidate.engineVersion === 'string';
    case 'searchCvars':
      return candidate.query === undefined || typeof candidate.query === 'string';
    case 'insertCvar':
      return typeof candidate.name === 'string' && candidate.name.length > 0;
    case 'generateReport':
    case 'showDiff':
    case 'explainSelection':
      return true;
    case 'runCommand':
      return typeof candidate.extensionCommand === 'string' && WORKBENCH_RUN_COMMANDS.has(candidate.extensionCommand);
    default:
      return false;
  }
}
