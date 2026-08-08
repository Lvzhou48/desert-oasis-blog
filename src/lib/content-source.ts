import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function resolvePostsDirectory(override = process.env.BLOG_CONTENT_DIR) {
  const directory = override?.trim();
  return directory ? pathToFileURL(resolve(directory)).href : './src/content/posts';
}
