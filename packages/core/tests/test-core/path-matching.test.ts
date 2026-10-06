import { describe, it, expect } from 'vitest';
import {
  normalizeUrlPath,
  normalizeExcludePaths,
  pathMatchesExclusions,
  pathIsExcluded,
} from '../../src/core/validation/path-matching.js';

describe('normalizeUrlPath', () => {
  it('keeps plain paths untouched', () => {
    expect(normalizeUrlPath('/api/users')).toBe('/api/users');
    expect(normalizeUrlPath('/')).toBe('/');
  });

  it('decodes a single percent-escape round', () => {
    expect(normalizeUrlPath('/%2Fdocs')).toBe('/docs');
    expect(normalizeUrlPath('/do%63s')).toBe('/docs');
  });

  it('decodes recursive percent-encoding up to 4 rounds', () => {
    /* %252F -> %2F -> / (two rounds) */
    expect(normalizeUrlPath('/%252Fdocs')).toBe('/docs');
    /* four rounds of %25: %25252F -> %252F -> %2F -> / */
    expect(normalizeUrlPath('/%25252Fdocs')).toBe('/docs');
  });

  it('gives up after 4 decode rounds', () => {
    /* five %25 rounds needed: four decode to %2F, which is still an
       undecoded run after the round budget, so the path is undecidable */
    expect(normalizeUrlPath('/%252525252Fdocs')).toBeNull();
  });

  it('returns null for invalid UTF-8 escape sequences', () => {
    /* %FF is never valid UTF-8 */
    expect(normalizeUrlPath('/%FFdocs')).toBeNull();
  });

  it('keeps literal invalid percent sequences as text', () => {
    /* %zz is not a valid escape run: kept literal like the reference regex */
    expect(normalizeUrlPath('/%zzdocs')).toBe('/%zzdocs');
  });

  it('decodes multi-byte UTF-8 runs as one sequence', () => {
    /* %C3%A9 is e-acute */
    expect(normalizeUrlPath('/caf%C3%A9')).toBe('/café');
  });

  it('collapses dot segments', () => {
    expect(normalizeUrlPath('/docs/../etc')).toBe('/etc');
    expect(normalizeUrlPath('/a/./b')).toBe('/a/b');
    expect(normalizeUrlPath('/a/b/..')).toBe('/a');
    expect(normalizeUrlPath('/../..')).toBe('/');
    expect(normalizeUrlPath('/a/../../b')).toBe('/b');
  });

  it('folds backslashes into segment separators', () => {
    expect(normalizeUrlPath('/docs\\..\\etc')).toBe('/etc');
    expect(normalizeUrlPath('/a\\b')).toBe('/a/b');
  });

  it('folds ;params only for dot segments', () => {
    /* "..;y" folds to ".." (so it pops the previous segment) ... */
    expect(normalizeUrlPath('/x/..;y/z')).toBe('/z');
    /* ... while ordinary segments keep their ;params text */
    expect(normalizeUrlPath('/a;b/c')).toBe('/a;b/c');
  });

  it('drops empty segments (double slashes)', () => {
    expect(normalizeUrlPath('//docs')).toBe('/docs');
    expect(normalizeUrlPath('/a//b')).toBe('/a/b');
    expect(normalizeUrlPath('/docs/')).toBe('/docs');
  });
});

describe('normalizeExcludePaths', () => {
  it('normalizes every entry and drops undecodable ones', () => {
    expect(normalizeExcludePaths(['/docs/', '/%2Fadmin', '/%FFbad']))
      .toEqual(['/docs', '/admin']);
  });
});

describe('pathMatchesExclusions', () => {
  it('matches exact and subtree, not textual prefix', () => {
    const exclusions = ['/docs'];
    expect(pathMatchesExclusions('/docs', exclusions)).toBe(true);
    expect(pathMatchesExclusions('/docs/sub/page', exclusions)).toBe(true);
    expect(pathMatchesExclusions('/docsanything', exclusions)).toBe(false);
    expect(pathMatchesExclusions('/docs-anything', exclusions)).toBe(false);
  });

  it('excludes everything for the root exclusion', () => {
    expect(pathMatchesExclusions('/anything/at/all', ['/'])).toBe(true);
  });
});

describe('pathIsExcluded', () => {
  it('excludes the configured path exactly', () => {
    expect(pathIsExcluded('/docs', ['/docs'])).toBe(true);
  });

  it('does NOT exclude a path that only shares the textual prefix', () => {
    expect(pathIsExcluded('/docsanything', ['/docs'])).toBe(false);
    expect(pathIsExcluded('/docsanything', ['/docs/'])).toBe(false);
  });

  it('excludes subtrees and trailing-slash variants', () => {
    expect(pathIsExcluded('/docs/', ['/docs'])).toBe(true);
    expect(pathIsExcluded('/docs/page/1', ['/docs'])).toBe(true);
  });

  it('matches percent-encoded and double-slash paths against exclusions', () => {
    expect(pathIsExcluded('/%2Fdocs', ['/docs'])).toBe(true);
    expect(pathIsExcluded('//docs', ['/docs'])).toBe(true);
    expect(pathIsExcluded('/%64ocs', ['/docs'])).toBe(true);
  });

  it('dot-segment traversal escapes the exclusion subtree', () => {
    /* /docs/../etc normalizes to /etc, which is NOT under /docs */
    expect(pathIsExcluded('/docs/../etc', ['/docs'])).toBe(false);
    expect(pathIsExcluded('/docs/../docs/secret', ['/docs'])).toBe(true);
  });

  it('treats undecodable request paths as not excluded (stays checked)', () => {
    expect(pathIsExcluded('/%FFdocs', ['/docs'])).toBe(false);
  });

  it('returns false with no exclusions', () => {
    expect(pathIsExcluded('/anything', [])).toBe(false);
  });
});
