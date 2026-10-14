import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

export async function startServer({ root = path.resolve('dist'), port = 4173 } = {}) {
  const absoluteRoot = path.resolve(root);
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(requestUrl.pathname);
      let filePath = path.resolve(absoluteRoot, `.${pathname}`);

      if (!filePath.startsWith(absoluteRoot)) {
        response.writeHead(403).end('Forbidden');
        return;
      }

      let details;
      try {
        details = await stat(filePath);
      } catch {
        filePath = path.join(absoluteRoot, 'index.html');
        details = await stat(filePath);
      }
      if (details.isDirectory()) filePath = path.join(filePath, 'index.html');

      const body = await readFile(filePath);
      response.writeHead(200, {
        'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      response.end(body);
    } catch (error) {
      response.writeHead(500).end('Server error');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}
