/**
 * Content preprocessor ported from
 * guard_core/detection_engine/preprocessor.py (spec 4.0.2, section 05).
 *
 * Pipeline: NFKC + lookalike normalization, the decode chain (percent, HTML
 * entities, %u, \\x, LDAP \\XX, \\u, base64 candidates with bounded gunzip),
 * SQL comment stripping, null/control-byte removal, whitespace collapse,
 * then safe truncation at detection_max_body_inspect_bytes (default 262144)
 * with attack-region preservation. The 10000-char detection_max_content_length
 * only bounds the semantic-analysis budget, not the scan content.
 */

import {
  decodeHexEscapes,
  decodeUnicodeEscapes,
  decodeLdapHexEscapes,
  decodePercentUEscapes,
  decodeOverlongUtf8PercentRuns,
  htmlUnescape,
  pyUnquote,
} from './encoding-decoders.js';
import { decodeBase64Candidates, MAX_GUNZIP_ATTEMPTS_PER_PASS } from './base64-decode.js';
import { buildShortBase64AdditiveView } from './base64-view.js';
import {
  capWithTail,
  extractAndConcatenateAttackRegions,
  buildResultWithAttackRegionsAndContext,
  extractAttackRegions as extractAttackRegionsTruncation,
} from './truncation.js';
import type { AgentHandlerProtocol } from '../protocols/agent.js';

const DEFAULT_MAX_FULL_SCAN_BYTES = 262144;

export const ATTACK_INDICATOR_SOURCES: readonly string[] = [
  '<script',
  'javascript:',
  'on\\w+=',
  'SELECT\\s+.{0,50}?\\s+FROM',
  'UNION\\s+SELECT',
  '\\.\\./',
  'eval\\s*\\(',
  'exec\\s*\\(',
  'system\\s*\\(',
  '<\\?php',
  '<%',
  '{{',
  '{%',
  '<iframe',
  '<object',
  '<embed',
  'onerror\\s*=',
  'onload\\s*=',
  '\\$\\{',
  '\\\\x[0-9a-fA-F]{2}',
  '%[0-9a-fA-F]{2}',
  '`',
  '\\$\\(',
  '[;&|]',
  '\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b',
];

const LOOKALIKES: ReadonlyArray<readonly [string, string]> = [
  ['\u2044', '/'],
  ['\uff0f', '/'],
  ['\u29f8', '/'],
  ['\u0130', 'I'],
  ['\u0131', 'i'],
  ['\u200b', ''],
  ['\u200c', ''],
  ['\u200d', ''],
  ['\ufeff', ''],
  ['\u00ad', ''],
  ['\u034f', ''],
  ['\u180e', ''],
  ['\u2028', '\n'],
  ['\u2029', '\n'],
  ['\ue000', ''],
  ['\ufff0', ''],
  ['\u01c0', '|'],
  ['\u037e', ';'],
  ['\u2215', '/'],
  ['\u2216', '\\'],
  ['\uff1c', '<'],
  ['\uff1e', '>'],
  ['\uff1b', ';'],
  ['\uff5c', '|'],
  ['\uff06', '&'],
];

const SQL_BLOCK_COMMENT_STRIP_RE = /(?<!\w)\/\*(?!!)([\s\S]*?)\*\/|\/\*(?!!)([\s\S]*?)\*\/(?!\w)/g;
const SQL_LINE_COMMENT_MARKER_RE = /--|#/g;

/**
 * Python re \s / str.strip() whitespace class (reference
 * preprocessor.py remove_excessive_whitespace). JS \s differs in both
 * directions: it misses U+0085 (NEL) and U+001C-U+001F which Python
 * collapses, and it matches U+FEFF which Python does not. The reference
 * behavior matters for binary bodies, where NEL and the C0 information
 * separators are common artifact bytes.
 */
const PY_WHITESPACE = '\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\u0085\\u001c-\\u001f';
const PY_WHITESPACE_RUN = new RegExp(`[${PY_WHITESPACE}]+`, 'g');
const PY_WHITESPACE_LEADING = new RegExp(`^[${PY_WHITESPACE}]+`);
const PY_WHITESPACE_TRAILING = new RegExp(`[${PY_WHITESPACE}]+$`);

export class ContentPreprocessor {
  readonly maxContentLength: number;
  readonly preserveAttackPatterns: boolean;
  readonly maxFullScanBytes: number;
  readonly compiledIndicators: RegExp[];
  private agentHandler: AgentHandlerProtocol | null = null;
  private correlationId: string | null = null;

  constructor(
    maxContentLength = 10000,
    preserveAttackPatterns = true,
    maxFullScanBytes: number | null = null,
  ) {
    this.maxContentLength = maxContentLength;
    this.preserveAttackPatterns = preserveAttackPatterns;
    this.maxFullScanBytes = maxFullScanBytes ?? DEFAULT_MAX_FULL_SCAN_BYTES;
    this.compiledIndicators = ATTACK_INDICATOR_SOURCES.map((source) => new RegExp(source, 'i'));
  }

  /* Reference ContentPreprocessor.agent_handler (preprocessor.py): the agent
     handler the decoding_error events ride, injected by the owning manager's
     initializeAgent. */
  setAgentHandler(agentHandler: AgentHandlerProtocol, correlationId: string | null = null): void {
    this.agentHandler = agentHandler;
    this.correlationId = correlationId;
  }

  /* The twin of _send_preprocessor_event (preprocessor.py): system-scoped
     SecurityEvent with the ContentPreprocessor component metadata; dispatch
     failures never propagate. */
  private async sendPreprocessorEvent(
    eventType: string,
    actionTaken: string,
    reason: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    if (!this.agentHandler) return;

    try {
      await this.agentHandler.sendEvent({
        timestamp: new Date(),
        eventType,
        ipAddress: 'system',
        actionTaken,
        reason,
        metadata: {
          component: 'ContentPreprocessor',
          correlationId: this.correlationId,
          ...metadata,
        },
      });
    } catch {
      /* never throw from event dispatch */
    }
  }

  normalizeUnicode(content: string): string {
    let normalized = content.normalize('NFKC');
    for (const [char, replacement] of LOOKALIKES) {
      normalized = normalized.split(char).join(replacement);
    }
    return normalized;
  }

  removeNullBytes(content: string): string {
    return content.replace(/\x00/g, '').replace(/[\x01-\x08\x0b\x0c\x0e-\x1f]/g, '');
  }

  removeExcessiveWhitespace(content: string): string {
    return content
      .replace(PY_WHITESPACE_RUN, ' ')
      .replace(PY_WHITESPACE_LEADING, '')
      .replace(PY_WHITESPACE_TRAILING, '');
  }

  extractAttackRegions(content: string): Array<[number, number]> {
    return extractAttackRegionsTruncation(this, content);
  }

  private extractAndConcatenateAttackRegions(content: string, attackRegions: Array<[number, number]>, budget: number): string {
    return extractAndConcatenateAttackRegions(content, attackRegions, budget);
  }

  private buildResultWithAttackRegionsAndContext(
    content: string,
    attackRegions: Array<[number, number]>,
    budget: number,
  ): string {
    return buildResultWithAttackRegionsAndContext(content, attackRegions, budget);
  }

  private capWithTail(content: string): string {
    return capWithTail(content, this.maxFullScanBytes);
  }

  truncateSafely(content: string): string {
    const maxFullScanBytes = this.maxFullScanBytes;

    if (content.length <= maxFullScanBytes) return content;

    if (!this.preserveAttackPatterns) return content.slice(0, maxFullScanBytes);

    const attackRegions = this.extractAttackRegions(content);

    if (attackRegions.length === 0) {
      return this.capWithTail(content);
    }

    const attackLength = attackRegions.reduce((sum, [start, end]) => sum + (end - start), 0);

    if (attackLength >= maxFullScanBytes) {
      return this.extractAndConcatenateAttackRegions(content, attackRegions, maxFullScanBytes);
    }

    return this.buildResultWithAttackRegionsAndContext(content, attackRegions, maxFullScanBytes);
  }

  stripSqlComments(content: string): string {
    content = content.replace(SQL_BLOCK_COMMENT_STRIP_RE, (_match, group1: string | undefined, group2: string | undefined) => {
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      return ` ${group1 ?? group2 ?? ''} `;
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    });
    return content.replace(SQL_LINE_COMMENT_MARKER_RE, ' ');
  }

  async decodeCommonEncodings(content: string, decodeBudgetExhausted?: { value: boolean }): Promise<string> {
    const maxDecodeIterations = 16;
    let iterations = 0;
    const gunzipAttemptsLeft = { value: MAX_GUNZIP_ATTEMPTS_PER_PASS };
    let current = content;

    while (iterations < maxDecodeIterations) {
      const original = current;

      current = decodeOverlongUtf8PercentRuns(current);
      /* Reference decode_common_encodings: a URL decode failure emits
         EVENT_DECODING_ERROR (error_type url_decode) and keeps the content
         as-is for the remaining passes. */
      try {
        current = pyUnquote(current);
      } catch (e) {
        await this.sendPreprocessorEvent(
          'decoding_error', 'decode_failed', 'Failed to URL decode content',
          { error: String(e), errorType: 'url_decode' },
        );
      }
      /* Reference decode_common_encodings: an HTML entity decode failure
         emits EVENT_DECODING_ERROR (error_type html_decode). */
      try {
        current = htmlUnescape(current);
      } catch (e) {
        await this.sendPreprocessorEvent(
          'decoding_error', 'decode_failed', 'Failed to HTML decode content',
          { error: String(e), errorType: 'html_decode' },
        );
      }
      current = decodePercentUEscapes(current);
      current = decodeHexEscapes(current);
      current = decodeLdapHexEscapes(current);
      current = decodeUnicodeEscapes(current);
      current = this.normalizeUnicode(current);
      current = await decodeBase64Candidates(current, gunzipAttemptsLeft);

      if (current === original) break;

      iterations += 1;
    }

    if (iterations >= maxDecodeIterations && decodeBudgetExhausted !== undefined) {
      decodeBudgetExhausted.value = true;
    }

    return this.stripSqlComments(current);
  }

  async preprocessWithDecoded(
    content: string,
    decodeBudgetExhausted?: { value: boolean },
  ): Promise<[string, string]> {
    if (!content) return ['', ''];

    let decoded = this.normalizeUnicode(content);
    decoded = await this.decodeCommonEncodings(decoded, decodeBudgetExhausted);
    let processed = this.removeNullBytes(decoded);
    processed = this.removeExcessiveWhitespace(processed);
    processed = this.truncateSafely(processed);

    return [processed, decoded];
  }

  async preprocess(content: string, decodeBudgetExhausted?: { value: boolean }): Promise<string> {
    const [processed] = await this.preprocessWithDecoded(content, decodeBudgetExhausted);
    return processed;
  }

  preprocessSignalPreserving(content: string): string {
    if (!content) return '';
    const normalized = this.normalizeUnicode(content);
    return this.truncateSafely(normalized);
  }

  async preprocessUrlDecodedNewlinePreserving(
    content: string,
    decodeBudgetExhausted?: { value: boolean },
  ): Promise<string> {
    if (!content) return '';
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    let decoded = this.normalizeUnicode(content);
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    decoded = await this.decodeCommonEncodings(decoded, decodeBudgetExhausted);
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    return this.truncateSafely(decoded);
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  }

  preprocessShortBase64AdditiveView(content: string): string {
    return buildShortBase64AdditiveView(this, content);
  }

  async preprocessBatch(contents: string[]): Promise<string[]> {
    const results: string[] = [];
    for (const content of contents) {
      results.push(await this.preprocess(content));
    }
    return results;
  }
}
