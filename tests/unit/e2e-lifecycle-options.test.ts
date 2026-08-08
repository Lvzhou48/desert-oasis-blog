import { describe, expect, it } from 'vitest';
import { lifecycleEnvironment } from '../../scripts/e2e-lifecycle-options.mjs';

describe('E2E lifecycle options', () => {
  it('passes an explicit project base path to the Playwright child', () => {
    expect(lifecycleEnvironment(['--base', '/desert-oasis-blog/'], { KEEP: 'yes' })).toEqual({
      KEEP: 'yes',
      BASE_PATH: '/desert-oasis-blog/',
    });
  });

  it('keeps the root path deterministic when no base argument is supplied', () => {
    expect(lifecycleEnvironment([], { BASE_PATH: '/stale/' })).toEqual({
      BASE_PATH: '/',
    });
  });

  it('does not pass contradictory color variables that make Playwright warn', () => {
    expect(lifecycleEnvironment([], { FORCE_COLOR: '1', NO_COLOR: '1' })).toEqual({
      FORCE_COLOR: '1',
      BASE_PATH: '/',
    });
  });

  it('drops NO_COLOR because Playwright workers force color internally', () => {
    expect(lifecycleEnvironment([], { NO_COLOR: '1' })).toEqual({ BASE_PATH: '/' });
  });
});
