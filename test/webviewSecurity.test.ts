import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('activity bar webview security', () => {
  it('renders with CSP, nonce-gated inline assets, and no local resource roots', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/webview/uiViewProvider.ts'), 'utf8');

    expect(source).toContain("localResourceRoots: []");
    expect(source).toContain('Content-Security-Policy');
    expect(source).toContain("style-src 'nonce-");
    expect(source).toContain("script-src 'nonce-");
    expect(source).toContain('<style nonce="${nonce}">');
    expect(source).toContain('<script nonce="${nonce}">');
  });

  it('validates posted messages against an explicit command allowlist', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/webview/uiViewProvider.ts'), 'utf8');

    expect(source).toContain('SUPPORTED_WEBVIEW_COMMANDS');
    expect(source).toContain('isSupportedWebviewMessage');
    expect(source).not.toContain('executeCommand(message.command)');
  });
});
