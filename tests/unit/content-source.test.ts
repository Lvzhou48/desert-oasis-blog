import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { resolvePostsDirectory } from '../../src/lib/content-source';

describe('post content source', () => {
  it('uses the production posts directory when no test override exists', () => {
    expect(resolvePostsDirectory(undefined)).toBe('./src/content/posts');
  });

  it('uses an explicit test-only content directory', () => {
    const directory = resolvePostsDirectory(resolve('tests/fixtures/content-independent'));

    expect(new URL(directory).protocol).toBe('file:');
    expect(new URL(directory).pathname).toContain('content-independent');
  });
});
