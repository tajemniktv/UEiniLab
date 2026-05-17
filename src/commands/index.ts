import * as vscode from 'vscode';
import type { IniDiagnostics } from '../features/diagnostics';
import type { SchemaStorage } from '../storage/schemaStorage';
import { commentOutSelectedTweaks } from './commentOutTweaks';
import { createWorkspaceSchema } from './createWorkspaceSchema';
import { explainSelectedSetting } from './explainSelectedSetting';
import { generateReport } from './generateReport';
import { generateUnrealRendererBlock } from './generateUnrealRendererBlock';
import { importCvarDump } from './importCvarDump';
import { importSchemaFile } from './importSchema';
import { openSchemaStack } from './openSchemaStack';
import { searchActiveCvars } from './searchCvars';
import { selectEngineVersion } from './selectEngineVersion';
import { sortCurrentSection } from './sortCurrentSection';
import { validateCurrentFile } from './validateCurrentFile';

export function registerCommands(context: vscode.ExtensionContext, storage: SchemaStorage, diagnostics: IniDiagnostics): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('iniTweakLab.importCvarDump', () =>
      requireWorkspaceTrust('import CVar dumps', () => importCvarDump(storage))
    ),
    vscode.commands.registerCommand('iniTweakLab.importSchemaFile', () =>
      requireWorkspaceTrust('import schema files', () => importSchemaFile(storage))
    ),
    vscode.commands.registerCommand('iniTweakLab.validateCurrentFile', () => validateCurrentFile(diagnostics)),
    vscode.commands.registerCommand('iniTweakLab.generateTweakReport', () => generateReport(storage)),
    vscode.commands.registerCommand('iniTweakLab.explainSelectedSetting', () => explainSelectedSetting(storage)),
    vscode.commands.registerCommand('iniTweakLab.compareCurrentIniAgainstActiveSchema', () => generateReport(storage)),
    vscode.commands.registerCommand('iniTweakLab.openSchemaStack', () => openSchemaStack(storage)),
    vscode.commands.registerCommand('iniTweakLab.selectEngineVersion', (engineVersion?: string) =>
      requireWorkspaceTrust('update the active schema stack', () => selectEngineVersion(storage, engineVersion))
    ),
    vscode.commands.registerCommand('iniTweakLab.createWorkspaceSchema', () =>
      requireWorkspaceTrust('create workspace schema files', () => createWorkspaceSchema(storage))
    ),
    vscode.commands.registerCommand('iniTweakLab.generateUnrealRendererBlock', generateUnrealRendererBlock),
    vscode.commands.registerCommand('iniTweakLab.sortCurrentSection', sortCurrentSection),
    vscode.commands.registerCommand('iniTweakLab.commentOutSelectedTweaks', commentOutSelectedTweaks),
    vscode.commands.registerCommand('iniTweakLab.searchActiveCVars', () => searchActiveCvars(storage))
  );
}

async function requireWorkspaceTrust(action: string, callback: () => Promise<void>): Promise<void> {
  if (!vscode.workspace.isTrusted) {
    void vscode.window.showWarningMessage(`Trust this workspace to ${action}.`);
    return;
  }
  await callback();
}
