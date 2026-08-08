import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import net from 'node:net';
import { lifecycleEnvironment } from './e2e-lifecycle-options.mjs';

const require = createRequire(import.meta.url);
const playwrightCli = require.resolve('@playwright/test/cli');
const timeoutMs = Number(process.env.E2E_LIFECYCLE_TIMEOUT_MS ?? 60_000);
const cleanupTimeoutMs = 5_000;
const host = '127.0.0.1';
const port = 4321;

async function assertPortReusable(context) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', (error) => {
      reject(new Error(`${context}: cannot bind ${host}:${port} (${error.code ?? error.message})`));
    });
    server.listen({ host, port, exclusive: true }, resolve);
  });
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function withTimeout(promise, milliseconds, timeoutValue) {
  let handle;
  const timeout = new Promise((resolve) => {
    handle = setTimeout(() => resolve(timeoutValue), milliseconds);
  });
  return await Promise.race([promise, timeout]).finally(() => clearTimeout(handle));
}

async function terminateChild(child, exit) {
  if (child.exitCode !== null || child.signalCode !== null) return exit;
  child.kill();
  const result = await withTimeout(exit, cleanupTimeoutMs, { cleanupTimedOut: true });
  if ('cleanupTimedOut' in result) {
    child.kill('SIGKILL');
    child.unref();
    throw new Error(`Playwright did not close within ${cleanupTimeoutMs}ms after termination`);
  }
  return result;
}

async function run() {
  await assertPortReusable('Lifecycle check requires a reusable port');
  const startedAt = Date.now();
  const child = spawn(process.execPath, [playwrightCli, 'test'], {
    cwd: process.cwd(),
    env: lifecycleEnvironment(process.argv.slice(2), process.env),
    stdio: 'inherit',
    windowsHide: true,
  });
  const exit = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  const result = await withTimeout(exit, timeoutMs, { timedOut: true });

  if ('timedOut' in result) {
    await terminateChild(child, exit);
    await assertPortReusable('Timed-out Playwright cleanup failed');
    throw new Error(`Playwright did not exit naturally within ${timeoutMs}ms`);
  }
  if (result.code !== 0) {
    await assertPortReusable('Failed Playwright cleanup failed');
    throw new Error(`Playwright exited with code ${result.code ?? 'null'} and signal ${result.signal ?? 'none'}`);
  }

  await assertPortReusable('Successful Playwright cleanup failed');
  console.log(`E2E lifecycle passed in ${Date.now() - startedAt}ms; port 4321 was released.`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
