// SOUND: every sound the pull makes, synthesised with Web Audio (no files, nothing loaded). Sam's reference is the
// CS:GO case opening, where the ticking builds the suspense, so the detent tick is the centrepiece: a short, bright,
// slightly wooden click whose pitch and weight follow the rail's speed (fast = light and high, the last slow ticks
// heavy, low and ringing a little). The roll-back tick sags instead. See docs/secret-round2.md.
//   S.snd = { play(id, o) → { stop(fade) } | null, loop(id, o) → { stop(fade), set(gain) }, tick(vel 0..1, back?) }
// Ids: tick, tickBack, rumble (o.gain builds it, o.dur ends it), land, slam, flip, burst, chime (o.tier), pop, film,
// tape, cardboard, tissue, countTick (o.i / o.n), countFinal, blind (o.dur), rise, sink, servo, glow; loops: hum,
// safelight, rumble. Every voice is in one table, so an unknown id is silent and nothing here ever throws.
// The context is made and resumed on the first pointerdown / keydown / click in this iframe (its document or the
// table canvas; the parent page too when it is same origin), and every call is a no-op while it is suspended or
// audio is unavailable, so nothing queues up and bursts out on the first click. The level follows the parent's
// Setup > Sound (studium_sound_lv, shared localStorage): master about 0.5 into a compressor, so nothing clips.
const LV = [0, 0.35, 0.65, 1];
const N = { A3: 220, E4: 329.63, A4: 440, Cs5: 554.37, E5: 659.25, A5: 880, Cs6: 1108.73, E6: 1318.51, A6: 1760, Cs7: 2217.46, E7: 2637.02, A7: 3520 };
const SEND = { land: 0.1, slam: 0.3, flip: 0.08, burst: 0.25, chime: 0.4, pop: 0.15, countFinal: 0.35, blind: 0.1, rise: 0.12, sink: 0.12, servo: 0.05, glow: 0.5 };
const EVS = ['pointerdown', 'keydown', 'click'];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);

export function install(S) {
  const A = { ctx: null, out: null, verb: null, nb: null, dead: false, armed: false, lvT: 0, lastTick: 0, rumble: null };
  const level = () => { let lv = 2; try { const v = localStorage.getItem('studium_sound_lv'); if (v != null && LV[+v] != null) lv = +v; } catch (e) {} return LV[lv]; };

  /* ---------- the context: made on the first gesture, a compressor on the master, a short dark room for the sends ---------- */
  function make() { const C = window.AudioContext || window.webkitAudioContext; if (!C) { A.dead = true; return; }
    try { const c = new C(), sr = c.sampleRate;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25; comp.connect(c.destination);
      const out = c.createGain(); out.gain.value = 0.5 * level(); out.connect(comp);
      const nb = c.createBuffer(2, sr * 2, sr); for (let ch = 0; ch < 2; ch++) { const d = nb.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const rl = Math.floor(sr * 1.6), ir = c.createBuffer(2, rl, sr); for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < rl; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 3.2); }
      const verb = c.createConvolver(); verb.buffer = ir; const vl = c.createBiquadFilter(); vl.type = 'lowpass'; vl.frequency.value = 3800; const vg = c.createGain(); vg.gain.value = 0.3; verb.connect(vl); vl.connect(vg); vg.connect(out);
      A.ctx = c; A.out = out; A.nb = nb; A.verb = verb; }
    catch (e) { A.dead = true; A.ctx = null; } }
  /* the running context, or null: nothing plays until a gesture has armed it and it is actually running */
  function get() { if (A.dead) return null; if (!A.ctx) { if (!A.armed) return null; make(); if (!A.ctx) return null; }
    const c = A.ctx; if (c.state !== 'running') { try { const p = c.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {} return null; }
    const now = Date.now(); if (now - A.lvT > 1000) { A.lvT = now; A.out.gain.setTargetAtTime(0.5 * level(), c.currentTime, 0.05); }
    return c; }
  function arm() { A.armed = true; get(); }
  function hear(doc) { if (!doc || !doc.addEventListener) return; EVS.forEach(ev => doc.addEventListener(ev, arm, { capture: true, passive: true })); }
  try { hear(document); } catch (e) {}
  try { hear(S.ctx && S.ctx.canvas); } catch (e) {}
  try { if (window.parent && window.parent !== window) hear(window.parent.document); } catch (e) {}

  /* ---------- the voice kit: a bus per call, envelopes, tones, filtered noise ---------- */
  const bus = (vol, send, pan) => { const c = A.ctx, g = c.createGain(); g.gain.value = vol == null ? 1 : vol; let o = g;
    if (pan != null && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); o = p; } o.connect(A.out);
    if (send) { const s = c.createGain(); s.gain.value = send; g.connect(s); s.connect(A.verb); } return g; };
  const env = (g, t, a, pk, h, r) => { pk = Math.max(pk, 0.0002); a = Math.max(a, 0.001); h = Math.max(h, 0); r = Math.max(r, 0.005);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + a); g.gain.setValueAtTime(pk, t + a + h); g.gain.exponentialRampToValueAtTime(0.0001, t + a + h + r); return a + h + r; };
  const tone = (b, t, f, type, a, pk, h, r, f2, det) => { const c = A.ctx, o = c.createOscillator(), g = c.createGain(), T = env(g, t, a, pk, h, r);
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + T); if (det) o.detune.value = det; o.connect(g); g.connect(b); o.start(t); o.stop(t + T + 0.05); return o; };
  const noise = (b, t, ft, f, q, a, pk, h, r, f2) => { const c = A.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(), T = env(g, t, a, pk, h, r);
    s.buffer = A.nb; s.loop = true; fl.type = ft; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + T); fl.Q.value = q || 0.7; s.connect(fl); fl.connect(g); g.connect(b); s.start(t, Math.random() * 1.5); s.stop(t + T + 0.05); return fl; };
  /* a dry wooden click: a narrow noise snap with a short sine body under it */
  const wood = (b, t, f, pk, r) => { noise(b, t, 'bandpass', f, 4, 0.001, pk, 0.002, r); tone(b, t, f * 0.5, 'sine', 0.002, pk * 0.55, 0.004, r * 1.3, f * 0.3); };
  const thump = (b, t, f, pk, r) => tone(b, t, f, 'sine', 0.004, pk, 0.01, r, f * 0.38);
  const glint = (b, t, f, pk, r) => tone(b, t, f, 'sine', 0.004, pk, 0.01, r || 0.9);
  /* a felt piano note: four harmonics under a lowpass that closes as it fades */
  const felt = (b, t, f, pk, len) => { const c = A.ctx, g = c.createGain(), lp = c.createBiquadFilter(); len = len || 1.6; lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 5, t); lp.frequency.exponentialRampToValueAtTime(f * 1.6, t + Math.min(1.2, len));
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(pk, 0.0002), t + 0.012); g.gain.exponentialRampToValueAtTime(Math.max(pk * 0.35, 0.0002), t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + len); lp.connect(g); g.connect(b);
    [[1, 1], [2, 0.32], [3, 0.1], [4.02, 0.05]].forEach(h => { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = f * h[0]; og.gain.value = h[1]; o.connect(og); og.connect(lp); o.start(t); o.stop(t + len + 0.1); }); };
  /* a chord of detuned saws behind a lowpass that opens over the attack: the swell under the bigger reveals */
  const swell = (b, t, freqs, a, pk, h, r, top) => { const c = A.ctx, T = a + h + r; freqs.forEach((f, i) => { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(220, t); lp.frequency.exponentialRampToValueAtTime(top || 4800, t + a + h * 0.5); lp.frequency.exponentialRampToValueAtTime(600, t + T);
    const g = c.createGain(); env(g, t, a, pk, h, r); lp.connect(g); g.connect(b);
    [-7, 6].forEach(det => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det + (i - freqs.length / 2) * 2; o.connect(lp); o.start(t); o.stop(t + T + 0.1); }); }); };
  /* one drip in the darkroom: a plink that rises as the drop lets go, with the room on it */
  const drip = (b, t) => { const c = A.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(rnd(520, 760), t); o.frequency.exponentialRampToValueAtTime(rnd(1300, 1900), t + 0.05); env(g, t, 0.003, 0.07, 0.004, 0.28); o.connect(g); g.connect(b); o.start(t); o.stop(t + 0.4); };

  /* ---------- the tick: the detent of the rail going by, its character following the speed ---------- */
  function tickAt(b, t, vel, back) { const c = A.ctx, slow = 1 - clamp(vel == null ? 0.5 : vel, 0, 1);
    const f = back ? 1500 - 500 * slow : 2700 - 1500 * slow;   /* bright and light at speed, lower and heavier as the rail slows */
    noise(b, t, 'bandpass', f, back ? 2.2 : 3.5, 0.001, 0.08 + 0.26 * slow, 0.002, 0.018 + 0.045 * slow);
    /* the wooden body: a sine that drops fast; the roll-back tick sags instead, a longer droop with the top taken off */
    const o = c.createOscillator(), g = c.createGain(), fb = back ? 420 - 120 * slow : 760 - 330 * slow, r = back ? 0.11 + 0.08 * slow : 0.03 + 0.06 * slow;
    o.type = 'triangle'; o.frequency.setValueAtTime(fb, t); o.frequency.exponentialRampToValueAtTime(fb * (back ? 0.45 : 0.6), t + r); env(g, t, 0.0015, (0.05 + 0.22 * slow) * (back ? 0.9 : 1), 0.003, r); o.connect(g);
    if (back) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; g.connect(lp); lp.connect(b); } else g.connect(b); o.start(t); o.stop(t + r + 0.05);
    /* the slow final ticks ring a little: a low resonance that only comes in under about a third of full speed */
    if (slow > 0.6) { const k = (slow - 0.6) / 0.4; tone(b, t, back ? 150 : 190, 'sine', 0.003, 0.05 + 0.1 * k, 0.01, 0.1 + 0.18 * k, back ? 110 : 160); } }
  function tick(vel, back) { const c = get(); if (!c) return; const t = c.currentTime; if (t - A.lastTick < 0.012) return; A.lastTick = t;
    try { const slow = 1 - clamp(vel == null ? 0.5 : vel, 0, 1); tickAt(bus(1, 0.1 + 0.35 * slow), t, vel, back); } catch (e) {} }

  /* ---------- the rumble: one low pad kept alive, built up and let go through its gain ---------- */
  function rumbleNode() { if (A.rumble) return A.rumble; const c = A.ctx, g = c.createGain(), f = c.createBiquadFilter(); g.gain.value = 0; f.type = 'lowpass'; f.frequency.value = 120; f.Q.value = 1.2; f.connect(g); g.connect(A.out);
    [[42, 'sawtooth', 0.5], [31, 'sine', 0.8], [63, 'sawtooth', 0.25]].forEach(([fr, ty, k]) => { const o = c.createOscillator(), og = c.createGain(); o.type = ty; o.frequency.value = fr; og.gain.value = k; o.connect(og); og.connect(f); o.start(); });
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.9; lg.gain.value = 25; lfo.connect(lg); lg.connect(f.frequency); lfo.start();   /* a slow churn in the filter */
    return (A.rumble = { g, f }); }
  function rumble(o) { const r = rumbleNode(), t = A.ctx.currentTime, k = clamp(o.gain == null ? 1 : o.gain, 0, 1);
    const set = (k, ramp) => { const tt = A.ctx.currentTime; r.g.gain.cancelScheduledValues(tt); r.g.gain.setTargetAtTime(0.2 * clamp(k, 0, 1), tt, ramp == null ? 0.12 : ramp); r.f.frequency.setTargetAtTime(110 + 320 * clamp(k, 0, 1), tt, 0.15); };
    set(k, o.ramp); if (o.dur) r.g.gain.setTargetAtTime(0, t + o.dur, 0.25);
    return { set(k) { try { set(k); } catch (e) {} }, stop(fade) { try { r.g.gain.setTargetAtTime(0, A.ctx.currentTime, (fade == null ? 0.6 : fade) / 2); } catch (e) {} } }; }

  /* ---------- the chimes, one per tier ---------- */
  const CHIME = {
    common: (b, t) => { felt(b, t, N.A5, 0.16, 1.4); },
    uncommon: (b, t) => { felt(b, t, N.A5, 0.15, 1.3); felt(b, t + 0.11, N.E6, 0.12, 1.6); },
    rare: (b, t) => { [N.A5, N.Cs6, N.E6, N.A6].forEach((f, i) => felt(b, t + i * 0.075, f, 0.12, 1.6)); for (let i = 0; i < 5; i++) glint(b, t + 0.35 + i * 0.09 + rnd(0, 0.04), [N.E7, N.A7, N.Cs7][i % 3] * rnd(0.995, 1.005), 0.03, 0.7); },
    epic: (b, t) => { swell(b, t, [N.A3, N.E4, N.A4, N.Cs5, N.E5], 0.35, 0.05, 0.4, 1.6, 5200); [N.A5, N.Cs6, N.E6, N.A6].forEach((f, i) => felt(b, t + 0.05 + i * 0.06, f, 0.1, 1.8));
      for (let i = 0; i < 9; i++) glint(b, t + 0.2 + i * 0.07 + rnd(0, 0.05), [N.E7, N.A7, N.Cs7, N.A6][i % 4] * rnd(0.994, 1.006), 0.03, 0.9); },
    /* a slow gold swell, then the hit: the slam comes in at 1.45 s with the glints raining after it */
    legendary: (b, t) => { swell(b, t, [N.A3, N.E4, N.A4, N.Cs5, N.E5, N.A5], 1.3, 0.05, 0.15, 1.6, 6000); glint(b, t + 0.5, N.A6, 0.04, 1.4); glint(b, t + 0.9, N.Cs7, 0.04, 1.2);
      V.slam(b, t + 1.45, { k: 0.85 }); felt(b, t + 1.46, N.A4, 0.14, 2.2); felt(b, t + 1.46, N.Cs5, 0.1, 2.2); felt(b, t + 1.48, N.A5, 0.1, 2.4);
      for (let i = 0; i < 12; i++) glint(b, t + 1.55 + i * 0.06 + rnd(0, 0.05), [N.A7, N.E7, N.Cs7, N.A6][i % 4] * rnd(0.994, 1.006), 0.035, 1.0); },
    /* the blackout: nothing for a beat, then the eclipse cluster swells with a sub falling away under it, and the flash */
    mythic: (b, t) => { const c = A.ctx, t0 = t + 0.85; tone(b, t0, 70, 'sine', 0.02, 0.6, 0.1, 1.6, 22);
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.5; lg.gain.value = 7; lfo.connect(lg); lfo.start(t0); lfo.stop(t0 + 4.5);
      [220, 233.08, 246.94, 329.63, 349.23, 466.16].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(); o.type = i < 4 ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = (i - 2.5) * 3; lg.connect(o.detune);
        lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t0); lp.frequency.exponentialRampToValueAtTime(2600, t0 + 0.7); lp.frequency.exponentialRampToValueAtTime(500, t0 + 3.6); env(g, t0, 0.6, 0.045, 1.0, 2.4); o.connect(lp); lp.connect(g); g.connect(b); o.start(t0); o.stop(t0 + 4.2); });
      noise(b, t0, 'bandpass', 380, 1.4, 0.65, 0.08, 0.02, 0.4, 2600); V.burst(b, t0 + 0.7, { k: 0.8 }); glint(b, t0 + 0.72, N.A7, 0.03, 1.6); glint(b, t0 + 0.75, N.E7, 0.025, 1.8); },
  };

  /* ---------- the voices: (bus, time, options) ---------- */
  const V = {
    tick: (b, t, o) => tickAt(b, t, o.vel, !!o.back),
    tickBack: (b, t, o) => tickAt(b, t, o.vel, true),
    rumble: (b, t, o) => rumble(o),
    /* a soft thud with felt on it: a damped low knock and no ring */
    land: (b, t) => { thump(b, t, 120, 0.5, 0.32); noise(b, t, 'lowpass', 520, 0.8, 0.003, 0.16, 0.01, 0.09, 180); tone(b, t + 0.004, 240, 'sine', 0.002, 0.06, 0.004, 0.06, 150); },
    /* the legendary hit: sub, a slab of noise, and the metallic ring of inharmonic partials off the strike */
    slam: (b, t, o) => { const k = o.k == null ? 1 : o.k; thump(b, t, 95, 0.75 * k, 0.7); tone(b, t, 55, 'sine', 0.006, 0.5 * k, 0.1, 1.0, 24); noise(b, t, 'lowpass', 3200, 0.7, 0.004, 0.45 * k, 0.01, 0.5, 160);
      [1, 1.42, 1.79, 2.31, 2.93].forEach((m, i) => tone(b, t + 0.01, 640 * m, 'sine', 0.004, 0.045 * k / (1 + i * 0.4), 0.02, 1.3 - i * 0.12)); },
    /* the card flick: a whoosh sweeping up, a tiny snap at the end of the turn */
    flip: (b, t) => { noise(b, t, 'bandpass', 450, 0.9, 0.09, 0.32, 0.02, 0.17, 5200); noise(b, t + 0.2, 'highpass', 2600, 0.6, 0.001, 0.1, 0.002, 0.03); tone(b, t + 0.2, N.A6, 'sine', 0.003, 0.05, 0.01, 0.5); },
    /* the edge-on flash: a bright burst with a shimmer rising out of it */
    burst: (b, t, o) => { const k = o.k == null ? 1 : o.k; noise(b, t, 'highpass', 1800, 0.5, 0.004, 0.38 * k, 0.02, 0.32, 6000); noise(b, t, 'bandpass', 900, 1.2, 0.002, 0.2 * k, 0.005, 0.12);
      [N.E6, 1980, N.E7].forEach((f, i) => tone(b, t + 0.02 + i * 0.03, f, 'sine', 0.02, 0.05 * k, 0.05, 0.5, f * 2)); },
    chime: (b, t, o) => (CHIME[o.tier] || CHIME.common)(b, t),
    /* the canister: the lid lets go with a pop, then a short hollow note from the tube */
    pop: (b, t) => { tone(b, t, 360, 'sine', 0.002, 0.4, 0.004, 0.07, 120); noise(b, t, 'bandpass', 1900, 1.5, 0.001, 0.22, 0.003, 0.04); tone(b, t + 0.006, 520, 'triangle', 0.002, 0.07, 0.01, 0.14, 430); },
    /* the tongue of film curling out: a crinkle of tiny clicks that rise as it goes, over a soft sweep */
    film: (b, t, o) => { const d = o.dur || 0.55; noise(b, t, 'bandpass', 1400, 1.4, 0.08, 0.09, d * 0.5, d * 0.4, 3800);
      for (let i = 0, n = 22; i < n; i++) { const k = i / n; noise(b, t + k * d + rnd(0, 0.02), 'bandpass', 2200 + 2600 * k + rnd(0, 800), 5, 0.001, rnd(0.06, 0.12), 0.001, 0.012); } },
    /* tape off the courier box: the tear stutters faster as it goes, then the end lets go with a snap */
    tape: (b, t, o) => { const c = A.ctx, d = o.dur || 0.5, tg = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(); tg.gain.value = 0.55; lfo.type = 'square'; lfo.frequency.setValueAtTime(34, t); lfo.frequency.linearRampToValueAtTime(62, t + d); lg.gain.value = 0.45; lfo.connect(lg); lg.connect(tg.gain); lfo.start(t); lfo.stop(t + d + 0.1); tg.connect(b);
      noise(tg, t, 'bandpass', 800, 1.1, 0.03, 0.5, d * 0.7, d * 0.3, 3000); noise(tg, t, 'highpass', 3500, 0.5, 0.05, 0.14, d * 0.6, d * 0.4);
      noise(b, t + d, 'bandpass', 2400, 2, 0.001, 0.18, 0.003, 0.05); tone(b, t + d, 500, 'sine', 0.002, 0.08, 0.004, 0.05, 200); },
    /* the flaps: each one a scrape as it bends and a soft dull knock as it lands */
    cardboard: (b, t, o) => { for (let i = 0, n = o.n || 2; i < n; i++) { const tt = t + i * 0.19; noise(b, tt, 'bandpass', 700, 0.8, 0.03, 0.16, 0.02, 0.12, 300); thump(b, tt + 0.05, 160, 0.14, 0.12); noise(b, tt + 0.05, 'lowpass', 900, 0.7, 0.002, 0.12, 0.004, 0.06); } },
    /* tissue parting: a soft high rustle with a few crinkles in it */
    tissue: (b, t, o) => { const d = o.dur || 0.45; noise(b, t, 'highpass', 2800, 0.6, 0.1, 0.17, d * 0.4, d * 0.5, 1500); for (let i = 0; i < 9; i++) noise(b, t + 0.03 + rnd(0, d * 0.8), 'bandpass', rnd(3500, 6500), 6, 0.001, 0.05, 0.001, 0.01); },
    /* the grade counting up: a wooden tick that climbs with o.i / o.n, then the loudest one with a ring on it */
    countTick: (b, t, o) => { const k = clamp(o.n ? (o.i || 0) / o.n : 0, 0, 1); wood(b, t, 1500 + 1700 * k, 0.1 + 0.16 * k, 0.025 + 0.01 * k); },
    countFinal: (b, t) => { wood(b, t, 3300, 0.42, 0.05); thump(b, t, 170, 0.3, 0.18); tone(b, t + 0.005, N.A6, 'sine', 0.003, 0.1, 0.02, 1.1); tone(b, t + 0.005, N.E7, 'sine', 0.003, 0.05, 0.02, 0.8); },
    /* the roller blind: a ratchet that runs fast through the middle and slows into the stop, over a whirr, then a thunk */
    blind: (b, t, o) => { const d = Math.max(0.4, o.dur || 1.4), n = Math.min(90, Math.round(d * 26)); noise(b, t, 'bandpass', 650, 0.9, 0.08, 0.1, Math.max(0.05, d - 0.35), 0.3, 1100);
      for (let i = 0; i < n; i++) { const k = (i + 0.5) / n, tt = t + d * (k + 0.12 * Math.sin(2 * Math.PI * k)); wood(b, tt, 1900 + rnd(-200, 200), rnd(0.05, 0.085), 0.012); }
      thump(b, t + d, 140, 0.25, 0.16); noise(b, t + d, 'lowpass', 1100, 0.7, 0.002, 0.14, 0.004, 0.07); },
    rise: (b, t, o) => lift(b, t, o, true),
    sink: (b, t, o) => lift(b, t, o, false),
    /* the arm's motor: a short whine with a brush of noise, a click as it stops */
    servo: (b, t, o) => { const d = o.dur || 0.2; tone(b, t, 180, 'sawtooth', 0.02, 0.05, Math.max(0, d - 0.08), 0.06, 250); noise(b, t, 'bandpass', 1200, 2, 0.02, 0.04, Math.max(0, d - 0.08), 0.06, 1800); noise(b, t + d, 'bandpass', 2600, 3, 0.001, 0.06, 0.002, 0.02); },
    /* the hover rim brightening: three faint high glints */
    glow: (b, t) => { [N.E7, N.A7, N.Cs7 * 2].forEach((f, i) => glint(b, t + i * 0.045, f * rnd(0.997, 1.003), 0.03, 0.55)); },
  };
  /* the lift motor going up or down: two detuned saws under a lowpass with the brush noise, a relay click first and a clunk as it seats */
  function lift(b, t, o, up) { const c = A.ctx, d = Math.max(0.5, o.dur || 1.2), f0 = up ? 72 : 108, f1 = up ? 108 : 72, lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 1.5; lp.connect(b);
    [0, 7].forEach(det => { const g = c.createGain(); env(g, t, 0.12, 0.09, d - 0.3, 0.18); g.connect(lp); const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.detune.value = det; osc.frequency.setValueAtTime(f0, t); osc.frequency.exponentialRampToValueAtTime(f1, t + d); osc.connect(g); osc.start(t); osc.stop(t + d + 0.1); });
    noise(b, t, 'bandpass', 420, 1.6, 0.15, 0.06, d - 0.4, 0.25, up ? 700 : 300);
    noise(b, t, 'bandpass', 2400, 3, 0.001, 0.1, 0.002, 0.03); thump(b, t + d, 110, 0.2, 0.14); noise(b, t + d, 'lowpass', 1200, 0.7, 0.002, 0.12, 0.004, 0.06); }

  /* ---------- the loops: (bus, time, options) → { gain, stop(at) } ---------- */
  const LOOPS = {
    /* a dark electrical hum: a 50 Hz saw with its harmonics under a lowpass that wanders slowly */
    hum: (b, t) => { const c = A.ctx, lp = c.createBiquadFilter(), src = []; lp.type = 'lowpass'; lp.frequency.value = 190; lp.Q.value = 1.1; lp.connect(b);
      [[50, 'sawtooth', 0.5, 0], [100, 'sine', 0.3, 4], [150, 'sine', 0.12, -3]].forEach(([f, ty, k, det]) => { const o = c.createOscillator(), g = c.createGain(); o.type = ty; o.frequency.value = f; o.detune.value = det; g.gain.value = k; o.connect(g); g.connect(lp); o.start(t); src.push(o); });
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.23; lg.gain.value = 28; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t); src.push(lfo);
      return { gain: 0.11, stop(at) { src.forEach(s => { try { s.stop(at); } catch (e) {} }); } }; },
    /* the darkroom: a softer, buzzier hum from the safelight, and a drip into a tray every few seconds */
    safelight: (b, t) => { const c = A.ctx, lp = c.createBiquadFilter(), src = []; lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.9; lp.connect(b);
      [[60, 'sawtooth', 0.35, 0], [120, 'square', 0.1, 3], [180, 'sine', 0.08, -4]].forEach(([f, ty, k, det]) => { const o = c.createOscillator(), g = c.createGain(); o.type = ty; o.frequency.value = f; o.detune.value = det; g.gain.value = k; o.connect(g); g.connect(lp); o.start(t); src.push(o); });
      const dg = c.createGain(); dg.gain.value = 1.6; dg.connect(b); let timer = 0, on = true;
      const next = () => { timer = setTimeout(() => { if (!on) return; try { const cc = get(); if (cc) drip(dg, cc.currentTime); } catch (e) {} next(); }, rnd(1400, 4500)); }; next();
      return { gain: 0.08, stop(at) { on = false; clearTimeout(timer); src.forEach(s => { try { s.stop(at); } catch (e) {} }); } }; },
  };
  const NOP = { stop() {}, set() {} };
  function loop(id, o) { o = o || {}; const c = get(); if (!c) return NOP; if (id === 'rumble') { try { return rumble(o); } catch (e) { return NOP; } } const L = LOOPS[id]; if (!L) return NOP;
    try { const b = bus(0, o.send == null ? (id === 'safelight' ? 0.35 : 0) : o.send, o.pan), t = c.currentTime, h = L(b, t, o), unit = h.gain || 1; let done = false;
      b.gain.setTargetAtTime(clamp(o.gain == null ? 1 : o.gain, 0, 1) * unit, t, o.fade == null ? 0.4 : o.fade);
      return {
        set(k) { if (done) return; try { b.gain.setTargetAtTime(clamp(k, 0, 1) * unit, A.ctx.currentTime, 0.2); } catch (e) {} },
        stop(fade) { if (done) return; done = true; try { const tt = A.ctx.currentTime, f = fade == null ? 0.5 : fade; b.gain.cancelScheduledValues(tt); b.gain.setTargetAtTime(0, tt, Math.max(0.01, f / 3)); h.stop(tt + f + 0.2); setTimeout(() => { try { b.disconnect(); } catch (e) {} }, (f + 0.4) * 1000); } catch (e) {} } }; }
    catch (e) { return NOP; } }

  function play(id, o) { o = o || {}; const c = get(); if (!c) return null; const v = V[id]; if (!v) return null;
    try { if (id === 'rumble') return rumble(o); const b = bus(o.vol == null ? 1 : o.vol, o.send == null ? SEND[id] || 0 : o.send, o.pan); v(b, c.currentTime + (o.delay || 0), o);
      return { stop(fade) { try { const tt = A.ctx.currentTime; b.gain.cancelScheduledValues(tt); b.gain.setTargetAtTime(0, tt, Math.max(0.01, (fade == null ? 0.08 : fade) / 3)); } catch (e) {} }, set() {} }; }
    catch (e) { return null; } }

  S.snd = { play, loop, tick, ids: Object.keys(V), loops: Object.keys(LOOPS).concat('rumble'), ctx() { return A.ctx; }, out() { return A.out || null; } };
}
