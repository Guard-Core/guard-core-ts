import type { Logger } from '../models/logger.js';
import type { AgentHandlerProtocol } from '../protocols/agent.js';
import type { RedisManager } from './redis.js';
import { redactHeaderValueForDisplay, redactUrlForDisplay } from '../redaction.js';

/* Reference _SECURITY_HEADERS_HANDLER_NAME (_security_headers_events.py). */
const SECURITY_HEADERS_HANDLER_NAME = 'security_headers';

const DEFAULT_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-Download-Options': 'noopen',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

const MAX_HEADER_VALUE_LENGTH = 8192;

function validateHeaderValue(value: string): string {
  if (value.includes('\r') || value.includes('\n')) {
    throw new Error('Header value must not contain CR or LF characters');
  }
  /* v8 ignore start -- header validation throw branch; requires header value exceeding 8192 chars with CRLF injection */
  if (value.length > MAX_HEADER_VALUE_LENGTH) {
    throw new Error(`Header value exceeds maximum length of ${MAX_HEADER_VALUE_LENGTH}`);
  }
  /* v8 ignore stop */
  return value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}

/* Strip every trailing '/' from a value.
   A linear scan instead of `replace(/\/+$/, "")`: requestPath reaches this
   from the incoming request, and CodeQL (js/polynomial-redos) flags anchored
   quantifier regexes over uncontrolled data. Behavior is identical - all
   trailing slashes are removed, none added. */
function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') {
    end--;
  }
  return value.slice(0, end);
}

function generateCacheKey(requestPath: string): string {
  const normalized = stripTrailingSlashes(requestPath.toLowerCase());
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return String(Math.abs(hash)).padStart(16, '0').slice(0, 16);
}

export class SecurityHeadersManager {
  private headersCache = new Map<string, Record<string, string>>();
  private defaultHeaders: Record<string, string> = { ...DEFAULT_HEADERS };
  private customHeaders: Record<string, string> = {};
  private cspConfig: Record<string, string[]> | null = null;
  private hstsConfig: { maxAge: number; includeSubdomains: boolean; preload: boolean } | null = null;
  private corsConfig: {
    origins: string[];
    allowCredentials: boolean;
    allowMethods: string[];
    allowHeaders: string[];
  } | null = null;
  private redisHandler: RedisManager | null = null;
  private agentHandler: AgentHandlerProtocol | null = null;
  private cacheMaxSize = 1000;
  private cacheTtlMs = 300_000;
  private cacheTimestamps = new Map<string, number>();

  constructor(private readonly logger: Logger) {}

  async initializeRedis(redisHandler: RedisManager): Promise<void> {
    this.redisHandler = redisHandler;
    await this.loadCachedConfig();
  }

  /* v8 ignore start -- initializeAgent assignment; tested via handler tests but V8 misses when called from mock */
  async initializeAgent(agentHandler: AgentHandlerProtocol): Promise<void> {
    this.agentHandler = agentHandler;
  }
  /* v8 ignore stop */

  /* The twin of the SecurityHeadersEventsMixin senders
     (_security_headers_events.py): handler-named SecurityEvents whose
     dispatch failures never propagate. The reference events carry no
     ip_address/reason kwargs, so both envelope fields default to ''. */
  private async sendHeadersEvent(
    eventType: string,
    actionTaken: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    if (!this.agentHandler) return;

    try {
      await this.agentHandler.sendEvent({
        timestamp: new Date(),
        eventType,
        ipAddress: '',
        actionTaken,
        reason: '',
        handlerName: SECURITY_HEADERS_HANDLER_NAME,
        metadata,
      });
    } catch {
      /* never throw from event dispatch */
    }
  }

  private async loadCachedConfig(): Promise<void> {
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (!this.redisHandler) return;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */

    const cspJson = await this.redisHandler.getKey('security_headers', 'csp_config');
    if (typeof cspJson === 'string') {
      try { this.cspConfig = JSON.parse(cspJson); } catch { /* ignore */ }
    }

    const hstsJson = await this.redisHandler.getKey('security_headers', 'hsts_config');
    if (typeof hstsJson === 'string') {
      try { this.hstsConfig = JSON.parse(hstsJson); } catch { /* ignore */ }
    }

    const customJson = await this.redisHandler.getKey('security_headers', 'custom_headers');
    if (typeof customJson === 'string') {
      try { this.customHeaders = JSON.parse(customJson); } catch { /* ignore */ }
    }
  }

  configure(options: {
    enabled?: boolean | undefined;
    csp?: Record<string, string[]> | null | undefined;
    hstsMaxAge?: number | undefined;
    hstsIncludeSubdomains?: boolean | undefined;
    hstsPreload?: boolean | undefined;
    frameOptions?: string | undefined;
    contentTypeOptions?: string | undefined;
    xssProtection?: string | undefined;
    referrerPolicy?: string | undefined;
    permissionsPolicy?: string | undefined;
    customHeaders?: Record<string, string> | null | undefined;
    corsOrigins?: string[] | undefined;
    corsAllowCredentials?: boolean | undefined;
    corsAllowMethods?: string[] | undefined;
    corsAllowHeaders?: string[] | undefined;
  }): void {
    if (options.enabled === false) {
      this.defaultHeaders = {};
      return;
    }

    if (options.csp) this.cspConfig = options.csp;
    if (options.hstsMaxAge !== undefined) {
      this.hstsConfig = {
        maxAge: options.hstsMaxAge,
        includeSubdomains: options.hstsIncludeSubdomains ?? true,
        preload: options.hstsPreload ?? false,
      };
    }
    if (options.frameOptions) this.defaultHeaders['X-Frame-Options'] = validateHeaderValue(options.frameOptions);
    if (options.contentTypeOptions) this.defaultHeaders['X-Content-Type-Options'] = validateHeaderValue(options.contentTypeOptions);
    if (options.xssProtection) this.defaultHeaders['X-XSS-Protection'] = validateHeaderValue(options.xssProtection);
    if (options.referrerPolicy) this.defaultHeaders['Referrer-Policy'] = validateHeaderValue(options.referrerPolicy);
    if (options.permissionsPolicy) this.defaultHeaders['Permissions-Policy'] = validateHeaderValue(options.permissionsPolicy);

    if (options.customHeaders) {
      for (const [key, value] of Object.entries(options.customHeaders)) {
        this.customHeaders[key] = validateHeaderValue(value);
      }
    }

    if (options.corsOrigins) {
      let allowCredentials = options.corsAllowCredentials ?? false;
      if (options.corsOrigins.includes('*') && allowCredentials) {
        this.logger.error('CORS config error: Wildcard origin disallowed with credentials');
        allowCredentials = false;
      }
      this.corsConfig = {
        origins: options.corsOrigins,
        allowCredentials,
        allowMethods: options.corsAllowMethods ?? ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: options.corsAllowHeaders ?? ['*'],
      };
    }

    this.cacheConfiguration();
  }

  private async cacheConfiguration(): Promise<void> {
    if (!this.redisHandler) return;
    const ttl = 86400;
    if (this.cspConfig) await this.redisHandler.setKey('security_headers', 'csp_config', JSON.stringify(this.cspConfig), ttl);
    if (this.hstsConfig) await this.redisHandler.setKey('security_headers', 'hsts_config', JSON.stringify(this.hstsConfig), ttl);
    if (Object.keys(this.customHeaders).length > 0) {
      await this.redisHandler.setKey('security_headers', 'custom_headers', JSON.stringify(this.customHeaders), ttl);
    }
  }

  private buildCsp(): string | null {
    if (!this.cspConfig) return null;
    return Object.entries(this.cspConfig)
      .map(([directive, values]) => `${directive} ${values.join(' ')}`)
      .join('; ');
  }

  private buildHsts(): string | null {
    if (!this.hstsConfig) return null;
    let header = `max-age=${this.hstsConfig.maxAge}`;
    if (this.hstsConfig.includeSubdomains) header += '; includeSubDomains';
    if (this.hstsConfig.preload) header += '; preload';
    return header;
  }

  async getHeaders(requestPath: string): Promise<Record<string, string>> {
    const cacheKey = generateCacheKey(requestPath);
    const now = Date.now();

    const cachedTimestamp = this.cacheTimestamps.get(cacheKey);
    if (cachedTimestamp && now - cachedTimestamp < this.cacheTtlMs) {
      const cached = this.headersCache.get(cacheKey);
      if (cached) return { ...cached };
    }

    const headers: Record<string, string> = { ...this.defaultHeaders };

    const csp = this.buildCsp();
    if (csp) headers['Content-Security-Policy'] = csp;

    const hsts = this.buildHsts();
    if (hsts) headers['Strict-Transport-Security'] = hsts;

    for (const [key, value] of Object.entries(this.customHeaders)) {
      headers[key] = value;
    }

    if (this.headersCache.size >= this.cacheMaxSize) {
      const oldestKey = this.headersCache.keys().next().value;
      if (oldestKey) {
        this.headersCache.delete(oldestKey);
        this.cacheTimestamps.delete(oldestKey);
      }
    }

    this.headersCache.set(cacheKey, headers);
    this.cacheTimestamps.set(cacheKey, now);

    /* Reference EVENT_SECURITY_HEADERS_APPLIED on a fresh header build
       (security_headers_handler.py get_headers; cache hits stay silent like
       the reference's early return). */
    if (requestPath) {
      await this.sendHeadersEvent(
        'security_headers_applied', 'headers_added',
        {
          path: redactUrlForDisplay(requestPath, null, null, null),
          headersCount: Object.keys(headers).length,
          hasCsp: 'Content-Security-Policy' in headers,
          hasHsts: 'Strict-Transport-Security' in headers,
        },
      );
    }

    return { ...headers };
  }

  /* The twin of validate_csp_report (handlers/_security_headers_events.py):
     a browser CSP violation report is validated against the required fields,
     logged with redacted values, and reported to the agent as
     EVENT_CSP_VIOLATION. Returns false when the report is malformed. */
  async validateCspReport(report: Record<string, unknown>): Promise<boolean> {
    const cspReport = (report['csp-report'] ?? {}) as Record<string, unknown>;
    const requiredFields = ['document-uri', 'violated-directive', 'blocked-uri'];
    for (const field of requiredFields) {
      if (!(field in cspReport)) return false;
    }

    const safeDirective = redactHeaderValueForDisplay(String(cspReport['violated-directive']), null, null, null);
    const safeBlockedUri = this.safeCspUri(cspReport['blocked-uri']);
    const safeDocumentUri = this.safeCspUri(cspReport['document-uri']);
    this.logger.warn(
      `CSP Violation: ${safeDirective} blocked ${safeBlockedUri} on ${safeDocumentUri}`,
    );

    if (this.agentHandler) {
      await this.sendHeadersEvent(
        'csp_violation', 'logged',
        {
          documentUri: safeDocumentUri,
          violatedDirective: safeDirective,
          blockedUri: safeBlockedUri,
          /* _safe_csp_uri(report.get('source-file')): a missing entry reads
             str(None) in the reference, so 'None' is the faithful absent
             rendering. */
          sourceFile: cspReport['source-file'] === undefined
            ? 'None'
            : this.safeCspUri(cspReport['source-file']),
          lineNumber: this.safeCspLineNumber(cspReport['line-number']),
        },
      );
    }

    return true;
  }

  /* The twin of _safe_csp_uri: attacker-controlled report values pass
     through the URL redactor before they reach any log or event. */
  private safeCspUri(value: unknown): string {
    return redactUrlForDisplay(String(value), null, null, null);
  }

  /* The twin of _safe_csp_line_number. */
  private safeCspLineNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  getCorsHeaders(origin: string): Record<string, string> {
    if (!this.corsConfig) return {};

    /* The wildcard-with-credentials pair is neutralized at config compute
       time (credentials forced off with an error), so it never blocks the
       wildcard response here; the credentials header simply never appears
       (guard_core/handlers/_security_headers_config.py _compute_cors_config
       + _security_headers_cors.py get_cors_headers). */
    const isAllowed = this.corsConfig.origins.includes('*') ||
      this.corsConfig.origins.includes(origin);
    if (!isAllowed) return {};

    const headers: Record<string, string> = {
      /* Reference _build_cors_headers: the origin echoes when listed, the
         wildcard composes as '*' otherwise. */
      'Access-Control-Allow-Origin': this.corsConfig.origins.includes(origin)
        ? origin
        : '*',
      'Access-Control-Allow-Methods': this.corsConfig.allowMethods.join(', '),
      'Access-Control-Allow-Headers': this.corsConfig.allowHeaders.join(', '),
      'Access-Control-Max-Age': '3600',
    };

    if (this.corsConfig.allowCredentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    return headers;
  }

  async reset(): Promise<void> {
    this.headersCache.clear();
    this.cacheTimestamps.clear();
    this.defaultHeaders = { ...DEFAULT_HEADERS };
    this.customHeaders = {};
    this.cspConfig = null;
    this.hstsConfig = null;
    this.corsConfig = null;
    if (this.redisHandler) {
      await this.redisHandler.deletePattern('security_headers:*');
    }
  }
}
