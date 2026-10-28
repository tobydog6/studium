// One state machine for every secret sequence. States are dotted names ("vault.rising", "loot.reel"); an event or
// pointer/key/frame call goes to the current state first, then to its parents ("vault"), then to "*".
// A state: { busy, enter(data, run), exit(next), on:{ EVENT: 'target' | (payload, M) => 'target'|void },
//            pointer(kind, e, M) → true if handled, key(e, M) → true if handled, frame(dt, M) }
// enter() may be async; run.alive() goes false as soon as the machine leaves that state, so a sequence stops cleanly:
//   async enter(d, run){ await tween(...); if(!run.alive()) return; M.go('vault.keypad'); }

export function createMachine() {
  const defs = {}, subs = [];
  let gen = 0;
  const M = {
    state: 'locked', data: {}, prev: null,
    define(name, def) { defs[name] = def || {}; return M; },
    defined(name) { return !!defs[name]; },
    /* the state and its parents, most specific first: vault.lid.open → vault.lid.open, vault.lid, vault, * */
    chain(s = M.state) { const out = [], parts = s.split('.'); for (let i = parts.length; i > 0; i--) out.push(parts.slice(0, i).join('.')); out.push('*'); return out; },
    is(prefix) { return M.state === prefix || M.state.startsWith(prefix + '.'); },
    busy() { return M.chain().some(n => defs[n] && defs[n].busy); },
    /* idle = unlocked and nothing playing; the normal table works then */
    active() { return M.state !== 'idle' && M.state !== 'locked'; },
    go(target, payload) {
      if (!target) return;
      const from = M.state, fd = defs[from];
      if (fd && fd.exit) try { fd.exit(target, M); } catch (e) { console.error(e); }
      M.prev = from; M.state = target; const my = ++gen;
      const run = { alive: () => gen === my && M.state === target, from };
      subs.forEach(f => { try { f(target, from); } catch (e) {} });
      const td = defs[target];
      if (td && td.enter) { try { const r = td.enter(payload === undefined ? M.data : payload, run); if (r && r.catch) r.catch(e => console.error(e)); } catch (e) { console.error(e); } }
      return run;
    },
    send(ev, payload) {
      for (const n of M.chain()) { const d = defs[n]; const h = d && d.on && d.on[ev];
        if (h == null) continue;
        const t = typeof h === 'function' ? h(payload, M) : h;
        if (typeof t === 'string') M.go(t, payload);
        return true; }
      return false;
    },
    pointer(kind, e) { for (const n of M.chain()) { const d = defs[n]; if (d && d.pointer && d.pointer(kind, e, M)) return true; } return false; },
    key(e) { for (const n of M.chain()) { const d = defs[n]; if (d && d.key && d.key(e, M)) return true; } return false; },
    frame(dt) { for (const n of M.chain()) { const d = defs[n]; if (d && d.frame) try { d.frame(dt, M); } catch (err) { console.error(err); } } },
    onChange(fn) { subs.push(fn); },
  };
  return M;
}
