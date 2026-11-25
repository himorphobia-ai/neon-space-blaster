/**
 * NEON VANGUARD — Main arcade engine, wave director, boss AI, and HUD controller.
 */
(function (global) {
  const {
    GAME_W,
    GAME_H,
    COLORS,
    POWERUPS,
    createStarfield,
    createPlayer,
    createEnemy,
    createBoss,
    drawHeart,
    drawBone,
    drawGlowingPoly,
    drawSans,
    drawGasterBlaster,
  } = global.NeonEntities;
  const Audio = global.NeonAudio;

  const HIGH_SCORE_KEY = "neon_vanguard_highscore_v1";
  const BEST_WAVE_KEY = "neon_vanguard_bestwave_v1";
  const BEST_MERCY_KEY = "neon_vanguard_bestmercy_v1";

  class NeonGame {
    constructor() {
      this.canvas = document.getElementById("gameCanvas");
      this.ctx = this.canvas.getContext("2d");

      this.dom = {
        score: document.getElementById("scoreVal"),
        highScore: document.getElementById("highScoreVal"),
        combo: document.getElementById("comboVal"),
        comboFill: document.getElementById("comboFill"),
        wave: document.getElementById("waveVal"),
        soulBadge: document.getElementById("soulBadge"),
        sparedVal: document.getElementById("sparedVal"),
        weapon: document.getElementById("weaponBadge"),
        lives: document.getElementById("livesVal"),
        bombs: document.getElementById("bombsVal"),
        bossHud: document.getElementById("bossHud"),
        bossName: document.getElementById("bossName"),
        bossPhase: document.getElementById("bossPhase"),
        bossBarFill: document.getElementById("bossBarFill"),
        banner: document.getElementById("bannerOverlay"),
        bannerText: document.getElementById("bannerText"),
        bannerSub: document.getElementById("bannerSub"),
        battleBox: document.getElementById("battleBox"),
        battleBoxText: document.getElementById("battleBoxText"),
        startModal: document.getElementById("startModal"),
        pauseModal: document.getElementById("pauseModal"),
        gameOverModal: document.getElementById("gameOverModal"),
        finalScore: document.getElementById("finalScore"),
        finalHighScore: document.getElementById("finalHighScore"),
        finalWave: document.getElementById("finalWave"),
        finalCombo: document.getElementById("finalCombo"),
        newHighBadge: document.getElementById("newHighBadge"),
        mouseBtn: document.getElementById("mouseBtn"),
        autoFireBtn: document.getElementById("autoFireBtn"),
        crtBtn: document.getElementById("crtBtn"),
        muteBtn: document.getElementById("muteBtn"),
        bgmBtn: document.getElementById("bgmBtn"),
        ostBadge: document.getElementById("ostBadge"),
        theaterBtn: document.getElementById("theaterBtn"),
        pauseBtn: document.getElementById("pauseBtn"),
        crtOverlay: document.getElementById("crtOverlay"),
        cabinet: document.getElementById("cabinet"),
        navHighScore: document.getElementById("navHighScore"),
        siteBestScore: document.getElementById("siteBestScore"),
        siteBestWave: document.getElementById("siteBestWave"),
        siteBestMercy: document.getElementById("siteBestMercy"),
      };

      this.keys = new Set();
      this.autoFire = true;
      this.mouseControl = false;
      this.controlMode = "keyboard";
      this.pointerTarget = null;
      this.pointerFiring = false;
      this.runStartedAt = 0;
      this.state = "MENU";
      this.highScore = this.loadNumber(HIGH_SCORE_KEY, 0);
      this.bestWave = this.loadNumber(BEST_WAVE_KEY, 1);
      this.bestMercy = this.loadNumber(BEST_MERCY_KEY, 0);

      this.stars = createStarfield(100);
      this.gridOffset = 0;
      this.shakeTimer = 0;
      this.shakeIntensity = 0;
      this.empFlash = 0;

      this.resetRunState();
      this.bindEvents();
      this.syncHud();

      this.lastFrame = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    loadNumber(key, fallback = 0) {
      try {
        return Number(localStorage.getItem(key) || fallback);
      } catch {
        return fallback;
      }
    }

    saveNumber(key, value) {
      try {
        localStorage.setItem(key, String(value));
      } catch {
        // Ignore storage restrictions
      }
    }

    resetRunState() {
      this.player = createPlayer();
      this.score = 0;
      this.wave = 1;
      this.combo = 1;
      this.maxCombo = 1;
      this.comboTimer = 0;
      this.comboDuration = 3.2;

      this.bullets = [];
      this.enemyBullets = [];
      this.enemies = [];
      this.powerups = [];
      this.particles = [];
      this.rings = [];
      this.popups = [];

      this.boss = null;
      this.spawnQueue = [];
      this.spawnTimer = 0;
      this.waveClearDelay = 0;
      this.bannerTimer = 0;
      this.pointerTarget = null;
      this.pointerFiring = false;

      // Undertale mechanics state
      this.sparedCount = 0;
      this.soulMode = "RED";
      this.soulVy = 0;
      this.onGround = false;
      this.playerMoved = false;
      this.arenaBox = null;
      this.bones = [];
      this.dialogueTimer = 0;
      this.actCooldown = 0;
      if (this.dom.battleBox) this.dom.battleBox.classList.add("hidden");
    }

    getCanvasCoords(clientX, clientY, isTouch = false) {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const x = ((clientX - rect.left) / rect.width) * GAME_W;
      const y = ((clientY - rect.top) / rect.height) * GAME_H - (isTouch ? 36 : 0);
      return {
        x: Math.max(24, Math.min(GAME_W - 24, x)),
        y: Math.max(36, Math.min(GAME_H - 28, y)),
      };
    }

    bindEvents() {
      window.addEventListener("keydown", (e) => {
        const code = e.code;
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(code)) {
          e.preventDefault();
        }
        this.keys.add(code);

        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(code)) {
          this.controlMode = "keyboard";
        }

        if (e.repeat) return;

        if (code === "KeyP" || code === "Escape") {
          this.togglePause();
        } else if (code === "KeyQ") {
          this.toggleMouseControl();
        } else if (code === "KeyF") {
          this.toggleAutoFire();
        } else if (code === "KeyM") {
          this.toggleMute();
        } else if (code === "KeyN") {
          this.toggleMusicMute();
        } else if (code === "KeyC") {
          this.toggleCrt();
        } else if ((code === "ShiftLeft" || code === "ShiftRight") && this.state === "PLAYING") {
          this.triggerDash();
        } else if ((code === "KeyX" || code === "KeyE") && this.state === "PLAYING") {
          this.triggerEmp();
        } else if ((code === "KeyV" || (code === "Space" && this.autoFire)) && this.state === "PLAYING") {
          this.triggerActSpare();
        } else if (code === "Enter" && (this.state === "MENU" || this.state === "GAME_OVER")) {
          this.startGame();
        }
      });

      window.addEventListener("keyup", (e) => {
        this.keys.delete(e.code);
      });

      this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

      this.canvas.addEventListener("pointermove", (e) => {
        if (!this.mouseControl) return;
        const coords = this.getCanvasCoords(e.clientX, e.clientY, e.pointerType === "touch");
        if (!coords) return;
        this.pointerTarget = coords;
        this.controlMode = "pointer";
      });

      this.canvas.addEventListener("pointerleave", () => {
        this.pointerFiring = false;
      });

      this.canvas.addEventListener("pointerdown", (e) => {
        if (this.state !== "PLAYING") return;
        Audio.ensureContext();
        const isTouch = e.pointerType === "touch";
        const coords = this.getCanvasCoords(e.clientX, e.clientY, isTouch);
        if (coords && this.mouseControl) {
          this.pointerTarget = coords;
          this.controlMode = "pointer";
        }

        if (e.button === 2 || e.button === 1) {
          this.triggerEmp();
          return;
        }

        if (e.button === 0) {
          if (this.autoFire) {
            if (performance.now() - this.runStartedAt > 220 && !isTouch) {
              this.triggerDash();
            }
          } else {
            this.pointerFiring = true;
          }
        }
      });

      window.addEventListener("pointerup", () => {
        this.pointerFiring = false;
      });

      document.getElementById("startBtn").addEventListener("click", () => this.startGame());
      const startSansBtn = document.getElementById("startSansBtn");
      if (startSansBtn) startSansBtn.addEventListener("click", () => this.startSansFight());
      const navPlayBtn = document.getElementById("navPlayBtn");
      if (navPlayBtn) {
        navPlayBtn.addEventListener("click", () => {
          if (this.state === "MENU" || this.state === "GAME_OVER") {
            this.startGame();
          }
        });
      }
      document.getElementById("resumeBtn").addEventListener("click", () => this.togglePause());
      document.getElementById("restartPauseBtn").addEventListener("click", () => this.startGame());
      document.getElementById("restartBtn").addEventListener("click", () => this.startGame());
      const restartSansBtn = document.getElementById("restartSansBtn");
      if (restartSansBtn) restartSansBtn.addEventListener("click", () => this.startSansFight());

      this.dom.mouseBtn.addEventListener("click", () => this.toggleMouseControl());
      this.dom.autoFireBtn.addEventListener("click", () => this.toggleAutoFire());
      this.dom.crtBtn.addEventListener("click", () => this.toggleCrt());
      this.dom.muteBtn.addEventListener("click", () => this.toggleMute());
      if (this.dom.bgmBtn) this.dom.bgmBtn.addEventListener("click", () => this.toggleMusicMute());
      if (this.dom.theaterBtn) this.dom.theaterBtn.addEventListener("click", () => this.toggleTheater());
      this.dom.pauseBtn.addEventListener("click", () => this.togglePause());
    }

    toggleTheater() {
      if (!this.dom.cabinet || !this.dom.theaterBtn) return;
      const active = this.dom.cabinet.classList.toggle("theater");
      this.dom.theaterBtn.classList.toggle("active", active);
      this.dom.theaterBtn.textContent = active ? "EXIT THEATER" : "THEATER";
    }

    toggleMouseControl() {
      this.mouseControl = !this.mouseControl;
      this.dom.mouseBtn.textContent = this.mouseControl ? "MOUSE: ON" : "MOUSE: OFF";
      this.dom.mouseBtn.classList.toggle("active", this.mouseControl);
      this.canvas.classList.toggle("pointer-active", this.mouseControl && this.state === "PLAYING");
      if (!this.mouseControl) {
        this.controlMode = "keyboard";
        this.pointerTarget = null;
      }
    }

    toggleAutoFire() {
      this.autoFire = !this.autoFire;
      this.dom.autoFireBtn.textContent = this.autoFire ? "AUTO: ON" : "AUTO: OFF";
      this.dom.autoFireBtn.classList.toggle("active", this.autoFire);
    }

    toggleCrt() {
      const isOff = this.dom.crtOverlay.classList.toggle("off");
      this.dom.crtBtn.classList.toggle("active", !isOff);
    }

    toggleMute() {
      const muted = Audio.toggleMute();
      this.dom.muteBtn.textContent = muted ? "MUTED" : "SFX";
      this.dom.muteBtn.classList.toggle("active", !muted);
    }

    toggleMusicMute() {
      const musicMuted = Audio.toggleMusicMute();
      if (this.dom.bgmBtn) {
        this.dom.bgmBtn.textContent = musicMuted ? "BGM: OFF" : "BGM: ON";
        this.dom.bgmBtn.classList.toggle("active", !musicMuted);
      }
    }

    togglePause() {
      if (this.state === "PLAYING") {
        this.state = "PAUSED";
        Audio.setMusicPaused(true);
        this.pointerFiring = false;
        this.canvas.classList.remove("pointer-active");
        this.dom.pauseModal.classList.remove("hidden");
      } else if (this.state === "PAUSED") {
        this.state = "PLAYING";
        Audio.setMusicPaused(false);
        this.canvas.classList.toggle("pointer-active", this.mouseControl);
        this.dom.pauseModal.classList.add("hidden");
      }
    }

    startGame() {
      Audio.ensureContext();
      this.resetRunState();
      this.state = "PLAYING";
      Audio.setMusicPaused(false);
      this.runStartedAt = performance.now();
      this.canvas.classList.toggle("pointer-active", this.mouseControl);
      this.dom.startModal.classList.add("hidden");
      this.dom.pauseModal.classList.add("hidden");
      this.dom.gameOverModal.classList.add("hidden");
      this.beginWave(1);
      this.syncHud();
    }

    startSansFight() {
      Audio.ensureContext();
      this.resetRunState();
      this.player.lives = 4;
      this.player.bombs = 3;
      this.state = "PLAYING";
      Audio.setMusicPaused(false);
      this.runStartedAt = performance.now();
      this.canvas.classList.toggle("pointer-active", this.mouseControl);
      this.dom.startModal.classList.add("hidden");
      this.dom.pauseModal.classList.add("hidden");
      this.dom.gameOverModal.classList.add("hidden");
      this.beginWave(3, "SANS");
      this.syncHud();
    }

    beginWave(waveNum, forceBossKind = null) {
      this.wave = waveNum;
      this.spawnQueue = [];
      this.boss = null;
      this.dom.bossHud.classList.add("hidden");

      if (waveNum % 3 === 0 || forceBossKind) {
        this.boss = createBoss(waveNum, forceBossKind);
        this.dom.bossHud.classList.remove("hidden");
        this.dom.bossName.textContent = this.boss.name;
        Audio.playMusic("FINALE");

        if (this.boss.kind === "SANS") {
          this.arenaBox = { x: 190, y: 270, w: 580, h: 300, persistent: true, timer: 999, spawnTimer: 0 };
          this.player.x = GAME_W / 2;
          this.player.y = 460;
          this.soulMode = "RED";
          this.showBanner("BAD TIME // BOSS", "SANS BLOCKS THE WAY", true, 2.3);
          this.showDialogue("* it's a beautiful day outside. ready to have a bad time?", 3.8);
          Audio.sansBlip();
        } else {
          this.showBanner("WARNING // BOSS", `${this.boss.name} BLOCKS THE WAY`, true, 2.3);
          this.showDialogue(`* ${this.boss.name} blocks the way!`, 3.4);
          Audio.bossWarning();
        }
      } else {
        Audio.playMusic("DOOM");
        const count = 9 + waveNum * 3;
        const pool = ["DRONE", "WEAVER"];
        if (waveNum >= 2) pool.push("SPLITTER");
        if (waveNum >= 3) pool.push("HEX");
        if (waveNum >= 4) pool.push("STRIKER");

        for (let i = 0; i < count; i++) {
          const kind = pool[Math.floor(Math.random() * pool.length)];
          this.spawnQueue.push(kind);
        }
        this.spawnTimer = 0.6;
        this.showBanner(`WAVE ${String(waveNum).padStart(2, "0")}`, "HOSTILES INBOUND", false, 1.7);
        const waveLines = [
          "* Smells like neon ozone. Press Space/V to ACT or SPARE!",
          "* CYAN attacks hurt if you move. ORANGE hurts if you stop!",
          "* Knowing the stars shine above... fills you with DETERMINATION.",
        ];
        this.showDialogue(waveLines[(waveNum - 1) % waveLines.length], 3.4);
      }
      this.syncHud();
    }

    showDialogue(text, duration = 3.0) {
      if (!this.dom.battleBox) return;
      this.dom.battleBoxText.textContent = text;
      this.dom.battleBox.classList.remove("hidden");
      this.dialogueTimer = duration;
      Audio.textBlip();
    }

    showBanner(text, sub, warning = false, duration = 1.8) {
      this.dom.bannerText.textContent = text;
      this.dom.bannerText.classList.toggle("warning", warning);
      this.dom.bannerSub.textContent = sub;
      this.dom.banner.classList.remove("hidden");
      this.bannerTimer = duration;
    }

    addShake(intensity, duration = 0.2) {
      this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
      this.shakeTimer = Math.max(this.shakeTimer, duration);
    }

    spawnParticles(x, y, color, count = 14, speedMax = 210) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * speedMax;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.3 + Math.random() * 0.35,
          maxLife: 0.65,
          size: 2 + Math.random() * 2.5,
          color,
        });
      }
    }

    spawnRing(x, y, color, maxRadius = 60) {
      this.rings.push({ x, y, r: 6, maxR: maxRadius, color, alpha: 0.9 });
    }

    addPopup(x, y, text, color = COLORS.cyan) {
      this.popups.push({ x, y, text, color, life: 0.85, maxLife: 0.85 });
    }

    triggerDash() {
      const p = this.player;
      if (p.dashCooldown > 0 || p.dashTimer > 0) return;

      let dx = 0;
      let dy = 0;
      if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) dx -= 1;
      if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) dx += 1;
      if (this.keys.has("ArrowUp") || this.keys.has("KeyW")) dy -= 1;
      if (this.keys.has("ArrowDown") || this.keys.has("KeyS")) dy += 1;

      if (dx === 0 && dy === 0 && this.mouseControl && this.controlMode === "pointer" && this.pointerTarget) {
        const pdx = this.pointerTarget.x - p.x;
        const pdy = this.pointerTarget.y - p.y;
        if (Math.hypot(pdx, pdy) > 8) {
          dx = pdx;
          dy = pdy;
        }
      }

      if (dx === 0 && dy === 0) dy = -1;
      const len = Math.hypot(dx, dy) || 1;
      p.dashVx = (dx / len) * 860;
      p.dashVy = (dy / len) * 860;
      p.dashTimer = 0.14;
      p.dashCooldown = 1.05;
      p.invulnTimer = Math.max(p.invulnTimer, 0.22);
      Audio.dash();
      this.spawnRing(p.x, p.y, COLORS.cyan, 42);
    }

    triggerEmp() {
      const p = this.player;
      if (p.bombs <= 0) return;
      p.bombs -= 1;
      this.empFlash = 0.55;
      this.addShake(11, 0.35);
      Audio.emp();
      this.spawnRing(p.x, p.y, COLORS.amber, 540);

      // Vaporize all enemy bullets into small score sparks
      for (const b of this.enemyBullets) {
        this.spawnParticles(b.x, b.y, COLORS.amber, 3, 90);
      }
      this.enemyBullets = [];

      // Damage all enemies on screen
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        this.damageEnemy(this.enemies[i], 6, i);
      }
      if (this.boss && this.boss.y >= 20) {
        this.damageBoss(16);
      }
      this.syncHud();
    }

    triggerActSpare() {
      if (this.actCooldown > 0) return;
      this.actCooldown = 0.38;
      const p = this.player;
      const range = 330;
      this.spawnRing(p.x, p.y, COLORS.yellow, range);

      let sparedAny = false;
      let actedLine = null;

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (Math.hypot(e.x - p.x, e.y - p.y) > range) continue;

        if (e.spareable) {
          this.enemies.splice(i, 1);
          sparedAny = true;
          this.sparedCount += 1;
          this.combo = Math.min(10, this.combo + 1);
          this.maxCombo = Math.max(this.maxCombo, this.combo);
          this.comboTimer = this.comboDuration;
          const gained = e.score * 2 * this.combo;
          this.addScore(gained);
          this.spawnParticles(e.x, e.y, COLORS.yellow, 14, 170);
          this.addPopup(e.x, e.y, `SPARED! +${gained}`, COLORS.yellow);
          actedLine = `* You spared ${e.kind}! (+${gained}G)`;
          if (Math.random() < 0.28) {
            const saveSpec = POWERUPS.find((item) => item.type === "SAVE");
            this.powerups.push({ ...saveSpec, x: e.x, y: e.y, vy: 105, radius: 14, age: 0 });
          }
        } else {
          e.mercy += 1;
          actedLine = e.actLine;
          if (e.mercy >= e.mercyMax) {
            e.spareable = true;
            this.addPopup(e.x, e.y - 16, "★ YELLOW!", COLORS.yellow);
          } else {
            this.addPopup(e.x, e.y - 16, "ACT ♥", COLORS.yellow);
          }
        }
      }

      if (this.boss && this.boss.y >= 20) {
        const boss = this.boss;
        if (boss.kind === "SANS" && boss.fakeSpareOffered && !boss.finalAttackStarted) {
          boss.spareable = false;
          boss.finalAttackStarted = true;
          boss.attackState = "FINAL_WHEEL";
          boss.attackTimer = 6.2;
          boss.patternTick = 0;
          boss.eyeFlashTimer = 2.0;
          this.soulMode = "RED";
          Audio.sansBlip();
          this.addPopup(boss.x, boss.y - 24, "GET DUNKED ON?!", COLORS.cyan);
          actedLine = "* sans: geeettttttt... JUST KIDDING! survive THIS!";
        } else if (boss.spareable) {
          sparedAny = true;
          this.sparedCount += 1;
          const gained = boss.score * 2 * this.combo;
          this.addScore(gained);
          this.spawnParticles(boss.x, boss.y, COLORS.yellow, 55, 300);
          this.spawnRing(boss.x, boss.y, COLORS.yellow, 260);
          this.addPopup(boss.x, boss.y, `MERCY! +${gained}`, COLORS.yellow);
          actedLine =
            boss.kind === "SANS"
              ? `* sans: ...welp. guess i'm going to grillby's. (+${gained}G)`
              : `* MERCY! ${boss.name} accepted your SPARE!`;
          if (p.lives < p.maxLives) p.lives += 1;
          this.endBossFightCleanup();
        } else {
          boss.mercy += 1;
          if (boss.kind === "SANS") {
            const sansQuips = [
              "* sans: nice dodge-bait, pal. keep trying.",
              "* sans: you're gonna have to try a little harder than that.",
              "* You tell Sans a skeleton joke. His eye twitches.",
              "* sans: ...huh. you really don't give up, do you?",
            ];
            actedLine = sansQuips[(boss.mercy - 1) % sansQuips.length];
            boss.hp = Math.max(boss.maxHp * 0.08, boss.hp - 7);
            Audio.sansBlip();
            this.addPopup(boss.x, boss.y - 24, `ACT (${boss.mercy})`, COLORS.yellow);
          } else if (boss.mercy >= boss.mercyMax) {
            boss.spareable = true;
            actedLine = `* ${boss.name}'s name is YELLOW! Press Space/V to SPARE!`;
            this.addPopup(boss.x, boss.y, "★ SPAREABLE!", COLORS.yellow);
          } else {
            const bossQuips = [
              `* You complimented ${boss.name}'s lasers. Attack slowed!`,
              `* You offered ${boss.name} a Monster Candy.`,
              `* ${boss.name} seems touched by your DETERMINATION.`,
            ];
            actedLine = bossQuips[(boss.mercy - 1) % bossQuips.length];
            boss.fireTimer += 0.55;
            this.addPopup(boss.x, boss.y - 24, `ACT (${boss.mercy}/${boss.mercyMax})`, COLORS.yellow);
          }
        }
      }

      if (sparedAny) Audio.spare();
      else Audio.act();

      if (actedLine) this.showDialogue(actedLine, 3.0);
      this.syncHud();
    }

    endBossFightCleanup() {
      this.boss = null;
      this.dom.bossHud.classList.add("hidden");
      this.enemyBullets = [];
      this.bones = [];
      this.arenaBox = null;
      this.soulMode = "RED";
      if (this.state === "PLAYING") {
        Audio.playMusic("DOOM");
      }
    }

    firePlayerWeapon() {
      const p = this.player;
      const rapidMult = p.rapidTimer > 0 ? 0.56 : 1;

      if (p.weapon === "SPREAD") {
        p.fireCooldown = 0.19 * rapidMult;
        [-0.24, -0.11, 0, 0.11, 0.24].forEach((ang) => {
          this.bullets.push({
            x: p.x,
            y: p.y - 16,
            vx: Math.sin(ang) * 620,
            vy: -Math.cos(ang) * 620,
            dmg: 1,
            color: COLORS.cyan,
            r: 4,
            pierce: false,
          });
        });
      } else if (p.weapon === "PLASMA") {
        p.fireCooldown = 0.22 * rapidMult;
        [-11, 11].forEach((ox) => {
          this.bullets.push({
            x: p.x + ox,
            y: p.y - 18,
            vx: 0,
            vy: -760,
            dmg: 2.2,
            color: COLORS.magenta,
            r: 5.5,
            pierce: true,
            hitIds: new Set(),
          });
        });
      } else {
        p.fireCooldown = 0.15 * rapidMult;
        [-8, 8].forEach((ox) => {
          this.bullets.push({
            x: p.x + ox,
            y: p.y - 14,
            vx: 0,
            vy: -670,
            dmg: 1,
            color: COLORS.cyan,
            r: 3.5,
            pierce: false,
          });
        });
      }
      Audio.shoot(p.weapon);
    }

    loop(now) {
      const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
      this.lastFrame = now;

      this.updateBackdrop(dt);
      if (this.state === "PLAYING") {
        this.update(dt);
      }
      this.render();
      requestAnimationFrame((t) => this.loop(t));
    }

    updateBackdrop(dt) {
      this.gridOffset = (this.gridOffset + 55 * dt) % 48;
      for (const s of this.stars) {
        s.y += s.speed * dt;
        if (s.y > GAME_H) {
          s.y = -4;
          s.x = Math.random() * GAME_W;
        }
      }
    }

    update(dt) {
      const p = this.player;

      if (this.bannerTimer > 0) {
        this.bannerTimer -= dt;
        if (this.bannerTimer <= 0) {
          this.dom.banner.classList.add("hidden");
        }
      }

      if (this.dialogueTimer > 0) {
        this.dialogueTimer -= dt;
        if (this.dialogueTimer <= 0 && this.dom.battleBox) {
          this.dom.battleBox.classList.add("hidden");
        }
      }
      if (this.actCooldown > 0) this.actCooldown -= dt;

      if (this.shakeTimer > 0) {
        this.shakeTimer -= dt;
        if (this.shakeTimer <= 0) this.shakeIntensity = 0;
      }
      if (this.empFlash > 0) this.empFlash -= dt;

      // Combo decay
      if (this.combo > 1) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          this.combo = 1;
        }
      }

      // Player timers
      if (p.invulnTimer > 0) p.invulnTimer -= dt;
      if (p.dashCooldown > 0) p.dashCooldown -= dt;
      if (p.fireCooldown > 0) p.fireCooldown -= dt;
      if (p.rapidTimer > 0) p.rapidTimer -= dt;
      if (p.weaponTimer > 0) {
        p.weaponTimer -= dt;
        if (p.weaponTimer <= 0) p.weapon = "PULSE";
      }

      const prevX = p.x;
      const prevY = p.y;

      // Movement (BLUE SOUL Battle Box gravity vs RED SOUL free flight)
      if (this.arenaBox && this.soulMode === "BLUE") {
        const box = this.arenaBox;
        let dx = 0;
        if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) dx -= 1;
        if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) dx += 1;
        p.x += dx * p.speed * 0.88 * dt;

        const prevBottom = prevY + 14;
        const jumpHeld = this.keys.has("ArrowUp") || this.keys.has("KeyW");
        if (jumpHeld && this.onGround) {
          this.soulVy = -545;
          this.onGround = false;
          Audio.dash();
        }
        if (this.keys.has("ArrowDown") || this.keys.has("KeyS")) {
          this.soulVy += 980 * dt;
        }
        if (!jumpHeld && this.soulVy < -140) {
          this.soulVy *= 0.86;
        }
        this.soulVy += 1280 * dt;
        p.y += this.soulVy * dt;

        const minX = box.x + 18;
        const maxX = box.x + box.w - 18;
        const minY = box.y + 18;
        const floorY = box.y + box.h - 18;

        p.x = Math.max(minX, Math.min(maxX, p.x));
        if (p.y < minY) {
          p.y = minY;
          this.soulVy = 0;
        }

        let landed = false;
        if (this.boss && this.boss.kind === "SANS" && this.boss.platforms.length > 0 && this.soulVy >= 0) {
          for (const plat of this.boss.platforms) {
            if (p.x >= plat.x - plat.w / 2 - 8 && p.x <= plat.x + plat.w / 2 + 8) {
              const platTop = plat.y - 14;
              if (prevBottom <= plat.y + 6 && p.y + 14 >= plat.y) {
                p.y = platTop;
                p.x += plat.vx * dt;
                this.soulVy = 0;
                landed = true;
                break;
              }
            }
          }
        }

        if (p.y >= floorY) {
          p.y = floorY;
          this.soulVy = 0;
          landed = true;
        }
        this.onGround = landed;
      } else if (p.dashTimer > 0) {
        p.dashTimer -= dt;
        p.x += p.dashVx * dt;
        p.y += p.dashVy * dt;
        p.afterimages.push({ x: p.x, y: p.y, alpha: 0.7 });
      } else {
        let dx = 0;
        let dy = 0;
        if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) dx -= 1;
        if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) dx += 1;
        if (this.keys.has("ArrowUp") || this.keys.has("KeyW")) dy -= 1;
        if (this.keys.has("ArrowDown") || this.keys.has("KeyS")) dy += 1;

        if (dx !== 0 || dy !== 0) {
          const len = Math.hypot(dx, dy);
          p.x += (dx / len) * p.speed * dt;
          p.y += (dy / len) * p.speed * dt;
        } else if (this.mouseControl && this.controlMode === "pointer" && this.pointerTarget) {
          const pdx = this.pointerTarget.x - p.x;
          const pdy = this.pointerTarget.y - p.y;
          const dist = Math.hypot(pdx, pdy);
          if (dist > 1.5) {
            const step = Math.min(dist, 980 * dt);
            p.x += (pdx / dist) * step;
            p.y += (pdy / dist) * step;
          }
        }
      }

      if (this.arenaBox) {
        const box = this.arenaBox;
        p.x = Math.max(box.x + 18, Math.min(box.x + box.w - 18, p.x));
        p.y = Math.max(box.y + 18, Math.min(box.y + box.h - 18, p.y));
      } else {
        p.x = Math.max(24, Math.min(GAME_W - 24, p.x));
        p.y = Math.max(36, Math.min(GAME_H - 28, p.y));
      }
      this.playerMoved = Math.hypot(p.x - prevX, p.y - prevY) > 0.6;

      for (let i = p.afterimages.length - 1; i >= 0; i--) {
        p.afterimages[i].alpha -= dt * 3.5;
        if (p.afterimages[i].alpha <= 0) p.afterimages.splice(i, 1);
      }

      const manualFire = !this.autoFire && (this.pointerFiring || this.keys.has("Space") || this.keys.has("KeyZ"));
      const firing = this.autoFire || manualFire || this.keys.has("KeyZ");
      if (firing && p.fireCooldown <= 0) {
        this.firePlayerWeapon();
      }

      if (this.arenaBox) {
        this.updateArenaBox(dt);
      }

      // Spawn waves
      if (this.spawnQueue.length > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          const kind = this.spawnQueue.shift();
          const x = 44 + Math.random() * (GAME_W - 88);
          this.enemies.push(createEnemy(kind, x, -28, this.wave));
          this.spawnTimer = Math.max(0.28, 0.88 - this.wave * 0.045);
        }
      } else if (!this.boss && this.enemies.length === 0) {
        this.waveClearDelay += dt;
        if (this.waveClearDelay >= 1.1) {
          this.waveClearDelay = 0;
          this.beginWave(this.wave + 1);
        }
      }

      this.updateBullets(dt);
      this.updateEnemies(dt);
      if (this.boss) this.updateBoss(dt);
      this.updateEnemyBullets(dt);
      this.updatePowerups(dt);
      this.updateEffects(dt);
      this.syncHud();
    }

    updateBullets(dt) {
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (b.y < -20 || b.x < -20 || b.x > GAME_W + 20) {
          this.bullets.splice(i, 1);
          continue;
        }

        let consumed = false;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (b.pierce && b.hitIds.has(e)) continue;
          if (Math.hypot(b.x - e.x, b.y - e.y) <= b.r + e.radius) {
            if (b.pierce) b.hitIds.add(e);
            else consumed = true;
            this.damageEnemy(e, b.dmg, j);
            if (consumed) break;
          }
        }

        if (!consumed && this.boss && this.boss.y >= 10) {
          if (!(b.pierce && b.hitIds.has(this.boss))) {
            const bossHitX = this.boss.x + (this.boss.dodgeOffset || 0);
            if (Math.hypot(b.x - bossHitX, b.y - this.boss.y) <= b.r + this.boss.radius) {
              if (b.pierce) b.hitIds.add(this.boss);
              else consumed = true;
              this.damageBoss(b.dmg);
            }
          }
        }

        if (consumed) {
          this.spawnParticles(b.x, b.y, b.color, 4, 80);
          this.bullets.splice(i, 1);
        }
      }
    }

    damageEnemy(e, dmg, index) {
      e.hp -= dmg;
      e.hitFlash = 0.08;
      if (e.hp > 0) {
        if (e.hp <= e.maxHp * 0.5 && !e.spareable) {
          e.spareable = true;
          this.addPopup(e.x, e.y - 16, "★ YELLOW!", COLORS.yellow);
        }
        Audio.hit();
        return;
      }

      // Enemy destroyed
      this.enemies.splice(index, 1);
      Audio.explode(false);
      this.spawnParticles(e.x, e.y, e.color, 16, 200);
      this.spawnRing(e.x, e.y, e.color, 40);

      // Splitter spawns 2 mini shards
      if (e.kind === "SPLITTER") {
        this.enemies.push(createEnemy("MINI", e.x - 14, e.y, this.wave));
        this.enemies.push(createEnemy("MINI", e.x + 14, e.y, this.wave));
      }

      // Score + Combo
      this.combo = Math.min(10, this.combo + 1);
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.comboTimer = this.comboDuration;

      const gained = e.score * this.combo;
      this.addScore(gained);
      this.addPopup(e.x, e.y, `+${gained}${this.combo > 1 ? ` x${this.combo}` : ""}`, e.color);

      // Power-up drop chance
      if (Math.random() < 0.16) {
        const spec = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
        this.powerups.push({
          ...spec,
          x: e.x,
          y: e.y,
          vy: 115,
          radius: 14,
          age: 0,
        });
      }
    }

    damageBoss(dmg) {
      const boss = this.boss;
      if (!boss) return;

      if (boss.kind === "SANS") {
        // Fake spare trigger -> Final Special Attack!
        if (boss.fakeSpareOffered && !boss.finalAttackStarted) {
          boss.spareable = false;
          boss.finalAttackStarted = true;
          boss.attackState = "FINAL_WHEEL";
          boss.attackTimer = 6.4;
          boss.patternTick = 0;
          boss.eyeFlashTimer = 2.0;
          this.soulMode = "RED";
          Audio.sansBlip();
          this.addPopup(boss.x, boss.y - 24, "NOPE!", COLORS.cyan);
          this.showDialogue("* sans: did you really think it'd be that easy?!", 3.2);
          return;
        }

        if (!boss.sleeping) {
          // Sans sidesteps shots while draining dodge stamina!
          const staminaDmg = dmg * 0.72;
          boss.hp = Math.max(boss.finalAttackDone ? 0 : boss.maxHp * 0.06, boss.hp - staminaDmg);
          if (boss.dodgeCooldown <= 0) {
            boss.targetDodgeOffset = boss.targetDodgeOffset >= 0 ? -(44 + Math.random() * 44) : 44 + Math.random() * 44;
            boss.dodgeCooldown = 0.24;
            Audio.dodge();
          }
          if (boss.missPopupCooldown <= 0) {
            this.addPopup(boss.x + boss.dodgeOffset, boss.y - 36, "MISS", "#ffffff");
            boss.missPopupCooldown = 0.36;
          }
        } else {
          boss.hp -= dmg * 3.5;
          boss.hitFlash = 0.08;
        }
      } else {
        boss.hp -= dmg;
        boss.hitFlash = 0.06;
      }

      const hpRatio = boss.hp / boss.maxHp;
      if (boss.kind === "SANS") {
        if (hpRatio <= 0.42) boss.sweat = 1;
        if (hpRatio <= 0.24 && !boss.fakeSpareOffered) {
          boss.fakeSpareOffered = true;
          boss.spareable = true;
          boss.attackState = "FAKE_SPARE";
          boss.attackTimer = 3.5;
          boss.blasters = [];
          boss.boneSpikes = [];
          this.bones = [];
          this.soulMode = "RED";
          Audio.sansBlip();
          this.showDialogue("* sans is sparing you. (Shoot or press Space/V...)", 3.5);
        }
        const newPhase = boss.finalAttackStarted ? 4 : hpRatio <= 0.35 ? 3 : hpRatio <= 0.68 ? 2 : 1;
        if (newPhase > boss.phase) {
          boss.phase = newPhase;
          this.addShake(7, 0.24);
          this.spawnRing(boss.x, boss.y, COLORS.cyan, 130);
          this.addPopup(boss.x, boss.y - 36, `PHASE ${newPhase}!`, COLORS.cyan);
          if (newPhase === 2) {
            this.showDialogue("* sans: i'm not gonna sugarcoat it. cyan & orange time.", 3.0);
          } else if (newPhase === 3) {
            this.showDialogue("* sans: *sweats* ...you feel your sins crawling on your back.", 3.0);
          }
          Audio.sansBlip();
        }
      } else {
        if (hpRatio > 0 && hpRatio <= 0.15 && !boss.spareable) {
          boss.spareable = true;
          this.showDialogue(`* ${boss.name} is sparing you? Name is YELLOW! (Space/V)`, 3.4);
        }
        const newPhase = hpRatio <= 0.33 ? 3 : hpRatio <= 0.66 ? 2 : 1;
        if (newPhase > boss.phase) {
          boss.phase = newPhase;
          this.addShake(8, 0.28);
          this.spawnRing(boss.x, boss.y, COLORS.amber, 130);
          this.addPopup(boss.x, boss.y - 36, `PHASE ${newPhase}!`, COLORS.amber);
          this.showDialogue(`* ${boss.name} refuses to yield! (PHASE ${newPhase})`, 2.6);
        }
      }

      if (boss.hp <= 0) {
        Audio.explode(true);
        this.addShake(15, 0.55);
        this.spawnParticles(boss.x, boss.y, boss.kind === "SANS" ? COLORS.cyan : COLORS.magenta, 55, 340);
        this.spawnParticles(boss.x, boss.y, COLORS.cyan, 40, 280);
        this.spawnRing(boss.x, boss.y, COLORS.cyan, 220);

        const gained = boss.score * this.combo;
        this.addScore(gained);
        this.addPopup(boss.x, boss.y, `BOSS DEFEATED +${gained}`, COLORS.amber);
        this.showDialogue(
          boss.kind === "SANS"
            ? `* sans: ...welp. don't say i didn't warn ya. (+${gained}G)`
            : `* YOU WON! Gained ${gained}G!`,
          3.4
        );

        // Reward drop
        const saveSpec = POWERUPS.find((item) => item.type === "SAVE");
        this.powerups.push({ ...saveSpec, x: boss.x, y: boss.y, vy: 110, radius: 14, age: 0 });
        if (this.player.lives < this.player.maxLives) {
          this.player.lives += 1;
          this.addPopup(this.player.x, this.player.y - 26, "+1 HULL", COLORS.lime);
        }

        this.endBossFightCleanup();
      } else if (boss.kind !== "SANS" || boss.sleeping) {
        Audio.hit();
      }
    }

    addScore(points) {
      this.score += points;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.saveNumber(HIGH_SCORE_KEY, this.highScore);
      }
    }

    updateEnemies(dt) {
      const p = this.player;
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        e.age += dt;
        if (e.hitFlash > 0) e.hitFlash -= dt;

        if (e.kind === "WEAVER") {
          e.y += e.speedY * dt;
          e.x = e.baseX + Math.sin(e.age * 3.4) * 65;
        } else if (e.kind === "STRIKER") {
          if (e.state === "TRACK") {
            e.y += e.speedY * dt;
            e.stateTimer -= dt;
            if (e.stateTimer <= 0) {
              e.state = "AIM";
              e.stateTimer = 0.55;
            }
          } else if (e.state === "AIM") {
            e.stateTimer -= dt;
            if (e.stateTimer <= 0) {
              const ang = Math.atan2(p.y - e.y, p.x - e.x);
              e.vx = Math.cos(ang) * 390;
              e.vy = Math.sin(ang) * 390;
              e.state = "DASH";
            }
          } else {
            e.x += e.vx * dt;
            e.y += e.vy * dt;
          }
        } else {
          e.y += e.speedY * dt;
          e.x += (e.vx || 0) * dt;
          if (e.x < 24 || e.x > GAME_W - 24) e.vx = -(e.vx || 0);
        }

        e.x = Math.max(20, Math.min(GAME_W - 20, e.x));

        // Enemy firing
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && e.y > 20 && e.y < GAME_H - 130) {
          if (e.kind === "HEX") {
            const rule = this.wave >= 2 && Math.random() < 0.45 ? (Math.random() < 0.5 ? "BLUE" : "ORANGE") : null;
            const bColor = rule === "BLUE" ? "#00e5ff" : rule === "ORANGE" ? COLORS.orange : COLORS.amber;
            for (let k = 0; k < 6; k++) {
              const ang = (Math.PI * 2 * k) / 6 + e.age;
              this.enemyBullets.push({
                x: e.x,
                y: e.y,
                vx: Math.cos(ang) * 190,
                vy: Math.sin(ang) * 190,
                r: 5,
                color: bColor,
                utRule: rule,
              });
            }
            e.fireTimer = 2.1;
          } else {
            const ang = Math.atan2(p.y - e.y, p.x - e.x);
            const spd = 230 + this.wave * 8;
            const rule = this.wave >= 2 && Math.random() < 0.25 ? (Math.random() < 0.5 ? "BLUE" : "ORANGE") : null;
            const bColor = rule === "BLUE" ? "#00e5ff" : rule === "ORANGE" ? COLORS.orange : e.color;
            this.enemyBullets.push({
              x: e.x,
              y: e.y + 8,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              r: 4.5,
              color: bColor,
              utRule: rule,
            });
            e.fireTimer = 1.9 + Math.random() * 1.1;
          }
        }

        if (e.y > GAME_H + 40) {
          this.enemies.splice(i, 1);
          continue;
        }

        if (Math.hypot(e.x - p.x, e.y - p.y) <= e.radius + p.radius - 3) {
          this.damageEnemy(e, 999, i);
          this.hitPlayer();
        }
      }
    }

    updateBoss(dt) {
      const boss = this.boss;
      boss.age += dt;
      if (boss.hitFlash > 0) boss.hitFlash -= dt;

      if (boss.y < boss.targetY) {
        boss.y += 95 * dt;
        return;
      }

      if (boss.kind === "SANS") {
        this.updateSansBoss(dt, boss);
        this.dom.bossPhase.textContent = boss.sleeping
          ? "SLEEPING (SPARE OR HIT!)"
          : `STAMINA // PHASE ${boss.phase}`;
        this.dom.bossBarFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
        return;
      }

      const moveSpeed = 95 + boss.phase * 38;
      boss.x += boss.dir * moveSpeed * dt;
      if (boss.x < 95) {
        boss.x = 95;
        boss.dir = 1;
      } else if (boss.x > GAME_W - 95) {
        boss.x = GAME_W - 95;
        boss.dir = -1;
      }

      // Aimed fan shots
      boss.fireTimer -= dt;
      if (boss.fireTimer <= 0) {
        const baseAng = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
        const spreadCount = boss.phase + 2;
        for (let i = 0; i < spreadCount; i++) {
          const offset = (i - (spreadCount - 1) / 2) * 0.19;
          const spd = 240 + boss.phase * 25;
          this.enemyBullets.push({
            x: boss.x,
            y: boss.y + 24,
            vx: Math.cos(baseAng + offset) * spd,
            vy: Math.sin(baseAng + offset) * spd,
            r: 5.5,
            color: COLORS.magenta,
          });
        }
        boss.fireTimer = Math.max(0.55, 1.35 - boss.phase * 0.24);
      }

      // Radial spiral burst (with occasional Blue/Orange Undertale wave!)
      boss.radialTimer -= dt;
      if (boss.radialTimer <= 0) {
        const count = 8 + boss.phase * 4;
        const rule = Math.random() < 0.45 ? (Math.random() < 0.5 ? "BLUE" : "ORANGE") : null;
        const bColor = rule === "BLUE" ? "#00e5ff" : rule === "ORANGE" ? COLORS.orange : COLORS.amber;
        for (let i = 0; i < count; i++) {
          const ang = (Math.PI * 2 * i) / count + boss.age * 1.4;
          this.enemyBullets.push({
            x: boss.x,
            y: boss.y,
            vx: Math.cos(ang) * 185,
            vy: Math.sin(ang) * 185,
            r: 5,
            color: bColor,
            utRule: rule,
          });
        }
        boss.radialTimer = Math.max(1.4, 2.7 - boss.phase * 0.35);
      }

      // Gaster Blaster beam in Phase 2+
      if (boss.phase >= 2) {
        if (boss.laserActive > 0) {
          boss.laserActive -= dt;
          if (Math.abs(this.player.x - boss.x) < 22 && this.player.y > boss.y) {
            this.hitPlayer();
          }
        } else if (boss.laserCharge > 0) {
          boss.laserCharge -= dt;
          if (boss.laserCharge <= 0) {
            boss.laserActive = 0.85;
            this.addShake(5, 0.25);
            Audio.blasterBeam();
          }
        } else {
          boss.laserTimer -= dt;
          if (boss.laserTimer <= 0) {
            boss.laserCharge = 0.95;
            boss.laserTimer = 5.2;
          }
        }
      }

      // Undertale Battle Box + BLUE SOUL Bone Jump Phase
      boss.boneWaveTimer -= dt;
      if (boss.boneWaveTimer <= 0 && !this.arenaBox) {
        this.arenaBox = { x: 240, y: 290, w: 480, h: 250, timer: 6.2, spawnTimer: 0.9 };
        this.soulMode = "BLUE";
        this.soulVy = 0;
        this.onGround = false;
        this.player.x = Math.max(260, Math.min(700, this.player.x));
        this.player.y = Math.max(310, Math.min(520, this.player.y));
        Audio.soulSwitch();
        this.showDialogue("* You're BLUE now! Press UP to jump over the bones!", 3.6);
        boss.boneWaveTimer = 13.5;
      }

      // Update Boss HUD
      this.dom.bossPhase.textContent = `PHASE ${boss.phase}`;
      this.dom.bossBarFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
    }

    distToSegment(px, py, x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return Math.hypot(px - x1, py - y1);
      let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }

    spawnSansBlaster(x, y, targetX, targetY, opts = {}) {
      const boss = this.boss;
      if (!boss || boss.kind !== "SANS") return;
      const angle = opts.angle !== undefined ? opts.angle : Math.atan2(targetY - y, targetX - x);
      Audio.gasterCharge();
      boss.blasters.push({
        x,
        y,
        angle,
        scale: opts.scale || 1,
        beamWidth: opts.beamWidth || 34,
        beamLen: opts.beamLen || 760,
        state: "CHARGE",
        timer: opts.chargeTime || 0.78,
        fireDuration: opts.fireTime || 0.52,
        jawOpen: 0,
        age: 0,
      });
    }

    startNextSansPattern(boss) {
      const box = this.arenaBox;
      if (!box) return;
      this.bones = [];
      boss.boneSpikes = [];
      boss.platforms = [];
      boss.slamSide = null;

      const deck =
        boss.phase === 1
          ? ["BONE_CORRIDOR", "GASTER_CROSS", "TELEKINESIS_SLAM"]
          : boss.phase === 2
          ? ["BONE_TUNNEL", "PLATFORM_HOP", "GASTER_CROSS", "TELEKINESIS_SLAM"]
          : ["TELEKINESIS_SLAM", "BONE_TUNNEL", "GASTER_CROSS", "BONE_CORRIDOR", "PLATFORM_HOP"];

      const next = deck[boss.attackIndex % deck.length];
      boss.attackIndex += 1;
      boss.attackState = next;
      boss.patternTick = 0;

      if (next === "BONE_CORRIDOR") {
        this.soulMode = "BLUE";
        this.soulVy = 0;
        boss.attackTimer = 5.6;
        Audio.soulSwitch();
        this.showDialogue("* sans: hope you brought your jumping shoes.", 2.8);
      } else if (next === "BONE_TUNNEL") {
        this.soulMode = "RED";
        boss.attackTimer = 5.8;
        Audio.soulSwitch();
        this.showDialogue("* sans: weave through the bone tunnel!", 2.8);
      } else if (next === "TELEKINESIS_SLAM") {
        this.soulMode = "BLUE";
        this.soulVy = 0;
        boss.eyeFlashTimer = 2.2;
        boss.attackTimer = 5.4;
        boss.slamTimer = 0.25;
        Audio.soulSwitch();
        this.showDialogue("* sans's left eye flashes CYAN! Watch the wall slams!", 2.8);
      } else if (next === "GASTER_CROSS") {
        this.soulMode = "RED";
        boss.eyeFlashTimer = 1.8;
        boss.attackTimer = 5.2;
        Audio.soulSwitch();
        this.showDialogue("* sans: say hello to my Gaster Blasters.", 2.6);
      } else if (next === "PLATFORM_HOP") {
        this.soulMode = "BLUE";
        this.soulVy = 0;
        boss.attackTimer = 5.6;
        boss.platforms = [
          { x: box.x + 150, y: box.y + 175, w: 105, vx: 95 },
          { x: box.x + 420, y: box.y + 125, w: 105, vx: -95 },
        ];
        Audio.soulSwitch();
        this.showDialogue("* sans: floor's full of bones. hop on the platforms!", 2.8);
      }
    }

    updateSansBoss(dt, boss) {
      const box = this.arenaBox;
      const p = this.player;

      if (boss.dodgeCooldown > 0) boss.dodgeCooldown -= dt;
      if (boss.missPopupCooldown > 0) boss.missPopupCooldown -= dt;
      if (boss.eyeFlashTimer > 0) boss.eyeFlashTimer -= dt;
      if (boss.krTimer > 0) boss.krTimer -= dt;

      // Smooth sidestep interpolation & gentle hover
      boss.dodgeOffset += (boss.targetDodgeOffset - boss.dodgeOffset) * Math.min(1, dt * 11);
      if (boss.dodgeCooldown <= 0) {
        boss.targetDodgeOffset *= Math.pow(0.2, dt);
      }

      if (boss.sleeping) {
        boss.blasters = [];
        boss.boneSpikes = [];
        boss.platforms = [];
        this.bones = [];
        return;
      }

      // Update Gaster Blasters
      for (let i = boss.blasters.length - 1; i >= 0; i--) {
        const gb = boss.blasters[i];
        gb.age += dt;
        gb.timer -= dt;
        if (gb.state === "CHARGE") {
          gb.jawOpen = Math.min(8, gb.jawOpen + dt * 16);
          if (gb.timer <= 0) {
            gb.state = "FIRE";
            gb.timer = gb.fireDuration;
            this.addShake(6, 0.2);
            Audio.blasterBeam();
          }
        } else if (gb.state === "FIRE") {
          gb.jawOpen = 10;
          const ex = gb.x + Math.cos(gb.angle) * gb.beamLen;
          const ey = gb.y + Math.sin(gb.angle) * gb.beamLen;
          const dist = this.distToSegment(p.x, p.y, gb.x, gb.y, ex, ey);
          if (dist <= gb.beamWidth * 0.48 + p.radius - 4) {
            this.hitPlayer();
          }
          if (gb.timer <= 0) {
            boss.blasters.splice(i, 1);
          }
        }
      }

      // Update Wall Bone Spikes (from Telekinesis Slams)
      for (let i = boss.boneSpikes.length - 1; i >= 0; i--) {
        const sp = boss.boneSpikes[i];
        sp.timer -= dt;
        if (sp.state === "WARN" && sp.timer <= 0) {
          sp.state = "ACTIVE";
          sp.timer = 0.48;
          this.addShake(4, 0.14);
        } else if (sp.state === "ACTIVE") {
          const depth = 98;
          let hit = false;
          if (sp.side === "BOTTOM" && p.y + p.radius > box.y + box.h - depth) hit = true;
          if (sp.side === "TOP" && p.y - p.radius < box.y + depth) hit = true;
          if (sp.side === "LEFT" && p.x - p.radius < box.x + depth) hit = true;
          if (sp.side === "RIGHT" && p.x + p.radius > box.x + box.w - depth) hit = true;
          if (hit) this.hitPlayer();
          if (sp.timer <= 0) boss.boneSpikes.splice(i, 1);
        }
      }

      // Update moving platforms
      for (const plat of boss.platforms) {
        plat.x += plat.vx * dt;
        if (plat.x - plat.w / 2 < box.x + 14) {
          plat.x = box.x + 14 + plat.w / 2;
          plat.vx = Math.abs(plat.vx);
        } else if (plat.x + plat.w / 2 > box.x + box.w - 14) {
          plat.x = box.x + box.w - 14 - plat.w / 2;
          plat.vx = -Math.abs(plat.vx);
        }
      }

      // Pattern State Machine
      boss.attackTimer -= dt;
      boss.patternTick += dt;

      if (boss.attackState === "INTRO") {
        if (boss.attackTimer <= 0) {
          this.startNextSansPattern(boss);
        }
        return;
      }

      if (boss.attackState === "FAKE_SPARE") {
        if (boss.attackTimer <= 0 && !boss.finalAttackStarted) {
          boss.spareable = false;
          boss.finalAttackStarted = true;
          boss.attackState = "FINAL_WHEEL";
          boss.attackTimer = 6.4;
          boss.patternTick = 0;
          boss.eyeFlashTimer = 2.0;
          Audio.sansBlip();
          this.showDialogue("* sans: alright. here comes my SPECIAL ATTACK!", 3.2);
        }
        return;
      }

      if (boss.attackState === "BONE_CORRIDOR") {
        if (boss.patternTick >= 0.72) {
          boss.patternTick = 0;
          const roll = Math.random();
          if (boss.phase >= 2 && roll < 0.34) {
            const isBlue = Math.random() < 0.5;
            this.bones.push({
              x: box.x + 12,
              y: box.y + box.h / 2,
              w: 16,
              h: box.h - 14,
              vx: 225,
              utRule: isBlue ? "BLUE" : "ORANGE",
              color: isBlue ? "#00e5ff" : COLORS.orange,
            });
          } else {
            const fromLeft = Math.random() < 0.5;
            const lowH = 44 + Math.random() * 28;
            const speed = (fromLeft ? 1 : -1) * (205 + boss.phase * 22);
            this.bones.push({
              x: fromLeft ? box.x + 14 : box.x + box.w - 14,
              y: box.y + box.h - lowH / 2 - 4,
              w: 14,
              h: lowH,
              vx: speed,
              utRule: null,
              color: COLORS.bone,
            });
            if (Math.random() < 0.55) {
              const highH = box.h - lowH - 96;
              this.bones.push({
                x: fromLeft ? box.x + 14 : box.x + box.w - 14,
                y: box.y + highH / 2 + 4,
                w: 14,
                h: highH,
                vx: speed,
                utRule: null,
                color: COLORS.bone,
              });
            }
          }
        }
      } else if (boss.attackState === "BONE_TUNNEL") {
        if (boss.patternTick >= 0.16) {
          boss.patternTick = 0;
          const centerY = box.y + box.h * 0.5 + Math.sin(boss.age * 3.1) * 68;
          const gap = Math.max(88, 114 - boss.phase * 8);
          const topH = Math.max(18, centerY - gap / 2 - box.y);
          const botH = Math.max(18, box.y + box.h - (centerY + gap / 2));
          const vx = -235 - boss.phase * 15;
          this.bones.push({
            x: box.x + box.w - 10,
            y: box.y + topH / 2 + 2,
            w: 12,
            h: topH,
            vx,
            utRule: null,
            color: COLORS.bone,
          });
          this.bones.push({
            x: box.x + box.w - 10,
            y: box.y + box.h - botH / 2 - 2,
            w: 12,
            h: botH,
            vx,
            utRule: null,
            color: COLORS.bone,
          });
        }
      } else if (boss.attackState === "TELEKINESIS_SLAM") {
        boss.slamTimer -= dt;
        if (boss.slamTimer <= 0 && boss.attackTimer > 0.7) {
          const sides = ["BOTTOM", "LEFT", "RIGHT", "TOP"];
          const side = sides[Math.floor(Math.random() * sides.length)];
          boss.slamSide = side;
          boss.eyeFlashTimer = 0.75;
          Audio.slam();
          this.addShake(8, 0.22);
          if (side === "BOTTOM") p.y = box.y + box.h - 22;
          if (side === "TOP") p.y = box.y + 22;
          if (side === "LEFT") p.x = box.x + 22;
          if (side === "RIGHT") p.x = box.x + box.w - 22;
          boss.boneSpikes.push({ side, state: "WARN", timer: 0.56 });
          boss.slamTimer = 1.45;
        }
      } else if (boss.attackState === "GASTER_CROSS") {
        if (boss.patternTick >= 1.25 && boss.attackTimer > 0.9) {
          boss.patternTick = 0;
          boss.eyeFlashTimer = 0.85;
          const mode = Math.floor(Math.random() * 3);
          if (mode === 0) {
            this.spawnSansBlaster(box.x - 54, p.y, box.x + box.w, p.y);
            this.spawnSansBlaster(p.x, box.y - 54, p.x, box.y + box.h);
          } else if (mode === 1) {
            this.spawnSansBlaster(box.x - 42, box.y - 42, box.x + box.w, box.y + box.h);
            this.spawnSansBlaster(box.x + box.w + 42, box.y - 42, box.x, box.y + box.h);
          } else {
            this.spawnSansBlaster(box.x + box.w + 54, box.y + 70, box.x, box.y + 70);
            this.spawnSansBlaster(box.x - 54, box.y + box.h - 70, box.x + box.w, box.y + box.h - 70);
          }
        }
      } else if (boss.attackState === "PLATFORM_HOP") {
        if (boss.patternTick >= 0.34) {
          boss.patternTick = 0;
          this.bones.push({
            x: box.x + box.w - 12,
            y: box.y + box.h - 32,
            w: 14,
            h: 58,
            vx: -230,
            utRule: null,
            color: COLORS.bone,
          });
        }
        if (Math.random() < dt * 0.65 && boss.blasters.length < 1 && boss.attackTimer > 1.2) {
          this.spawnSansBlaster(box.x - 52, box.y + 52, box.x + box.w, box.y + 52, { chargeTime: 0.95 });
        }
      } else if (boss.attackState === "FINAL_WHEEL") {
        if (boss.patternTick >= 0.38 && boss.attackTimer > 0.9) {
          boss.patternTick = 0;
          const cx = box.x + box.w / 2;
          const cy = box.y + box.h / 2;
          const ang = boss.age * 2.5;
          const rad = 245;
          this.spawnSansBlaster(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, cx, cy, {
            chargeTime: 0.62,
            fireTime: 0.38,
            beamWidth: 28,
            beamLen: 520,
          });
        }
        if (boss.attackTimer <= 0) {
          boss.finalAttackDone = true;
          boss.sleeping = true;
          boss.spareable = true;
          boss.eyeFlashTimer = 0;
          boss.blasters = [];
          boss.boneSpikes = [];
          this.bones = [];
          this.addPopup(boss.x, boss.y - 36, "Zzz...", COLORS.yellow);
          this.showDialogue("* sans fell asleep! Strike him OR press Space/V to SPARE!", 4.5);
          return;
        }
      }

      if (boss.attackTimer <= 0 && boss.attackState !== "FINAL_WHEEL") {
        this.startNextSansPattern(boss);
      }
    }

    updateArenaBox(dt) {
      const box = this.arenaBox;
      const p = this.player;

      if (!box.persistent) {
        box.timer -= dt;
        box.spawnTimer -= dt;

        if (box.spawnTimer <= 0 && box.timer > 1.0) {
          const fromLeft = Math.random() < 0.5;
          const h = 42 + Math.random() * 42;
          const roll = Math.random();
          const utRule = roll < 0.22 ? "BLUE" : roll < 0.44 ? "ORANGE" : null;
          this.bones.push({
            x: fromLeft ? box.x + 14 : box.x + box.w - 14,
            y: box.y + box.h - h / 2 - 4,
            w: 14,
            h,
            vx: (fromLeft ? 1 : -1) * (185 + this.wave * 8),
            utRule,
            color: utRule === "BLUE" ? "#00e5ff" : utRule === "ORANGE" ? COLORS.orange : COLORS.bone,
          });
          box.spawnTimer = 0.85;
        }
      }

      for (let i = this.bones.length - 1; i >= 0; i--) {
        const bn = this.bones[i];
        bn.x += bn.vx * dt;
        if (bn.x < box.x - 18 || bn.x > box.x + box.w + 18) {
          this.bones.splice(i, 1);
          continue;
        }
        const hitX = Math.abs(p.x - bn.x) <= bn.w / 2 + p.radius - 2;
        const hitY = Math.abs(p.y - bn.y) <= bn.h / 2 + p.radius - 2;
        if (hitX && hitY) {
          if (bn.utRule === "BLUE" && !this.playerMoved) continue;
          if (bn.utRule === "ORANGE" && this.playerMoved) continue;
          this.hitPlayer();
        }
      }

      if (!box.persistent && box.timer <= 0) {
        this.arenaBox = null;
        this.bones = [];
        this.soulMode = "RED";
        Audio.soulSwitch();
        this.showDialogue("* SOUL returned to RED (DETERMINATION)!", 2.4);
      }
    }

    updateEnemyBullets(dt) {
      const p = this.player;
      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const b = this.enemyBullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (b.x < -20 || b.x > GAME_W + 20 || b.y < -20 || b.y > GAME_H + 20) {
          this.enemyBullets.splice(i, 1);
          continue;
        }

        if (Math.hypot(b.x - p.x, b.y - p.y) <= b.r + p.radius - 4) {
          if (b.utRule === "BLUE" && !this.playerMoved) continue;
          if (b.utRule === "ORANGE" && this.playerMoved) continue;
          this.enemyBullets.splice(i, 1);
          this.hitPlayer();
        }
      }
    }

    updatePowerups(dt) {
      const p = this.player;
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const u = this.powerups[i];
        u.age += dt;
        u.y += u.vy * dt;

        // Magnetic pull when player is nearby
        const mdx = p.x - u.x;
        const mdy = p.y - u.y;
        const mdist = Math.hypot(mdx, mdy);
        if (mdist > 1 && mdist < 140) {
          const pull = 280 * (1 - mdist / 140) + 90;
          u.x += (mdx / mdist) * pull * dt;
          u.y += (mdy / mdist) * pull * dt;
        }

        if (u.y > GAME_H + 30) {
          this.powerups.splice(i, 1);
          continue;
        }

        if (Math.hypot(u.x - p.x, u.y - p.y) <= u.radius + p.radius + 6) {
          this.spawnRing(u.x, u.y, u.color, 46);
          this.addPopup(u.x, u.y, u.name, u.color);

          if (u.type === "SAVE") {
            Audio.saveStar();
            if (p.lives < p.maxLives) p.lives += 1;
            else this.addScore(500);
            this.comboTimer = this.comboDuration;
            this.showDialogue("* (The neon starlight fills you with DETERMINATION. HP restored!)", 3.0);
          } else {
            Audio.powerUp();
            if (u.type === "SPREAD" || u.type === "PLASMA") {
              p.weapon = u.type;
              p.weaponTimer = 14;
            } else if (u.type === "RAPID") {
              p.rapidTimer = 12;
            } else if (u.type === "SHIELD") {
              p.shield = true;
            } else if (u.type === "BOMB") {
              p.bombs = Math.min(p.maxBombs, p.bombs + 1);
            }
          }
          this.powerups.splice(i, 1);
        }
      }
    }

    updateEffects(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.96;
        pt.vy *= 0.96;
        pt.life -= dt;
        if (pt.life <= 0) this.particles.splice(i, 1);
      }

      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.r += (r.maxR - r.r) * 7.5 * dt + 40 * dt;
        r.alpha -= dt * 2.1;
        if (r.alpha <= 0 || r.r >= r.maxR) this.rings.splice(i, 1);
      }

      for (let i = this.popups.length - 1; i >= 0; i--) {
        const pop = this.popups[i];
        pop.y -= 34 * dt;
        pop.life -= dt;
        if (pop.life <= 0) this.popups.splice(i, 1);
      }
    }

    hitPlayer() {
      const p = this.player;
      if (p.invulnTimer > 0) return;

      if (p.shield) {
        p.shield = false;
        p.invulnTimer = 1.1;
        this.addShake(6, 0.2);
        this.spawnRing(p.x, p.y, COLORS.blue, 95);
        this.addPopup(p.x, p.y - 20, "SHIELD BROKEN", COLORS.blue);
        Audio.playerHit();
        return;
      }

      p.lives -= 1;
      p.invulnTimer = 1.6;
      this.combo = 1;
      this.addShake(11, 0.35);
      this.spawnParticles(p.x, p.y, COLORS.magenta, 24, 240);
      this.spawnRing(p.x, p.y, COLORS.magenta, 85);
      Audio.playerHit();

      if (this.boss && this.boss.kind === "SANS") {
        this.boss.krTimer = 2.4;
        this.addPopup(p.x, p.y - 24, "KR!", COLORS.violet);
      }

      if (p.lives <= 0) {
        this.triggerGameOver();
      }
    }

    triggerGameOver() {
      this.state = "GAME_OVER";
      Audio.stopMusic();
      this.pointerFiring = false;
      this.canvas.classList.remove("pointer-active");
      this.dom.bossHud.classList.add("hidden");
      this.dom.banner.classList.add("hidden");

      this.dom.finalScore.textContent = this.score.toLocaleString();
      this.dom.finalHighScore.textContent = this.highScore.toLocaleString();
      this.dom.finalWave.textContent = String(this.wave);
      this.dom.finalCombo.textContent = `x${this.maxCombo}`;
      this.dom.newHighBadge.classList.toggle("hidden", this.score === 0 || this.score < this.highScore);
      this.dom.gameOverModal.classList.remove("hidden");
      this.syncHud();
    }

    syncHud() {
      this.dom.score.textContent = String(this.score).padStart(6, "0");
      this.dom.highScore.textContent = String(this.highScore).padStart(6, "0");
      if (this.wave > this.bestWave) {
        this.bestWave = this.wave;
        this.saveNumber(BEST_WAVE_KEY, this.bestWave);
      }
      if (this.sparedCount > this.bestMercy) {
        this.bestMercy = this.sparedCount;
        this.saveNumber(BEST_MERCY_KEY, this.bestMercy);
      }
      if (this.dom.navHighScore) this.dom.navHighScore.textContent = String(this.highScore).padStart(6, "0");
      if (this.dom.siteBestScore) this.dom.siteBestScore.textContent = String(this.highScore).padStart(6, "0");
      if (this.dom.siteBestWave) this.dom.siteBestWave.textContent = String(this.bestWave).padStart(2, "0");
      if (this.dom.siteBestMercy) this.dom.siteBestMercy.textContent = String(this.bestMercy);
      this.dom.combo.textContent = `x${this.combo}`;
      this.dom.comboFill.style.width =
        this.combo > 1 ? `${Math.max(0, (this.comboTimer / this.comboDuration) * 100)}%` : "0%";
      this.dom.wave.textContent = String(this.wave).padStart(2, "0");
      if (this.dom.sparedVal) this.dom.sparedVal.textContent = String(this.sparedCount);
      if (this.dom.soulBadge) {
        const isBlue = this.soulMode === "BLUE";
        this.dom.soulBadge.textContent = isBlue ? "♥ BLUE SOUL" : "♥ RED SOUL";
        this.dom.soulBadge.classList.toggle("blue", isBlue);
      }
      if (this.dom.ostBadge) {
        const track = Audio.currentTrack;
        if (this.state !== "PLAYING" && this.state !== "PAUSED") {
          this.dom.ostBadge.textContent = "OST: READY";
          this.dom.ostBadge.className = "ost-badge";
        } else if (track === "FINALE") {
          this.dom.ostBadge.textContent = "♪ FINALE OST";
          this.dom.ostBadge.className = "ost-badge finale";
        } else {
          this.dom.ostBadge.textContent = "♪ DOOM OST";
          this.dom.ostBadge.className = "ost-badge doom";
        }
      }

      const p = this.player;
      const weaponLabel = p.rapidTimer > 0 ? `${p.weapon} + RAPID` : p.weapon;
      this.dom.weapon.textContent = weaponLabel;

      this.renderPips(this.dom.lives, p.lives, p.maxLives, "hull");
      this.renderPips(this.dom.bombs, p.bombs, p.maxBombs, "emp");
    }

    renderPips(container, active, max, cls) {
      let html = "";
      for (let i = 0; i < max; i++) {
        html += `<span class="pip ${cls}${i < active ? "" : " empty"}"></span>`;
      }
      container.innerHTML = html;
    }

    render() {
      const ctx = this.ctx;
      ctx.save();

      if (this.shakeTimer > 0) {
        const sx = (Math.random() - 0.5) * this.shakeIntensity * 2;
        const sy = (Math.random() - 0.5) * this.shakeIntensity * 2;
        ctx.translate(sx, sy);
      }

      // Deep space background
      ctx.fillStyle = "#04040e";
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      // Perspective synthwave grid
      ctx.strokeStyle = "rgba(0, 243, 255, 0.065)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= GAME_W; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, GAME_H);
        ctx.stroke();
      }
      for (let y = this.gridOffset; y <= GAME_H; y += 48) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(GAME_W, y);
        ctx.stroke();
      }

      // Stars
      for (const s of this.stars) {
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.tint;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      ctx.globalAlpha = 1;

      // Rings
      for (const r of this.rings) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, r.alpha);
        ctx.strokeStyle = r.color;
        ctx.shadowColor = r.color;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Powerups
      for (const u of this.powerups) {
        ctx.save();
        ctx.translate(u.x, u.y);
        ctx.rotate(u.age * 2.2);
        drawGlowingPoly(
          ctx,
          [
            [0, -14],
            [14, 0],
            [0, 14],
            [-14, 0],
          ],
          u.color,
          "rgba(8, 12, 28, 0.85)",
          2,
          14
        );
        ctx.rotate(-u.age * 2.2);
        ctx.fillStyle = u.color;
        ctx.font = "bold 13px Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(u.label, 0, 1);
        ctx.restore();
      }

      // Player Bullets
      for (const b of this.bullets) {
        ctx.save();
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(b.x - b.r * 0.65, b.y - 10, b.r * 1.3, 18, 3);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Enemy Bullets
      for (const b of this.enemyBullets) {
        ctx.save();
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Enemies
      for (const e of this.enemies) {
        this.drawEnemy(ctx, e);
      }

      // Boss
      if (this.boss) {
        this.drawBoss(ctx, this.boss);
      }

      // Undertale Battle Box & Bones
      if (this.arenaBox) {
        const box = this.arenaBox;
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
        ctx.strokeStyle = this.boss && this.boss.kind === "SANS" && this.boss.krTimer > 0 ? COLORS.violet : "#ffffff";
        ctx.lineWidth = 4;
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        ctx.beginPath();
        ctx.rect(box.x + 2, box.y + 2, box.w - 4, box.h - 4);
        ctx.clip();

        // Moving green platforms during Sans PLATFORM_HOP
        if (this.boss && this.boss.kind === "SANS") {
          for (const plat of this.boss.platforms) {
            ctx.fillStyle = "#39ff14";
            ctx.shadowColor = "#39ff14";
            ctx.shadowBlur = 10;
            ctx.fillRect(plat.x - plat.w / 2, plat.y, plat.w, 8);
            ctx.shadowBlur = 0;
          }

          // Wall Bone Spikes (telegraph + eruption)
          for (const sp of this.boss.boneSpikes) {
            const depth = 98;
            if (sp.state === "WARN") {
              ctx.fillStyle = "rgba(255, 42, 157, 0.22)";
              ctx.strokeStyle = COLORS.magenta;
              ctx.lineWidth = 2;
              if (sp.side === "BOTTOM") {
                ctx.fillRect(box.x, box.y + box.h - depth, box.w, depth);
                ctx.strokeRect(box.x, box.y + box.h - depth, box.w, depth);
              } else if (sp.side === "TOP") {
                ctx.fillRect(box.x, box.y, box.w, depth);
                ctx.strokeRect(box.x, box.y, box.w, depth);
              } else if (sp.side === "LEFT") {
                ctx.fillRect(box.x, box.y, depth, box.h);
                ctx.strokeRect(box.x, box.y, depth, box.h);
              } else if (sp.side === "RIGHT") {
                ctx.fillRect(box.x + box.w - depth, box.y, depth, box.h);
                ctx.strokeRect(box.x + box.w - depth, box.y, depth, box.h);
              }
            } else {
              if (sp.side === "BOTTOM" || sp.side === "TOP") {
                const by = sp.side === "BOTTOM" ? box.y + box.h - depth / 2 : box.y + depth / 2;
                for (let bx = box.x + 18; bx < box.x + box.w - 10; bx += 26) {
                  drawBone(ctx, bx, by, 12, depth - 6, COLORS.bone);
                }
              } else {
                const bx = sp.side === "LEFT" ? box.x + depth / 2 : box.x + box.w - depth / 2;
                for (let by = box.y + 18; by < box.y + box.h - 10; by += 26) {
                  drawBone(ctx, bx, by, depth - 6, 12, COLORS.bone);
                }
              }
            }
          }
        }

        for (const bn of this.bones) {
          drawBone(ctx, bn.x, bn.y, bn.w, bn.h, bn.color);
        }
        ctx.restore();

        // Draw Sans Gaster Blasters outside/around the Battle Box
        if (this.boss && this.boss.kind === "SANS") {
          for (const gb of this.boss.blasters) {
            drawGasterBlaster(ctx, gb);
          }
          if (this.boss.krTimer > 0) {
            ctx.save();
            ctx.fillStyle = COLORS.violet;
            ctx.font = "bold 12px Consolas, monospace";
            ctx.fillText("KR", box.x + box.w - 28, box.y - 8);
            ctx.restore();
          }
        }
      }

      // Player
      if (this.state !== "MENU") {
        if (this.state === "PLAYING" && this.mouseControl && this.controlMode === "pointer" && this.pointerTarget) {
          ctx.save();
          ctx.strokeStyle = "rgba(0, 243, 255, 0.32)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(this.pointerTarget.x, this.pointerTarget.y, 10, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        this.drawPlayer(ctx, this.player);
      }

      // Particles
      for (const pt of this.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.shadowColor = pt.color;
        ctx.shadowBlur = 8;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
        ctx.restore();
      }

      // Popups
      for (const pop of this.popups) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pop.life / pop.maxLife);
        ctx.fillStyle = pop.color;
        ctx.font = "bold 13px Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText(pop.text, pop.x, pop.y);
        ctx.restore();
      }

      if (this.empFlash > 0) {
        ctx.fillStyle = `rgba(255, 184, 0, ${this.empFlash * 0.35})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }

      ctx.restore();
    }

    drawPlayer(ctx, p) {
      // Dash afterimages
      for (const img of p.afterimages) {
        ctx.save();
        ctx.globalAlpha = img.alpha * 0.55;
        drawGlowingPoly(
          ctx,
          [
            [img.x, img.y - 18],
            [img.x + 15, img.y + 13],
            [img.x, img.y + 6],
            [img.x - 15, img.y + 13],
          ],
          COLORS.cyan,
          null,
          1.5,
          10
        );
        ctx.restore();
      }

      // Invulnerability blink
      if (p.invulnTimer > 0 && Math.floor(p.invulnTimer * 18) % 2 === 0) {
        return;
      }

      // Thruster flame
      ctx.save();
      const flameH = 12 + Math.random() * 9;
      ctx.fillStyle = COLORS.magenta;
      ctx.shadowColor = COLORS.magenta;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(p.x - 6, p.y + 10);
      ctx.lineTo(p.x + 6, p.y + 10);
      ctx.lineTo(p.x, p.y + 10 + flameH);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Ship hull
      drawGlowingPoly(
        ctx,
        [
          [p.x, p.y - 20],
          [p.x + 17, p.y + 14],
          [p.x + 6, p.y + 8],
          [p.x, p.y + 12],
          [p.x - 6, p.y + 8],
          [p.x - 17, p.y + 14],
        ],
        COLORS.cyan,
        "rgba(0, 243, 255, 0.22)",
        2.2,
        16
      );

      // SOUL Heart Core (Undertale Red / Blue)
      const heartColor = this.soulMode === "BLUE" ? COLORS.soulBlue : COLORS.soulRed;
      drawHeart(ctx, p.x, p.y - 2, 10, heartColor);

      // Shield bubble
      if (p.shield) {
        ctx.save();
        ctx.strokeStyle = COLORS.blue;
        ctx.shadowColor = COLORS.blue;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawEnemy(ctx, e) {
      const baseColor = e.spareable ? COLORS.yellow : e.color;
      const stroke = e.hitFlash > 0 ? "#ffffff" : baseColor;
      const fill = e.hitFlash > 0 ? "rgba(255,255,255,0.45)" : "rgba(10, 12, 28, 0.78)";

      if (e.kind === "STRIKER" && e.state === "AIM") {
        ctx.save();
        ctx.strokeStyle = "rgba(184, 77, 255, 0.45)";
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(this.player.x, this.player.y);
        ctx.stroke();
        ctx.restore();
      }

      if (e.kind === "HEX") {
        const pts = [];
        for (let k = 0; k < 6; k++) {
          const ang = (Math.PI * 2 * k) / 6 + e.age * 1.2;
          pts.push([e.x + Math.cos(ang) * e.radius, e.y + Math.sin(ang) * e.radius]);
        }
        drawGlowingPoly(ctx, pts, stroke, fill, 2.2, 14);
      } else if (e.kind === "WEAVER") {
        drawGlowingPoly(
          ctx,
          [
            [e.x, e.y + 16],
            [e.x + 16, e.y - 8],
            [e.x, e.y - 16],
            [e.x - 16, e.y - 8],
          ],
          stroke,
          fill,
          2,
          12
        );
      } else if (e.kind === "SPLITTER" || e.kind === "MINI") {
        const r = e.radius;
        drawGlowingPoly(
          ctx,
          [
            [e.x - r, e.y - r * 0.6],
            [e.x + r, e.y - r * 0.6],
            [e.x + r * 0.6, e.y + r],
            [e.x - r * 0.6, e.y + r],
          ],
          stroke,
          fill,
          2,
          12
        );
      } else {
        const r = e.radius;
        drawGlowingPoly(
          ctx,
          [
            [e.x, e.y + r],
            [e.x + r, e.y - r * 0.6],
            [e.x, e.y - r],
            [e.x - r, e.y - r * 0.6],
          ],
          stroke,
          fill,
          2,
          12
        );
      }
    }

    drawBoss(ctx, boss) {
      if (boss.kind === "SANS") {
        drawSans(ctx, boss);
        return;
      }

      // Gaster Blaster Skull & Laser Beam
      if (boss.laserCharge > 0 || boss.laserActive > 0) {
        drawGlowingPoly(
          ctx,
          [
            [boss.x - 16, boss.y + 20],
            [boss.x + 16, boss.y + 20],
            [boss.x + 22, boss.y + 38],
            [boss.x + 10, boss.y + 46],
            [boss.x - 10, boss.y + 46],
            [boss.x - 22, boss.y + 38],
          ],
          "#ffffff",
          "rgba(255, 255, 255, 0.9)",
          2,
          14
        );
      }
      if (boss.laserCharge > 0) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 42, 157, 0.55)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(boss.x, boss.y + 44);
        ctx.lineTo(boss.x, GAME_H);
        ctx.stroke();
        ctx.restore();
      } else if (boss.laserActive > 0) {
        ctx.save();
        ctx.fillStyle = "rgba(255, 42, 157, 0.35)";
        ctx.shadowColor = COLORS.magenta;
        ctx.shadowBlur = 24;
        ctx.fillRect(boss.x - 20, boss.y + 44, 40, GAME_H - boss.y);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(boss.x - 7, boss.y + 44, 14, GAME_H - boss.y);
        ctx.restore();
      }

      const baseStroke = boss.spareable ? COLORS.yellow : COLORS.magenta;
      const stroke = boss.hitFlash > 0 ? "#ffffff" : baseStroke;
      const fill = boss.hitFlash > 0 ? "rgba(255,255,255,0.45)" : "rgba(26, 6, 36, 0.9)";

      // Outer dreadnought frame
      drawGlowingPoly(
        ctx,
        [
          [boss.x, boss.y - 44],
          [boss.x + 58, boss.y - 16],
          [boss.x + 48, boss.y + 32],
          [boss.x + 18, boss.y + 44],
          [boss.x - 18, boss.y + 44],
          [boss.x - 48, boss.y + 32],
          [boss.x - 58, boss.y - 16],
        ],
        stroke,
        fill,
        2.8,
        22
      );

      // Rotating inner core
      const corePts = [];
      for (let k = 0; k < 4; k++) {
        const ang = (Math.PI * k) / 2 + boss.age * 2.2;
        corePts.push([boss.x + Math.cos(ang) * 20, boss.y + Math.sin(ang) * 20]);
      }
      drawGlowingPoly(ctx, corePts, COLORS.amber, "rgba(255, 184, 0, 0.25)", 2, 14);
    }
  }

  global.addEventListener("DOMContentLoaded", () => {
    global.__neonGame = new NeonGame();
  });
})(window);
