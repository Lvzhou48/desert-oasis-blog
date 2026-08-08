import { dev } from 'astro';

export default async function startAstroForPlaywright() {
  const server = await dev({
    root: process.cwd(),
    server: { host: '127.0.0.1', port: 4321 },
  });
  return async () => server.stop();
}
