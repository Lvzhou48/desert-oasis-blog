import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

describe('GitHub Pages workflow', () => {
  const workflow = parse(readFileSync('.github/workflows/deploy.yml', 'utf8'));
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const build = workflow.jobs.build;
  const deploy = workflow.jobs.deploy;
  const buildSteps = build.steps.map((step: { run?: string; uses?: string }) => step.run ?? step.uses);
  const mainOnly = "github.ref == 'refs/heads/main'";

  it('parses the intended release triggers', () => {
    expect(workflow.on).toEqual({
      push: { branches: ['main'] },
      pull_request: null,
      workflow_dispatch: null,
    });
  });

  it('runs the production gates in order before uploading the Pages artifact', () => {
    const orderedSteps = [
      'npm run check',
      'npm run check:public',
      'npm test',
      'npm run build:pages',
      'npm run check:links:pages',
      'npm run test:e2e:lifecycle:pages',
      'actions/upload-pages-artifact@v4',
    ];
    const indexes = orderedSteps.map((step) => buildSteps.indexOf(step));

    expect(indexes.every((index) => index >= 0)).toBe(true);
    expect(indexes).toEqual([...indexes].toSorted((left, right) => left - right));
  });

  it('installs Chromium and its Linux dependencies before base-path E2E', () => {
    const install = buildSteps.indexOf('npx playwright install --with-deps chromium');
    const e2e = buildSteps.indexOf('npm run test:e2e:lifecycle:pages');

    expect(install).toBeGreaterThan(buildSteps.indexOf('npm ci'));
    expect(install).toBeLessThan(e2e);
  });

  it('uploads and deploys only refs/heads/main, including manual runs', () => {
    const upload = build.steps.find((step: { uses?: string }) => step.uses === 'actions/upload-pages-artifact@v4');

    expect(upload.if).toBe(mainOnly);
    expect(deploy.if).toBe(mainOnly);
    expect(deploy.needs).toBe('build');
  });

  it('uses the production project path and optional giscus variables', () => {
    const productionBuild = build.steps.find((step: { run?: string }) => step.run === 'npm run build:pages');

    expect(productionBuild.env).toEqual({
      PUBLIC_GISCUS_REPO: '${{ vars.PUBLIC_GISCUS_REPO }}',
      PUBLIC_GISCUS_REPO_ID: '${{ vars.PUBLIC_GISCUS_REPO_ID }}',
      PUBLIC_GISCUS_CATEGORY: '${{ vars.PUBLIC_GISCUS_CATEGORY }}',
      PUBLIC_GISCUS_CATEGORY_ID: '${{ vars.PUBLIC_GISCUS_CATEGORY_ID }}',
    });
  });

  it('cancels stale runs at workflow scope so older artifacts cannot deploy later', () => {
    expect(workflow.concurrency).toEqual({
      group: 'pages-${{ github.ref }}',
      'cancel-in-progress': true,
    });
    expect(deploy.concurrency).toBeUndefined();
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(deploy.permissions).toEqual({ pages: 'write', 'id-token': 'write' });
    expect(deploy.steps).toContainEqual(expect.objectContaining({ uses: 'actions/deploy-pages@v4' }));
  });

  it('keeps local production verification aligned with the CI gate order', () => {
    expect(packageJson.scripts.verify).toBe(
      'npm run check && npm run check:public && npm test && npm run build:pages && npm run check:links:pages && npm run test:e2e:lifecycle:pages',
    );
  });
});
