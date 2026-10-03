/** Keep every chunk inside one PDF page and section. Offsets use UTF-16. */
export function chunkPages(pages, maxChars = 1200) {
  if (!Number.isInteger(maxChars) || maxChars < 1) throw new Error('maxChars must be a positive integer');
  const chunks = [];
  for (const item of pages) {
    for (let start = 0; start < item.text.length;) {
      let end = Math.min(start + maxChars, item.text.length);
      // Never split a surrogate pair; a one-unit budget may need two units.
      if (end < item.text.length && /[\uD800-\uDBFF]/.test(item.text[end - 1])) end += 1;
      chunks.push({ page: item.page, start, end, text: item.text.slice(start, end), method: item.method });
      start = end;
    }
  }
  return chunks;
}

/** Match literal terms, tolerating OCR whitespace between Han characters. */
export function findEvidence(pages, query, sourceSha256, limit = 8) {
  if (typeof query !== 'string' || query.length > 256) throw new Error('query must be at most 256 characters');
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('limit must be between 1 and 20');
  const terms = [...new Set(query.trim().split(/\s+/u).filter(Boolean))];
  if (!terms.length) return [];
  const matches = [];
  for (const page of pages) {
    // Regex match indices refer to the original string, including Unicode case folds.
    const hits = terms.map(term => {
      const chars = Array.from(term);
      const pattern = chars.map((char, i) => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        (/\p{Script=Han}/u.test(char) && /\p{Script=Han}/u.test(chars[i + 1] ?? '') ? '\\s*' : '')).join('');
      return new RegExp(pattern, 'iu').exec(page.text);
    });
    if (hits.some(hit => !hit)) continue;
    const first = Math.min(...hits.map(hit => hit.index));
    const start = Math.max(0, first - 70);
    const end = Math.min(page.text.length, first + 230);
    matches.push({
      citation: `sha256:${sourceSha256}#page=${page.page}&start=${start}&end=${end}`,
      page: page.page, start, end, quote: page.text.slice(start, end), method: page.method,
    });
    if (matches.length >= limit) break;
  }
  return matches;
}
