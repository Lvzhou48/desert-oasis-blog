import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMap, parseDocument } from 'yaml';
import { loadPublicSnapshot } from './public-snapshot.mjs';
import { findSensitiveSnapshotViolations } from './scan-public-snapshot.mjs';

function inspectPublicContent(entry) {
  if (entry.encoding === 'utf8-bom') {
    return { path: entry.path, reason: 'UTF-8 BOM is not allowed before frontmatter' };
  }
  if (entry.encoding !== 'utf8') {
    return { path: entry.path, reason: 'post frontmatter must use UTF-8 without a BOM' };
  }

  const frontmatter = entry.text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (frontmatter === undefined) return { path: entry.path, reason: 'missing valid frontmatter block' };

  let document;
  try {
    document = parseDocument(frontmatter);
  } catch {
    return { path: entry.path, reason: 'invalid YAML frontmatter' };
  }
  if (document.errors.length > 0 || !isMap(document.contents)) {
    return { path: entry.path, reason: 'invalid YAML frontmatter' };
  }
  if (!document.has('draft')) return { path: entry.path, reason: 'missing explicit draft: false' };
  if (document.get('draft') !== false) return { path: entry.path, reason: 'draft must be the boolean false' };
  return undefined;
}

export function findPublicContentViolations(entries) {
  return entries.flatMap((entry) => {
    if (!entry.path.startsWith('src/content/posts/')) return [];
    if (!['.md', '.mdx'].includes(extname(entry.path).toLowerCase())) return [];
    const violation = inspectPublicContent(entry);
    return violation ? [violation] : [];
  });
}

function directoryArgument(arguments_) {
  const index = arguments_.indexOf('--directory');
  if (index < 0) return undefined;
  if (!arguments_[index + 1]) throw new Error('--directory requires a path');
  return arguments_[index + 1];
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  try {
    const snapshot = loadPublicSnapshot({ directory: directoryArgument(process.argv.slice(2)) });
    const violations = [
      ...snapshot.violations,
      ...findPublicContentViolations(snapshot.entries),
      ...findSensitiveSnapshotViolations(snapshot.entries),
    ].toSorted((left, right) => left.path.localeCompare(right.path) || left.reason.localeCompare(right.reason));
    if (violations.length > 0) {
      console.error([
        'Refusing public release; staged snapshot violations found:',
        ...violations.map(({ path, reason }) => `- ${path}: ${reason}`),
      ].join('\n'));
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`Refusing public release; snapshot could not be inspected: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
