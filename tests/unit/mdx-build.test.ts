import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const astroPackage = JSON.parse(readFileSync(resolve('node_modules/astro/package.json'), 'utf8'));
const astroCli = resolve('node_modules/astro', astroPackage.bin.astro);

describe('MDX build contract', () => {
  it('builds and renders an MDX page through the project Astro configuration', () => {
    const output = mkdtempSync(join(tmpdir(), 'oasis-mdx-dist-'));
    const result = spawnSync(process.execPath, [
      astroCli,
      'build',
      '--root', resolve('tests/fixtures/mdx-contract'),
      '--outDir', output,
    ], { encoding: 'utf8' });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(readFileSync(join(output, 'index.html'), 'utf8')).toContain('<strong>MDX works</strong>');
  });
});
