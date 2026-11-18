import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const port = 4173;

createServer(async (request, response) => {
  const { pathname } = new URL(request.url, `http://127.0.0.1:${port}`);
  if (pathname !== '/' && pathname !== '/index.html') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(await readFile('dist/index.html'));
}).listen(port, '127.0.0.1');
