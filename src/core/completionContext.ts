export interface CompletionTextRange {
  start: number;
  end: number;
}

export interface KeyCompletionContext {
  kind: 'key';
  prefix: string;
  insertRange: CompletionTextRange;
  replaceRange: CompletionTextRange;
}

export interface ValueCompletionContext {
  kind: 'value';
  key: string;
  valuePrefix: string;
  insertRange: CompletionTextRange;
  replaceRange: CompletionTextRange;
}

export type IniCompletionContext = KeyCompletionContext | ValueCompletionContext;

const keyTokenPattern = /[A-Za-z_][\w.:-]*/;

export function getLineCompletionContext(line: string, position: number): IniCompletionContext | undefined {
  const boundedPosition = Math.max(0, Math.min(position, line.length));
  const beforeCursor = line.slice(0, boundedPosition);

  if (/^\s*[;#]/.test(beforeCursor) || /^\s*\[[^\]]*$/.test(beforeCursor)) {
    return undefined;
  }

  const commentStart = findCommentStart(line);
  if (commentStart !== -1 && boundedPosition > commentStart) {
    return undefined;
  }

  const equalsIndex = line.indexOf('=');
  if (equalsIndex !== -1 && boundedPosition > equalsIndex) {
    return getValueCompletionContext(line, boundedPosition, equalsIndex, commentStart);
  }

  return getKeyCompletionContext(line, boundedPosition, equalsIndex, commentStart);
}

function getKeyCompletionContext(
  line: string,
  position: number,
  equalsIndex: number,
  commentStart: number
): KeyCompletionContext | undefined {
  const hardEnd = firstNonNegative(equalsIndex, commentStart, line.length);
  const prefixRegion = line.slice(0, position);
  const leadingMatch = prefixRegion.match(/^(\s*[+\-!]?\s*)/);
  const tokenStart = leadingMatch?.[1].length ?? 0;

  if (position < tokenStart) {
    return undefined;
  }

  const prefix = line.slice(tokenStart, position);
  if (prefix && !/^[A-Za-z_][\w.:-]*$/.test(prefix)) {
    return undefined;
  }

  const tokenEnd = scanKeyTokenEnd(line, tokenStart, hardEnd);
  return {
    kind: 'key',
    prefix,
    insertRange: { start: tokenStart, end: position },
    replaceRange: { start: tokenStart, end: tokenEnd }
  };
}

function getValueCompletionContext(
  line: string,
  position: number,
  equalsIndex: number,
  commentStart: number
): ValueCompletionContext | undefined {
  const keyText = line.slice(0, equalsIndex).trim().replace(/^[+\-!]\s*/, '').trim();
  if (!keyTokenPattern.test(keyText)) {
    return undefined;
  }

  const valueHardEnd = firstNonNegative(commentStart, line.length);
  const valueStart = scanWhitespaceEnd(line, equalsIndex + 1, valueHardEnd);
  const valueEnd = scanValueTokenEnd(line, valueStart, valueHardEnd);
  const insertStart = Math.min(Math.max(position, valueStart), valueEnd);
  return {
    kind: 'value',
    key: keyText,
    valuePrefix: line.slice(valueStart, insertStart),
    insertRange: { start: valueStart, end: insertStart },
    replaceRange: { start: valueStart, end: valueEnd }
  };
}

function scanKeyTokenEnd(line: string, start: number, hardEnd: number): number {
  let index = start;
  while (index < hardEnd && /[\w.:-]/.test(line[index])) {
    index++;
  }
  return index;
}

function scanValueTokenEnd(line: string, start: number, hardEnd: number): number {
  let index = start;
  while (index < hardEnd && !/\s/.test(line[index])) {
    index++;
  }
  return index;
}

function scanWhitespaceEnd(line: string, start: number, hardEnd: number): number {
  let index = start;
  while (index < hardEnd && /\s/.test(line[index])) {
    index++;
  }
  return index;
}

function findCommentStart(line: string): number {
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if ((char === ';' || char === '#') && (index === 0 || /\s/.test(line[index - 1]))) {
      return index;
    }
  }
  return -1;
}

function firstNonNegative(...values: number[]): number {
  return values.filter((value) => value >= 0).sort((a, b) => a - b)[0] ?? -1;
}
