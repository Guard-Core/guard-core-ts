import type { BaseSecurityDecorator } from './base.js';
import type { GuardRequest } from '../protocols/request.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TS mixin pattern requires any[]
type AnyConstructor = new (...args: any[]) => BaseSecurityDecorator;

export type AuthVerifier = (
  request: GuardRequest,
  credential: string,
) => unknown;

export function Authentication<T extends AnyConstructor>(Base: T) {
  return class extends Base {
    requireHttps() {
      return <F extends Function>(fn: F): F => {
        const rc = this.ensureRouteConfig(fn);
        rc.requireHttps = true;
        return this.applyRouteConfig(fn);
      };
    }

    /* The twin of require_auth (guard_core/decorators/authentication.py):
       sets the scheme and the optional route verifier, mutually exclusive with
       the presence-only requireAuthorizationHeader. */
    requireAuth(type = 'bearer', verifier: AuthVerifier | null = null) {
      return <F extends Function>(fn: F): F => {
        const rc = this.ensureRouteConfig(fn);
        if (rc.authorizationHeaderRequired !== null) {
          throw new Error(
            'requireAuth cannot be combined with requireAuthorizationHeader;'
            + ' the latter is presence-only and mutually exclusive with'
            + ' authenticated routes',
          );
        }
        rc.authRequired = type;
        rc.authVerifier = verifier;
        return this.applyRouteConfig(fn);
      };
    }

    /* The twin of api_key_auth: sets the header name, the optional verifier,
       and the presence-only required_headers entry with the 'required'
       sentinel. */
    apiKeyAuth(headerName = 'X-API-Key', verifier: AuthVerifier | null = null) {
      return <F extends Function>(fn: F): F => {
        const rc = this.ensureRouteConfig(fn);
        if (rc.authorizationHeaderRequired !== null) {
          throw new Error(
            'apiKeyAuth cannot be combined with requireAuthorizationHeader;'
            + ' the latter is presence-only and mutually exclusive with'
            + ' authenticated routes',
          );
        }
        rc.apiKeyRequired = true;
        rc.requiredHeaders[headerName] = 'required';
        rc.apiKeyHeader = headerName;
        rc.apiKeyVerifier = verifier;
        return this.applyRouteConfig(fn);
      };
    }

    /* The twin of require_authorization_header: presence-only authorization
       scheme check, mutually exclusive with requireAuth and apiKeyAuth. */
    requireAuthorizationHeader(scheme = 'bearer') {
      return <F extends Function>(fn: F): F => {
        const rc = this.ensureRouteConfig(fn);
        if (rc.authRequired !== null || rc.apiKeyRequired) {
          throw new Error(
            'requireAuthorizationHeader cannot be combined with'
            + ' requireAuth or apiKeyAuth; it is presence-only and'
            + ' mutually exclusive with authenticated routes',
          );
        }
        rc.authorizationHeaderRequired = scheme;
        return this.applyRouteConfig(fn);
      };
    }

    requireHeaders(headers: Record<string, string>) {
      return <F extends Function>(fn: F): F => {
        const rc = this.ensureRouteConfig(fn);
        Object.assign(rc.requiredHeaders, headers);
        return this.applyRouteConfig(fn);
      };
    }
  };
}
