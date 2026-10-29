// BLADE SOUND: Blades' own sound, synthesised with Web Audio (no files), through the room's level (S.snd.out()).
//   spin(wings)   a top's voice: a metallic whine whose pitch follows its spin and pulses as the wings pass, a scrape of
//                 the tip on the floor, panned with where it is. set(speed 0..1, pan -1..1, grind 0..1) each frame.
//   hit(k, pan)   a clash: a burst through ringing metal modes (inharmonic, so it reads as metal), a thump on the big ones
//   wall(k, pan)  a plastic clack off the stadium wall
//   dash(pan)     the X rail: a rising zip of gear teeth
//   rip(q)        the ripcord: ratchet clicks speeding up, a zip and the drop
//   burst(pan)    a crack, a boom and the parts tinkling down
//   ringOut(pan)  a whoosh over the rim and a clatter on the floor
//   slow(on)      the slow motion: everything goes muffled and low until it lets go
// make(ctx, out) returns the set; every call is safe when there is no audio.

export function make(ctx, out) {
  if (!ctx) return null;
  const master = ctx.createGain(), muff = ctx.createBiquadFilter(), comp = ctx.createDynamicsCompressor();
  master.gain.value = 0.9; muff.type = 'lowpass'; muff.frequency.value = 18000; muff.Q.value = 0.7;
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
  master.connect(muff); muff.connect(comp); comp.connect(out || ctx.destination);
  /* one second of white noise, shared */
  const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const noise = (t, dur, loop) => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = !!loop; s.start(t, Math.random() * 0.5); if (!loop) s.stop(t + dur + 0.05); return s; };
  const panner = p => { const n = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (n.pan) n.pan.value = Math.max(-1, Math.min(1, p || 0)); return n; };
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  const now = () => ctx.currentTime;

  /* ringing metal: a short excitation through a few resonant bandpasses at inharmonic ratios */
  function ring(t, f0, k, pan, decay) {
    const p = panner(pan); p.connect(master); const src = noise(t, 0.03), pre = ctx.createGain(); env(pre, t, 0.001, 1, 0.025); src.connect(pre);
    [1, 2.31, 3.87, 5.4, 7.1].forEach((r, i) => { const bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = f0 * r * (0.97 + Math.random() * 0.06); bp.Q.value = 30 + i * 12;
      env(g, t, 0.002, (0.9 / (i + 1)) * k * 3, decay * (1 - i * 0.12)); pre.connect(bp); bp.connect(g); g.connect(p); });
  }
  function thump(t, k, pan) { const o = ctx.createOscillator(), g = ctx.createGain(), p = panner(pan); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); env(g, t, 0.004, 0.9 * k, 0.22); o.connect(g); g.connect(p); p.connect(master); o.start(t); o.stop(t + 0.3); }
  function click(t, f, v, pan, q) { const s = noise(t, 0.012), bp = ctx.createBiquadFilter(), g = ctx.createGain(), p = panner(pan); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q || 8; env(g, t, 0.0008, v, 0.012); s.connect(bp); bp.connect(g); g.connect(p); p.connect(master); }
  function whoosh(t, dur, f0, f1, v, pan) { const s = noise(t, dur), bp = ctx.createBiquadFilter(), g = ctx.createGain(), p = panner(pan); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(bp); bp.connect(g); g.connect(p); p.connect(master); }

  return {
    spin(wings) {
      const p = panner(0), g = ctx.createGain(); g.gain.value = 0; g.connect(p); p.connect(master);
      /* the whine: two detuned oscillators through a peaky filter, amplitude pulsed at the wing-pass rate */
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), wf = ctx.createBiquadFilter(), am = ctx.createGain(), lfo = ctx.createOscillator(), lfoG = ctx.createGain();
      o1.type = 'sawtooth'; o2.type = 'triangle'; wf.type = 'bandpass'; wf.Q.value = 3; am.gain.value = 0.6; lfo.type = 'sine'; lfoG.gain.value = 0.35; lfo.connect(lfoG); lfoG.connect(am.gain);
      o1.connect(wf); o2.connect(wf); wf.connect(am); am.connect(g); o1.start(); o2.start(); lfo.start();
      /* the scrape: noise, high and thin, louder with speed and with grinding */
      const sc = noise(now(), 0, true), sf = ctx.createBiquadFilter(), sg = ctx.createGain(); sf.type = 'bandpass'; sf.Q.value = 0.8; sf.frequency.value = 3500; sg.gain.value = 0; sc.connect(sf); sf.connect(sg); sg.connect(g);
      let dead = false;
      return { set(s, pan, grind) { if (dead) return; const t = now(), rev = 2 + s * 16; s = Math.max(0, Math.min(1, s));
          o1.frequency.setTargetAtTime(rev * wings * 9, t, 0.05); o2.frequency.setTargetAtTime(rev * wings * 9 * 1.503, t, 0.05); wf.frequency.setTargetAtTime(600 + s * 2400, t, 0.05);
          lfo.frequency.setTargetAtTime(rev * wings, t, 0.05); g.gain.setTargetAtTime(0.11 * Math.pow(s, 0.7), t, 0.06); sg.gain.setTargetAtTime(0.06 * s + 0.25 * (grind || 0), t, 0.03); sf.frequency.setTargetAtTime(2200 + s * 3000, t, 0.05);
          if (p.pan) p.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan || 0)), t, 0.05); },
        stop() { if (dead) return; dead = true; const t = now(); g.gain.setTargetAtTime(0, t, 0.08); [o1, o2, lfo, sc].forEach(n => { try { n.stop(t + 0.5); } catch (e) {} }); } };
    },
    hit(k, pan) { const t = now(), kk = Math.min(1, k / 6); ring(t, 900 + Math.random() * 700, 0.25 + 0.75 * kk, pan, 0.12 + 0.35 * kk); if (k > 2.5) thump(t, kk, pan); if (k > 4) ring(t + 0.01, 420 + Math.random() * 200, kk * 0.6, pan, 0.6); },
    grind(pan) { const t = now(); for (let i = 0; i < 4; i++) click(t + i * 0.012, 3000 + Math.random() * 3000, 0.25, pan, 5); },
    wall(k, pan) { const t = now(); click(t, 1600 + Math.random() * 500, Math.min(0.7, 0.15 + k * 0.12), pan, 3); click(t + 0.004, 600, Math.min(0.4, k * 0.08), pan, 2); },
    dash(pan) { const t = now(); for (let i = 0; i < 26; i++) { const ti = t + 0.5 * Math.pow(i / 26, 0.7); click(ti, 1800 + i * 90, 0.35, pan, 10); } whoosh(t, 0.6, 600, 4000, 0.3, pan); },
    rip(q) { const t = now(), n = 18; for (let i = 0; i < n; i++) click(t + 0.32 * Math.pow(i / n, 0.6), 2400 + i * 60, 0.3 + 0.2 * q, 0, 9); whoosh(t, 0.45, 900, 5200, 0.25 + 0.3 * q, 0); thump(t + 0.36, 0.5, 0); },
    burst(pan) { const t = now(); thump(t, 1, pan); thump(t + 0.02, 0.8, pan); ring(t, 700, 1, pan, 0.5); whoosh(t, 0.35, 5000, 400, 0.6, pan);
      for (let i = 0; i < 14; i++) { const ti = t + 0.15 + Math.random() * 0.9; ring(ti, 2400 + Math.random() * 2600, 0.15 + Math.random() * 0.15, (pan || 0) + (Math.random() - 0.5), 0.08); } },
    ringOut(pan) { const t = now(); whoosh(t, 0.5, 300, 2500, 0.45, pan); for (let i = 0; i < 6; i++) click(t + 0.45 + i * (0.06 + Math.random() * 0.05), 900 + Math.random() * 800, 0.4 / (i + 1), pan, 3); },
    slow(on) { const t = now(); muff.frequency.cancelScheduledValues(t); muff.frequency.setTargetAtTime(on ? 700 : 18000, t, on ? 0.06 : 0.25); if (on) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.9); env(g, t, 0.05, 0.6, 0.9); o.connect(g); g.connect(comp); o.start(t); o.stop(t + 1); } },
  };
}
