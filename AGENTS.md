# AGENTS.md

Guidance for coding agents working in this workspace.

## Project

This repository is a VS Code extension named **Taj's UE ini Lab**. It provides schema-backed intelligence for Unreal Engine and game `.ini` tweak files:

- custom language id: `ini-tweak`
- tolerant Unreal-aware INI parser
- JSONC CVar schema packs
- layered schema registry: workspace/user > game dump > engine base > generic/example
- hover, completion, diagnostics, inlay hints, code actions, reports, and schema UI

Use the VS Code Extension API directly. Do not introduce an LSP unless the change explicitly needs it and the core modules are kept portable.

## Commands

Run these before claiming work is complete:

```bash
npm run compile
npm test -- --run
npm run lint
```

Useful development commands:

```bash
npm install
npm run watch
npm run generate:epic-schemas
```

Launch/debug through VS Code with `.vscode/launch.json` using **Run Extension**.

## Architecture Map

- `src/extension.ts`: extension activation and provider registration.
- `src/core/`: pure engine logic. Keep this independent from VS Code APIs where possible.
  - `iniParser.ts`, `iniAst.ts`: tolerant parser and AST.
  - `schemaTypes.ts`, `schemaLoader.ts`, `schemaMerge.ts`, `schemaRegistry.ts`: schema validation/loading/layering.
  - `hoverText.ts`, `completionEngine.ts`, `completionContext.ts`, `diagnosticEngine.ts`, `reportBuilder.ts`: testable feature logic.
- `src/features/`: VS Code providers that adapt core logic.
- `src/commands/`: command handlers.
- `src/importers/`: dump and documentation import parsers.
- `src/storage/`: workspace config, schema storage, bundled schema discovery.
- `src/webview/`: schema stack panel and activity bar Workbench.
- `syntaxes/`, `snippets/`, `language-configuration.json`: language assets.
- `schemas/`: bundled schema files and schema metadata.
- `test/`: Vitest tests for pure logic and manifest contracts.

## Important Extension Gotchas

- `package.json.main` must point to an emitted file. Current contract:
  - `main`: `./dist/extension.js`
  - `tsconfig.compilerOptions.rootDir`: `src`
  - `tsconfig.compilerOptions.outDir`: `dist`
- `npm run compile` cleans `dist` before compiling. Do not depend on stale emitted files.
- Activity bar webview views need activation. Keep `onView:iniTweakLab.panel` in `activationEvents`.
- Register `IniTweakLabViewProvider` early in `activate()` before expensive schema loading.
- Bundled base schema paths like `schemas/ue5.7-base.cvars.jsonc` must resolve relative to the extension install path, not the user workspace.
- Workspace/game schema paths like `.ini-lab/schemas/foo.cvars.jsonc` should resolve relative to the current workspace.

## Schema Layering Rules

The intended priority order is:

1. workspace/user override schemas
2. game/build dump schemas
3. Unreal Engine version base schema
4. generic/example schema
5. heuristics

Higher-priority entries should override only the fields they provide. Lower-priority schemas should still fill missing fields such as `defaultValue`, `knownValues`, `iniSections`, notes, and docs help.

Do not flatten provenance away. Hovers and reports rely on `ResolvedCvarEntry.sources`.

## Bundled Base Schemas

Bundled Unreal Engine base schemas are generated from rendered Epic Developer Community HTML exports:

- `schemas/ue5.4-base.cvars.jsonc`
- `schemas/ue5.5-base.cvars.jsonc`
- `schemas/ue5.6-base.cvars.jsonc`
- `schemas/ue5.7-base.cvars.jsonc`

The source HTML exports live under `SchemaSource/Epic/<version>/`. Regenerate bundled schemas with:

```bash
npm run generate:epic-schemas
```

The Epic HTML parser must parse every table under each category heading, not just the first table. This previously caused missing CVars like `r.TSR.*`, `r.SSR.HalfResSceneColor`, and `r.Lumen.Reflections.DownsampleFactor`.

Epic docs are not a complete runtime dump. Game/plugin/runtime CVars can still be absent from base schemas. Use game dumps for those.

## Completion Policy

Do not rely on VS Code fuzzy filtering as the CVar search engine. The extension must pre-filter and rank CVar completions itself, then set explicit item ranges/filter text/sort text.

Current intended behavior:

- `iniTweakLab.completion.matchMode` defaults to `smart`.
- `strictPrefix` returns only canonical case-insensitive `startsWith` matches.
- `smart` returns exact prefix matches first, namespace-aware token matches second, and contains-token matches third.
- `fuzzy` or `iniTweakLab.completion.fuzzyFallback` may add typo fallback, but fuzzy results must remain clearly lower priority and should not pollute normal typing.
- Completion lists for key prefixes should be returned as incomplete so VS Code recomputes on further typing.
- Completion ranges must cover the whole typed CVar token, not only the segment after the final dot.
- Unreal operators `+`, `-`, and `!` must remain outside the replacement range.
- Comments and section headers should not trigger CVar key completions.

Important examples:

- `r.Shader` must not return `r.Shadow.*`.
- `r.Shadow` should return `r.Shadow.*`.
- `r.Lumen` should return `r.Lumen.*` first and may return related `Lumen` token matches such as `r.Scene.LumenSomething` lower down.
- Bare `lumen` may search token matches across namespaces.
- Short ambiguous terms such as `r.shad` should remain prefix-driven.

When changing completions, update:

- `src/core/completionEngine.ts`
- `src/core/completionContext.ts`
- `src/features/completion.ts`
- `test/hoverCompletion.test.ts`
- `test/completionContext.test.ts`

Use `iniTweakLab.debug.completions` for runtime troubleshooting. It writes detected prefixes, ranges, candidate counts, and the first candidates to the **INI Tweak Lab Completions** output channel.

## Importer Notes

UUU-style JSON dumps commonly use:

- `Helptext`
- `type` values such as `Int32`, `Boolean`, `Command`
- `value`
- `Flags`, often `SetByConstructor`, `SetByScalability`, etc.

The importer should preserve help text, normalize type names, preserve flags, and label provenance as a game dump.

Raw text/log dump importers are best effort. Do not claim exact parsing unless tests prove it.

## Diagnostics Policy

Unreal config is permissive. Prefer warnings/information over errors.

Known noisy keys:

- duplicate `Paths=` should not warn
- duplicate `HistoryBuffer=` should not warn
- incomplete typed keys such as `r.shad` should not produce malformed-line diagnostics while the user is completing them

Unknown CVar diagnostics should be limited to CVar-looking keys.

## UI

The activity bar view id is `iniTweakLab.panel`. It should show:

- active base schema
- active CVar count
- bundled UE version buttons
- active schema stack
- buttons for all extension commands

The standalone schema stack panel is opened by **INI Tweak Lab: Open Schema Stack** and should remain useful for inspecting schema paths, priority, and CVar counts.

## Language Association

Do not broadly take over every `.ini` file by default.

Auto-associated files should remain Unreal-focused, such as:

- `Engine.ini`
- `GameUserSettings.ini`
- `Scalability.ini`
- `Game.ini`
- default Unreal config filenames
- `.engineini`
- `.gameini`

Users can manually select **INI Tweak** for additional files.

## Coding Standards

- TypeScript strict mode is enabled.
- Keep core modules free of VS Code imports unless there is a strong reason.
- Prefer adding tests before changing behavior.
- Use `apply_patch` for manual file edits.
- Do not rewrite generated schema files by hand; update the generator/importer and regenerate.
- Keep user-facing messages professional and clear.
- Avoid broad refactors unrelated to the requested change.

## Test Coverage Expectations

When changing behavior, add or update tests in `test/`:

- parser behavior: `iniParser.test.ts`
- schema merge/registry: `schemaMerge.test.ts`, `schemaRegistry.test.ts`
- diagnostics: `diagnostics.test.ts`
- importer behavior: `importers.test.ts`, `epicCvarReferenceHtmlParser.test.ts`
- hover/completion pure output: `hoverCompletion.test.ts`
- manifest/view/activation contracts: `packageManifest.test.ts`
- bundled schema discovery: `bundledSchemas.test.ts`
- completion context/ranges: `completionContext.test.ts`

## Current Known Limitations

- Epic base schemas come from public docs and do not cover all runtime/game/plugin CVars.
- No LSP yet.
- Webview UI is intentionally lightweight.
- Raw DumpConsoleCommands parsing remains best effort.
