import type { BaseSecurityDecorator } from './base.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TS mixin pattern requires any[]
type AnyConstructor = new (...args: any[]) => BaseSecurityDecorator;

export function Advanced<T extends AnyConstructor>(Base: T) {
  return class extends Base {
    timeWindow(startTime: string, endTime: string, _timezone = 'UTC') {
      return <F extends Function>(fn: F): F => {
        const rc = this.ensureRouteConfig(fn);
        rc.timeRestrictions = { start: startTime, end: endTime };
        return this.applyRouteConfig(fn);
      };
    }

    suspiciousDetection(enabled = true) {
      return <F extends Function>(fn: F): F => {
        const rc = this.ensureRouteConfig(fn);
        rc.enableSuspiciousDetection = enabled;
        return this.applyRouteConfig(fn);
      };
    }

    honeypotDetection(trapFields: string[]) {
      return <F extends Function>(fn: F): F => {
        const rc = this.ensureRouteConfig(fn);
        rc.customValidators.push(async (request) => {
          try {
            const bodyBytes = await request.body();
            if (bodyBytes.length === 0) return null;

            const bodyText = new TextDecoder().decode(bodyBytes);
            let data: Record<string, unknown> = {};

            const contentType = request.headers['content-type'] ?? '';
            if (contentType.includes('json')) {
              data = JSON.parse(bodyText);
            } else if (contentType.includes('form')) {
              for (const pair of bodyText.split('&')) {
                const [key, value] = pair.split('=');
                if (key && value) data[decodeURIComponent(key)] = decodeURIComponent(value);
              }
            }

            for (const field of trapFields) {
              if (data[field] !== undefined && data[field] !== '' && data[field] !== null) {
                return {
                  statusCode: 403,
                  headers: {},
                  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
                  setHeader() {},
                  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
                  body: new TextEncoder().encode('Forbidden'),
                  bodyText: 'Forbidden',
                };
              }
            }
          /* v8 ignore start -- catch block function for honeypot body parsing; silently ignored */
          } catch { /* ignore */ }
          /* v8 ignore stop */
          return null;
        });
        return this.applyRouteConfig(fn);
      };
    }
  };
}
