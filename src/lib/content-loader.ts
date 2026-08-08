import { readFileSync } from 'node:fs';
import { glob } from 'astro/loaders';
import type { Loader } from 'astro/loaders';
import { isAlias, isMap, isScalar, parseDocument } from 'yaml';

const FRONTMATTER = /(?:^\uFEFF?|^\s*\n)---([\s\S]*?\n)---/;
const DATE_FIELDS = ['publishedAt', 'updatedAt'] as const;
const INVALID_DATE_NODE = Object.freeze({ invalidContentDateNode: true });

function scalarSource(document: ReturnType<typeof parseDocument>, field: string): string | undefined {
  let node = document.get(field, true);
  if (isAlias(node)) {
    try {
      node = node.resolve(document);
    } catch {
      return undefined;
    }
  }
  return isScalar(node) && typeof node.source === 'string' ? node.source : undefined;
}

export function restoreRawContentDates<T extends Record<string, unknown>>(data: T, contents: string): T {
  const rawFrontmatter = FRONTMATTER.exec(contents)?.[1];
  if (rawFrontmatter === undefined) return data;

  const document = parseDocument(rawFrontmatter);
  if (document.errors.length > 0 || !isMap(document.contents)) return data;

  let restored: Record<string, unknown> = data;
  for (const field of DATE_FIELDS) {
    if (!(field in data)) continue;
    const rawValue = scalarSource(document, field);
    if (restored === data) restored = { ...data };
    restored[field] = rawValue ?? INVALID_DATE_NODE;
  }
  return restored as T;
}

export function dateAwareGlob(options: Parameters<typeof glob>[0]): Loader {
  const loader = glob(options);
  return {
    ...loader,
    async load(context) {
      await loader.load({
        ...context,
        async parseData(properties) {
          if (!properties.filePath) return context.parseData(properties);
          const contents = readFileSync(properties.filePath, 'utf8');
          return context.parseData({
            ...properties,
            data: restoreRawContentDates(properties.data, contents),
          });
        },
      });
    },
  };
}
