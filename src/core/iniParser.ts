import type {
  IniBlankNode,
  IniCommentNode,
  IniDocument,
  IniInvalidNode,
  IniKeyValueNode,
  IniNode,
  IniSectionNode
} from './iniAst';

export interface ParseIniOptions {
  enableInlineCommentParsing?: boolean;
}

const sectionPattern = /^\s*\[([^\]\r\n]+)]\s*(?:[;#].*)?$/;
const keyValuePattern = /^(\s*)([+\-!]?)([^=;\r\n#][^=\r\n]*?)\s*=\s*(.*)$/;

export function parseIni(text: string, options: ParseIniOptions = {}): IniDocument {
  const parseInlineComments = options.enableInlineCommentParsing ?? true;
  const nodes: IniNode[] = [];
  let offset = 0;
  let activeSection: string | null = null;
  const lines = splitLinesWithTerminators(text);

  lines.forEach((lineText, line) => {
    const raw = trimLineTerminator(lineText);
    const startOffset = offset;
    const endOffset = offset + raw.length;
    offset += lineText.length;

    if (/^\s*$/.test(raw)) {
      nodes.push({ kind: 'blank', raw, line, startOffset, endOffset } satisfies IniBlankNode);
      return;
    }

    const trimmed = raw.trimStart();
    if (trimmed.startsWith(';') || trimmed.startsWith('#')) {
      const marker = trimmed[0] as ';' | '#';
      nodes.push({
        kind: 'comment',
        raw,
        line,
        startOffset,
        endOffset,
        marker,
        text: trimmed.slice(1).trim()
      } satisfies IniCommentNode);
      return;
    }

    const sectionMatch = raw.match(sectionPattern);
    if (sectionMatch) {
      const name = sectionMatch[1].trim();
      const nameStart = startOffset + raw.indexOf(sectionMatch[1]);
      activeSection = name;
      nodes.push({
        kind: 'section',
        raw,
        line,
        startOffset,
        endOffset,
        name,
        nameRange: { start: nameStart, end: nameStart + sectionMatch[1].length }
      } satisfies IniSectionNode);
      return;
    }

    const keyValueMatch = raw.match(keyValuePattern);
    if (keyValueMatch) {
      const leading = keyValueMatch[1];
      const operatorText = keyValueMatch[2];
      const rawKey = keyValueMatch[3];
      const valueWithComment = keyValueMatch[4] ?? '';
      const key = rawKey.trim();
      const operator = operatorText === '+' || operatorText === '-' || operatorText === '!' ? operatorText : null;
      const keyStartInRaw = leading.length + operatorText.length + rawKey.indexOf(key);
      const valueStartInRaw = raw.indexOf('=', keyStartInRaw) + 1;
      const parsedValue = parseValueAndInlineComment(valueWithComment, parseInlineComments);
      const valueLeadingWhitespace = valueWithComment.length - valueWithComment.trimStart().length;
      const valueStart = startOffset + valueStartInRaw + valueLeadingWhitespace;

      nodes.push({
        kind: 'keyValue',
        raw,
        line,
        startOffset,
        endOffset,
        section: activeSection,
        operator,
        key,
        value: parsedValue.value,
        keyRange: {
          start: startOffset + keyStartInRaw,
          end: startOffset + keyStartInRaw + key.length
        },
        valueRange: {
          start: valueStart,
          end: valueStart + parsedValue.value.length
        },
        inlineComment: parsedValue.inlineComment
      } satisfies IniKeyValueNode);
      return;
    }

    nodes.push({
      kind: 'invalid',
      raw,
      line,
      startOffset,
      endOffset,
      reason: 'Expected a section header, comment, blank line, or key=value assignment.'
    } satisfies IniInvalidNode);
  });

  return {
    text,
    nodes,
    sections: nodes.filter((node): node is IniSectionNode => node.kind === 'section'),
    keyValues: nodes.filter((node): node is IniKeyValueNode => node.kind === 'keyValue'),
    comments: nodes.filter((node): node is IniCommentNode => node.kind === 'comment'),
    invalid: nodes.filter((node): node is IniInvalidNode => node.kind === 'invalid')
  };
}

function splitLinesWithTerminators(text: string): string[] {
  if (text.length === 0) {
    return [];
  }
  return text.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g)?.filter((line, index, all) => {
    return !(line === '' && index === all.length - 1);
  }) ?? [text];
}

function trimLineTerminator(line: string): string {
  return line.replace(/\r?\n$/, '').replace(/\r$/, '');
}

function parseValueAndInlineComment(
  text: string,
  enabled: boolean
): { value: string; inlineComment?: string } {
  if (!enabled) {
    return { value: text.trim() };
  }

  let quote: '"' | "'" | null = null;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const previous = index > 0 ? text[index - 1] : '';
    if ((char === '"' || char === "'") && previous !== '\\') {
      quote = quote === char ? null : quote ?? char;
    }
    if (!quote && (char === ';' || char === '#') && (index === 0 || /\s/.test(previous))) {
      return {
        value: text.slice(0, index).trim(),
        inlineComment: text.slice(index + 1).trim()
      };
    }
  }
  return { value: text.trim() };
}
