import type { GuardRequest } from '../protocols/request.js';
import type { GuardResponse } from '../protocols/response.js';
import type { BaseSecurityDecorator } from './base.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TS mixin pattern requires any[]
type AnyConstructor = new (...args: any[]) => BaseSecurityDecorator;

export function ContentFiltering<T extends AnyConstructor>(Base: T) {
  return class extends Base {
    blockUserAgents(patterns: string[]) {
      return <F extends Function>(fn: F): F => {
        const rc = this.ensureRouteConfig(fn);
        rc.blockedUserAgents.push(...patterns);
        return this.applyRouteConfig(fn);
      };
    }

    contentTypeFilter(allowedTypes: string[]) {
      return <F extends Function>(fn: F): F => {
        const rc = this.ensureRouteConfig(fn);
        rc.allowedContentTypes = allowedTypes;
        return this.applyRouteConfig(fn);
      };
    }

    maxRequestSize(sizeBytes: number) {
      return <F extends Function>(fn: F): F => {
        const rc = this.ensureRouteConfig(fn);
        rc.maxRequestSize = sizeBytes;
        return this.applyRouteConfig(fn);
      };
    }

    requireReferrer(allowedDomains: string[]) {
      return <F extends Function>(fn: F): F => {
        const rc = this.ensureRouteConfig(fn);
        rc.requireReferrer = allowedDomains;
        return this.applyRouteConfig(fn);
      };
    }

    customValidation(validator: (request: GuardRequest) => Promise<GuardResponse | null>) {
      return <F extends Function>(fn: F): F => {
        const rc = this.ensureRouteConfig(fn);
        rc.customValidators.push(validator);
        return this.applyRouteConfig(fn);
      };
    }

    /* The reference detection_exclusion decorator
       (guard_core/decorators/content_filtering.py): each surface is written
       onto the route config only when given, so a null/undefined surface
       keeps inheriting the global config while a given value replaces it
       (headers always merge with the defaults and the config set, see
       resolveDetectionExclusions). Entries are matched lowercased by the
       scan. */
    detectionExclusion(options: {
      headers?: Set<string>;
      params?: Set<string>;
      bodyFields?: Set<string>;
      categories?: Set<string>;
      scanBody?: boolean;
    }) {
      return <F extends Function>(fn: F): F => {
        const rc = this.ensureRouteConfig(fn);
        if (options.headers !== undefined) rc.excludedDetectionHeaders = new Set(options.headers);
        if (options.params !== undefined) rc.excludedDetectionParams = new Set(options.params);
        if (options.bodyFields !== undefined) rc.excludedDetectionBodyFields = new Set(options.bodyFields);
        if (options.categories !== undefined) rc.enabledDetectionCategories = new Set(options.categories);
        if (options.scanBody !== undefined) rc.detectionScanBody = options.scanBody;
        return this.applyRouteConfig(fn);
      };
    }
  };
}
