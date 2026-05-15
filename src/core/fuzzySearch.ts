export interface FuzzyResult<T> {
  item: T;
  score: number;
}

export function fuzzyFind(query: string, items: string[], limit = 5): FuzzyResult<string>[] {
  const normalizedQuery = normalize(query);
  return items
    .map((item) => ({ item, score: score(normalizedQuery, normalize(item)) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.item.localeCompare(b.item))
    .slice(0, limit);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.]/g, '');
}

function score(query: string, candidate: string): number {
  if (!query || !candidate) return 0;
  if (query === candidate) return 1;
  if (candidate.startsWith(query)) return 0.95;
  if (candidate.includes(query)) return 0.85;
  const distance = levenshtein(query, candidate);
  const maxLength = Math.max(query.length, candidate.length);
  const similarity = 1 - distance / maxLength;
  const prefixBoost = commonPrefixLength(query, candidate) / Math.max(1, Math.min(query.length, candidate.length));
  return similarity * 0.8 + prefixBoost * 0.2;
}

function commonPrefixLength(a: string, b: string): number {
  let index = 0;
  while (index < a.length && index < b.length && a[index] === b[index]) {
    index++;
  }
  return index;
}

function levenshtein(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    for (let j = 0; j <= b.length; j++) {
      previous[j] = current[j];
    }
  }
  return previous[b.length];
}
