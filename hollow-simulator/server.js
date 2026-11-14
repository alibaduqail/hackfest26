import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = dirname(fileURLToPath(import.meta.url));
const files = { '/': ['index.html', 'text/html'], '/style.css': ['style.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'], '/scenario.js': ['scenario.js', 'text/javascript'], '/simulation.js': ['simulation.js', 'text/javascript'], '/controller.js': ['controller.js', 'text/javascript'] };
createServer(async (req, res) => {
  const entry = files[new URL(req.url, 'http://localhost').pathname];
  if (!entry) { res.writeHead(404); res.end('Not found'); return; }
  try { const data = await readFile(join(root, entry[0])); res.writeHead(200, { 'Content-Type': `${entry[1]}; charset=utf-8`, 'Cache-Control': 'no-store' }); res.end(data); }
  catch { res.writeHead(500); res.end('Could not read file'); }
}).listen(4173, '127.0.0.1', () => console.log('The Hollow: http://127.0.0.1:4173'));
