// The hidden dev panel: every style choice in the secret layer is an option here, so Sam can flip between versions
// live instead of us picking. Options persist in localStorage (studium_secret_dev). Backquote toggles it once the
// layer is unlocked, or type "dev" in the = box. Modules add their own options with S.dev.define() and buttons with
// S.dev.action(); the ones from the brief are defined below so every agent reads the same keys.
import { FINISHES } from './slabs.js';

const KEY = 'studium_secret_dev';
export function createDev(S) {
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  const defs = [], subs = {}, actions = [], info = [];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {} };
  const el = S.el('div', 'sk-dev', ''); el.id = 'skDev'; document.body.appendChild(el);
  let rt = 0; const render = () => { clearTimeout(rt); rt = setTimeout(draw, 0); };
  const dev = {
    el, shown: false, order: 0,
    /* define('case', 'Vault case', { hard:'Hard case', safe:'Steel safe' }, 'hard') */
    define(key, label, choices, def) { const d = defs.find(x => x.key === key); if (d) { Object.assign(d.choices, choices); } else defs.push({ key, label, choices, def }); if (saved[key] == null || !(saved[key] in choices)) saved[key] = def; render(); return dev; },
    opt(key) { return saved[key]; },
    set(key, id) { if (saved[key] === id) return; saved[key] = id; save(); (subs[key] || []).forEach(f => { try { f(id); } catch (e) { console.error(e); } }); render(); },
    on(key, fn) { (subs[key] || (subs[key] = [])).push(fn); return dev; },
    action(label, fn, group) { actions.push({ label, fn, group: group || 'Try' }); render(); return dev; },
    info(fn) { info.push(fn); render(); return dev; },
    toggle(on) { dev.shown = on === undefined ? !dev.shown : !!on; el.classList.toggle('on', dev.shown); if (dev.shown) draw(); },
    refresh: render,
  };
  function draw() {
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let h = '<div class="sk-dh"><b>Secret · dev</b><span>' + info.map(f => { try { return esc(f()); } catch (e) { return ''; } }).filter(Boolean).join(' · ') + '</span><button class="sk-x" type="button" data-close aria-label="Close">×</button></div><div class="sk-opts">';
    defs.forEach(d => { const keys = Object.keys(d.choices), cur = saved[d.key];
      h += '<div class="sk-opt"><span>' + esc(d.label) + '</span>';
      if (keys.length > 6) h += '<select data-k="' + esc(d.key) + '">' + keys.map(k => '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(d.choices[k]) + '</option>').join('') + '</select>';
      else h += '<div class="sk-chips">' + keys.map(k => '<button type="button" class="sk-chip' + (k === cur ? ' on' : '') + '" data-k="' + esc(d.key) + '" data-v="' + esc(k) + '">' + esc(d.choices[k]) + '</button>').join('') + '</div>';
      h += '</div>'; });
    h += '</div>';
    const groups = [...new Set(actions.map(a => a.group))];
    groups.forEach(g => { h += '<div class="sk-acts"><em>' + esc(g) + '</em>' + actions.map((a, i) => a.group === g ? '<button type="button" class="btn" data-a="' + i + '">' + esc(a.label) + '</button>' : '').join('') + '</div>'; });
    el.innerHTML = h;
  }
  el.addEventListener('click', e => { const t = e.target.closest('[data-v],[data-a],[data-close]'); if (!t) return; e.stopPropagation();
    if (t.hasAttribute('data-close')) { dev.toggle(false); return; }
    if (t.dataset.a != null) { try { actions[+t.dataset.a].fn(); } catch (err) { console.error(err); } return; }
    dev.set(t.dataset.k, t.dataset.v); });
  el.addEventListener('change', e => { const s = e.target.closest('select[data-k]'); if (s) dev.set(s.dataset.k, s.value); });
  el.addEventListener('pointerdown', e => e.stopPropagation()); el.addEventListener('wheel', e => e.stopPropagation());
  el.addEventListener('keydown', e => e.stopPropagation());
  /* the options from the brief */
  dev.define('case', 'Vault case', { pelican: 'Ribbed polymer', flight: 'Flight case', carbon: 'Carbon' }, 'pelican');
  dev.define('hole', 'Round opening', { lift: 'Lift', iris: 'Aperture', petals: 'Petals', rings: 'Rings' }, 'lift');
  dev.define('clearing', 'Clearing prints', { sweep: 'Sweep', lift: 'Lift + drift' }, 'sweep');
  dev.define('keypad', 'Keypad', { rubber: 'Backlit rubber', brass: 'Brass + amber', glass: 'Glass touch' }, 'rubber');
  dev.define('dissolve', 'Dissolve', { vortex: 'Vortex', scatter: 'Scatter', sand: 'Sand' }, 'sand');
  dev.define('reel', 'Loot rail look', { neon: 'Neon rail', screen: 'Screen', lightbox: 'Lightbox' }, 'neon');
  dev.define('parcel', 'Delivery', { courier: 'Courier box', mailer: 'Padded mailer', crate: 'Mini crate' }, 'courier');
  const fin = { tier: 'By tier' }; FINISHES.forEach(f => { fin[f.id] = f.name + (f.tier ? ' (' + f.tier + ')' : ''); });
  dev.define('finishTest', 'Test finish (override)', fin, 'tier');   /* a new key: Sam had the old one stuck on one finish */
  dev.define('speed', 'Speed', { 1: 'Normal', 0.5: 'Half', 0.25: 'Quarter' }, '1');
  /* the wait for grading: a real day for students, shorter for testing (plus Skip the wait under Try) */
  dev.define('grading', 'Grading wait', { day: 'A real day', minute: 'One minute', instant: 'Instant' }, 'day');
  return dev;
}
export const DEV_CSS = `
#skDev{ position:fixed; top:calc(14px + env(safe-area-inset-top,0px)); right:max(14px, env(safe-area-inset-right,0px)); width:292px; max-height:calc(100vh - 40px); overflow:auto; background:var(--panel); border:1px solid var(--line); border-radius:6px; z-index:14; backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); box-shadow:0 18px 40px rgba(0,0,0,.35); opacity:0; pointer-events:none; transform:translateX(20px); transition:opacity .25s, transform .3s cubic-bezier(.2,.8,.2,1); font-family:var(--f-ui); color:var(--text); }
#skDev.on{ opacity:1; pointer-events:auto; transform:none; }
#skDev .sk-dh{ display:flex; align-items:center; gap:8px; padding:11px 10px 10px 14px; border-bottom:1px solid var(--line); }
#skDev .sk-dh b{ font:500 10px/1 var(--f-mono); letter-spacing:.16em; text-transform:uppercase; color:var(--accent); }
#skDev .sk-dh span{ flex:1; font:500 10px/1.3 var(--f-mono); color:var(--faint); text-align:right; }
#skDev .sk-x{ width:24px; height:24px; border:0; background:transparent; color:var(--faint); font:400 18px/1 var(--f-ui); cursor:pointer; }
#skDev .sk-opts{ padding:4px 14px 6px; }
#skDev .sk-opt{ display:grid; gap:6px; padding:9px 0; border-bottom:1px solid rgba(44,41,37,.7); }
#skDev .sk-opt>span{ font:500 11.5px/1.1 var(--f-ui); color:var(--faint); }
#skDev .sk-chips{ display:flex; flex-wrap:wrap; gap:4px; }
#skDev .sk-chip{ height:26px; padding:0 9px; border-radius:4px; border:1px solid var(--line); background:var(--raise); color:var(--faint); font:500 11px/1 var(--f-ui); cursor:pointer; }
#skDev .sk-chip:hover{ color:var(--text); border-color:#4a453e; }
#skDev .sk-chip.on{ background:var(--text); color:#1a1714; border-color:var(--text); }
#skDev select{ height:28px; border-radius:4px; border:1px solid var(--line); background:var(--raise); color:var(--text); font:500 12px/1 var(--f-ui); padding:0 6px; }
#skDev .sk-acts{ display:flex; flex-wrap:wrap; gap:5px; padding:10px 14px; border-top:1px solid var(--line); align-items:center; }
#skDev .sk-acts em{ width:100%; font:500 10px/1 var(--f-mono); letter-spacing:.14em; text-transform:uppercase; color:var(--faint); font-style:normal; margin-bottom:2px; }
#skDev .sk-acts .btn{ height:28px; padding:0 10px; font-size:11.5px; }
`;
