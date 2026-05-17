import { describe, expect, it } from 'vitest';
import { isSupportedWorkbenchMessage } from '../src/webview/workbenchMessages';

describe('Workbench webview messages', () => {
  it('accepts supported navigation and CVar messages', () => {
    expect(isSupportedWorkbenchMessage({ command: 'setView', view: 'schemaStack' })).toBe(true);
    expect(isSupportedWorkbenchMessage({ command: 'searchCvars', query: 'lumen' })).toBe(true);
    expect(isSupportedWorkbenchMessage({ command: 'insertCvar', name: 'r.Lumen.Reflections.Allow' })).toBe(true);
  });

  it('rejects unsupported commands and invalid payloads', () => {
    expect(isSupportedWorkbenchMessage({ command: 'workbench.action.closeWindow' })).toBe(false);
    expect(isSupportedWorkbenchMessage({ command: 'setView', view: 'unknown' })).toBe(false);
    expect(isSupportedWorkbenchMessage({ command: 'selectEngineVersion', engineVersion: 57 })).toBe(false);
    expect(isSupportedWorkbenchMessage({ command: 'searchCvars', query: 'x'.repeat(1001) })).toBe(false);
    expect(isSupportedWorkbenchMessage({ command: 'insertCvar', name: 'r.Bad${1}' })).toBe(false);
    expect(isSupportedWorkbenchMessage({ command: 'insertCvar', name: `r.${'x'.repeat(501)}` })).toBe(false);
    expect(isSupportedWorkbenchMessage(null)).toBe(false);
  });
});
