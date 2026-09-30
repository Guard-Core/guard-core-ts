/**
 * SusPatternsManager ported from guard_core/handlers/suspatterns_handler.py
 * (spec 4.0.2): multi-view detection (processed, raw, URL-decoded,
 * short-base64 additive), the canonical pattern table with structural
 * matchers, weighted anomaly scoring against detection_threat_score_threshold,
 * and the semantic emission path.
 */

import type { ResolvedSecurityConfig } from '../models/config.js';
import type { Logger } from '../models/logger.js';
import { ContentPreprocessor } from '../detection-engine/preprocessor.js';
import { PatternCompiler } from '../detection-engine/compiler.js';
import { PerformanceMonitor } from '../detection-engine/monitor.js';
import { ScanPoolSupervisor } from '../detection-engine/scan-pool.js';
import { SemanticAnalyzer } from '../detection-engine/semantic.js';
import type { SemanticAnalysis } from '../detection-engine/semantic.js';
import {
  compilePythonPattern,
  findall,
} from '../detection-engine/regex-compat.js';
import type { CompiledPythonPattern } from '../detection-engine/regex-compat.js';
import { buildBinaryPrefix, looksLikeBinaryContent } from '../detection-engine/binary.js';
import {
  buildRegexThreat,
  getCompiledPatterns,
  firstAcceptedRegexThreat,
  iterScanWindowMatches,
  resolvePatternWeight,
  scanMatcherFor,
  scanWindowBoundsFor,
  windowedFinderFor,
} from '../detection-engine/patterns/index.js';
import type { CompiledTableEntry } from '../detection-engine/patterns/index.js';
import {
  DETECTION_RAW_VIEW_PATTERN_SOURCES,
  DETECTION_RECON_RAW_VIEW_PATTERN_SOURCES,
  DETECTION_URL_DECODED_VIEW_PATTERN_SOURCES,
} from '../detection-engine/patterns/pattern-table.js';
import { _PATH_TRAVERSAL_DECODED_SHAPE_RE } from '../detection-engine/patterns/sources.js';
import type { AgentHandlerProtocol } from '../protocols/agent.js';
import type { RedisManager } from './redis.js';

const CTX_ALL: ReadonlySet<string> = new Set([
  'query_param',
  'header',
  'url_path',
  'request_body',
  'unknown',
]);

const KNOWN_CONTEXTS = new Set(['query_param', 'header', 'url_path', 'request_body', 'unknown']);

const PATH_TRAVERSAL_DECODED_SHAPE = compilePythonPattern(_PATH_TRAVERSAL_DECODED_SHAPE_RE);

const DECODE_BUDGET_EXHAUSTED_PATTERN = 'decode_budget_exhausted';

const SEMANTIC_ATTACK_TYPE_TO_CATEGORY: Readonly<Record<string, string>> = {
  xss: 'xss',
  sql: 'sqli',
  command: 'cmd_injection',
  path: 'path_traversal',
  template: 'template',
  suspicious: 'custom',
};

export interface DetectionResult {
  isThreat: boolean;
  threatScore: number;
  threats: Array<{
    pattern: string;
    context: string;
    matchedContent: string;
    detectionMethod: string;
  }>;
  /* Detection categories of the matched threats (regex row categories and
     semantic attack types), deduplicated preserving first-seen order. The
     reference twin is DetectionResult.threat_categories, the input to the
     autoban counter (guard_core/_utils/detection_result_builders.py). */
  threatCategories: string[];
  executionTime: number;
  timeouts: string[];
  correlationId: string | null;
  originalLength: number;
  processedLength: number;
}

interface InternalRegexThreat {
  type: string;
  pattern: string;
  match: string;
  position: number;
  category: string;
  weight: number;
}

interface InternalSemanticThreat {
  type: 'semantic';
  attack_type: string;
  probability?: number;
  threat_score?: number;
}

/**
 * Python `_sanitize_for_reporting`: lone surrogates (surrogateescape
 * artifacts) render as backslash escapes instead of surviving raw.
 */
function sanitizeForReporting(value: string): string {
  let result = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0xdc80 && code <= 0xdcff) {
      result += `\\x${(code - 0xdc80 + 0x80).toString(16).padStart(2, '0')}`;
    } else if (code >= 0xd800 && code <= 0xdfff) {
      result += `\\u${code.toString(16).padStart(4, '0')}`;
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * The reference reports original_length/processed_length as len(content),
 * i.e. code points (suspatterns_handler.py uses len() on the decoded str).
 * JS .length counts UTF-16 code units, which overcounts strings containing
 * astral code points (valid 4-byte UTF-8 sequences inside binary bodies
 * decode to them), so the reported lengths must count code points.
 */
function countCodePoints(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit < 0xdc00) i++;
    count++;
  }
  return count;
}

/**
 * Keep only the raw-pass results whose (pattern, match text) pair an earlier
 * view has already reported. Threats and matched patterns are parallel lists
 * (one append per match), so a raw-view sighting of a pattern over text the
 * processed views already matched is the same evidence and must not inflate
 * the threat score (Python `_drop_view_duplicate_threats`).
 */
function dropViewDuplicateThreats(
  seenThreats: ReadonlyArray<InternalRegexThreat>,
  newThreats: ReadonlyArray<InternalRegexThreat>,
  newMatched: readonly string[],
): { threats: InternalRegexThreat[]; matchedPatterns: string[] } {
  const seen = new Map<string, Set<string>>();
  const remember = (pattern: string, match: string): void => {
    const matches = seen.get(pattern);
    if (matches) matches.add(match);
    else seen.set(pattern, new Set([match]));
  };
  for (const threat of seenThreats) remember(threat.pattern, threat.match);
  const keptThreats: InternalRegexThreat[] = [];
  const keptMatched: string[] = [];
  for (let i = 0; i < newThreats.length; i++) {
    const threat = newThreats[i] as InternalRegexThreat;
    if (seen.get(threat.pattern)?.has(threat.match)) continue;
    remember(threat.pattern, threat.match);
    keptThreats.push(threat);
    keptMatched.push(newMatched[i] ?? threat.pattern);
  }
  return { threats: keptThreats, matchedPatterns: keptMatched };
}

export class SusPatternsManager {
  private preprocessor: ContentPreprocessor;
  private semantic: SemanticAnalyzer;
  private monitor: PerformanceMonitor;
  private compiler: PatternCompiler | null;
  private scanPool: ScanPoolSupervisor;
  private customPatterns = new Set<string>();
  private redisHandler: RedisManager | null = null;
  private agentHandler: AgentHandlerProtocol | null = null;
  private semanticThreshold: number;
  private threatScoreThreshold: number;
  private binaryMinRunLength: number;

  constructor(
    config: ResolvedSecurityConfig,
    private readonly logger: Logger,
    scanPool?: ScanPoolSupervisor,
  ) {
    this.compiler = new PatternCompiler(config.detectionCompilerTimeout * 1000, config.detectionMaxTrackedPatterns);
    this.preprocessor = new ContentPreprocessor(
      config.detectionMaxContentLength,
      config.detectionPreserveAttackPatterns,
      config.detectionMaxBodyInspectBytes,
    );
    this.semantic = new SemanticAnalyzer();
    this.monitor = new PerformanceMonitor(
      config.detectionAnomalyThreshold,
      config.detectionSlowPatternThreshold,
      config.detectionMonitorHistorySize,
      config.detectionMaxTrackedPatterns,
    );
    this.scanPool = scanPool ?? new ScanPoolSupervisor(config.detectionCompilerTimeout * 1000);
    this.scanPool.onPoolEvent((event) => {
      void this.monitor.recordPoolEvent(
        event.type === 'pattern_quarantined' ? 'quarantined' : 'released',
        event.pattern,
        this.agentHandler,
      );
    });
    this.semanticThreshold = config.detectionSemanticThreshold;
    this.threatScoreThreshold = config.detectionThreatScoreThreshold;
    this.binaryMinRunLength = config.detectionBinaryMinRunLength;
  }

  /** detection_binary_min_run_length: the printable-run threshold the
   *  multipart binary-islands reduction hands to the pattern scan. */
  get detectionBinaryMinRunLength(): number {
    return this.binaryMinRunLength;
  }

  async initializeRedis(redisHandler: RedisManager): Promise<void> {
    this.redisHandler = redisHandler;
    const cached = await redisHandler.getKey('patterns', 'custom');
    if (typeof cached === 'string' && cached.length > 0) {
      for (const p of cached.split(',')) {
        if (p.trim()) {
          this.customPatterns.add(p.trim());
        }
      }
    }
  }

  async initializeAgent(agentHandler: AgentHandlerProtocol): Promise<void> {
    this.agentHandler = agentHandler;
  }

  private normalizeContext(context: string): string {
    const parts = context.split(':');
    const normalized = parts[0]?.toLowerCase() ?? 'unknown';
    return KNOWN_CONTEXTS.has(normalized) ? normalized : 'unknown';
  }

  private static excludedFromView(
    source: string,
    rawViewOnly: boolean | null,
    urlDecodedViewOnly: boolean | null,
  ): boolean {
    const isRawViewPattern = DETECTION_RAW_VIEW_PATTERN_SOURCES.has(source);
    const isUrlDecodedViewPattern = DETECTION_URL_DECODED_VIEW_PATTERN_SOURCES.has(source);
    const isReconRawViewPattern = DETECTION_RECON_RAW_VIEW_PATTERN_SOURCES.has(source);
    // Recon rows also run on the raw view: the processed views fold LDAP hex
    // escapes before the tables run, so separator-prefixed probes such as
    // `\default` only survive there (upstream commit 81cf07f1,
    // DETECTION_RECON_RAW_VIEW_PATTERN_SOURCES).
    if (rawViewOnly === true) {
      return isUrlDecodedViewPattern || !(isRawViewPattern || isReconRawViewPattern);
    }
    if (urlDecodedViewOnly === true) return isRawViewPattern || !isUrlDecodedViewPattern;
    if (rawViewOnly === false) return isRawViewPattern || isUrlDecodedViewPattern;
    return false;
  }

  private async checkRegexPatterns(
    content: string,
    context: string,
    correlationId: string | null,
    options: { rawViewOnly?: boolean | null; urlDecodedViewOnly?: boolean | null } = {},
  ): Promise<{ threats: InternalRegexThreat[]; matchedPatterns: string[]; timeouts: string[] }> {
    const { rawViewOnly = null, urlDecodedViewOnly = null } = options;
    const threats: InternalRegexThreat[] = [];
    const matchedPatterns: string[] = [];
    const timeouts: string[] = [];

    const normalized = this.normalizeContext(context);
    const validatorContext = context.endsWith(':embedded_json') ? `${normalized}:embedded_json` : normalized;
    const skipFilter = normalized === 'unknown' || normalized === 'request_body';
    const binaryPrefix = buildBinaryPrefix(content);

    const allPatterns: Array<{
      source: string;
      compiled: CompiledPythonPattern;
      contexts: ReadonlySet<string>;
      category: string;
      custom: boolean;
    }> = getCompiledPatterns().map((entry: CompiledTableEntry) => ({
      source: entry.source,
      compiled: entry.re,
      contexts: entry.contexts,
      category: entry.category,
      custom: false,
    }));
    for (const customSource of this.customPatterns) {
      allPatterns.push({
        source: customSource,
        compiled: compilePythonPattern(customSource, true),
        contexts: CTX_ALL,
        category: 'custom',
        custom: true,
      });
    }

    for (const pattern of allPatterns) {
      if (SusPatternsManager.excludedFromView(pattern.source, rawViewOnly, urlDecodedViewOnly)) continue;
      if (!skipFilter && !pattern.contexts.has(normalized)) continue;

      const patternStart = performance.now();
      const outcome = this.scanPool.run(
        pattern.source,
        () => this.checkRegexPattern(pattern, content, pattern.category, validatorContext, binaryPrefix),
      );
      const elapsed = (performance.now() - patternStart) / 1000;

      // Reference timeout semantics (_suspatterns_regex.py): a scan that
      // overshoots detection_compiler_timeout yields no regex verdict, the
      // timeout itself becomes a pattern_timeout threat, the pattern source
      // joins the result timeouts, and the metric records timeout=true (the
      // monitor's pattern_anomaly_timeout event). A quarantined pattern is
      // not scanned and records nothing: the worker-less fallback's
      // stand-in for the reference's consecutive-timeout pool replacement.
      let threat: InternalRegexThreat | null = null;
      if (outcome.status === 'timeout') {
        timeouts.push(pattern.source);
        threat = {
          type: 'pattern_timeout',
          pattern: pattern.source,
          match: '',
          position: 0,
          category: pattern.category,
          weight: resolvePatternWeight(pattern.source, pattern.category),
        };
      } else if (outcome.status === 'completed') {
        threat = outcome.value;
      }

      if (outcome.status !== 'quarantined') {
        await this.monitor.recordMetric(
          pattern.source,
          elapsed,
          content.length,
          threat !== null,
          outcome.status === 'timeout',
          this.agentHandler,
          correlationId,
        );
      }
      if (threat !== null) {
        threats.push(threat);
        matchedPatterns.push(pattern.source);
      }
    }

    return { threats, matchedPatterns, timeouts };
  }

  private checkRegexPattern(
    pattern: { source: string; compiled: CompiledPythonPattern; category: string; custom: boolean },
    content: string,
    category: string,
    context: string,
    binaryPrefix: number[],
  ): InternalRegexThreat | null {
    const windowedFinder = windowedFinderFor(pattern.source);
    if (windowedFinder !== undefined) {
      return firstAcceptedRegexThreat(windowedFinder(content), pattern.compiled, category, context, binaryPrefix);
    }

    const scanMatcher = scanMatcherFor(pattern.source);
    if (scanMatcher !== undefined) {
      return firstAcceptedRegexThreat(scanMatcher(content, pattern.compiled), pattern.compiled, category, context, binaryPrefix);
    }

    const bounds = scanWindowBoundsFor(pattern.source);
    if (bounds !== undefined) {
      const matches = iterScanWindowMatches(content, pattern.compiled, bounds);
      return firstAcceptedRegexThreat(matches, pattern.compiled, category, context, binaryPrefix);
    }

    // Plain full-content search with per-candidate validation: the first
    // candidate that passes its rejection validator (and the binary-density
    // gate for noise-prone patterns) wins, like the reference's
    // _check_regex_pattern_with_retry.
    const flags = pattern.custom
      ? pattern.compiled.re.flags.replace('y', 'gm')
      : pattern.compiled.re.flags.replace('y', 'g');
    const global = new RegExp(pattern.compiled.re.source, flags);
    global.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = global.exec(content)) !== null) {
      const threat = buildRegexThreat(pattern.compiled, match, category, context, binaryPrefix);
      if (threat !== null) return threat;
      if (match[0].length === 0) global.lastIndex++;
    }
    return null;
  }

  private checkDecodedViewPathTraversal(
    processedContent: string,
    rawViewContent: string,
  ): InternalRegexThreat | null {
    const decodedMatches = findall(PATH_TRAVERSAL_DECODED_SHAPE, processedContent);
    const rawCount = findall(PATH_TRAVERSAL_DECODED_SHAPE, rawViewContent).length;
    if (decodedMatches.length <= rawCount) return null;
    const match = decodedMatches[0] as RegExpExecArray;
    return {
      type: 'regex',
      pattern: _PATH_TRAVERSAL_DECODED_SHAPE_RE,
      match: sanitizeForReporting(match[0]),
      position: match.index,
      category: 'path_traversal',
      weight: resolvePatternWeight(_PATH_TRAVERSAL_DECODED_SHAPE_RE, 'path_traversal'),
    };
  }

  private checkSemanticThreats(
    processedContent: string,
    rawContent: string,
  ): { threats: InternalSemanticThreat[]; semanticScore: number } {
    if (looksLikeBinaryContent(rawContent)) {
      return { threats: [], semanticScore: 0.0 };
    }

    const semanticBudget = this.preprocessor.maxContentLength;
    const content = processedContent.slice(0, semanticBudget);
    const semanticAnalysis: SemanticAnalysis = this.semantic.analyze(content);
    const semanticScore = this.semantic.getThreatScore(semanticAnalysis);
    const threats: InternalSemanticThreat[] = [];

    if (semanticScore > this.semanticThreshold) {
      const attackProbs = semanticAnalysis.attackProbabilities;
      for (const [attackType, probability] of Object.entries(attackProbs)) {
        if (probability >= this.semanticThreshold) {
          threats.push({ type: 'semantic', attack_type: attackType, probability });
        }
      }
      if (threats.length === 0 && semanticScore >= this.semanticThreshold) {
        threats.push({ type: 'semantic', attack_type: 'suspicious', threat_score: semanticScore });
      }
    }

    return { threats, semanticScore };
  }

  private static regexAnomaly(regexThreats: InternalRegexThreat[]): number {
    return regexThreats.reduce((sum, threat) => sum + (threat.weight ?? 1.0), 0);
  }

  private static calculateThreatScore(
    regexThreats: InternalRegexThreat[],
    semanticThreats: InternalSemanticThreat[],
  ): number {
    if (regexThreats.length === 0 && semanticThreats.length === 0) return 0.0;
    const anomaly = SusPatternsManager.regexAnomaly(regexThreats);
    const semanticScores = semanticThreats.map((threat) => threat.probability ?? threat.threat_score ?? 0.0);
    const semanticMax = semanticScores.length > 0 ? Math.max(...semanticScores) : 0.0;
    return Math.min(Math.max(anomaly, semanticMax), 1.0);
  }

  async detect(
    content: string,
    ipAddress: string,
    context = 'unknown',
    correlationId: string | null = null,
    options?: { skipCategories?: ReadonlySet<string> },
  ): Promise<DetectionResult> {
    const startTime = performance.now();
    const originalLength = countCodePoints(content);

    const decodeBudgetExhausted = { value: false };
    const [processedContent, decodedContent] = await this.preprocessor.preprocessWithDecoded(
      content,
      decodeBudgetExhausted,
    );
    const normalizedCtx = this.normalizeContext(context);

    const mainPass = await this.checkRegexPatterns(processedContent, context, correlationId, { rawViewOnly: false });
    const rawViewContent = this.preprocessor.preprocessSignalPreserving(content);
    const rawPass = await this.checkRegexPatterns(rawViewContent, context, correlationId, { rawViewOnly: true });
    // The raw view rescans rows that already ran on the processed views (now
    // including the recon rows), so a row matching both views on the same
    // text must be reported once (Python `_merge_raw_view_results`: merge
    // order processed-then-raw with the (pattern, match) dedup applied to
    // the raw pass).
    const rawDedup = dropViewDuplicateThreats(mainPass.threats, rawPass.threats, rawPass.matchedPatterns);

    const regexThreats = [...mainPass.threats, ...rawDedup.threats];
    const matchedPatterns = [...mainPass.matchedPatterns, ...rawDedup.matchedPatterns];
    /* Python _merge_raw_view_results: the processed-view timeouts are the
       base list and only unseen raw-view timeouts append. */
    const timeouts = [...mainPass.timeouts];
    for (const t of rawPass.timeouts) {
      if (!timeouts.includes(t)) timeouts.push(t);
    }

    const decodedViewThreat = this.checkDecodedViewPathTraversal(processedContent, rawViewContent);
    if (decodedViewThreat !== null) {
      regexThreats.push(decodedViewThreat);
      matchedPatterns.push(decodedViewThreat.pattern);
    }

    const urlDecodedViewContent = this.preprocessor.truncateSafely(decodedContent);
    const urlDecodedPass = await this.checkRegexPatterns(urlDecodedViewContent, context, correlationId, {
      urlDecodedViewOnly: true,
    });
    regexThreats.push(...urlDecodedPass.threats);
    matchedPatterns.push(...urlDecodedPass.matchedPatterns);
    timeouts.push(...urlDecodedPass.timeouts);

    if (decodeBudgetExhausted.value) {
      regexThreats.push({
        type: 'regex',
        pattern: DECODE_BUDGET_EXHAUSTED_PATTERN,
        match: DECODE_BUDGET_EXHAUSTED_PATTERN,
        position: 0,
        category: 'custom',
        weight: resolvePatternWeight(DECODE_BUDGET_EXHAUSTED_PATTERN, 'custom'),
      });
      matchedPatterns.push(DECODE_BUDGET_EXHAUSTED_PATTERN);
    }

    const additiveViewContent = this.preprocessor.preprocessShortBase64AdditiveView(content);
    if (additiveViewContent) {
      const additivePass = await this.checkRegexPatterns(additiveViewContent, context, correlationId);
      regexThreats.push(...additivePass.threats);
      matchedPatterns.push(...additivePass.matchedPatterns);
      timeouts.push(...additivePass.timeouts);
    }

    const { threats: semanticThreats } = this.checkSemanticThreats(processedContent, content);

    // Excluded-header category skip (the reference's
    // _scan_excluded_header_component effective categories): threats whose
    // category is skipped for this value never count toward the threat
    // decision, exactly like patterns of a disabled category not matching.
    let effectiveRegexThreats = regexThreats;
    let effectiveSemanticThreats = semanticThreats;
    const skipCategories = options?.skipCategories;
    if (skipCategories !== undefined && skipCategories.size > 0) {
      effectiveRegexThreats = regexThreats.filter((threat) => !skipCategories.has(threat.category));
      effectiveSemanticThreats = semanticThreats.filter(
        (threat) => !skipCategories.has(SEMANTIC_ATTACK_TYPE_TO_CATEGORY[threat.attack_type] ?? 'custom'),
      );
    }

    const threatScoreThreshold = this.threatScoreThreshold;
    const isThreat =
      SusPatternsManager.regexAnomaly(effectiveRegexThreats) >= threatScoreThreshold ||
      effectiveSemanticThreats.length > 0;

    const threatScore = SusPatternsManager.calculateThreatScore(effectiveRegexThreats, effectiveSemanticThreats);

    const threats: DetectionResult['threats'] = [
      ...effectiveRegexThreats.map((threat) => ({
        pattern: threat.pattern,
        context: normalizedCtx,
        matchedContent: threat.match,
        detectionMethod: threat.type === 'pattern_timeout' ? 'pattern_timeout' : 'regex',
      })),
      ...effectiveSemanticThreats.map((threat) => ({
        pattern: `semantic:${threat.attack_type}`,
        context: normalizedCtx,
        matchedContent: `score=${threatScore.toFixed(3)}`,
        detectionMethod: 'semantic',
      })),
    ];

    const executionTime = (performance.now() - startTime) / 1000;

    /* Reference _build_detection_hit (detection_result_builders.py): each
       regex threat contributes its row category and each semantic threat its
       attack type, deduplicated in first-seen order. A pattern_timeout
       threat is neither (its _threat_category is None) and contributes
       nothing. */
    const threatCategories: string[] = [];
    for (const threat of [...regexThreats, ...semanticThreats]) {
      const category = threat.type === 'semantic'
        ? (threat as InternalSemanticThreat).attack_type
        : threat.type === 'regex'
          ? (threat as InternalRegexThreat).category
          : null;
      if (category !== null && !threatCategories.includes(category)) threatCategories.push(category);
    }

    return {
      isThreat,
      threatScore,
      threats,
      threatCategories,
      executionTime,
      timeouts,
      correlationId,
      originalLength,
      processedLength: countCodePoints(processedContent),
    };
  }

  async detectPatternMatch(
    content: string,
    ipAddress: string,
    context = 'unknown',
    correlationId: string | null = null,
  ): Promise<[boolean, string | null]> {
    const result = await this.detect(content, ipAddress, context, correlationId);
    if (result.isThreat && result.threats.length > 0) {
      const threat = result.threats[0] as DetectionResult['threats'][number];
      if (threat.detectionMethod === 'semantic') {
        return [true, `semantic:${threat.pattern.slice('semantic:'.length)}`];
      }
      return [true, threat.pattern];
    }
    return [false, null];
  }

  async addPattern(pattern: string, custom = true): Promise<void> {
    // Reference add_pattern (suspatterns registry) runs
    // compiler.validate_pattern_safety first and refuses unsafe or
    // uncompilable patterns with a warning; rejected patterns never join the
    // scan set, so detect() cannot hit an invalid regex at scan time.
    if (this.compiler !== null) {
      const [isSafe, reason] = this.compiler.validatePatternSafety(pattern);
      if (!isSafe) {
        this.logger.warn(`Rejected unsafe pattern (${reason}): ${pattern}`);
        return;
      }
    }
    this.customPatterns.add(pattern);
    if (custom && this.redisHandler) {
      await this.redisHandler.setKey('patterns', 'custom', [...this.customPatterns].join(','));
    }
  }

  async removePattern(pattern: string): Promise<void> {
    this.customPatterns.delete(pattern);
    if (this.redisHandler) {
      await this.redisHandler.setKey('patterns', 'custom', [...this.customPatterns].join(','));
    }
    if (this.compiler !== null) {
      await this.compiler.clearCache();
    }
    await this.monitor.removePatternStats(pattern);
  }

  getDefaultPatterns(): string[] {
    return getCompiledPatterns().map((entry) => entry.source);
  }

  getCustomPatterns(): string[] {
    return [...this.customPatterns];
  }

  getAllPatterns(): string[] {
    return [...this.getDefaultPatterns(), ...this.getCustomPatterns()];
  }

  async getPerformanceStats(): Promise<Record<string, unknown> | null> {
    return {
      summary: this.monitor.getSummaryStats(),
      slowPatterns: this.monitor.getSlowPatterns(),
      problematicPatterns: this.monitor.getProblematicPatterns(),
    };
  }

  getComponentStatus(): Record<string, boolean> {
    return {
      compiler: true,
      preprocessor: true,
      semanticAnalyzer: true,
      performanceMonitor: true,
    };
  }

  async configureSemanticThreshold(threshold: number): Promise<void> {
    this.semanticThreshold = Math.max(0, Math.min(1, threshold));
  }

  async reset(): Promise<void> {
    this.customPatterns.clear();
    this.agentHandler = null;
    if (this.compiler !== null) {
      await this.compiler.clearCache();
    }
    this.scanPool.reset();
    await this.monitor.clearStats();
  }
}
