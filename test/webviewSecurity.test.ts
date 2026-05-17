import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('activity bar webview security', () => {
  it('renders with CSP, nonce-gated inline assets, and no local resource roots', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/webview/uiViewProvider.ts'), 'utf8');

    expect(source).toContain("from 'node:crypto'");
    expect(source).toContain("localResourceRoots: []");
    expect(source).toContain('Content-Security-Policy');
    expect(source).toContain("style-src 'nonce-");
    expect(source).toContain("script-src 'nonce-");
    expect(source).toContain(`<style nonce="\${nonce}">`);
    expect(source).toContain(`<script nonce="\${nonce}">`);
    expect(source).toContain('randomBytes(16)');
    expect(source).not.toContain('Math.random');
  });

  it('validates posted messages against an explicit command allowlist', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/webview/uiViewProvider.ts'), 'utf8');

    expect(source).toContain('WORKBENCH_RUN_COMMANDS');
    expect(source).toContain('isSupportedWorkbenchMessage');
    expect(source).toContain('safeSerializeMessage');
    expect(source).toContain('if (!isSupportedWorkbenchMessage(message))');
    expect(source).toContain('Error handling Workbench message');
    expect(source).not.toContain('executeCommand(message.command)');
  });

  it('updates dynamic CVar search results without assigning raw HTML', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/webview/uiViewProvider.ts'), 'utf8');

    expect(source).toContain('document.createElement');
    expect(source).toContain('textContent');
    expect(source).toContain('replaceChildren');
    expect(source).not.toContain('innerHTML');
  });
});
