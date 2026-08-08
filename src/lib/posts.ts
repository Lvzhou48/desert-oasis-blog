import type { CollectionEntry } from 'astro:content';
import type { Category } from '../data/site';
import { withBase } from './urls';

export type Post = CollectionEntry<'posts'>;

export function getPublishedPosts(posts: Post[], now = new Date()): Post[] {
  return posts
    .filter((post) => !post.data.draft && post.data.publishedAt <= now)
    .toSorted((a, b) => {
      const newestFirst = b.data.publishedAt.getTime() - a.data.publishedAt.getTime();
      if (newestFirst !== 0) return newestFirst;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

export function getPostsByCategory(posts: Post[], category: Category): Post[] {
  return posts.filter((post) => post.data.category === category);
}

export function getAdjacentPosts(posts: Post[], id: string) {
  const index = posts.findIndex((post) => post.id === id);
  if (index < 0) return { previous: undefined, next: undefined };
  return { previous: posts[index + 1], next: posts[index - 1] };
}

export function toSearchRecord(post: Post) {
  return {
    id: post.id,
    title: post.data.title,
    description: post.data.description,
    category: post.data.category,
    tags: post.data.tags,
    publishedAt: post.data.publishedAt.toISOString(),
    href: withBase(`/posts/${post.id}/`),
  };
}
