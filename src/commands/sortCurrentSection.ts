import * as vscode from 'vscode';
import { parseIni } from '../core/iniParser';

export async function sortCurrentSection(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const parsed = parseIni(editor.document.getText());
  const cursorLine = editor.selection.active.line;
  const section = [...parsed.sections].reverse().find((candidate) => candidate.line <= cursorLine);
  const startLine = section ? section.line + 1 : 0;
  const nextSection = parsed.sections.find((candidate) => candidate.line > startLine);
  const endLine = nextSection ? nextSection.line - 1 : editor.document.lineCount - 1;
  const lines = [];
  for (let line = startLine; line <= endLine; line++) lines.push(editor.document.lineAt(line).text);
  const sorted = [...lines].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  await editor.edit((edit) => {
    edit.replace(new vscode.Range(new vscode.Position(startLine, 0), editor.document.lineAt(endLine).range.end), sorted.join('\n'));
  });
}

function sortKey(line: string): string {
  const match = line.match(/^\s*[+\-!]?\s*([^=]+)/);
  return match?.[1]?.trim().toLowerCase() ?? line.toLowerCase();
}
