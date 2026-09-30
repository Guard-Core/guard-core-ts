import type { IncomingHttpHeaders } from 'http';
import type { Request, Response } from 'express';
import type { GuardRequest, GuardRequestState, GuardResponse, GuardResponseFactory } from '@guardcore/core';

function normalizeHeaders(headers: IncomingHttpHeaders): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    normalized[name] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return normalized;
}

function normalizeQueryParams(query: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      normalized[key] = value;
    } else if (Array.isArray(value)) {
      normalized[key] = value.map((v) => String(v)).join(', ');
    } else if (typeof value === 'object') {
      normalized[key] = JSON.stringify(value);
    } else {
      normalized[key] = String(value);
    }
  }
  return normalized;
}

export class ExpressGuardRequest implements GuardRequest {
  private _state: GuardRequestState = {};
  private rawBody: Uint8Array | null = null;
  private readonly _headers: Readonly<Record<string, string>>;
  private readonly _queryParams: Readonly<Record<string, string>>;

  constructor(private readonly req: Request) {
    this._headers = normalizeHeaders(req.headers);
    this._queryParams = normalizeQueryParams(req.query as Record<string, unknown>);
    const raw = (req as unknown as Record<string, unknown>)['rawBody'];
    /* Buffer extends Uint8Array, so the first branch always claims Buffer
       bodies too; the second branch only exists for safety. */
    /* v8 ignore start -- Buffer bodies are Uint8Array instances */
    if (raw instanceof Uint8Array) {
      this.rawBody = raw;
    } else if (raw instanceof Buffer) {
      this.rawBody = new Uint8Array(raw);
    }
    /* v8 ignore stop */
  }

  get urlPath(): string { return this.req.path; }
  get urlScheme(): string { return this.req.protocol; }
  get urlFull(): string { return `${this.req.protocol}://${this.req.get('host')}${this.req.originalUrl}`; }
  urlReplaceScheme(scheme: string): string { return this.urlFull.replace(/^https?/, scheme); }
  get method(): string { return this.req.method; }
  get clientHost(): string | null { return this.req.socket.remoteAddress ?? null; }
  get headers(): Readonly<Record<string, string>> { return this._headers; }
  get queryParams(): Readonly<Record<string, string>> { return this._queryParams; }
  async body(): Promise<Uint8Array> { return this.rawBody ?? new Uint8Array(0); }
  get state(): GuardRequestState { return this._state; }
  get scope(): Readonly<Record<string, unknown>> { return {}; }
}

export class ExpressGuardResponse implements GuardResponse {
  private _headers: Record<string, string> = {};
  private _body: Uint8Array | null;

  constructor(
    readonly statusCode: number,
    content: string,
  ) {
    this._body = new TextEncoder().encode(content);
    /* Block and error responses are plain text like the Python family
       (fastapi-guard #144): the message itself, not JSON-wrapped. A custom
       response modifier can still override the content type. */
    this._headers['content-type'] = 'text/plain; charset=utf-8';
  }

  get headers(): Record<string, string> { return this._headers; }
  setHeader(name: string, value: string): void { this._headers[name] = value; }
  get body(): Uint8Array | null { return this._body; }
  /* _body is always assigned in the constructor, so the null arm is a
     GuardResponse-contract guard that cannot execute. */
  /* v8 ignore next */
  get bodyText(): string | null {
    return this._body ? new TextDecoder().decode(this._body) : null;
  }
}

export class ExpressResponseFactory implements GuardResponseFactory {
  createResponse(content: string, statusCode: number): GuardResponse {
    return new ExpressGuardResponse(statusCode, content);
  }

  createRedirectResponse(url: string, statusCode: number): GuardResponse {
    const resp = new ExpressGuardResponse(statusCode, '');
    resp.setHeader('location', url);
    return resp;
  }
}

export function sendGuardResponse(res: Response, guardResponse: GuardResponse): void {
  for (const [name, value] of Object.entries(guardResponse.headers)) {
    res.setHeader(name, value);
  }

  if (guardResponse.headers['location']) {
    res.redirect(guardResponse.statusCode, guardResponse.headers['location']);
    return;
  }

  res.status(guardResponse.statusCode);
  if (guardResponse.body) {
    res.send(Buffer.from(guardResponse.body));
  } else {
    res.end();
  }
}
