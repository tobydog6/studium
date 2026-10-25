// PostToolUse hook: after Claude edits anything in src/, parse the assembled page. A syntax error is fed straight
// back to Claude (exit 2) so it gets fixed before the next step, not discovered in a 300 MB build.
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
let raw = ''; process.stdin.on('data', (d) => (raw += d)); process.stdin.on('end', () => {
  let f = ''; try { const j = JSON.parse(raw); f = (j.tool_input && (j.tool_input.file_path || j.tool_input.path)) || ''; } catch (e) {}
  if (!/[\\/]src[\\/].+\.(js|html)$/.test(f) || !resolve(f).startsWith(ROOT)) process.exit(0);
  try { execFileSync('node', [join(ROOT, 'tools', 'check-js.mjs')], { stdio: ['ignore', 'ignore', 'pipe'] }); process.exit(0); }
  catch (e) { process.stderr.write('Syntax check failed after editing ' + f + ':\n' + String(e.stderr || e.message)); process.exit(2); }
});
