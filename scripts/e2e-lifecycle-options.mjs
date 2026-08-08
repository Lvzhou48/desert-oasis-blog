export function lifecycleEnvironment(arguments_, environment) {
  const baseIndex = arguments_.indexOf('--base');
  const requested = baseIndex >= 0 ? arguments_[baseIndex + 1] : '/';
  const contentIndex = arguments_.indexOf('--content-dir');
  const contentDirectory = contentIndex >= 0 ? arguments_[contentIndex + 1] : undefined;
  const normalized = `/${String(requested ?? '/').replace(/^\/+|\/+$/g, '')}/`;
  const normalizedEnvironment = { ...environment };
  delete normalizedEnvironment.NO_COLOR;
  delete normalizedEnvironment.BLOG_CONTENT_DIR;
  return {
    ...normalizedEnvironment,
    BASE_PATH: normalized === '//' ? '/' : normalized,
    ...(contentDirectory ? { BLOG_CONTENT_DIR: contentDirectory } : {}),
  };
}
