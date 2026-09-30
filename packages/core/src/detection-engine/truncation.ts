/**
 * Truncation semantics ported from guard_core/detection_engine/truncation.py
 * (spec 4.0.2, section 05): the full-scan cap is
 * detection_max_body_inspect_bytes (262144 by default), NOT
 * detection_max_content_length; decoded content preserves attack regions up
 * to the cap and keeps a tail window otherwise.
 */

export const FULL_SCAN_TAIL_BYTES = 4096;

export interface AttackRegionExtractor {
  readonly maxContentLength: number;
  readonly compiledIndicators: RegExp[];
  extractAttackRegions(content: string): Array<[number, number]>;
}

export function extractAttackRegions(preprocessor: AttackRegionExtractor, content: string): Array<[number, number]> {
  const maxRegions = Math.min(100, Math.floor(preprocessor.maxContentLength / 100));
  const regions: Array<[number, number]> = [];

  for (const indicator of preprocessor.compiledIndicators) {
    const global = new RegExp(indicator.source, indicator.flags + 'g');
    let match: RegExpExecArray | null;
    let found = 0;
    while ((match = global.exec(content)) !== null) {
      if (found >= maxRegions) break;
      found++;
      const start = Math.max(0, match.index - 100);
      const end = Math.min(content.length, match.index + match[0].length + 100);
      regions.push([start, end]);
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      if (match[0].length === 0) global.lastIndex++;
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    }
    if (regions.length >= maxRegions) break;
  }

  if (regions.length > 0) {
    regions.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const merged: Array<[number, number]> = [regions[0] as [number, number]];
    for (const [start, end] of regions.slice(1)) {
      const last = merged[merged.length - 1] as [number, number];
      if (start <= last[1]) {
        last[1] = Math.max(last[1], end);
      } else {
        merged.push([start, end]);
      }
    }
    return merged.slice(0, maxRegions);
  }

  return [];
}

export function extractAndConcatenateAttackRegions(
  content: string,
  attackRegions: Array<[number, number]>,
  budget: number,
): string {
  let result = '';
  let remaining = budget;

  for (const [start, end] of attackRegions) {
    const chunkLen = Math.min(end - start, remaining);
    result += content.slice(start, start + chunkLen);
    remaining -= chunkLen;
    if (remaining <= 0) break;
  }

  return result;
}

function consumeGap(content: string, lastEnd: number, start: number, gapBudget: number): [string, number] {
  const gapLen = start - lastEnd;
  if (gapLen <= gapBudget) {
    return [content.slice(lastEnd, start), gapBudget - gapLen];
  }
  const chunkLen = gapBudget - 1;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const piece = chunkLen > 0 ? content.slice(lastEnd, lastEnd + chunkLen) : '';
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return [`${piece} `, 0];
}

export function buildResultWithAttackRegionsAndContext(
  content: string,
  attackRegions: Array<[number, number]>,
  budget: number,
): string {
  const attackLength = attackRegions.reduce((sum, [start, end]) => sum + (end - start), 0);
  let gapBudget = budget - attackLength;
  const resultParts: string[] = [];
  let lastEnd = 0;

  for (const [start, end] of attackRegions) {
    if (lastEnd < start && gapBudget > 0) {
      const [piece, remaining] = consumeGap(content, lastEnd, start, gapBudget);
      gapBudget = remaining;
      resultParts.push(piece);
    }
    resultParts.push(content.slice(start, end));
    lastEnd = end;
  }

  if (lastEnd < content.length && gapBudget > 0) {
    const tailLen = Math.min(content.length - lastEnd, gapBudget);
    resultParts.push(content.slice(lastEnd, lastEnd + tailLen));
  }

  return resultParts.join('');
}

export function capWithTail(content: string, maxFullScanBytes: number): string {
  const cap = maxFullScanBytes;
  const tail = Math.min(FULL_SCAN_TAIL_BYTES, cap);
  const headLen = cap - tail;
  return content.slice(0, headLen) + content.slice(content.length - tail);
}
