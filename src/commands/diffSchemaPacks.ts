import * as vscode from 'vscode';
import { diffSchemaPacks as diffSchemaPacksCore, renderSchemaDiffMarkdown } from '../core/schemaDiff';
import type { LoadedSchemaPack } from '../core/schemaTypes';
import type { SchemaStorage } from '../storage/schemaStorage';
import type { WorkbenchController } from '../webview/uiViewProvider';
import { activeScopeUri, runStorageCommandWithErrorHandling } from './commandUtils';

export async function diffSchemaPacks(storage: SchemaStorage, workbench: WorkbenchController): Promise<void> {
  await runStorageCommandWithErrorHandling(storage, 'Diff Schema Packs', async () => {
    const scope = activeScopeUri();
    const packs = storage
      .registryFor(scope)
      .getPacks()
      .sort((a, b) => b.priority - a.priority);
    if (packs.length < 2) {
      workbench.setWorkbenchResult({
        kind: 'error',
        title: 'Schema diff unavailable',
        markdown: 'Load at least two schema packs before running a schema diff.'
      });
      await workbench.focusWorkbench('actions');
      return;
    }

    const before = await pickPack('Select the older/base schema pack', packs);
    if (!before) return;
    const after = await pickPack(
      'Select the newer/override schema pack',
      packs.filter((pack) => pack !== before)
    );
    if (!after) return;

    const markdown = renderSchemaDiffMarkdown(diffLoadedSchemaPacks(before, after));
    workbench.setWorkbenchResult({ kind: 'diff', title: 'Schema diff', markdown });
    await workbench.focusWorkbench('diff');
  });
}

function diffLoadedSchemaPacks(before: LoadedSchemaPack, after: LoadedSchemaPack) {
  return diffSchemaPacksCore(before.pack, after.pack);
}

async function pickPack(title: string, packs: LoadedSchemaPack[]): Promise<LoadedSchemaPack | undefined> {
  return (
    await vscode.window.showQuickPick(
      packs.map((pack) => ({
        label: pack.pack.displayName,
        description: [pack.role, pack.pack.target?.engineVersion ? `UE ${pack.pack.target.engineVersion}` : undefined]
          .filter(Boolean)
          .join(' | '),
        detail: `${Object.keys(pack.pack.cvars).length} CVars - ${pack.path}`,
        pack
      })),
      { title }
    )
  )?.pack;
}
