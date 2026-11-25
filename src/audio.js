/**
 * Procedural Web Audio synthesizer for retro neon arcade SFX & dynamic OST.
 * Features:
 *  - "DOOM": Intense drop-tuned industrial djent metal OST (waveshaper distortion, double-kick, chainsaw synth)
 *  - "FINALE": Frantic, heroic Undertale "Finale"-inspired chiptune/orchestral rock OST for Boss Fights
 * Zero external audio assets required.
 */
(function (global) {
  function mtof(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function createDistortionCurve(amount = 80) {
    const samples = 2048;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  // 64-step (4-bar) Drop-E Industrial Metal riff (null = rest)
  const DOOM_RIFF = [
    // Bar 1: relentless chug
    28, null, 28, 28, 29, null, 28, null, 28, 28, 31, null, 29, null, 34, 33,
    // Bar 2: syncopated crush
    28, null, 28, 28, 34, null, 31, null, 29, 28, null, 28, 36, 35, 34, 29,
    // Bar 3: Phrygian surge
    28, 28, null, 28, 29, 31, null, 28, 32, null, 31, 29, 28, null, 38, 36,
    // Bar 4: rising assault
    28, 28, 28, null, 34, null, 33, null, 31, null, 29, null, 27, 29, 31, 32,
  ];

  // Chainsaw Phrygian lead accents over bars 2 & 4
  const DOOM_LEAD = [
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    64, null, 65, null, 68, null, 69, null, 70, null, 69, 68, 65, null, 64, null,
    null, null, null, null, null, null, null, null, 76, null, 75, null, 72, null, 70, null,
    64, 65, 68, null, 70, null, 68, null, 77, null, 76, null, 74, 72, 70, 68,
  ];

  // Undertale "Finale"-inspired 8-bar (128-step) Heroic Climax in C minor
  const FINALE_CHORDS = [
    [48, 51, 55, 60], // Bar 1: Cm
    [44, 48, 51, 56], // Bar 2: Ab
    [46, 50, 53, 58], // Bar 3: Bb
    [43, 47, 50, 55], // Bar 4: G
    [48, 51, 55, 60], // Bar 5: Cm
    [44, 48, 51, 56], // Bar 6: Ab
    [41, 44, 48, 53], // Bar 7: Fm
    [46, 50, 55, 59], // Bar 8: Bb -> G7 turnaround
  ];

  const FINALE_BASS = [36, 32, 34, 31, 36, 32, 29, 34];

  const FINALE_MELODY = [
    // Bar 1 (Cm): heroic pickup & soar
    67, null, 72, null, 74, null, 75, null, 79, null, null, 75, 74, null, 72, null,
    // Bar 2 (Ab): bright lift
    75, null, 72, null, 68, null, 72, null, 75, null, null, 74, 72, null, 70, null,
    // Bar 3 (Bb): driving climb
    70, null, 74, null, 77, null, 75, null, 74, null, 70, null, 74, null, 77, null,
    // Bar 4 (G): urgent dominant push
    79, null, 77, null, 75, null, 74, null, 71, null, 74, null, 77, null, 79, null,
    // Bar 5 (Cm): climax octave
    84, null, 82, null, 79, null, 75, null, 79, null, null, 84, 82, null, 79, null,
    // Bar 6 (Ab): emotional peak
    80, null, 79, null, 75, null, 72, null, 75, null, null, 79, 80, null, 82, null,
    // Bar 7 (Fm): soaring cadence
    84, null, 80, null, 77, null, 80, null, 82, null, 79, null, 75, null, 77, null,
    // Bar 8 (Bb/G): triumphant turnaround
    79, null, 82, null, 84, null, 86, null, 83, null, 79, null, 74, null, 79, null,
  ];

  class RetroAudio {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.musicMuted = false;
      this.lastShotAt = 0;

      this.masterGain = null;
      this.sfxGain = null;
      this.musicGain = null;
      this.compressor = null;
      this.distortionCurve = null;
      this.noiseBuffer = null;

      this.currentTrack = null;
      this.musicPaused = false;
      this.musicTimer = null;
      this.nextNoteTime = 0;
      this.stepIndex = 0;
    }

    ensureContext() {
      if (!this.ctx) {
        const AudioCtx = global.AudioContext || global.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
        this.initBuses();
      }
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    initBuses() {
      const ctx = this.ctx;
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.88;
      this.masterGain.connect(ctx.destination);

      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.value = 0.85;
      this.sfxGain.connect(this.masterGain);

      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.14;
      this.compressor.connect(this.masterGain);

      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = this.musicMuted ? 0 : 0.36;
      this.musicGain.connect(this.compressor);

      this.distortionCurve = createDistortionCurve(95);

      const sampleCount = Math.floor(ctx.sampleRate * 1.0);
      this.noiseBuffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < sampleCount; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }

    syncGains() {
      if (!this.ctx || !this.masterGain || !this.musicGain) return;
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.88, now, 0.02);
      this.musicGain.gain.setTargetAtTime(this.musicMuted ? 0 : 0.36, now, 0.03);
    }

    toggleMute() {
      this.muted = !this.muted;
      this.syncGains();
      return this.muted;
    }

    toggleMusicMute() {
      this.musicMuted = !this.musicMuted;
      this.syncGains();
      return this.musicMuted;
    }

    /* ===========================
     * PROCEDURAL OST SEQUENCER
     * =========================== */

    playMusic(trackName) {
      if (!trackName) {
        this.stopMusic();
        return;
      }
      if (this.currentTrack === trackName && this.musicTimer !== null) {
        return;
      }
      const ctx = this.ensureContext();
      this.currentTrack = trackName;
      this.stepIndex = 0;
      if (ctx) {
        this.nextNoteTime = ctx.currentTime + 0.04;
      }
      if (this.musicTimer === null) {
        this.musicTimer = setInterval(() => this.schedulerTick(), 24);
      }
    }

    stopMusic() {
      this.currentTrack = null;
      if (this.musicTimer !== null) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
    }

    setMusicPaused(paused) {
      this.musicPaused = paused;
      if (!paused && this.ctx && this.currentTrack) {
        this.nextNoteTime = this.ctx.currentTime + 0.05;
      }
    }

    schedulerTick() {
      if (!this.currentTrack || this.musicPaused || !this.ctx || this.ctx.state !== "running") {
        return;
      }
      const lookahead = 0.12;
      while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
        if (this.currentTrack === "DOOM") {
          this.scheduleDoomStep(this.stepIndex, this.nextNoteTime);
          this.nextNoteTime += 60 / 152 / 4; // 152 BPM 16th notes
          this.stepIndex = (this.stepIndex + 1) % DOOM_RIFF.length;
        } else if (this.currentTrack === "FINALE") {
          this.scheduleFinaleStep(this.stepIndex, this.nextNoteTime);
          this.nextNoteTime += 60 / 178 / 4; // 178 BPM 16th notes
          this.stepIndex = (this.stepIndex + 1) % FINALE_MELODY.length;
        } else {
          break;
        }
      }
    }

    scheduleDoomStep(step, time) {
      const barStep = step % 16;
      const bar = Math.floor(step / 16);
      const riffMidi = DOOM_RIFF[step];
      const leadMidi = DOOM_LEAD[step];

      // 1. Sub + Distorted Djent Guitar Chug
      if (riffMidi !== null) {
        const freq = mtof(riffMidi);
        const isSustained = DOOM_RIFF[(step + 1) % DOOM_RIFF.length] === null;
        const dur = isSustained ? 0.17 : 0.088;

        // Heavy sub-bass sine
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = "sine";
        sub.frequency.setValueAtTime(freq, time);
        subGain.gain.setValueAtTime(0.32, time);
        subGain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        sub.connect(subGain);
        subGain.connect(this.musicGain);
        sub.start(time);
        sub.stop(time + dur + 0.01);

        // Dual distorted power chord (root + 5th)
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        osc1.type = "sawtooth";
        osc2.type = "square";
        osc1.frequency.setValueAtTime(freq * 2, time);
        osc2.frequency.setValueAtTime(freq * 2.996, time); // crunchy power fifth

        const shaper = this.ctx.createWaveShaper();
        shaper.curve = this.distortionCurve;
        shaper.oversample = "2x";

        const cab = this.ctx.createBiquadFilter();
        cab.type = "lowpass";
        cab.Q.value = 3.2;
        cab.frequency.setValueAtTime(2600, time);
        cab.frequency.exponentialRampToValueAtTime(850, time + dur);

        const gtrGain = this.ctx.createGain();
        gtrGain.gain.setValueAtTime(0.24, time);
        gtrGain.gain.exponentialRampToValueAtTime(0.001, time + dur);

        osc1.connect(shaper);
        osc2.connect(shaper);
        shaper.connect(cab);
        cab.connect(gtrGain);
        gtrGain.connect(this.musicGain);

        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + dur + 0.01);
        osc2.stop(time + dur + 0.01);
      }

      // 2. Argent Chainsaw Lead
      if (leadMidi !== null) {
        const freq = mtof(leadMidi);
        const dur = 0.16;
        const l1 = this.ctx.createOscillator();
        const l2 = this.ctx.createOscillator();
        l1.type = "sawtooth";
        l2.type = "sawtooth";
        l1.frequency.setValueAtTime(freq, time);
        l2.frequency.setValueAtTime(freq * 1.012, time);

        const shaper = this.ctx.createWaveShaper();
        shaper.curve = this.distortionCurve;

        const bp = this.ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(1650, time);
        bp.Q.value = 1.6;

        const lg = this.ctx.createGain();
        lg.gain.setValueAtTime(0.16, time);
        lg.gain.exponentialRampToValueAtTime(0.001, time + dur);

        l1.connect(shaper);
        l2.connect(shaper);
        shaper.connect(bp);
        bp.connect(lg);
        lg.connect(this.musicGain);

        l1.start(time);
        l2.start(time);
        l1.stop(time + dur + 0.01);
        l2.stop(time + dur + 0.01);
      }

      // 3. Industrial Horror Pad on bar starts
      if (barStep === 0 && (bar === 0 || bar === 2)) {
        [40, 47, 53].forEach((m) => {
          const pad = this.ctx.createOscillator();
          const pg = this.ctx.createGain();
          const lp = this.ctx.createBiquadFilter();
          pad.type = "sawtooth";
          pad.frequency.setValueAtTime(mtof(m), time);
          lp.type = "lowpass";
          lp.frequency.setValueAtTime(620, time);
          pg.gain.setValueAtTime(0.001, time);
          pg.gain.linearRampToValueAtTime(0.06, time + 0.15);
          pg.gain.exponentialRampToValueAtTime(0.001, time + 1.45);
          pad.connect(lp);
          lp.connect(pg);
          pg.connect(this.musicGain);
          pad.start(time);
          pad.stop(time + 1.5);
        });
      }

      // 4. Double-Kick Industrial Drums
      const isDoubleKickBurst = barStep === 0 || barStep === 2 || barStep === 3 || barStep === 6 || barStep === 8 || barStep === 9 || barStep === 10 || (bar === 3 && barStep >= 12);
      if (isDoubleKickBurst || riffMidi === 28) {
        this.scheduleKick(time, 0.44);
      }
      if (barStep === 4 || barStep === 12 || (bar === 3 && (barStep === 14 || barStep === 15))) {
        this.scheduleSnare(time, 0.32);
      }
      if (barStep % 2 === 0 || barStep === 15) {
        this.scheduleHat(time, barStep === 0 ? 0.16 : 0.08, barStep === 0);
      }
    }

    scheduleFinaleStep(step, time) {
      const bar = Math.floor(step / 16);
      const barStep = step % 16;
      const chord = FINALE_CHORDS[bar % FINALE_CHORDS.length];
      const bassMidi = FINALE_BASS[bar % FINALE_BASS.length];
      const melMidi = FINALE_MELODY[step];

      // 1. Sparkling 16th-Note Undertale Chiptune Arpeggio
      const arpPattern = [0, 1, 2, 3, 2, 1, 2, 3];
      const arpNote = chord[arpPattern[barStep % arpPattern.length]] + 12;
      const arpOsc = this.ctx.createOscillator();
      const arpGain = this.ctx.createGain();
      arpOsc.type = "square";
      arpOsc.frequency.setValueAtTime(mtof(arpNote), time);
      arpGain.gain.setValueAtTime(0.085, time);
      arpGain.gain.exponentialRampToValueAtTime(0.001, time + 0.075);
      arpOsc.connect(arpGain);
      arpGain.connect(this.musicGain);
      arpOsc.start(time);
      arpOsc.stop(time + 0.08);

      // 2. Heroic Soaring Lead Melody
      if (melMidi !== null) {
        const freq = mtof(melMidi);
        const holdSteps = FINALE_MELODY[(step + 1) % FINALE_MELODY.length] === null ? 2 : 1;
        const dur = holdSteps * 0.085 + 0.04;

        const lead1 = this.ctx.createOscillator();
        const lead2 = this.ctx.createOscillator();
        lead1.type = "square";
        lead2.type = "triangle";
        lead1.frequency.setValueAtTime(freq, time);
        lead2.frequency.setValueAtTime(freq * 1.004, time);

        const lg = this.ctx.createGain();
        lg.gain.setValueAtTime(0.002, time);
        lg.gain.linearRampToValueAtTime(0.18, time + 0.01);
        lg.gain.exponentialRampToValueAtTime(0.001, time + dur);

        lead1.connect(lg);
        lead2.connect(lg);
        lg.connect(this.musicGain);

        lead1.start(time);
        lead2.start(time);
        lead1.stop(time + dur + 0.01);
        lead2.stop(time + dur + 0.01);
      }

      // 3. Driving Rock Octave Bassline on 8th notes
      if (barStep % 2 === 0) {
        const octaveOffset = barStep % 4 === 2 ? 12 : 0;
        const bFreq = mtof(bassMidi + octaveOffset);
        const bass = this.ctx.createOscillator();
        const lp = this.ctx.createBiquadFilter();
        const bg = this.ctx.createGain();
        bass.type = "sawtooth";
        bass.frequency.setValueAtTime(bFreq, time);
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(920, time);
        bg.gain.setValueAtTime(0.24, time);
        bg.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
        bass.connect(lp);
        lp.connect(bg);
        bg.connect(this.musicGain);
        bass.start(time);
        bass.stop(time + 0.15);
      }

      // 4. Warm Orchestral String/Brass Pad on bar changes
      if (barStep === 0) {
        chord.slice(0, 3).forEach((m) => {
          const pad = this.ctx.createOscillator();
          const lp = this.ctx.createBiquadFilter();
          const pg = this.ctx.createGain();
          pad.type = "sawtooth";
          pad.frequency.setValueAtTime(mtof(m), time);
          lp.type = "lowpass";
          lp.frequency.setValueAtTime(1400, time);
          pg.gain.setValueAtTime(0.002, time);
          pg.gain.linearRampToValueAtTime(0.055, time + 0.08);
          pg.gain.exponentialRampToValueAtTime(0.001, time + 1.28);
          pad.connect(lp);
          lp.connect(pg);
          pg.connect(this.musicGain);
          pad.start(time);
          pad.stop(time + 1.32);
        });
      }

      // 5. Energetic Finale Rock Drums
      if (barStep === 0 || barStep === 6 || barStep === 8 || barStep === 10 || (bar % 2 === 1 && barStep === 14)) {
        this.scheduleKick(time, 0.36);
      }
      if (barStep === 4 || barStep === 12 || (bar === 7 && (barStep === 14 || barStep === 15))) {
        this.scheduleSnare(time, 0.25);
      }
      this.scheduleHat(time, barStep === 0 && bar % 4 === 0 ? 0.15 : 0.06, barStep === 0 && bar % 4 === 0);
    }

    scheduleKick(time, vol = 0.38) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(155, time);
      osc.frequency.exponentialRampToValueAtTime(36, time + 0.11);
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + 0.14);
    }

    scheduleSnare(time, vol = 0.26) {
      if (this.noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.setValueAtTime(900, time);
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(vol, time);
        ng.gain.exponentialRampToValueAtTime(0.001, time + 0.11);
        src.connect(hp);
        hp.connect(ng);
        ng.connect(this.musicGain);
        src.start(time);
        src.stop(time + 0.12);
      }
      const body = this.ctx.createOscillator();
      const bg = this.ctx.createGain();
      body.type = "triangle";
      body.frequency.setValueAtTime(210, time);
      body.frequency.exponentialRampToValueAtTime(95, time + 0.08);
      bg.gain.setValueAtTime(vol * 0.7, time);
      bg.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
      body.connect(bg);
      bg.connect(this.musicGain);
      body.start(time);
      body.stop(time + 0.1);
    }

    scheduleHat(time, vol = 0.07, open = false) {
      if (!this.noiseBuffer) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(open ? 5200 : 7500, time);
      const g = this.ctx.createGain();
      const dur = open ? 0.18 : 0.035;
      g.gain.setValueAtTime(vol, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + dur);
      src.connect(hp);
      hp.connect(g);
      g.connect(this.musicGain);
      src.start(time);
      src.stop(time + dur + 0.01);
    }

    /* ===========================
     * ARCADE & UNDERTALE SFX
     * =========================== */

    playTone(opts) {
      if (this.muted) return;
      const ctx = this.ensureContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = opts.type || "sawtooth";
      osc.frequency.setValueAtTime(opts.freqStart, now);
      if (opts.freqEnd) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), now + opts.duration);
      }

      gain.gain.setValueAtTime(opts.volume || 0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + opts.duration);

      osc.connect(gain);
      gain.connect(this.sfxGain || ctx.destination);
      osc.start(now);
      osc.stop(now + opts.duration);
    }

    playNoise(duration, volume = 0.18, highpass = 220) {
      if (this.muted) return;
      const ctx = this.ensureContext();
      if (!ctx) return;

      const sampleCount = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < sampleCount; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
      }

      const src = ctx.createBufferSource();
      src.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = highpass;

      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain || ctx.destination);
      src.start(now);
    }

    shoot(weapon = "PULSE") {
      const now = performance.now();
      if (now - this.lastShotAt < 45) return;
      this.lastShotAt = now;

      if (weapon === "PLASMA") {
        this.playTone({ type: "sawtooth", freqStart: 540, freqEnd: 170, duration: 0.11, volume: 0.08 });
      } else if (weapon === "SPREAD") {
        this.playTone({ type: "triangle", freqStart: 740, freqEnd: 260, duration: 0.08, volume: 0.07 });
      } else {
        this.playTone({ type: "square", freqStart: 880, freqEnd: 320, duration: 0.065, volume: 0.06 });
      }
    }

    hit() {
      this.playTone({ type: "triangle", freqStart: 220, freqEnd: 90, duration: 0.05, volume: 0.07 });
    }

    explode(large = false) {
      this.playNoise(large ? 0.42 : 0.18, large ? 0.25 : 0.14, large ? 90 : 280);
      this.playTone({
        type: "sawtooth",
        freqStart: large ? 160 : 240,
        freqEnd: 36,
        duration: large ? 0.38 : 0.15,
        volume: large ? 0.16 : 0.09,
      });
    }

    powerUp() {
      const ctx = this.ensureContext();
      if (!ctx) return;
      [440, 554, 659, 880].forEach((freq, idx) => {
        setTimeout(() => {
          this.playTone({ type: "sine", freqStart: freq, freqEnd: freq * 1.05, duration: 0.09, volume: 0.1 });
        }, idx * 45);
      });
    }

    dash() {
      this.playTone({ type: "sine", freqStart: 300, freqEnd: 920, duration: 0.12, volume: 0.09 });
    }

    emp() {
      this.playNoise(0.45, 0.22, 120);
      this.playTone({ type: "sine", freqStart: 780, freqEnd: 55, duration: 0.45, volume: 0.18 });
    }

    playerHit() {
      this.playNoise(0.28, 0.24, 150);
      this.playTone({ type: "sawtooth", freqStart: 180, freqEnd: 45, duration: 0.28, volume: 0.18 });
    }

    bossWarning() {
      [0, 220, 440].forEach((delay) => {
        setTimeout(() => {
          this.playTone({ type: "sawtooth", freqStart: 320, freqEnd: 210, duration: 0.16, volume: 0.13 });
        }, delay);
      });
    }

    act() {
      [523.25, 659.25].forEach((freq, idx) => {
        setTimeout(() => {
          this.playTone({ type: "square", freqStart: freq, freqEnd: freq, duration: 0.07, volume: 0.07 });
        }, idx * 55);
      });
    }

    spare() {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        setTimeout(() => {
          this.playTone({ type: "triangle", freqStart: freq, freqEnd: freq * 1.02, duration: 0.11, volume: 0.1 });
        }, idx * 45);
      });
    }

    saveStar() {
      [659.25, 783.99, 987.77, 1318.5].forEach((freq, idx) => {
        setTimeout(() => {
          this.playTone({ type: "square", freqStart: freq, freqEnd: freq, duration: 0.12, volume: 0.08 });
        }, idx * 65);
      });
    }

    soulSwitch() {
      this.playTone({ type: "square", freqStart: 420, freqEnd: 740, duration: 0.12, volume: 0.1 });
    }

    gasterCharge() {
      this.playTone({ type: "sine", freqStart: 220, freqEnd: 880, duration: 0.32, volume: 0.08 });
    }

    blasterBeam() {
      this.playNoise(0.42, 0.25, 130);
      this.playTone({ type: "sawtooth", freqStart: 680, freqEnd: 95, duration: 0.4, volume: 0.16 });
    }

    slam() {
      this.playNoise(0.22, 0.24, 90);
      this.playTone({ type: "triangle", freqStart: 145, freqEnd: 38, duration: 0.2, volume: 0.2 });
    }

    dodge() {
      this.playTone({ type: "sine", freqStart: 620, freqEnd: 290, duration: 0.08, volume: 0.06 });
    }

    textBlip() {
      this.playTone({ type: "square", freqStart: 175, freqEnd: 165, duration: 0.025, volume: 0.03 });
    }

    sansBlip() {
      [0, 60, 120].forEach((delay, idx) => {
        setTimeout(() => {
          this.playTone({
            type: "square",
            freqStart: 112 + idx * 4,
            freqEnd: 106,
            duration: 0.045,
            volume: 0.06,
          });
        }, delay);
      });
    }
  }

  global.NeonAudio = new RetroAudio();
})(window);
