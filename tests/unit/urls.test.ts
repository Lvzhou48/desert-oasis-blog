import { describe, expect, it } from 'vitest';
import { resolveProjectSite, withBase } from '../../src/lib/urls';

describe('base-aware public URLs', () => {
  it('keeps internal links inside the GitHub Pages project path', () => {
    expect(withBase('/', '/desert-oasis-blog/')).toBe('/desert-oasis-blog/');
    expect(withBase('/articles/', '/desert-oasis-blog/')).toBe('/desert-oasis-blog/articles/');
    expect(withBase('/posts/first-oasis/', '/desert-oasis-blog/'))
      .toBe('/desert-oasis-blog/posts/first-oasis/');
  });

  it('resolves the RSS channel URL to the project root', () => {
    expect(resolveProjectSite(new URL('https://lvzhou48.github.io'), '/desert-oasis-blog/').href)
      .toBe('https://lvzhou48.github.io/desert-oasis-blog/');
    expect(resolveProjectSite(undefined, '/').href)
      .toBe('https://lvzhou48.github.io/desert-oasis-blog/');
  });
});
