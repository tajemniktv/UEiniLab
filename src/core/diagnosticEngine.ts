import type { IniDocument, IniKeyValueNode } from './iniAst';
import { looksLikeUnrealCvar } from './profiles';
import type { SchemaRegistry } from './schemaRegistry';
import { validateCvarValue } from './valueInference';

const duplicateAllowedKeys = new Set(['paths', 'historybuffer']);

export type IniDiagnosticSeverity = 'error' | 'warning' | 'information';
export type IniDiagnosticCode =
  | 'malformed-line'
  | 'duplicate-key'
  | 'conflicting-duplicate'
  | 'unknown-cvar'
  | 'type-mismatch'
  | 'invalid-enum'
  | 'engine-only'
  | 'suspicious-section'
  | 'same-as-default'
  | 'same-as-current';

export interface DiagnosticOptions {
  warnUnknownCvars: boolean;
  warnDuplicateKeys: boolean;
  warnTypeMismatches: boolean;
  warnKnownInEngineButMissingFromGameDump: boolean;
}

export interface IniDiagnostic {
  code: IniDiagnosticCode;
  severity: IniDiagnosticSeverity;
  message: string;
  line: number;
  startOffset: number;
  endOffset: number;
  node?: IniKeyValueNode;
  suggestions?: string[];
}

export function analyzeIniDocument(
  document: IniDocument,
  registry: SchemaRegistry,
  options: DiagnosticOptions
): IniDiagnostic[] {
  const diagnostics: IniDiagnostic[] = [];

  for (const invalid of document.invalid) {
    if (isIncompleteKeyCandidate(invalid.raw)) {
      continue;
    }
    diagnostics.push({
      code: 'malformed-line',
      severity: 'warning',
      message: invalid.reason,
      line: invalid.line,
      startOffset: invalid.startOffset,
      endOffset: invalid.endOffset
    });
  }

  if (options.warnDuplicateKeys) {
    diagnostics.push(...findDuplicateDiagnostics(document.keyValues));
  }

  for (const node of document.keyValues) {
    const resolved = registry.lookup(node.key);
    if (!resolved) {
      if (options.warnUnknownCvars && looksLikeUnrealCvar(node.key)) {
        const suggestions = registry.fuzzy(node.key, 3).map((entry) => entry.name);
        diagnostics.push({
          code: 'unknown-cvar',
          severity: 'warning',
          message:
            suggestions.length > 0
              ? `Unknown CVar "${node.key}". Did you mean ${suggestions.join(', ')}?`
              : `Unknown CVar "${node.key}".`,
          line: node.line,
          startOffset: node.keyRange.start,
          endOffset: node.keyRange.end,
          node,
          suggestions
        });
      }
      continue;
    }

    if (options.warnTypeMismatches) {
      const valueResult = validateCvarValue(resolved.entry, node.value);
      if (!valueResult.ok && valueResult.code) {
        diagnostics.push({
          code: valueResult.code,
          severity: 'warning',
          message: `${node.key}: ${valueResult.message}`,
          line: node.line,
          startOffset: node.valueRange.start,
          endOffset: node.valueRange.end,
          node
        });
      }
    }

    if (
      options.warnKnownInEngineButMissingFromGameDump &&
      registry.isKnownInLowerLayerOnly(node.key, 'game')
    ) {
      diagnostics.push({
        code: 'engine-only',
        severity: 'information',
        message: `${node.key} is known from an engine/base schema but is missing from the active game dump.`,
        line: node.line,
        startOffset: node.keyRange.start,
        endOffset: node.keyRange.end,
        node
      });
    }

    const sections = resolved.entry.iniSections ?? [];
    if (sections.length > 0 && node.section && !sections.includes(node.section)) {
      diagnostics.push({
        code: 'suspicious-section',
        severity: 'information',
        message: `${node.key} is usually used in: ${sections.join(', ')}.`,
        line: node.line,
        startOffset: node.keyRange.start,
        endOffset: node.keyRange.end,
        node
      });
    }
  }

  return diagnostics;
}

function findDuplicateDiagnostics(nodes: IniKeyValueNode[]): IniDiagnostic[] {
  const byScope = new Map<string, IniKeyValueNode[]>();
  for (const node of nodes) {
    if (duplicateAllowedKeys.has(node.key.toLowerCase())) {
      continue;
    }
    const key = `${node.section ?? '<root>'}\u0000${node.key.toLowerCase()}`;
    const list = byScope.get(key) ?? [];
    list.push(node);
    byScope.set(key, list);
  }

  const diagnostics: IniDiagnostic[] = [];
  for (const duplicates of byScope.values()) {
    if (duplicates.length < 2) continue;
    const distinctValues = new Set(duplicates.map((node) => node.value));
    for (const node of duplicates.slice(1)) {
      diagnostics.push({
        code: 'duplicate-key',
        severity: 'information',
        message: `Duplicate key "${node.key}" in this section.`,
        line: node.line,
        startOffset: node.keyRange.start,
        endOffset: node.keyRange.end,
        node
      });
      if (distinctValues.size > 1) {
        diagnostics.push({
          code: 'conflicting-duplicate',
          severity: 'warning',
          message: `Duplicate key "${node.key}" has conflicting values in this section.`,
          line: node.line,
          startOffset: node.keyRange.start,
          endOffset: node.keyRange.end,
          node
        });
      }
    }
  }
  return diagnostics;
}

function isIncompleteKeyCandidate(raw: string): boolean {
  return /^\s*[+\-!]?[A-Za-z_][\w.:-]*\s*$/.test(raw);
}
