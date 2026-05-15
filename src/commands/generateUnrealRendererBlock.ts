import * as vscode from 'vscode';

export async function generateUnrealRendererBlock(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  await editor.insertSnippet(
    new vscode.SnippetString(
      [
        '[/Script/Engine.RendererSettings]',
        'r.DynamicGlobalIlluminationMethod=${1:1}',
        'r.ReflectionMethod=${2:1}',
        'r.Shadow.Virtual.Enable=${3:1}',
        '',
        '[SystemSettings]',
        'r.Lumen.Reflections.Allow=${4:1}',
        'r.Nanite.ProjectEnabled=${5:1}'
      ].join('\n')
    )
  );
}
