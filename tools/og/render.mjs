// Renders tools/og/og.html to assets/web/og.jpg (1200x630), the studium.nz link preview / Google image.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto('file://' + join(ROOT, 'tools/og/og.html')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
await p.screenshot({ path: join(ROOT, 'assets/web/og.jpg'), type: 'jpeg', quality: 90 });
await b.close(); console.log('wrote assets/web/og.jpg');
