import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('extension package manifest', () => {
  it('keeps package main aligned with the TypeScript output layout', async () => {
    const packageJson = JSON.parse(await readFile(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      main: string;
      contributes: { languages: Array<{ id: string; extensions?: string[]; filenames?: string[] }> };
    };
    const tsconfig = JSON.parse(await readFile(resolve(process.cwd(), 'tsconfig.json'), 'utf8')) as {
      compilerOptions: { rootDir: string; outDir: string };
    };

    expect(packageJson.main).toBe('./dist/extension.js');
    expect(tsconfig.compilerOptions.rootDir).toBe('src');
    expect(tsconfig.compilerOptions.outDir).toBe('dist');
  });

  it('auto-associates only known Unreal INI filenames while preserving manual language selection', async () => {
    const packageJson = JSON.parse(await readFile(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      contributes: { languages: Array<{ id: string; extensions?: string[]; filenames?: string[] }> };
    };
    const language = packageJson.contributes.languages.find((item) => item.id === 'ini-tweak');

    expect(language?.extensions).not.toContain('.ini');
    expect(language?.filenames).toEqual(
      expect.arrayContaining(['Engine.ini', 'GameUserSettings.ini', 'Scalability.ini', 'Game.ini'])
    );
  });

  it('contributes the Unreal Engine version selection command', async () => {
    const packageJson = JSON.parse(await readFile(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      activationEvents: string[];
      contributes: { commands: Array<{ command: string; title: string }> };
    };

    expect(packageJson.activationEvents).toContain('onCommand:iniTweakLab.selectEngineVersion');
    expect(packageJson.contributes.commands).toContainEqual({
      command: 'iniTweakLab.selectEngineVersion',
      title: 'INI Tweak Lab: Select Unreal Engine Version'
    });
  });

  it('contributes a dedicated activity bar view for the extension UI', async () => {
    const packageJson = JSON.parse(await readFile(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      activationEvents: string[];
      contributes: {
        viewsContainers: { activitybar: Array<{ id: string; title: string; icon: string }> };
        views: Record<string, Array<{ id: string; name: string }>>;
      };
    };

    expect(packageJson.contributes.viewsContainers.activitybar).toContainEqual({
      id: 'iniTweakLab',
      title: 'INI Tweak Lab',
      icon: 'resources/activity-icon.svg'
    });
    expect(packageJson.contributes.views.iniTweakLab).toContainEqual({
      id: 'iniTweakLab.panel',
      name: 'Workbench'
    });
    expect(packageJson.activationEvents).toContain('onView:iniTweakLab.panel');
  });
});
