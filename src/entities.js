/**
 * Game constants, geometric neon drawing helpers, and entity factories.
 */
(function (global) {
  const GAME_W = 960;
  const GAME_H = 640;

  const COLORS = {
    cyan: "#00f3ff",
    magenta: "#ff2a9d",
    lime: "#39ff14",
    amber: "#ffb800",
    blue: "#4d79ff",
    violet: "#b84dff",
    white: "#ffffff",
    yellow: "#ffe600",
    orange: "#ff8c00",
    soulRed: "#ff2244",
    soulBlue: "#2979ff",
    bone: "#f5f7ff",
  };

  const POWERUPS = [
    { type: "SPREAD", label: "S", color: COLORS.cyan, name: "SPREAD SHOT" },
    { type: "RAPID", label: "R", color: COLORS.lime, name: "RAPID OVERDRIVE" },
    { type: "PLASMA", label: "L", color: COLORS.magenta, name: "PLASMA LANCE" },
    { type: "SHIELD", label: "H", color: COLORS.blue, name: "AEGIS SHIELD" },
    { type: "BOMB", label: "B", color: COLORS.amber, name: "EMP CHARGE" },
    { type: "SAVE", label: "✦", color: COLORS.yellow, name: "DETERMINATION" },
  ];

  function createStarfield(count = 95) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      const layer = Math.random() < 0.2 ? 3 : Math.random() < 0.5 ? 2 : 1;
      stars.push({
        x: Math.random() * GAME_W,
        y: Math.random() * GAME_H,
        speed: layer * 28 + Math.random() * 16,
        size: layer * 0.9,
        alpha: 0.25 + layer * 0.22,
        tint: layer === 3 ? COLORS.cyan : layer === 2 ? "#c7d8ff" : "#7085b8",
      });
    }
    return stars;
  }

  function createPlayer() {
    return {
      x: GAME_W / 2,
      y: GAME_H - 76,
      radius: 11,
      speed: 420,
      lives: 3,
      maxLives: 5,
      bombs: 2,
      maxBombs: 4,
      shield: false,
      weapon: "PULSE",
      weaponTimer: 0,
      rapidTimer: 0,
      fireCooldown: 0,
      invulnTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      dashVx: 0,
      dashVy: 0,
      afterimages: [],
    };
  }

  function createEnemy(kind, x, y, wave) {
    const scale = 1 + (wave - 1) * 0.12;
    switch (kind) {
      case "WEAVER":
        return {
          kind,
          x,
          y,
          baseX: x,
          radius: 16,
          hp: Math.round(2 * scale),
          maxHp: Math.round(2 * scale),
          speedY: 92 + wave * 4,
          age: Math.random() * 6,
          fireTimer: 1.1 + Math.random() * 1.1,
          score: 160,
          color: COLORS.magenta,
          hitFlash: 0,
          mercy: 0,
          mercyMax: 1,
          spareable: false,
          actLine: "* WEAVER blushes at your fancy dodging.",
        };
      case "HEX":
        return {
          kind,
          x,
          y,
          radius: 22,
          hp: Math.round(5 * scale),
          maxHp: Math.round(5 * scale),
          speedY: 56 + wave * 2.5,
          age: 0,
          fireTimer: 1.6 + Math.random() * 0.8,
          score: 280,
          color: COLORS.amber,
          hitFlash: 0,
          mercy: 0,
          mercyMax: 2,
          spareable: false,
          actLine: "* HEX appreciates your geometric symmetry.",
        };
      case "SPLITTER":
        return {
          kind,
          x,
          y,
          radius: 19,
          hp: Math.round(3 * scale),
          maxHp: Math.round(3 * scale),
          speedY: 84 + wave * 3,
          vx: (Math.random() < 0.5 ? -1 : 1) * 70,
          age: 0,
          fireTimer: 99,
          score: 200,
          color: COLORS.lime,
          hitFlash: 0,
          mercy: 0,
          mercyMax: 1,
          spareable: false,
          actLine: "* SPLITTER decides not to split today.",
        };
      case "MINI":
        return {
          kind,
          x,
          y,
          radius: 10,
          hp: 1,
          maxHp: 1,
          speedY: 165 + wave * 5,
          vx: (Math.random() < 0.5 ? -1 : 1) * 115,
          age: 0,
          fireTimer: 99,
          score: 90,
          color: COLORS.lime,
          hitFlash: 0,
          mercy: 1,
          mercyMax: 1,
          spareable: true,
          actLine: "* MINI SHARD is already friendly!",
        };
      case "STRIKER":
        return {
          kind,
          x,
          y,
          radius: 15,
          hp: Math.round(2 * scale),
          maxHp: Math.round(2 * scale),
          speedY: 85,
          state: "TRACK",
          stateTimer: 0.9,
          vx: 0,
          vy: 0,
          age: 0,
          fireTimer: 99,
          score: 220,
          color: COLORS.violet,
          hitFlash: 0,
          mercy: 0,
          mercyMax: 1,
          spareable: false,
          actLine: "* STRIKER powers down its targeting laser.",
        };
      case "DRONE":
      default:
        return {
          kind: "DRONE",
          x,
          y,
          radius: 14,
          hp: Math.max(1, Math.round(1.2 * scale)),
          maxHp: Math.max(1, Math.round(1.2 * scale)),
          speedY: 118 + wave * 5,
          vx: (Math.random() - 0.5) * 65,
          age: 0,
          fireTimer: 2.0 + Math.random() * 1.4,
          score: 100,
          color: COLORS.cyan,
          hitFlash: 0,
          mercy: 0,
          mercyMax: 1,
          spareable: false,
          actLine: "* You pet the DRONE. It purrs in 8-bit.",
        };
    }
  }

  function createBoss(wave, forceKind = null) {
    const tier = Math.max(1, Math.floor(wave / 3));
    const isSans = forceKind === "SANS" || wave === 3 || (wave > 3 && wave % 9 === 3);

    if (isSans) {
      const maxHp = 130 + Math.max(0, tier - 1) * 45;
      return {
        kind: "SANS",
        name: tier > 1 ? `SANS // MK-${tier}` : "SANS",
        tier,
        x: GAME_W / 2,
        baseX: GAME_W / 2,
        y: -90,
        targetY: 112,
        radius: 44,
        hp: maxHp,
        maxHp,
        phase: 1,
        age: 0,
        dir: 1,
        score: 5000 * tier,
        hitFlash: 0,
        mercy: 0,
        mercyMax: 5,
        spareable: false,
        // Sans-specific Undertale fight state
        dodgeOffset: 0,
        targetDodgeOffset: 0,
        dodgeCooldown: 0,
        missPopupCooldown: 0,
        eyeFlashTimer: 0,
        eyeColor: COLORS.cyan,
        sweat: 0,
        sleeping: false,
        fakeSpareOffered: false,
        finalAttackStarted: false,
        finalAttackDone: false,
        attackState: "INTRO",
        attackTimer: 1.1,
        attackIndex: 0,
        patternTick: 0,
        slamSide: null,
        slamTimer: 0,
        blasters: [],
        boneSpikes: [],
        platforms: [],
        krTimer: 0,
      };
    }

    const names = ["CORE SENTINEL", "BONE TITAN", "OMEGA OVERLORD"];
    const name = names[(tier - 1) % names.length] + (tier > 3 ? ` MK-${tier - 2}` : "");
    const maxHp = 85 + (tier - 1) * 55;
    return {
      kind: "MECH",
      name,
      tier,
      x: GAME_W / 2,
      y: -90,
      targetY: 112,
      radius: 50,
      hp: maxHp,
      maxHp,
      phase: 1,
      age: 0,
      dir: 1,
      fireTimer: 1.0,
      radialTimer: 2.4,
      laserTimer: 5.5,
      laserCharge: 0,
      laserActive: 0,
      boneWaveTimer: 7.5,
      score: 2500 * tier,
      hitFlash: 0,
      mercy: 0,
      mercyMax: 4,
      spareable: false,
    };
  }

  function drawHeart(ctx, x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.42);
    ctx.bezierCurveTo(-size * 0.9, -size * 0.1, -size * 0.55, -size * 0.78, 0, -size * 0.28);
    ctx.bezierCurveTo(size * 0.55, -size * 0.78, size * 0.9, -size * 0.1, 0, size * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBone(ctx, x, y, w, h, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    const hw = w / 2;
    const hh = h / 2;
    ctx.fillRect(x - hw * 0.55, y - hh, w * 0.55, h);
    ctx.beginPath();
    ctx.arc(x - hw * 0.35, y - hh, hw * 0.45, 0, Math.PI * 2);
    ctx.arc(x + hw * 0.35, y - hh, hw * 0.45, 0, Math.PI * 2);
    ctx.arc(x - hw * 0.35, y + hh, hw * 0.45, 0, Math.PI * 2);
    ctx.arc(x + hw * 0.35, y + hh, hw * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGlowingPoly(ctx, points, strokeColor, fillColor, lineWidth = 2, glow = 12) {
    ctx.save();
    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = glow;
    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
    ctx.restore();
  }

  function drawSans(ctx, boss) {
    const bob = boss.sleeping ? Math.sin(boss.age * 1.8) * 1.5 : Math.sin(boss.age * 4.5) * 3;
    const drawX = boss.x + boss.dodgeOffset;
    const drawY = boss.y + bob;
    const auraColor = boss.spareable ? COLORS.yellow : boss.eyeFlashTimer > 0 ? boss.eyeColor : COLORS.cyan;

    ctx.save();
    ctx.translate(drawX, drawY);

    // Dodge afterimage when sidestepping
    if (Math.abs(boss.dodgeOffset - boss.targetDodgeOffset) > 4) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = COLORS.cyan;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-boss.dodgeOffset * 0.45, 0, 32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Neon aura ring behind Sans
    ctx.save();
    ctx.strokeStyle = auraColor;
    ctx.shadowColor = auraColor;
    ctx.shadowBlur = 18;
    ctx.globalAlpha = 0.42 + Math.sin(boss.age * 5) * 0.14;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 4, 48, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Pink neon slippers
    ctx.fillStyle = "#ff5da2";
    ctx.shadowColor = "#ff5da2";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(-12, 46, 9, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(12, 46, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Dark shorts with white stripe
    ctx.fillStyle = "#101426";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.fillRect(-17, 26, 34, 15);
    ctx.strokeRect(-17, 26, 34, 15);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-16, 28, 3, 11);
    ctx.fillRect(13, 28, 3, 11);

    // Blue hoodie jacket + white t-shirt
    ctx.fillStyle = boss.hitFlash > 0 ? "#ffffff" : "#1d6fff";
    ctx.strokeStyle = boss.spareable ? COLORS.yellow : COLORS.cyan;
    ctx.shadowColor = boss.spareable ? COLORS.yellow : COLORS.cyan;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-24, -4, 48, 32, 9);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // White inner shirt & zipper line
    ctx.fillStyle = "#f2f7ff";
    ctx.beginPath();
    ctx.moveTo(-7, -2);
    ctx.lineTo(7, -2);
    ctx.lineTo(4, 27);
    ctx.lineTo(-4, 27);
    ctx.closePath();
    ctx.fill();

    // Fluffy hoodie collar
    ctx.fillStyle = "#d9e6ff";
    ctx.beginPath();
    ctx.ellipse(0, -3, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Skull head
    ctx.save();
    ctx.translate(0, -24);
    ctx.fillStyle = boss.hitFlash > 0 ? "#ffe600" : "#f7fbff";
    ctx.strokeStyle = boss.spareable ? COLORS.yellow : "#ffffff";
    ctx.shadowColor = auraColor;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -3, 20, Math.PI, 0);
    ctx.lineTo(20, 6);
    ctx.quadraticCurveTo(18, 17, 11, 18);
    ctx.lineTo(-11, 18);
    ctx.quadraticCurveTo(-18, 17, -20, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Eye sockets
    if (boss.sleeping) {
      ctx.strokeStyle = "#080b18";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-13, -3);
      ctx.lineTo(-5, -3);
      ctx.moveTo(5, -3);
      ctx.lineTo(13, -3);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#060812";
      ctx.beginPath();
      ctx.ellipse(-8.5, -3, 5.2, 5.8, 0, 0, Math.PI * 2);
      ctx.ellipse(8.5, -3, 5.2, 5.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Right eye pupil (white)
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-8.5, -3, 1.9, 0, Math.PI * 2);
      ctx.fill();

      // Left eye (flashes cyan/yellow during telekinesis/blasters!)
      if (boss.eyeFlashTimer > 0) {
        const flashColor = Math.floor(boss.age * 20) % 2 === 0 ? COLORS.cyan : COLORS.yellow;
        ctx.fillStyle = flashColor;
        ctx.shadowColor = flashColor;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(8.5, -3, 3.6, 0, Math.PI * 2);
        ctx.fill();
        // Eye flame trail
        ctx.beginPath();
        ctx.moveTo(8.5, -6);
        ctx.lineTo(20, -14);
        ctx.lineTo(12, -2);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(8.5, -3, 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Nasal cavity
    ctx.fillStyle = "#060812";
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(-3, 7);
    ctx.lineTo(3, 7);
    ctx.closePath();
    ctx.fill();

    // Classic Sans grin + teeth bars
    ctx.strokeStyle = "#060812";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, 10);
    ctx.quadraticCurveTo(0, 16, 12, 10);
    ctx.stroke();
    [-7, -2.5, 2.5, 7].forEach((tx) => {
      ctx.beginPath();
      ctx.moveTo(tx, 10.5);
      ctx.lineTo(tx, 14.5);
      ctx.stroke();
    });

    // Sweat drops when tired
    if (boss.sweat > 0 && !boss.sleeping) {
      ctx.fillStyle = "#7feaff";
      ctx.beginPath();
      ctx.ellipse(-16, -10 + Math.sin(boss.age * 7) * 1.5, 2.2, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Floating Zzz when asleep
    if (boss.sleeping) {
      ctx.fillStyle = COLORS.yellow;
      ctx.font = "bold 14px Consolas, monospace";
      ctx.fillText("Z", 22, -14 - (boss.age * 10) % 10);
      ctx.font = "bold 11px Consolas, monospace";
      ctx.fillText("z", 32, -24 - (boss.age * 10) % 10);
    }

    ctx.restore();
    ctx.restore();
  }

  function drawGasterBlaster(ctx, gb) {
    ctx.save();
    ctx.translate(gb.x, gb.y);
    ctx.rotate(gb.angle - Math.PI / 2);
    ctx.scale(gb.scale || 1, gb.scale || 1);

    const beamLen = gb.beamLen || 760;

    // Telegraph line while charging
    if (gb.state === "CHARGE") {
      ctx.save();
      ctx.strokeStyle = "rgba(0, 243, 255, 0.55)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.lineTo(0, beamLen);
      ctx.stroke();
      ctx.restore();
    } else if (gb.state === "FIRE") {
      const pulse = 1 + Math.sin(gb.age * 45) * 0.12;
      const w = (gb.beamWidth || 34) * pulse;
      ctx.save();
      ctx.fillStyle = "rgba(0, 243, 255, 0.36)";
      ctx.shadowColor = COLORS.cyan;
      ctx.shadowBlur = 24;
      ctx.fillRect(-w * 0.75, 14, w * 1.5, beamLen);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-w * 0.35, 14, w * 0.7, beamLen);
      ctx.restore();
    }

    // Blaster skull body
    const jawOffset = gb.jawOpen || 0;
    ctx.fillStyle = "#f4f8ff";
    ctx.strokeStyle = gb.state === "FIRE" ? COLORS.cyan : "#ffffff";
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = gb.state === "FIRE" ? 20 : 12;
    ctx.lineWidth = 2;

    // Upper skull & horns
    ctx.beginPath();
    ctx.moveTo(-22, -20);
    ctx.lineTo(-10, -10);
    ctx.lineTo(10, -10);
    ctx.lineTo(22, -20);
    ctx.lineTo(20, 6);
    ctx.lineTo(11, 14);
    ctx.lineTo(-11, 14);
    ctx.lineTo(-20, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Lower jaw
    ctx.beginPath();
    ctx.moveTo(-12, 12 + jawOffset);
    ctx.lineTo(12, 12 + jawOffset);
    ctx.lineTo(8, 22 + jawOffset);
    ctx.lineTo(-8, 22 + jawOffset);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing eyes
    ctx.fillStyle = gb.state === "CHARGE" || gb.state === "FIRE" ? COLORS.cyan : "#070b18";
    ctx.beginPath();
    ctx.ellipse(-8, 0, 4, 5, -0.2, 0, Math.PI * 2);
    ctx.ellipse(8, 0, 4, 5, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  global.NeonEntities = {
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
  };
})(window);
