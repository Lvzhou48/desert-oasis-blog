import { describe, expect, it } from 'vitest';
import { resolvePostsDirectory } from '../../src/lib/content-source';

describe('post content source', () => {
  it('uses the production posts directory when no test override exists', () => {
    expect(resolvePostsDirectory(undefined)).toBe('./src/content/posts');
  });

  it('uses an explicit test-only content directory', () => {
    expect(resolvePostsDirectory('tests/fixtures/content-independent')).toBe('tests/fixtures/content-independent');
  });
});
