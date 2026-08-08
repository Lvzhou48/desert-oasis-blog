import { getCollection } from 'astro:content';
import { getPublishedPosts, toSearchRecord } from '../lib/posts';

export async function GET() {
  const records = getPublishedPosts(await getCollection('posts')).map(toSearchRecord);
  return new Response(JSON.stringify(records), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
