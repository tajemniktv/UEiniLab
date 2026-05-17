import type { WorkbenchController } from '../webview/uiViewProvider';

export async function searchActiveCvars(workbench: WorkbenchController): Promise<void> {
  await workbench.focusWorkbench('cvars');
}
