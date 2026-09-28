import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.vercel', 'output');
const connected = process.argv.includes('--connected');
const backend = connected ? new URL(process.env.PROOFLANE_BACKEND_ORIGIN ?? '') : null;
if (backend && (backend.protocol !== 'https:' || backend.username || backend.password || backend.pathname !== '/' || backend.search || backend.hash)) {
  throw new Error('PROOFLANE_BACKEND_ORIGIN must be a public HTTPS origin without a path or credentials');
}
// This fixed build directory is disposable; project/account linkage lives above it.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'dist'), path.join(output, 'static'), { recursive: true });
const config = JSON.parse(await readFile(path.join(root, 'vercel-output.json'), 'utf8'));
if (backend) {
  const reserved = config.routes.findIndex(route => route.dest === '/backend-unavailable.json');
  config.routes.splice(reserved, 1, ...['api', 'auth'].map(prefix => ({
    src: `/${prefix}(?:/(.*))?`, dest: `${backend.origin}/${prefix}/$1`,
    headers: { 'Cache-Control': 'no-store' },
  })));
  // Keycloak supplies its own CSP for identity pages, including its theme scripts.
  const policy = config.routes[0].headers['Content-Security-Policy'];
  delete config.routes[0].headers['Content-Security-Policy'];
  config.routes.splice(1, 0, { src: '/(?!auth(?:/|$))(.*)', headers: { 'Content-Security-Policy': policy }, continue: true });
}
await writeFile(path.join(output, 'config.json'), JSON.stringify(config, null, 2) + '\n');
await writeFile(path.join(output, 'static', 'backend-unavailable.json'), JSON.stringify({
  detail: 'This deployment hosts the frontend only. The workspace backend is not connected.',
}) + '\n');
const files = await readdir(path.join(output, 'static'), { recursive: true });
if (files.some(name => /(?:^|[\\/])\.env|\.map$|\.pem$|\.key$/i.test(name))) {
  throw new Error('Unexpected private or source-map file in the deployment output');
}
console.log(`Prepared ${connected ? "connected" : "frontend-only"} Vercel output (${files.length} entries). No backend credentials are required.`);
