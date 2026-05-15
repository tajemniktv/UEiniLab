import * as vscode from 'vscode';

export async function commentOutSelectedTweaks(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const selection = editor.selection;
  await editor.edit((edit) => {
    for (let line = selection.start.line; line <= selection.end.line; line++) {
      const text = editor.document.lineAt(line).text;
      if (text.trim() && !text.trimStart().startsWith(';')) {
        edit.insert(new vscode.Position(line, 0), '; ');
      }
    }
  });
}
