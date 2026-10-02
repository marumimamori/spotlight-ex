import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const routes = new Map([
  ['/', ['tests/fixture.html', 'text/html']],
  ['/fixture.js', ['tests/fixture.js', 'text/javascript']],
  ['/regression.js', ['tests/regression.js', 'text/javascript']],
  ['/main.js', ['src/main.js', 'text/javascript']],
  ['/styles.css', ['styles.css', 'text/css']],
]);
const server = createServer(async (request, response) => {
  const route = routes.get(new URL(request.url, 'http://localhost').pathname);
  if (!route) { response.writeHead(404).end(); return; }
  try {
    response.writeHead(200, { 'Content-Type': `${route[1]}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(await readFile(resolve(root, route[0])));
  } catch (error) { response.writeHead(500).end(String(error)); }
});
server.listen(4319, '127.0.0.1', () => console.log('Spotlight regression fixture: http://127.0.0.1:4319'));
