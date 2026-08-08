export function resolvePostsDirectory(override = process.env.BLOG_CONTENT_DIR) {
  return override?.trim() || './src/content/posts';
}
