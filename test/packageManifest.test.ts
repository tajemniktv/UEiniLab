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

  it('builds against ESM dependency entrypoints so bundled extensions do not need node_modules', async () => {
    const esbuildConfig = await readFile(resolve(process.cwd(), 'esbuild.js'), 'utf8');

    expect(esbuildConfig).toContain("mainFields: ['module', 'main']");
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

  it('wires a small VS Code extension-host integration test suite', async () => {
    const packageJson = JSON.parse(await readFile(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(packageJson.devDependencies).toHaveProperty('@vscode/test-cli');
    expect(packageJson.devDependencies).toHaveProperty('@vscode/test-electron');
    expect(packageJson.scripts['test:integration']).toBe('vscode-test --config .vscode-test.mjs');
  });

  it('declares resource scope for settings that can vary by workspace folder or document', async () => {
    const packageJson = JSON.parse(await readFile(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      contributes: { configuration: { properties: Record<string, { scope?: string }> } };
    };
    const properties = packageJson.contributes.configuration.properties;

    for (const setting of [
      'iniTweakLab.schemaStack',
      'iniTweakLab.enableDiagnostics',
      'iniTweakLab.warnUnknownCvars',
      'iniTweakLab.warnDuplicateKeys',
      'iniTweakLab.warnTypeMismatches',
      'iniTweakLab.warnKnownInEngineButMissingFromGameDump',
      'iniTweakLab.showHoverSourceProvenance',
      'iniTweakLab.showDumpValuesAsInlayHints',
      'iniTweakLab.maxCompletionItems',
      'iniTweakLab.completion.matchMode',
      'iniTweakLab.completion.fuzzyFallback',
      'iniTweakLab.schemaSearchPaths',
      'iniTweakLab.defaultIniSections',
      'iniTweakLab.assumeUnrealSyntax',
      'iniTweakLab.enableInlineCommentParsing'
    ]) {
      expect(properties[setting]?.scope, setting).toBe('resource');
    }

    expect(properties['iniTweakLab.debug.completions']?.scope).toBe('window');
  });

  it('declares limited Workspace Trust support and restricts workspace-writing settings', async () => {
    const packageJson = JSON.parse(await readFile(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      capabilities?: {
        untrustedWorkspaces?: {
          supported?: boolean | 'limited';
          restrictedConfigurations?: string[];
        };
      };
    };

    expect(packageJson.capabilities?.untrustedWorkspaces?.supported).toBe('limited');
    expect(packageJson.capabilities?.untrustedWorkspaces?.restrictedConfigurations).toEqual(
      expect.arrayContaining(['iniTweakLab.schemaStack', 'iniTweakLab.schemaSearchPaths'])
    );
  });

  it('keeps packaging focused on runtime extension assets', async () => {
    const ignore = await readFile(resolve(process.cwd(), '.vscodeignore'), 'utf8');
    const rules = ignore
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
    const excluded = rules.filter((line) => !line.startsWith('!'));

    expect(excluded).toContain('src/**');
    expect(excluded).toContain('test/**');
    expect(excluded).toContain('SchemaSource/**');
    expect(excluded).not.toContain('dist/**');
    expect(excluded).not.toContain('schemas/**');
    expect(excluded).not.toContain('resources/**');
  });

  it('has a basic CI workflow for build, tests, lint, and package verification', async () => {
    const workflow = await readFile(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');

    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('npm run compile');
    expect(workflow).toContain('npm test -- --run');
    expect(workflow).toContain('npm run test:integration');
    expect(workflow).toContain('npm run lint');
    expect(workflow).toContain('npm run package:verify');
  });
});
