import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname } from 'node:path';

const port = 4173;
// Só o app e os arquivos de instalação no celular, na raiz de dist/, como no GitHub Pages.
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

createServer(async (request, response) => {
  const { pathname } = new URL(request.url, `http://127.0.0.1:${port}`);
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  const type = TYPES[extname(name)];
  if (!type || !/^[\w.-]+$/.test(name)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const body = await readFile(`dist/${name}`);
    response.writeHead(200, { 'content-type': type, 'x-content-type-options': 'nosniff' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, '127.0.0.1');
