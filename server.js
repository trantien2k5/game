import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve('.');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};
let port = Number(process.env.PORT) || 4173;
const server = http.createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const target = (await stat(path)).isDirectory() ? resolve(path, 'index.html') : path;
    const content = await readFile(target);
    res.writeHead(200, {
      'Content-Type': types[extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  } catch {
    res.writeHead(404).end('Not found');
  }
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && port < 4200) server.listen(++port, '127.0.0.1');
  else {
    console.error(err);
    process.exit(1);
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Mạch Vườn: http://localhost:${port}`));
