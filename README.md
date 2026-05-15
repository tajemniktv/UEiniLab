# Taj's UE ini Lab

Taj's UE ini Lab is a VS Code extension for working on Unreal Engine and game `.ini` tweak files. It provides a custom `ini-tweak` language mode, tolerant Unreal-aware parsing, schema-backed CVar documentation, completions, diagnostics, inlay hints, import tools, and reports.

## Quick Start

1. Run `npm install`.
2. Run `npm run compile`.
3. Press `F5` in VS Code and choose **Run Extension**.
4. Open `examples/Engine.ini`.
5. Set the language mode to **INI Tweak** if VS Code did not select it automatically.
6. Use **INI Tweak Lab: Select Unreal Engine Version** or the **INI Tweak Lab** activity bar view to choose a bundled UE base schema.
7. Hover a known key such as `r.DynamicGlobalIlluminationMethod`.

If no workspace schema stack is configured, the extension loads the newest bundled `schemas/ue<version>-base.cvars.jsonc` schema it can find. The tiny example schema is only a last-resort fallback.

## Features

- Language registration for known Unreal config filenames such as `Engine.ini`, `GameUserSettings.ini`, `Scalability.ini`, and `Game.ini`, plus `.engineini` and `.gameini`, with language id `ini-tweak`. Other files can still use the extension by manually selecting **INI Tweak** as the language mode.
- TextMate highlighting for sections, Unreal object sections, CVar-looking keys, assignments, values, comments, and `+Key`, `-Key`, `!Key` array mutation syntax.
- Tolerant parser with AST nodes for sections, key-values, comments, blanks, and invalid lines.
- JSONC schema packs with runtime validation through `zod`.
- Layered schema resolution: user/workspace, game dump, engine schema, generic schema, then heuristics.
- Hover documentation with type, default value, current dump value, user value, help, known values, sections, notes, and provenance.
- Smart completions for CVar names, sections, boolean/enum values, and common snippets. CVar completions are ranked by exact prefix first, namespace/token matches second, and optional fuzzy fallback last.
- Diagnostics for malformed lines, duplicates, conflicting duplicates, unknown CVar-looking keys, typo suggestions, type mismatches, invalid enum values, suspicious sections, and engine-known/game-missing entries.
- Inlay hints for type/default/dump values.
- Quick fixes for typo replacement, boolean normalization, inserting default/current values, commenting tweaks, and generating schema-help comments.
- Dedicated **INI Tweak Lab** activity bar Workbench showing the active base schema, schema stack, CVar count, bundled UE version buttons, and extension command shortcuts.
- Commands for importing dumps/schema files, selecting bundled UE base schemas, validating, reports, schema stack viewing, workspace schema creation, renderer block generation, section sorting, commenting selections, explaining settings, and searching active CVars.

## Importing CVar Dumps

Use **INI Tweak Lab: Import CVar Dump** and select a dump file. The importer accepts:

- Existing INI Tweak Lab schema JSON/JSONC.
- JSON object or array dumps, including common UUU-style objects such as `UUU_CVarsDump.json`. UUU `Helptext`, `type`, `value`, and `Flags` fields are normalized when present.
- Best-effort `DumpConsoleCommands` text/log lines.
- Simple fallback line-based text.

Imported files are written to `.ini-lab/schemas/<name>.cvars.jsonc` and added to `iniTweakLab.schemaStack`.

Dump formats vary. The importer preserves best-effort fields and labels imported provenance, but you should review generated schema files before treating them as authoritative.

## Schema Stack

Set `iniTweakLab.schemaStack` in workspace settings. Higher priority files should appear first:

```jsonc
{
  "iniTweakLab.schemaStack": [
    ".ini-lab/schemas/workspace-overrides.cvars.jsonc",
    ".ini-lab/schemas/subnautica2.cvars.jsonc",
    "schemas/examples/ue5-base.example.cvars.jsonc"
  ]
}
```

Sparse high-priority entries override only the fields they provide. Lower-priority schemas can still supply help text, default values, known values, notes, and suggested sections.

Bundled base schemas can be selected from **INI Tweak Lab: Select Unreal Engine Version**, **INI Tweak Lab: Open Schema Stack**, or the **INI Tweak Lab** activity bar Workbench. Selecting a base schema updates the workspace schema stack while preserving higher-priority game dump and workspace override schemas above it.

Current bundled base schemas are generated from Epic Developer Community HTML exports:

- `schemas/ue5.4-base.cvars.jsonc`
- `schemas/ue5.5-base.cvars.jsonc`
- `schemas/ue5.6-base.cvars.jsonc`
- `schemas/ue5.7-base.cvars.jsonc`

The source HTML files are kept in `SchemaSource/Epic/<version>/` so schema generation is reproducible from files in the repository.

## Schema Format

Schemas are JSONC and support comments/trailing commas:

```jsonc
{
  "schemaVersion": 1,
  "id": "ue5.5-base",
  "displayName": "Unreal Engine 5.5 Base CVars",
  "target": {
    "engine": "Unreal Engine",
    "engineVersion": "5.5",
    "game": null,
    "gameBuild": null
  },
  "generatedFrom": {
    "source": "DumpConsoleCommands",
    "generatedAt": "2026-05-15T00:00:00Z"
  },
  "cvars": {
    "r.DynamicGlobalIlluminationMethod": {
      "name": "r.DynamicGlobalIlluminationMethod",
      "kind": "variable",
      "type": "int",
      "defaultValue": "1",
      "currentValue": "1",
      "help": "Selects the dynamic global illumination method.",
      "category": "Rendering / Global Illumination",
      "knownValues": {
        "0": "Disabled",
        "1": "Lumen",
        "2": "Screen Space"
      },
      "iniSections": ["SystemSettings", "/Script/Engine.RendererSettings"],
      "notes": ["May be overridden by project renderer settings or scalability."],
      "sources": [{ "type": "engine-dump", "label": "UE 5.5 DumpConsoleCommands" }]
    }
  }
}
```

## Settings

- `iniTweakLab.profile`
- `iniTweakLab.schemaStack`
- `iniTweakLab.enableDiagnostics`
- `iniTweakLab.warnUnknownCvars`
- `iniTweakLab.warnDuplicateKeys`
- `iniTweakLab.warnTypeMismatches`
- `iniTweakLab.warnKnownInEngineButMissingFromGameDump`
- `iniTweakLab.showHoverSourceProvenance`
- `iniTweakLab.showDumpValuesAsInlayHints`
- `iniTweakLab.maxCompletionItems`
- `iniTweakLab.completion.matchMode`
  - `strictPrefix`: only canonical `startsWith` CVar matches.
  - `smart`: exact prefix matches first, then namespace-aware token matches, then contains-token matches.
  - `fuzzy`: smart matching plus fuzzy fallback.
- `iniTweakLab.completion.fuzzyFallback`
- `iniTweakLab.debug.completions`
- `iniTweakLab.schemaSearchPaths`
- `iniTweakLab.defaultIniSections`
- `iniTweakLab.assumeUnrealSyntax`
- `iniTweakLab.enableInlineCommentParsing`

Completion behavior is intentionally handled by the extension, not left to VS Code fuzzy filtering. For example, `r.Shader` should not show `r.Shadow.*`, while `r.Lumen` can show exact `r.Lumen.*` matches first and related `Lumen` token matches lower in the list. Enable `iniTweakLab.debug.completions` to inspect detected prefixes, ranges, and candidate lists in the **INI Tweak Lab Completions** output channel.

## Commands

- **INI Tweak Lab: Import CVar Dump**
- **INI Tweak Lab: Import Schema File**
- **INI Tweak Lab: Validate Current File**
- **INI Tweak Lab: Generate Tweak Report**
- **INI Tweak Lab: Explain Selected Setting**
- **INI Tweak Lab: Compare Current INI Against Active Schema**
- **INI Tweak Lab: Open Schema Stack**
- **INI Tweak Lab: Select Unreal Engine Version**
- **INI Tweak Lab: Create Workspace Schema**
- **INI Tweak Lab: Generate Unreal Renderer Block**
- **INI Tweak Lab: Sort Current Section**
- **INI Tweak Lab: Comment Out Selected Tweaks**
- **INI Tweak Lab: Search Active CVars**

## Development

```bash
npm install
npm run compile
npm test -- --run
npm run lint
```

Launch an Extension Development Host with the included `.vscode/launch.json`.

## Regenerating Epic Base Schemas

Epic Developer Community HTML exports for **Unreal Engine Console Variables Reference** live under `SchemaSource/Epic/<version>/`. Current source files are:

- `SchemaSource/Epic/5.4/Unreal Engine Console Variables Reference _ Unreal Engine 5.4 Documentation _ Epic Developer Community.html`
- `SchemaSource/Epic/5.5/Unreal Engine Console Variables Reference _ Unreal Engine 5.5 Documentation _ Epic Developer Community.html`
- `SchemaSource/Epic/5.6/Unreal Engine Console Variables Reference _ Unreal Engine 5.6 Documentation _ Epic Developer Community.html`
- `SchemaSource/Epic/5.7/Unreal Engine Console Variables Reference _ Unreal Engine 5.7 Documentation _ Epic Developer Community.html`

To regenerate bundled base schemas, run:

```bash
npm run generate:epic-schemas
```

The generator recursively reads rendered Epic HTML tables and writes `schemas/ue<version>-base.cvars.jsonc`. You can pass a custom source folder as the first argument if needed.

## Completion Matching

The extension uses explicit CVar-aware matching and returns incomplete completion lists so VS Code recomputes suggestions as you type. The default `smart` mode works as:

1. Exact prefix: `r.Shadow` matches `r.Shadow.MaxResolution`.
2. Namespace token: `r.Lumen` can also match `r.Scene.LumenSomething` because it stays in the `r` namespace and contains a real `Lumen` token.
3. Contains token: `lumen` can find CVar names containing a `Lumen` token across namespaces.
4. Fuzzy fallback: disabled by default, and only intended for explicit typo-search behavior.

Token matching deliberately avoids short ambiguous terms, so partial input such as `r.shad` remains prefix-driven and does not turn into broad contains search.

## Known Limitations

- Raw `DumpConsoleCommands` and arbitrary game dump parsing is best-effort, not exact.
- The CVar browser is currently command/Quick Pick oriented; the Workbench and schema stack webviews are intentionally lightweight.
- Diagnostics are conservative because Unreal config files can rely on project/game-specific behavior.
- There is no LSP yet. The core modules are separated so they can move to an LSP later.
- Epic base schemas are generated from public documentation exports. They are useful as base documentation, but runtime/game/plugin CVars still require game dumps or workspace schemas.

## Roadmap

- Rich CVar browser webview with filters, copy actions, and direct insertion.
- More dump format adapters for specific Unreal tools and game builds.
- Schema conflict viewer and validation diagnostics for schema files.
- Optional LSP backend for very large workspaces.
- More code actions for duplicate handling and section insertion.
