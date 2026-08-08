import { describe, expect, it } from 'vitest';
import type { Post } from '../../src/lib/posts';
import {
  getAdjacentPosts,
  getPostsByCategory,
  getPublishedPosts,
  toSearchRecord,
} from '../../src/lib/posts';

function createPost(overrides: Partial<Post['data']> & { id: string }): Post {
  return {
    id: overrides.id,
    collection: 'posts',
    data: {
      title: `${overrides.id} title`,
      description: `${overrides.id} description that is long enough for the schema`,
      publishedAt: new Date('2026-08-01T00:00:00.000Z'),
      category: '数据工程和 AI',
      tags: [],
      draft: false,
      ...overrides,
    },
  } as Post;
}

describe('article domain logic', () => {
  it('publishes Shanghai date-only posts from local midnight across the UTC boundary', () => {
    const today = createPost({ id: 'today', publishedAt: new Date('2026-08-07T16:00:00.000Z') });
    const tomorrow = createPost({ id: 'tomorrow', publishedAt: new Date('2026-08-08T16:00:00.000Z') });

    expect(getPublishedPosts([today], new Date('2026-08-07T15:59:00.000Z'))).toEqual([]);
    expect(getPublishedPosts([tomorrow, today], new Date('2026-08-07T16:01:00.000Z')).map((post) => post.id))
      .toEqual(['today']);
    expect(getPublishedPosts([tomorrow, today], new Date('2026-08-07T23:59:00.000Z')).map((post) => post.id))
      .toEqual(['today']);
  });
  it('filters drafts and future posts before sorting published posts newest first', () => {
    const now = new Date('2026-08-08T00:00:00.000Z');
    const draft = createPost({ id: 'draft', draft: true });
    const future = createPost({ id: 'future', publishedAt: new Date('2026-08-09T00:00:00.000Z') });
    const older = createPost({ id: 'older', publishedAt: new Date('2026-08-01T00:00:00.000Z') });
    const newer = createPost({ id: 'newer', publishedAt: new Date('2026-08-07T00:00:00.000Z') });

    expect(getPublishedPosts([draft, future, older, newer], now).map((post) => post.id))
      .toEqual(['newer', 'older']);
  });

  it('sorts equal publication timestamps by id ascending regardless of input order', () => {
    const now = new Date('2026-08-08T00:00:00.000Z');
    const alpha = createPost({ id: 'alpha' });
    const beta = createPost({ id: 'beta' });
    const gamma = createPost({ id: 'gamma' });

    const first = getPublishedPosts([gamma, alpha, beta], now);
    const second = getPublishedPosts([beta, gamma, alpha], now);

    expect(first.map((post) => post.id)).toEqual(['alpha', 'beta', 'gamma']);
    expect(second.map((post) => post.id)).toEqual(['alpha', 'beta', 'gamma']);
    expect(getAdjacentPosts(first, 'beta')).toEqual({ previous: gamma, next: alpha });
  });

  it('filters posts by category', () => {
    const newer = createPost({ id: 'newer' });
    const older = createPost({ id: 'older', category: '随想' });

    expect(getPostsByCategory([newer, older], '数据工程和 AI')).toEqual([newer]);
  });

  it('returns adjacent posts from an ordered collection', () => {
    const newer = createPost({ id: 'newer' });
    const older = createPost({ id: 'older' });

    expect(getAdjacentPosts([newer, older], 'newer')).toEqual({ previous: older, next: undefined });
  });

  it('converts a post into its public search record', () => {
    const newer = createPost({ id: 'newer' });

    expect(toSearchRecord(newer)).toMatchObject({
      id: 'newer',
      title: newer.data.title,
      category: '数据工程和 AI',
    });
  });
});
