import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('VS Code feature adapters performance safety', () => {
  it('debounces diagnostics updates and clears pending work on close/dispose', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/features/diagnostics.ts'), 'utf8');

    expect(source).toContain('pendingUpdates');
    expect(source).toContain('setTimeout');
    expect(source).toContain('clearPendingUpdate');
    expect(source).toContain('this.collection.delete(document.uri)');
  });

  it('checks cancellation and avoids full-document parsing before line-only completion contexts', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/features/completion.ts'), 'utf8');

    expect(source).toContain('token.isCancellationRequested');
    expect(source).toContain('getLineCompletionContext(fullLine, position.character)');
    expect(source).toContain('findKeyFromCurrentLine');
  });
});
