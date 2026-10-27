import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function resolveFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  const candidate = path.normalize(path.join(root, decoded === '/' ? 'index.html' : decoded));
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
  try {
    const stats = statSync(candidate);
    if (stats.isDirectory()) {
      const index = path.join(candidate, 'index.html');
      return statSync(index).isFile() ? index : null;
    }
    return stats.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method Not Allowed');
    return;
  }

  let pathname;
  try {
    pathname = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
  } catch {
    response.writeHead(400);
    response.end('Bad Request');
    return;
  }

  const filePath = resolveFile(pathname);
  if (!filePath) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const cacheControl =
    extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable';
  const stats = statSync(filePath);

  response.writeHead(200, {
    'Content-Type': mimeTypes[extension] || 'application/octet-stream',
    'Content-Length': stats.size,
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on('error', () => {
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
  stream.pipe(response);
});

server.listen(port, host, () => {
  console.log(`[moss-and-timber] serving ${root}`);
  console.log(`[moss-and-timber] http://127.0.0.1:${port}/`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
