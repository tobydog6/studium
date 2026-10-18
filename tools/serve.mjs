// Serves a folder over http for trying the web build locally:  node tools/serve.mjs [dir=dist/web] [port=8080]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve, normalize } from 'node:path';
const DIR = resolve(process.argv[2] || 'dist/web'), PORT = +(process.argv[3] || 8080);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.json': 'application/json' };
createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(req.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html';
  const f = join(DIR, p); if (!f.startsWith(DIR)) { res.writeHead(403).end(); return; }
  try { const b = await readFile(f); res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }).end(b); }
  catch { res.writeHead(404).end('not found'); }
}).listen(PORT, () => console.log(`Serving ${DIR} at http://localhost:${PORT}/`));
