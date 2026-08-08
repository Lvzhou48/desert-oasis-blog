const FALLBACK_SITE = new URL('https://lvzhou48.github.io/desert-oasis-blog/');

export function withBase(pathname: string, base = import.meta.env.BASE_URL): string {
  const baseSegment = base.replace(/^\/+|\/+$/g, '');
  const pathSegment = pathname.replace(/^\/+/, '');
  if (!pathSegment) return baseSegment ? `/${baseSegment}/` : '/';
  return `/${[baseSegment, pathSegment].filter(Boolean).join('/')}`;
}

export function resolveProjectSite(site: URL | undefined, base = import.meta.env.BASE_URL): URL {
  if (!site) return new URL(FALLBACK_SITE);
  return new URL(withBase('/', base), new URL('/', site));
}
