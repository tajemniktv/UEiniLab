import type { WorkbenchController } from '../webview/uiViewProvider';

export async function openSchemaStack(workbench: WorkbenchController): Promise<void> {
  await workbench.focusWorkbench('schemaStack');
}
