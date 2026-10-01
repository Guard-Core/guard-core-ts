---
title: "Detection Engine"
description: "PatternCompiler, ContentPreprocessor, SemanticAnalyzer, PerformanceMonitor, and tuning knobs"
---

The detection engine is a four-stage pipeline that analyzes request content for attack patterns. It combines regex matching, content normalization, semantic analysis, and performance monitoring.

## Architecture

```
Content → ContentPreprocessor → PatternCompiler → SemanticAnalyzer → PerformanceMonitor → DetectionResult
```

## PatternCompiler

Compiles and caches regex patterns with ReDoS protection.

**Primary engine**: `re2-wasm` -- a WebAssembly port of Google's RE2 that guarantees linear-time matching. Works in Node.js and edge runtimes (Cloudflare Workers, Deno).

**Fallback chain**:
1. `re2-wasm` (linear time, ReDoS-safe)
2. `worker_threads` timeout wrapper (native RegExp in a worker with configurable timeout)
3. Native `RegExp` (last resort, no timeout protection)

```typescript
import { PatternCompiler } from '@guardcore/core';

const compiler = new PatternCompiler(2000, 1000);

const result = await compiler.safeMatch(
  String.raw`<script[^>]*>[^<]*<\/script\s*>`,
  userInput,
);

if (result) {
  console.log('XSS pattern matched:', result[0]);
}
```

**Pattern safety validation**:

```typescript
const [isSafe, message] = compiler.validatePatternSafety(
  '(a+)+$',
);
// isSafe: false
// message: "Pattern contains dangerous construct: (.*)+""
```

The validator checks for catastrophic backtracking patterns like `(.*)+`, `(.+)+`, nested quantifiers, and measures actual execution time against test strings.

**Cache**: LRU cache of compiled patterns, configurable max size (default 1000, max 5000).

## ContentPreprocessor

Normalizes input before pattern matching to defeat encoding-based bypasses.

**Processing pipeline**:
1. **Unicode normalization** (NFKC) + lookalike character replacement (e.g., `\u2044` -> `/`, `\uff1c` -> `<`)
2. **Encoding decoding** -- up to 3 iterations of URL decoding + HTML entity decoding
3. **Null byte removal** + control character stripping
4. **Whitespace normalization**
5. **Safe truncation** -- preserves attack-containing regions when truncating long content

```typescript
import { ContentPreprocessor } from '@guardcore/core';

const preprocessor = new ContentPreprocessor(10000, true);

const normalized = await preprocessor.preprocess(
  '%3Cscript%3Ealert%281%29%3C%2Fscript%3E',
);
// "<script>alert(1)</script>"
```

**Attack-preserving truncation**: When content exceeds `maxContentLength`, the preprocessor extracts regions containing attack indicators (e.g., `<script`, `../`, `eval(`) and prioritizes keeping those in the truncated output.

## SemanticAnalyzer

Analyzes content semantically to catch attacks that bypass regex patterns.

**Analysis produces**:

| Metric | Description |
|--------|-------------|
| `attackProbabilities` | Per-category scores (xss, sql, command, path, template) from 0 to 1 |
| `entropy` | Shannon entropy of the content (high entropy suggests obfuscation) |
| `encodingLayers` | Count of detected encoding types (URL, base64, hex, unicode, HTML entities) |
| `isObfuscated` | Boolean based on entropy > 4.5, encoding layers > 2, special char ratio > 0.4, or 100+ consecutive non-space characters |
| `codeInjectionRisk` | Score from 0 to 1 based on code structure patterns and AST parsing (via `acorn`) |
| `suspiciousPatterns` | Array of detected structural patterns (tags, function calls, command chains, path traversal, URLs) |
| `tokenCount` | Number of extracted tokens |

```typescript
import { SemanticAnalyzer } from '@guardcore/core';

const analyzer = new SemanticAnalyzer();
const analysis = analyzer.analyze(userInput);
const threatScore = analyzer.getThreatScore(analysis);

if (threatScore >= 0.7) {
  console.log('Semantic threat detected:', analysis.attackProbabilities);
}
```

**Threat score formula**:
- Max attack probability * 0.3
- Obfuscation detected: +0.2
- Encoding layers: +0.1 per layer (max 0.2)
- Code injection risk * 0.2
- Suspicious patterns: +0.05 per pattern (max 0.1)
- Total capped at 1.0

## PerformanceMonitor

Tracks regex execution times and detects anomalies using z-score analysis.

**What it tracks per pattern**:
- Total executions, matches, and timeouts
- Average, min, and max execution times
- Recent execution time history (sliding window)

**Anomaly detection**:
- **Timeout**: pattern exceeded the configured timeout
- **Slow execution**: execution time > `slowPatternThreshold`
- **Statistical anomaly**: execution time z-score > `anomalyThreshold` (default 3.0)

```typescript
import { PerformanceMonitor } from '@guardcore/core';

const monitor = new PerformanceMonitor(3.0, 0.1, 1000, 1000);

monitor.registerAnomalyCallback((anomaly) => {
  console.log('Pattern anomaly:', anomaly.type, anomaly.pattern);
});
```

## Pattern Table

The engine ships with the 157-row spec 4.1.0 pattern table across 19 categories (the canonical sources are carried verbatim and verified by the spec 4.1.0 conformance corpus, 219 cases):

| Category | Patterns | Contexts |
|----------|----------|----------|
| Command Injection | 23 | header, query_param, request_body, url_path |
| SQL Injection | 22 | header, query_param, request_body, url_path |
| Reconnaissance | 21 | query_param, request_body, url_path |
| Deserialization | 13 | header, query_param, request_body, url_path |
| XSS | 9 | header, query_param, request_body, url_path |
| LDAP Injection | 9 | header, query_param, request_body, url_path |
| Sensitive Files | 8 | query_param, request_body, url_path |
| Directory Traversal | 7 | header, query_param, request_body, url_path |
| CMS Probing | 7 | query_param, request_body, url_path |
| NoSQL Injection | 6 | header, query_param, request_body, url_path |
| Template Injection | 6 | header, query_param, request_body, url_path |
| SSRF | 5 | header, query_param, request_body, url_path |
| File Inclusion | 4 | header, query_param, request_body, url_path |
| XML/XXE | 4 | header, query_param, request_body, url_path |
| File Upload | 4 | header, query_param, request_body |
| Prototype Pollution | 4 | header, query_param, request_body, url_path |
| Code Injection | 3 | header, query_param, request_body, url_path |
| Path Traversal (encoded) | 1 | header, query_param, request_body, url_path |
| HTTP Splitting | 1 | header, query_param, request_body, url_path |

Each pattern is only checked against relevant contexts -- a SQL injection pattern is not tested against URL paths, and reconnaissance patterns are not tested against request bodies.

## Scan Deadlines and Pattern Quarantine

Every per-pattern scan on the JS-native regex path runs under a verdict deadline (`detectionCompilerTimeout`, deployment default 2.0 s, mirroring the reference `detection_compiler_timeout`). A JS `RegExp` cannot be interrupted mid-execution, so the deadline is enforced as a deadline-bounded synchronous fallback with documented detection limits:

- A scan that overshoots the deadline still runs to completion, but its verdict is discarded (no match is reported), the timeout is recorded, and the pattern source appears in the detection result's `timeouts` list. The detection limit: a pattern that massively exceeds the deadline still blocks its thread for the overshoot duration. Only a worker-based path (Node `worker_threads`, used by `PatternCompiler.safeMatch`) can hard-interrupt a regex.
- The reference's second arm applies as well: a scan that completes with no verdict but whose measured time reached 0.9x the deadline is the same timeout verdict (the reference `_suspatterns_regex.py` flips `timeout_occurred` under `not matches and elapsed >= 0.9 * compiler.default_timeout`), so a scan that crawls home just under the wire fails closed too.
- The timeout verdict itself is detection evidence: it contributes a `pattern_timeout` threat with the pattern's weight (so repeated timeouts feed the threat score) and fires a `pattern_anomaly_timeout` event through `PerformanceMonitor`.
- **Consecutive-timeout quarantine** (the reference's 4-consecutive-timeout pool replacement, mapped to a worker-less runtime): a pattern whose scans time out 4 consecutive times (the reference scan-pool size) is pulled from the active scan pool for a 60 s cooldown window. While quarantined it is not scanned and records nothing; after the cooldown it is re-admitted automatically. Any successful scan resets a pattern's consecutive-timeout counter. Quarantine and release are reported as `pattern_pool_quarantined` / `pattern_pool_released` events.

### Worker-thread scan execution (`detectionScanWorkerPool`)

Set `detectionScanWorkerPool: true` to move the unbounded regex work off the main thread, the way the reference runs every timeout-guarded scan on its shared 4-worker thread pool (compiler.py `shared_regex_executor`). Default `false`: the deadline-bounded synchronous fallback above stays the default execution mode, and worker-less targets (edge runtimes) have no pool to run.

With the knob on:

- Each plain full-content pattern scan dispatches the candidate match loop to a bounded pool of exactly 4 worker threads (the reference `_SHARED_EXECUTOR_MAX_WORKERS`). The worker answers with candidate matches only; candidate validation (per-pattern rejection validators, binary-density gates) stays on the calling thread, so a scan's verdict is byte-identical to the inline path - only the preemption changes. Patterns whose scan logic is engine-side (windowed finders, structural scan matchers, scan windows) stay on the inline path; their verdicts are identical either way.
- The verdict deadline terminates the worker mid-`RegExp` (hard interrupt): the result is abandoned, the calling thread was never blocked, and a fresh worker takes the terminated one's slot, so the pool stays at its bound.
- Replacement mirrors the reference `report_scan_timeout`: any completed scan resets the consecutive-timeout counter, and 4 consecutive timeouts replace the WHOLE pool (every worker terminated and respawned, with the same warning the reference logs), because a slow pattern may have poisoned every worker.
- On runtimes without `worker_threads`, the engine logs a single warning and keeps every scan on the inline deadline path.

All other timeout semantics (the `pattern_timeout` threat, the 0.9x slow-completion arm, the `timeouts` result list, the anomaly events) are identical in both modes.

## Tuning Knobs

| Config Field | Default | Effect |
|-------------|---------|--------|
| `detectionCompilerTimeout` | `2.0` | Per-scan verdict deadline in seconds (a scan that overshoots it is discarded as a timeout and heads toward quarantine) |
| `detectionMaxContentLength` | `10000` | Max characters to scan per request |
| `detectionPreserveAttackPatterns` | `true` | Keep attack regions when truncating |
| `detectionSemanticThreshold` | `0.7` | Minimum semantic score to flag as threat |
| `detectionAnomalyThreshold` | `3.0` | Z-score standard deviations for anomaly |
| `detectionSlowPatternThreshold` | `0.1` | Seconds before a pattern is "slow" |
| `detectionMonitorHistorySize` | `1000` | Metrics history buffer size |
| `detectionMaxTrackedPatterns` | `1000` | Max patterns tracked by monitor |
| `detectionScanWorkerPool` | `false` | Opt-in worker-thread scan execution: the deadline terminates the worker (hard interrupt) instead of letting the scan block the main thread; the pool is bounded at 4 workers and replaced after 4 consecutive timeouts |

**Lowering `detectionSemanticThreshold`** catches more attacks but increases false positives.
**Raising `detectionMaxContentLength`** scans more of large request bodies but increases CPU time.
**Lowering `detectionCompilerTimeout`** fails faster on complex patterns but may miss legitimate matches.
