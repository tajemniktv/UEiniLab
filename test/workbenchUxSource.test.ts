/// <reference types="node" />
/// <reference types="vitest/globals" />

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Workbench UX source contracts', () => {
  it('updates CVar search results without replacing the whole webview document', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/webview/uiViewProvider.ts'), 'utf8');

    expect(source).toMatch(/case 'searchCvars':[\s\S]*this\.postCvarResults\(\);[\s\S]*return;/);
    expect(source).toContain("command: 'replaceCvarResults'");
    expect(source).toContain("[data-cvar-results]");
  });

  it('keeps result actions available after a result has rendered', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/webview/uiViewProvider.ts'), 'utf8');

    expect(source).toContain('const resultActions');
    expect(source).toMatch(/return `<section class="result">[\s\S]*\$\{action\}[\s\S]*\$\{markdownToHtml/);
  });

  it('offers a reload-window action when a different extension version activates', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/extension.ts'), 'utf8');

    expect(source).toContain('iniTweakLab.lastActivatedVersion');
    expect(source).toContain('workbench.action.reloadWindow');
  });
});
