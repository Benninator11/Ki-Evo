/* engine.js — Spiel-Engine: Konstanten, Blocktypen, Physik (AABB), Fitness, Rendering (Canvas 2D) */

  // ---------- Konstanten (feste interne Auflösung, feste Tick-Rate) ----------
  export const C = {
    W: 1280,
    H: 640,
    SCALE: 2, // interne Render-Auflösung (scharf auf HiDPI-Bildschirmen)
    GRID: 20,
    TICK_MS: 1000 / 60,
    AGENT_W: 18,
    AGENT_H: 26,
    GRAVITY: 0.42,
    MAX_FALL: 11,
    JUMP: -9.0,
    BOUNCE: -12.5,
    MAX_SPEED: 3.0,
    STUCK_TICKS: 120, // so lange ohne Fortschritt -> Agent "steht" und scheidet aus
    FALL_MARGIN: 60,
    START_SIZE: { w: 40, h: 40 },
    GOAL_SIZE: { w: 40, h: 60 },
  };

  // kind: full | ice | mud | bounce | conveyor (alle fest) · oneway (Plattform) · deadly (tödlich)
  const T = (cat, label, color, kind, style, w, h, extra) => Object.assign({ cat, label, color, kind, style, w, h }, extra || {});
  const G1 = 'Boden & Wände', G2 = 'Spezial', G3 = 'Plattformen', G4 = 'Gefahren';
  export const CATEGORIES = [G1, G2, G3, G4];
  export const BLOCK_TYPES = {
    // Boden & Wände
    ground: T(G1, 'Boden', '#8a5a3b', 'full', 'ground', 160, 40),
    wall: T(G1, 'Steinwand', '#7d8794', 'full', 'stone', 40, 80),
    brick: T(G1, 'Ziegel', '#d2573f', 'full', 'brick', 40, 40),
    wood: T(G1, 'Holz', '#a9713f', 'full', 'wood', 40, 40),
    sand: T(G1, 'Sand', '#e2c885', 'full', 'sand', 80, 40),
    snow: T(G1, 'Schnee', '#dcebf7', 'full', 'snow', 80, 40),
    moss: T(G1, 'Moosstein', '#6f8a6a', 'full', 'moss', 40, 40),
    metal: T(G1, 'Metall', '#8fa0b3', 'full', 'metal', 40, 40),
    gold: T(G1, 'Gold', '#f2c230', 'full', 'gold', 40, 40),
    crystal: T(G1, 'Kristall', '#55c7e8', 'full', 'crystal', 40, 40),
    obsidian: T(G1, 'Obsidian', '#3a2d52', 'full', 'obsidian', 40, 40),
    candy: T(G1, 'Zucker', '#ff7eb6', 'full', 'candy', 40, 40),
    // Spezial
    ice: T(G2, 'Eis (rutschig)', '#aee3f5', 'ice', 'ice', 80, 40),
    mud: T(G2, 'Schlamm (langsam)', '#6b4a2e', 'mud', 'mud', 80, 40),
    bounce: T(G2, 'Trampolin', '#e8453c', 'bounce', 'bounce', 40, 20),
    superBounce: T(G2, 'Super-Trampolin', '#a855f7', 'bounce', 'bounce', 60, 20, { bounce: -16 }),
    convR: T(G2, 'Band →', '#4b5563', 'conveyor', 'conveyor', 80, 20, { dir: 1, anim: true }),
    convL: T(G2, 'Band ←', '#4b5563', 'conveyor', 'conveyor', 80, 20, { dir: -1, anim: true }),
    boostR: T(G2, 'Turbo-Band →', '#0b8edb', 'conveyor', 'conveyor', 100, 20, { dir: 1, push: 2.7, anim: true }),
    boostL: T(G2, 'Turbo-Band ←', '#0b8edb', 'conveyor', 'conveyor', 100, 20, { dir: -1, push: 2.7, anim: true }),
    slime: T(G2, 'Klebeschleim', '#7dce52', 'mud', 'mud', 80, 20),
    // Plattformen (nur von unten durchlässig)
    platform: T(G3, 'Holzsteg', '#c99a5b', 'oneway', 'plank', 120, 16),
    cloud: T(G3, 'Wolke', '#f4f8ff', 'oneway', 'cloud', 120, 20),
    steel: T(G3, 'Stahlsteg', '#9aa7b5', 'oneway', 'steel', 120, 16),
    bridge: T(G3, 'Seilbrücke', '#b88a52', 'oneway', 'bridge', 160, 16),
    // Gefahren
    spike: T(G4, 'Stachel', '#cfd6df', 'deadly', 'spike', 40, 20, { shape: 'up' }),
    spikeDown: T(G4, 'Deckenstachel', '#cfd6df', 'deadly', 'spikeDown', 40, 20, { shape: 'down' }),
    thorns: T(G4, 'Dornenbusch', '#3f9b45', 'deadly', 'thorns', 40, 40, { shape: 'full', inset: 5 }),
    lava: T(G4, 'Lava', '#ff6a00', 'deadly', 'lava', 80, 40, { shape: 'full', inset: 3, anim: true }),
    water: T(G4, 'Wasser', '#2f7fe0', 'deadly', 'water', 80, 40, { shape: 'full', inset: 3, anim: true }),
    poison: T(G4, 'Gift', '#6ee04a', 'deadly', 'poison', 80, 40, { shape: 'full', inset: 3, anim: true }),
    saw: T(G4, 'Sägeblatt', '#b9c2cf', 'deadly', 'saw', 40, 40, { shape: 'full', inset: 6, anim: true }),
    fire: T(G4, 'Feuer', '#ff3d18', 'deadly', 'fire', 60, 30, { shape: 'full', inset: 5, anim: true }),
    electric: T(G4, 'Stromfeld', '#9d7cff', 'deadly', 'electric', 60, 50, { shape: 'full', inset: 5, anim: true }),
    acid: T(G4, 'Säure', '#b6e834', 'deadly', 'acid', 80, 30, { shape: 'full', inset: 4, anim: true }),
    laser: T(G4, 'Laser-Barriere', '#ff315b', 'deadly', 'laser', 20, 120, { shape: 'full', inset: 3, anim: true }),
  };
  const SOLID_KINDS = { full: 1, ice: 1, mud: 1, bounce: 1, conveyor: 1 };

  // ---------- Hilfsfunktionen ----------
  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  // exported below

  function shade(hex, amt) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * (amt > 0 ? 255 - v : v))));
    const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  // exported below

  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function hash(i, j) {
    let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ---------- Agenten / Physik ----------
  function distToGoal(a, goal) {
    const dx = a.x + a.w / 2 - (goal.x + goal.w / 2);
    const dy = a.y + a.h / 2 - (goal.y + goal.h / 2);
    return Math.sqrt(dx * dx + dy * dy);
  }

  export const createAgent = function (level) {
    const s = level.start;
    const a = {
      x: s.x + (s.w - C.AGENT_W) / 2,
      y: s.y + s.h - C.AGENT_H,
      w: C.AGENT_W,
      h: C.AGENT_H,
      vx: 0,
      vy: 0,
      onGround: false,
      surface: null,
      alive: true,
      finished: false,
      reason: '',
      ticks: 0,
      idle: 0,
      facing: 1,
      state: 'steht', // steht | vorwärts | rückwärts | springt | Luft
      deadAt: -1,
      finishTick: 0,
      visitedCells: new Set(),
      exploration: 0,
      rays: [],
      sensorValues: null,
      navigation: { blockedTicks: 0, detourTicks: 0, detourStartX: 0, detourDirection: 0 },
    };
    a.startDist = distToGoal(a, level.goal);
    a.bestDist = a.startDist;
    a.startX = a.x + a.w / 2;
    a.bestX = a.startX;
    a.visitedCells.add(Math.floor((a.x + a.w / 2) / 80) + ',' + Math.floor((a.y + a.h / 2) / 80));
    return a;
  };

  // Nach einer Live-Änderung im Editor dürfen Agenten nie in einem neu
  // platzierten festen Block stecken bleiben. Sie werden zur nächstgelegenen
  // freien Kante herausgeschoben; ist das in einem dichten Blockstapel nicht
  // möglich, scheidet der Agent kontrolliert aus statt die Physik zu brechen.
  export function reconcileAgentAfterLevelEdit(a, level, tick) {
    if (!a || !a.alive || a.finished) return a;
    const solids = level.blocks.filter((b) => b.solid !== false && SOLID_KINDS[kindOf(b)]);
    for (let pass = 0; pass < solids.length + 2; pass++) {
      const block = solids.find((b) => overlap(a, b));
      if (!block) break;
      const choices = [
        { axis: 'x', value: block.x - a.w, distance: a.x + a.w - block.x },
        { axis: 'x', value: block.x + block.w, distance: block.x + block.w - a.x },
        { axis: 'y', value: block.y - a.h, distance: a.y + a.h - block.y },
        { axis: 'y', value: block.y + block.h, distance: block.y + block.h - a.y },
      ].filter((choice) => choice.value >= (choice.axis === 'x' ? 0 : 0)
        && choice.value <= (choice.axis === 'x' ? C.W - a.w : C.H - a.h));
      if (!choices.length) { kill(a, 'Level geändert', tick); return a; }
      choices.sort((left, right) => left.distance - right.distance);
      const choice = choices[0];
      a[choice.axis] = choice.value;
      if (choice.axis === 'x') a.vx = 0;
      else { a.vy = 0; a.onGround = choice.value === block.y - a.h; }
    }
    if (solids.some((b) => overlap(a, b))) { kill(a, 'Level geändert', tick); return a; }

    // Gefahren gelten sofort. Das verhindert, dass ein Agent einen Tick lang
    // in einer gerade gesetzten Gefahr weiterläuft.
    for (const block of level.blocks) {
      if (block.solid === false) continue;
      const def = BLOCK_TYPES[block.type];
      if (def && def.kind === 'deadly' && overlap(a, hazardBounds(block, def))) {
        kill(a, def.label, tick);
        break;
      }
    }
    return a;
  }

  export function reconcileAgentsAfterLevelEdit(agents, level, tick) {
    for (const agent of agents) reconcileAgentAfterLevelEdit(agent, level, tick);
    return agents;
  }

  // Fitness belohnt echten Ziel-Fortschritt, Vorwärtskommen und Erkundung.
  export const fitness = function (a, maxTicks) {
    const progress = Math.max(0, a.startDist - a.bestDist);
    const forwardProgress = Math.max(0, (a.bestX || 0) - (a.startX || 0));
    const exploration = Math.min(a.exploration || 0, 32) * 1.8;
    const inactivityPenalty = Math.min(a.idle || 0, C.STUCK_TICKS) * 0.22;
    const survivalBonus = Math.min(a.ticks || 0, 360) * 0.025;
    const deathPenalty = a.alive || a.finished ? 0 : 8;
    let score = progress * 1.25 + forwardProgress * 0.28 + exploration + survivalBonus - inactivityPenalty - deathPenalty;
    if (a.finished) score += 1500 + (maxTicks - a.finishTick) * 0.65;
    return score;
  };

  // 18 Raycasts für Hindernisse, Gefahren, Rückraum und Bodenabdeckung.
  const DIAG = Math.sqrt(C.W * C.W + C.H * C.H);
  const SENSOR_RAYS = [
    { name: 'Vorne', angle: 0, length: 240, anchor: 'front' },
    { name: 'Oben vorn', angle: -Math.PI / 7, length: 210, anchor: 'front' },
    { name: 'Oben steil', angle: -Math.PI * 0.34, length: 170, anchor: 'front' },
    { name: 'Oben', angle: -Math.PI / 2, length: 145, anchor: 'top' },
    { name: 'Unten vorn', angle: Math.PI / 7, length: 210, anchor: 'front' },
    { name: 'Unten steil', angle: Math.PI * 0.34, length: 190, anchor: 'front' },
    { name: 'Boden vorn', angle: Math.PI / 2, length: 190, anchor: 'frontFoot', down: true },
    { name: 'Boden mitte', angle: Math.PI / 2, length: 155, anchor: 'bottom', down: true },
    { name: 'Hinten', angle: 0, length: 150, anchor: 'back', reverse: true },
    { name: 'Hinten oben', angle: -Math.PI / 4, length: 170, anchor: 'back', reverse: true },
    { name: 'Hinten unten', angle: Math.PI / 4, length: 170, anchor: 'back', reverse: true },
    { name: 'Vorne oben steil', angle: -Math.PI * 0.42, length: 190, anchor: 'front' },
    { name: 'Vorne unten steil', angle: Math.PI * 0.42, length: 190, anchor: 'frontFoot' },
    { name: 'Boden links', angle: Math.PI / 2, length: 220, anchor: 'backFoot', down: true },
    { name: 'Boden rechts', angle: Math.PI / 2, length: 220, anchor: 'frontFoot', down: true },
    { name: 'Boden voraus', angle: Math.PI / 2, length: 280, anchor: 'frontFoot', down: true },
    { name: 'Seitlich oben', angle: -Math.PI / 2, length: 105, anchor: 'front' },
    { name: 'Seitlich unten', angle: Math.PI / 2, length: 125, anchor: 'frontFoot', down: true },
  ];

  function rayRectDistance(x, y, dx, dy, length, rect) {
    let near = 0;
    let far = length;
    const axes = [[x, dx, rect.x, rect.x + rect.w], [y, dy, rect.y, rect.y + rect.h]];
    for (const [origin, dir, min, max] of axes) {
      if (Math.abs(dir) < 1e-8) {
        if (origin < min || origin > max) return null;
        continue;
      }
      let t1 = (min - origin) / dir;
      let t2 = (max - origin) / dir;
      if (t1 > t2) [t1, t2] = [t2, t1];
      near = Math.max(near, t1);
      far = Math.min(far, t2);
      if (near > far) return null;
    }
    return far < 0 || near > length ? null : Math.max(0, near);
  }

  function hazardBounds(b, def) {
    if (def.shape === 'up') return { x: b.x + 4, y: b.y + 6, w: Math.max(1, b.w - 8), h: Math.max(1, b.h - 6) };
    if (def.shape === 'down') return { x: b.x + 4, y: b.y, w: Math.max(1, b.w - 8), h: Math.max(1, b.h - 6) };
    const inset = def.inset || 3;
    return { x: b.x + inset, y: b.y + inset, w: Math.max(1, b.w - 2 * inset), h: Math.max(1, b.h - 2 * inset) };
  }

  function castRay(a, level, config) {
    const facing = a.facing || 1;
    const frontX = facing > 0 ? a.x + a.w - 1 : a.x + 1;
    let ox = a.x + a.w / 2;
    let oy = a.y + a.h / 2;
    if (config.anchor === 'front') { ox = frontX; oy = a.y + a.h * 0.44; }
    else if (config.anchor === 'back') { ox = facing > 0 ? a.x + 1 : a.x + a.w - 1; oy = a.y + a.h * 0.44; }
    else if (config.anchor === 'top') { ox = a.x + a.w / 2; oy = a.y + 2; }
    else if (config.anchor === 'frontFoot') { ox = frontX; oy = a.y + a.h - 2; }
    else if (config.anchor === 'backFoot') { ox = facing > 0 ? a.x + 1 : a.x + a.w - 1; oy = a.y + a.h - 2; }
    else if (config.anchor === 'bottom') { ox = a.x + a.w / 2; oy = a.y + a.h - 1; }

    let dx = Math.cos(config.angle) * facing * (config.reverse ? -1 : 1);
    let dy = Math.sin(config.angle);
    const magnitude = Math.hypot(dx, dy) || 1;
    dx /= magnitude; dy /= magnitude;
    let bestDistance = config.length;
    let bestKind = 'none';

    for (const block of level.blocks) {
      if (block.solid === false) continue;
      const def = BLOCK_TYPES[block.type];
      if (!def) continue;
      const deadly = def.kind === 'deadly';
      if (!deadly && !SOLID_KINDS[def.kind] && def.kind !== 'oneway') continue;
      const bounds = deadly ? hazardBounds(block, def) : block;
      const distance = rayRectDistance(ox, oy, dx, dy, config.length, bounds);
      if (distance !== null && distance < bestDistance) {
        bestDistance = distance;
        bestKind = deadly ? 'deadly' : 'solid';
      }
    }

    // Die Levelgrenzen sind ebenfalls sichtbare Hindernisse.
    if (dx < -1e-8) {
      const t = (0 - ox) / dx;
      if (t >= 0 && t < bestDistance) { bestDistance = t; bestKind = 'solid'; }
    } else if (dx > 1e-8) {
      const t = (C.W - ox) / dx;
      if (t >= 0 && t < bestDistance) { bestDistance = t; bestKind = 'solid'; }
    }

    const hit = bestKind !== 'none';
    const value = hit
      ? (bestKind === 'deadly' ? -1 : 1) * Math.max(0, Math.min(1, bestDistance / config.length))
      : (config.down ? -1 : 1);
    return {
      value,
      ray: { name: config.name, x1: ox, y1: oy, x2: ox + dx * bestDistance, y2: oy + dy * bestDistance, kind: bestKind, distance: bestDistance, length: config.length },
    };
  }

  export const sense = function (a, level, out) {
    out[0] = ((a.x + a.w / 2) / C.W) * 2 - 1;
    out[1] = ((a.y + a.h / 2) / C.H) * 2 - 1;
    out[2] = a.vx / C.MAX_SPEED;
    out[3] = Math.max(-1.5, Math.min(1.5, a.vy / C.MAX_FALL));
    out[4] = distToGoal(a, level.goal) / DIAG;
    out[5] = a.onGround ? 1 : 0;
    a.rays = new Array(SENSOR_RAYS.length);
    for (let i = 0; i < SENSOR_RAYS.length; i++) {
      const result = castRay(a, level, SENSOR_RAYS[i]);
      out[6 + i] = result.value;
      a.rays[i] = result.ray;
    }
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
    const gx = level.goal.x + level.goal.w / 2, gy = level.goal.y + level.goal.h / 2;
    out[24] = Math.max(-1, Math.min(1, (gx - ax) / C.W));
    out[25] = Math.max(-1, Math.min(1, (gy - ay) / C.H));
    let nearestHazard = null, nearestDistance = DIAG;
    for (const block of level.blocks) {
      const def = BLOCK_TYPES[block.type];
      if (block.solid === false || !def || def.kind !== 'deadly') continue;
      const hx = block.x + block.w / 2, hy = block.y + block.h / 2;
      const d = Math.hypot(hx - ax, hy - ay);
      if (d < nearestDistance) { nearestDistance = d; nearestHazard = { x: hx, y: hy }; }
    }
    out[26] = Math.max(0, Math.min(1, nearestDistance / DIAG));
    out[27] = nearestHazard ? Math.max(-1, Math.min(1, (nearestHazard.y - ay) / C.H)) : 0;
    a.sensorValues = out;
    return out;
  };
  export { SENSOR_RAYS };

  function blockingWallAhead(agent, level, direction) {
    if (!level) return null;
    const ax = agent.x + agent.w / 2;
    const goalX = level.goal.x + level.goal.w / 2;
    for (const block of level.blocks) {
      if (block.solid === false || !SOLID_KINDS[kindOf(block)]) continue;
      const ahead = direction > 0 ? block.x >= ax && block.x < goalX : block.x + block.w <= ax && block.x + block.w > goalX;
      if (!ahead) continue;
      // Niedrige Blöcke werden weiterhin übersprungen. Eine hohe Wand kann
      // dagegen nicht mit einem direkten Sprung überwunden werden.
      const overlapsRoute = block.y < agent.y + agent.h && block.y + block.h > agent.y - 8;
      if (overlapsRoute && (block.h >= 100 || block.y < agent.y - 55)) return block;
    }
    return null;
  }

  // Reflexhilfe für nahe Hindernisse und Abgründe; die Netzwerkausgabe bleibt beteiligt.
  // Bei einer hohen Wand wird nicht stur weiter zum Ziel gedrückt: Der Agent
  // geht erst ein Stück zurück und sucht damit einen Abstieg bzw. Umweg.
  export function assistControl(agent, input, neuralOut, level) {
    const goalDirection = input[24] >= 0 ? 1 : -1;
    let move = neuralOut[0] * 0.62 + goalDirection * 0.38;
    if (goalDirection > 0 && move < 0.16) move = 0.16;
    if (goalDirection < 0 && move > -0.16) move = -0.16;
    move = Math.max(-1, Math.min(1, move));
    const nav = agent.navigation || (agent.navigation = { blockedTicks: 0, detourTicks: 0, detourStartX: agent.x, detourDirection: 0 });
    const wall = blockingWallAhead(agent, level, goalDirection);
    if (nav.detourTicks > 0) {
      nav.detourTicks--;
      if (Math.abs(agent.x - nav.detourStartX) >= 110) nav.detourTicks = 0;
    } else if (wall && Math.abs(agent.vx) < 0.35) {
      nav.blockedTicks++;
      if (nav.blockedTicks >= 18) {
        nav.detourDirection = -goalDirection;
        nav.detourStartX = agent.x;
        nav.detourTicks = 100;
        nav.blockedTicks = 0;
      }
    } else if (!wall) {
      nav.blockedTicks = 0;
    }
    const detouring = nav.detourTicks > 0;
    if (detouring) move = nav.detourDirection;
    move = Math.max(-1, Math.min(1, move));
    const nearSolid = input[6] > 0 && input[6] < 0.72;
    const nearHazard = (input[6] < 0 && Math.abs(input[6]) < 0.82)
      || (input[10] < 0 && Math.abs(input[10]) < 0.82)
      || (input[18] < 0 && Math.abs(input[18]) < 0.82);
    const missingGround = input[12] < -0.95 || input[21] < -0.95;
    const assistedJump = !detouring && agent.onGround && (nearSolid || nearHazard || missingGround);
    return { move, jump: !detouring && (neuralOut[1] > 0.56 || assistedJump), assistedJump, detouring };
  }

  function kindOf(b) {
    const d = BLOCK_TYPES[b.type];
    return d ? d.kind : null;
  }

  // Ein Physik-Tick für einen Agenten. ctrl = { move: -1..1, jump: bool }
  export const stepAgent = function (a, level, ctrl, tick) {
    if (!a.alive || a.finished) return;
    const blocks = level.blocks;

    // Untergrund-Effekte (vom letzten Tick)
    const sk = a.surface ? kindOf(a.surface) : null;
    let vmax = C.MAX_SPEED;
    let accel = a.onGround ? 0.3 : 0.12;
    let push = 0;
    if (sk === 'ice') accel = 0.05;
    else if (sk === 'mud') vmax *= 0.5;
    else if (sk === 'conveyor') push = BLOCK_TYPES[a.surface.type].dir * (BLOCK_TYPES[a.surface.type].push || 1.3);

    // Horizontal
    const target = Math.abs(ctrl.move) < 0.2 ? 0 : ctrl.move * vmax;
    a.vx += (target - a.vx) * accel;
    if (Math.abs(a.vx) < 0.02) a.vx = 0;
    if (a.vx > 0.1) a.facing = 1;
    else if (a.vx < -0.1) a.facing = -1;

    // Springen
    if (ctrl.jump && a.onGround) {
      a.vy = C.JUMP;
      a.onGround = false;
    }
    a.vy = Math.min(a.vy + C.GRAVITY, C.MAX_FALL);

    // X bewegen + kollidieren
    const px = a.x;
    const dx = a.vx + push;
    a.x += dx;
    if (a.x < 0) { a.x = 0; a.vx = 0; }
    if (a.x + a.w > C.W) { a.x = C.W - a.w; a.vx = 0; }
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.solid === false) continue;
      const kind = kindOf(b);
      if (SOLID_KINDS[kind]) {
        if (!overlap(a, b)) continue;
      } else if (kind === 'oneway') {
        // Plattform: seitlich fest, wenn man von der Seite hineinläuft.
        // Wer schon darin steckt (Sprung von unten durch die Plattform), wird nicht aufgehalten.
        if (!overlap(a, b) || overlap({ x: px, y: a.y, w: a.w, h: a.h }, b)) continue;
      } else continue;
      if (dx > 0) a.x = b.x - a.w;
      else if (dx < 0) a.x = b.x + b.w;
      a.vx = 0;
    }

    // Y bewegen + kollidieren
    const prevBottom = a.y + a.h;
    a.y += a.vy;
    a.onGround = false;
    a.surface = null;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.solid === false) continue;
      const kind = kindOf(b);
      if (SOLID_KINDS[kind]) {
        if (!overlap(a, b)) continue;
        if (a.vy > 0) {
          a.y = b.y - a.h;
          if (kind === 'bounce') {
            a.vy = BLOCK_TYPES[b.type].bounce || C.BOUNCE;
          } else {
            a.vy = 0;
            a.onGround = true;
            a.surface = b;
          }
        } else if (a.vy < 0) {
          a.y = b.y + b.h;
          a.vy = 0;
        }
      } else if (kind === 'oneway') {
        if (a.vy >= 0 && prevBottom <= b.y + 0.001 && overlap(a, b)) {
          a.y = b.y - a.h;
          a.vy = 0;
          a.onGround = true;
          a.surface = b;
        }
      }
    }

    // Tödliche Blöcke (verkleinerte Hitbox) und Absturz
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.solid === false) continue;
      const def = BLOCK_TYPES[b.type];
      if (!def || def.kind !== 'deadly') continue;
      let hb;
      if (def.shape === 'up') hb = { x: b.x + 4, y: b.y + 6, w: b.w - 8, h: b.h - 6 };
      else if (def.shape === 'down') hb = { x: b.x + 4, y: b.y, w: b.w - 8, h: b.h - 6 };
      else { const n = def.inset || 3; hb = { x: b.x + n, y: b.y + n, w: b.w - 2 * n, h: b.h - 2 * n }; }
      hb.w = Math.max(1, hb.w);
      hb.h = Math.max(1, hb.h);
      if (overlap(a, hb)) { kill(a, def.label, tick); return; }
    }
    if (a.y > C.H + C.FALL_MARGIN) { kill(a, 'Absturz', tick); return; }

    // Zustand (für Anzeige)
    if (!a.onGround) a.state = a.vy < 0 ? 'springt' : 'Luft';
    else if (a.vx > 0.3) a.state = 'vorwärts';
    else if (a.vx < -0.3) a.state = 'rückwärts';
    else a.state = 'steht';

    a.ticks++;

    // Ziel
    if (overlap(a, level.goal)) {
      a.finished = true;
      a.finishTick = a.ticks;
      a.bestDist = 0;
      return;
    }

    // Fortschritt / Stillstand
    a.bestX = Math.max(a.bestX || a.x, a.x + a.w / 2);
    const cell = Math.floor((a.x + a.w / 2) / 80) + ',' + Math.floor((a.y + a.h / 2) / 80);
    const exploredNewCell = !a.visitedCells.has(cell);
    if (exploredNewCell) {
      a.visitedCells.add(cell);
      a.exploration++;
      a.idle = 0;
    }
    const d = distToGoal(a, level.goal);
    if (d < a.bestDist - 1) { a.bestDist = d; a.idle = 0; }
    else if (!exploredNewCell && ++a.idle >= C.STUCK_TICKS) kill(a, 'Stillstand', tick);
  };

  function kill(a, reason, tick) {
    a.alive = false;
    a.reason = reason;
    a.deadAt = tick;
  }

  // =====================================================================
  //                              RENDERING
  // =====================================================================
  const S = C.SCALE;
  const grad = (ctx, y0, y1, c0, c1, x0, x1) => {
    const g = ctx.createLinearGradient(x0 || 0, y0, x1 || 0, y1);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    return g;
  };
  function bevel(ctx, w, h, light, dark, t) {
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, w, t);
    ctx.fillRect(0, 0, t, h);
    ctx.fillStyle = dark;
    ctx.fillRect(0, h - t, w, t);
    ctx.fillRect(w - t, 0, t, h);
  }
  function clipRect(ctx, w, h) {
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
  }
  function tiles(w, h, size, cb) {
    for (let y = 0, j = 0; y < h; y += size, j++)
      for (let x = 0, i = 0; x < w; x += size, i++) cb(x, y, Math.min(size, w - x), Math.min(size, h - y), i, j);
  }

  // ---- Block-Stile (zeichnen im lokalen Koordinatensystem, Ursprung links oben) ----
  const ST = {};

  ST.ground = (ctx, w, h, base) => {
    ctx.fillStyle = grad(ctx, 0, h, shade(base, 0.08), shade(base, -0.4));
    ctx.fillRect(0, 0, w, h);
    const n = (w * h) / 450;
    for (let i = 0; i < n; i++) {
      const px = hash(i, 1) * w, py = 12 + hash(i, 2) * Math.max(0, h - 12);
      ctx.fillStyle = hash(i, 3) > 0.5 ? shade(base, -0.3) : shade(base, 0.2);
      ctx.beginPath();
      ctx.arc(px, py, 1.2 + hash(i, 4) * 2.2, 0, 7);
      ctx.fill();
    }
    const gh = Math.min(9, h);
    ctx.fillStyle = '#4f9d3f';
    ctx.fillRect(0, 0, w, gh);
    for (let x = 0; x < w; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, gh - 1);
      ctx.lineTo(x + 4, gh + 3 + hash(x, 5) * 4);
      ctx.lineTo(x + 8, gh - 1);
      ctx.fill();
    }
    ctx.fillStyle = '#7fcf5c';
    ctx.fillRect(0, 0, w, Math.min(3, h));
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    for (let x = 3; x < w; x += 11) ctx.fillRect(x, 4, 2, 3);
  };

  ST.stone = (ctx, w, h, base) => {
    ctx.fillStyle = shade(base, -0.5);
    ctx.fillRect(0, 0, w, h);
    tiles(w, h, 40, (x, y, tw, th, i, j) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = shade(base, hash(i, j) * 0.14 - 0.07);
      ctx.fillRect(1, 1, tw - 2, th - 2);
      bevel(ctx, tw, th, 'rgba(255,255,255,.28)', 'rgba(0,0,0,.3)', 3);
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = hash(i * 7 + k, j) > 0.5 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.16)';
        ctx.fillRect(4 + hash(k, i + j * 3) * (tw - 10), 4 + hash(j, k + i * 5) * (th - 10), 2, 2);
      }
      if (hash(i, j + 9) > 0.7 && tw >= 30 && th >= 30) {
        ctx.strokeStyle = 'rgba(0,0,0,.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(10, 8); ctx.lineTo(16, 18); ctx.lineTo(13, 26); ctx.lineTo(20, 33);
        ctx.stroke();
      }
      ctx.restore();
    });
  };

  ST.brick = (ctx, w, h, base) => {
    ctx.fillStyle = shade(base, -0.5);
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row * 20 < h; row++) {
      const off = row % 2 ? -20 : 0;
      for (let x = off, col = 0; x < w; x += 40, col++) {
        const bx = Math.max(0, x), bx2 = Math.min(w, x + 40), by = row * 20, bh = Math.min(20, h - by);
        ctx.fillStyle = shade(base, hash(col, row) * 0.2 - 0.1);
        ctx.fillRect(bx + 1, by + 1, bx2 - bx - 2, bh - 2);
        ctx.fillStyle = 'rgba(255,255,255,.28)';
        ctx.fillRect(bx + 1, by + 1, bx2 - bx - 2, 2);
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.fillRect(bx + 1, by + bh - 3, bx2 - bx - 2, 2);
      }
    }
  };

  ST.wood = (ctx, w, h, base) => {
    for (let x = 0, i = 0; x < w; x += 10, i++) {
      ctx.fillStyle = shade(base, (i % 2 ? -0.08 : 0.06) + hash(i, 1) * 0.06);
      ctx.fillRect(x, 0, Math.min(10, w - x), h);
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.fillRect(x, 0, 1, h);
      ctx.strokeStyle = 'rgba(60,30,10,.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 4, 3); ctx.bezierCurveTo(x + 7, h * 0.3, x + 2, h * 0.6, x + 5, h - 3);
      ctx.stroke();
    }
    bevel(ctx, w, h, 'rgba(255,255,255,.25)', 'rgba(0,0,0,.3)', 3);
    ctx.fillStyle = '#3b2a1c';
    tiles(w, h, 40, (x, y, tw, th) => {
      for (const [nx, ny] of [[5, 5], [tw - 5, 5], [5, th - 5], [tw - 5, th - 5]]) {
        ctx.beginPath(); ctx.arc(x + nx, y + ny, 1.6, 0, 7); ctx.fill();
      }
    });
  };

  ST.sand = (ctx, w, h, base) => {
    ctx.fillStyle = grad(ctx, 0, h, shade(base, 0.12), shade(base, -0.22));
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < (w * h) / 120; i++) {
      ctx.fillStyle = hash(i, 2) > 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(120,80,30,.25)';
      ctx.fillRect(hash(i, 3) * w, hash(i, 4) * h, 1.5, 1.5);
    }
    ctx.strokeStyle = 'rgba(150,110,50,.3)';
    ctx.lineWidth = 1.5;
    for (let y = 12; y < h; y += 12) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) ctx.lineTo(x, y + Math.sin(x / 8 + y) * 1.5);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillRect(0, 0, w, 3);
  };

  ST.snow = (ctx, w, h, base) => {
    ctx.fillStyle = grad(ctx, 0, h, '#bcd7ee', '#6f93b8');
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    tiles(w, h, 20, (x, y, tw, th, i, j) => { if ((i + j) % 2) ctx.fillRect(x, y, tw, th); });
    ctx.fillStyle = base;
    const cap = Math.min(12, h);
    ctx.fillRect(0, 0, w, cap - 3);
    for (let x = 0; x < w; x += 10) {
      ctx.beginPath(); ctx.arc(x + 5, cap - 3, 5 + hash(x, 3) * 2, 0, Math.PI); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < w / 14; i++) ctx.fillRect(hash(i, 8) * w, hash(i, 9) * h, 2, 2);
  };

  ST.moss = (ctx, w, h, base) => {
    ST.stone(ctx, w, h, base);
    ctx.fillStyle = '#4c8f3e';
    ctx.fillRect(0, 0, w, Math.min(8, h));
    for (let x = 0; x < w; x += 6) {
      ctx.fillRect(x, 0, 6, 8 + hash(x, 4) * 9);
    }
    ctx.fillStyle = '#6cc35a';
    ctx.fillRect(0, 0, w, 3);
    ctx.fillStyle = 'rgba(80,160,70,.5)';
    for (let i = 0; i < w / 12; i++) { ctx.beginPath(); ctx.arc(hash(i, 5) * w, 12 + hash(i, 6) * Math.max(0, h - 12), 3 + hash(i, 7) * 3, 0, 7); ctx.fill(); }
  };

  ST.metal = (ctx, w, h, base) => {
    tiles(w, h, 40, (x, y, tw, th) => {
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = grad(ctx, 0, th, shade(base, 0.2), shade(base, -0.25));
      ctx.fillRect(0, 0, tw, th);
      bevel(ctx, tw, th, 'rgba(255,255,255,.5)', 'rgba(0,0,0,.35)', 3);
      ctx.strokeStyle = 'rgba(0,0,0,.25)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(6, 6); ctx.lineTo(tw - 6, th - 6); ctx.moveTo(tw - 6, 6); ctx.lineTo(6, th - 6); ctx.stroke();
      for (const [nx, ny] of [[7, 7], [tw - 7, 7], [7, th - 7], [tw - 7, th - 7]]) {
        ctx.fillStyle = shade(base, -0.35); ctx.beginPath(); ctx.arc(nx, ny, 2.6, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(nx - 0.7, ny - 0.7, 1, 0, 7); ctx.fill();
      }
      ctx.restore();
    });
  };

  ST.gold = (ctx, w, h, base) => {
    ctx.fillStyle = grad(ctx, 0, h, shade(base, 0.35), shade(base, -0.3));
    ctx.fillRect(0, 0, w, h);
    bevel(ctx, w, h, 'rgba(255,255,255,.65)', 'rgba(110,60,0,.45)', 4);
    ctx.save();
    clipRect(ctx, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    for (let x = -h; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x + 8, h); ctx.lineTo(x + 22, h); ctx.lineTo(x + 22 + h, 0); ctx.lineTo(x + 8 + h, 0); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#fff';
    tiles(w, h, 40, (x, y, tw, th, i, j) => {
      const cx = x + 10 + hash(i, j) * (tw - 20), cy = y + 10 + hash(j, i + 3) * (th - 20);
      ctx.beginPath(); ctx.moveTo(cx, cy - 4); ctx.lineTo(cx + 1.2, cy - 1.2); ctx.lineTo(cx + 4, cy); ctx.lineTo(cx + 1.2, cy + 1.2); ctx.lineTo(cx, cy + 4); ctx.lineTo(cx - 1.2, cy + 1.2); ctx.lineTo(cx - 4, cy); ctx.lineTo(cx - 1.2, cy - 1.2); ctx.fill();
    });
  };

  ST.crystal = (ctx, w, h, base) => {
    ctx.fillStyle = grad(ctx, 0, h, shade(base, 0.3), shade(base, -0.35));
    ctx.fillRect(0, 0, w, h);
    tiles(w, h, 40, (x, y, tw, th, i, j) => {
      const cx = x + tw / 2, cy = y + th / 2;
      const pts = [[x, y], [x + tw, y], [x + tw, y + th], [x, y + th]];
      for (let k = 0; k < 4; k++) {
        const a = pts[k], b = pts[(k + 1) % 4];
        ctx.fillStyle = ['rgba(255,255,255,.35)', 'rgba(255,255,255,.08)', 'rgba(0,0,40,.25)', 'rgba(255,255,255,.18)'][k];
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(cx, cy); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 6, y + 6, tw - 12, th - 12);
    });
    bevel(ctx, w, h, 'rgba(255,255,255,.6)', 'rgba(0,0,60,.4)', 3);
  };

  ST.obsidian = (ctx, w, h, base) => {
    ctx.fillStyle = grad(ctx, 0, h, shade(base, -0.2), shade(base, -0.75));
    ctx.fillRect(0, 0, w, h);
    ctx.save(); clipRect(ctx, w, h);
    ctx.strokeStyle = 'rgba(190,120,255,.55)';
    ctx.lineWidth = 1.5;
    tiles(w, h, 40, (x, y, tw, th, i, j) => {
      ctx.beginPath();
      ctx.moveTo(x + hash(i, j) * 20, y);
      ctx.lineTo(x + 14 + hash(j, i) * 12, y + 14);
      ctx.lineTo(x + 8 + hash(i + 2, j) * 20, y + 26);
      ctx.lineTo(x + 20 + hash(i, j + 5) * 14, y + th);
      ctx.stroke();
    });
    ctx.fillStyle = 'rgba(255,255,255,.1)';
    for (let x = -h; x < w; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 8, h); ctx.lineTo(x + 8 + h, 0); ctx.lineTo(x + h, 0); ctx.fill();
    }
    ctx.restore();
    bevel(ctx, w, h, 'rgba(200,160,255,.35)', 'rgba(0,0,0,.5)', 2);
  };

  ST.candy = (ctx, w, h, base) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.save(); clipRect(ctx, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (let x = -h; x < w; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 8, h); ctx.lineTo(x + 8 + h, 0); ctx.lineTo(x + h, 0); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = grad(ctx, 0, h, 'rgba(255,255,255,.4)', 'rgba(120,0,60,.25)');
    ctx.fillRect(0, 0, w, h);
    bevel(ctx, w, h, 'rgba(255,255,255,.7)', 'rgba(120,0,60,.35)', 3);
  };

  ST.ice = (ctx, w, h, base) => {
    ctx.fillStyle = grad(ctx, 0, h, shade(base, 0.45), shade(base, -0.1));
    ctx.fillRect(0, 0, w, h);
    ctx.save(); clipRect(ctx, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    for (let x = -h; x < w; x += 34) {
      ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 10, h); ctx.lineTo(x + 10 + h, 0); ctx.lineTo(x + h, 0); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 1;
    for (let i = 0; i < w / 40; i++) {
      ctx.beginPath(); ctx.moveTo(10 + i * 40, 10); ctx.lineTo(18 + i * 40, 20); ctx.lineTo(14 + i * 40, 30); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillRect(0, 0, w, 3);
    bevel(ctx, w, h, 'rgba(255,255,255,.5)', 'rgba(30,90,140,.35)', 2);
  };

  ST.mud = (ctx, w, h, base) => {
    ctx.fillStyle = grad(ctx, 0, h, shade(base, 0.1), shade(base, -0.45));
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = shade(base, 0.2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= w; x += 4) ctx.lineTo(x, 6 + Math.sin(x / 7) * 2.5);
    ctx.lineTo(w, 0);
    ctx.fill();
    for (let i = 0; i < w / 10; i++) {
      const bx = hash(i, 1) * w, by = 10 + hash(i, 2) * Math.max(0, h - 14), r = 2 + hash(i, 3) * 3;
      ctx.fillStyle = shade(base, -0.3);
      ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.beginPath(); ctx.arc(bx - r * 0.3, by - r * 0.3, r * 0.4, 0, 7); ctx.fill();
    }
  };

  ST.bounce = (ctx, w, h, base) => {
    const pad = Math.min(7, h * 0.4), foot = Math.min(4, h * 0.25);
    ctx.strokeStyle = '#9aa3b0';
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    const top = pad, bot = h - foot, seg = 5;
    ctx.beginPath();
    for (let x = 4; x < w - 4; x += 12) {
      ctx.moveTo(x, bot);
      for (let k = 1; k <= seg; k++) ctx.lineTo(x + (k % 2 ? 6 : 0), bot - ((bot - top) * k) / seg);
    }
    ctx.stroke();
    ctx.fillStyle = '#3d4552';
    rr(ctx, 0, h - foot, w, foot, 2); ctx.fill();
    ctx.fillStyle = grad(ctx, 0, pad, shade(base, 0.25), shade(base, -0.3));
    rr(ctx, 0, 0, w, pad, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillRect(3, 1.5, w - 6, 1.5);
  };

  ST.conveyor = (ctx, w, h, base, t, def) => {
    const dir = def.dir || 1;
    rr(ctx, 0, 0, w, h, h / 2);
    ctx.fillStyle = grad(ctx, 0, h, shade(base, 0.15), shade(base, -0.4));
    ctx.fill();
    ctx.save();
    rr(ctx, 0, 0, w, h, h / 2); ctx.clip();
    ctx.strokeStyle = '#ffcc33';
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    const off = (((t * 22 * dir) % 16) + 16) % 16;
    for (let x = -16 + off; x < w + 16; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 4); ctx.lineTo(x + 6 * dir, h / 2); ctx.lineTo(x, h - 4);
      ctx.stroke();
    }
    ctx.restore();
    for (const cx of [h / 2, w - h / 2]) {
      ctx.fillStyle = '#2d3440';
      ctx.beginPath(); ctx.arc(cx, h / 2, h / 2 - 2, 0, 7); ctx.fill();
      ctx.strokeStyle = '#aab3c0'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = t * 4 * dir + (k * Math.PI * 2) / 3;
        ctx.moveTo(cx, h / 2); ctx.lineTo(cx + Math.cos(a) * (h / 2 - 3), h / 2 + Math.sin(a) * (h / 2 - 3));
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2;
    rr(ctx, 1, 1, w - 2, h - 2, h / 2); ctx.stroke();
  };

  ST.plank = (ctx, w, h, base) => {
    rr(ctx, 0, 0, w, h, 3);
    ctx.fillStyle = grad(ctx, 0, h, shade(base, 0.2), shade(base, -0.3));
    ctx.fill();
    ctx.save(); clipRect(ctx, w, h);
    ctx.strokeStyle = 'rgba(60,30,10,.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 30; x < w; x += 30) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillRect(0, 0, w, 3);
    ctx.fillStyle = '#3b2a1c';
    for (let x = 6; x < w; x += 30) { ctx.beginPath(); ctx.arc(x, h / 2 + 1, 1.5, 0, 7); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(40,20,5,.8)'; ctx.lineWidth = 1.5;
    rr(ctx, 0.75, 0.75, w - 1.5, h - 1.5, 3); ctx.stroke();
  };

  ST.cloud = (ctx, w, h, base) => {
    ctx.fillStyle = 'rgba(110,150,200,.35)';
    rr(ctx, 0, h * 0.45, w, h * 0.55, h * 0.3); ctx.fill();
    ctx.fillStyle = base;
    rr(ctx, 0, h * 0.25, w, h * 0.65, h * 0.32); ctx.fill();
    const n = Math.max(2, Math.round(w / 32));
    for (let i = 0; i < n; i++) {
      const cx = ((i + 0.5) * w) / n, r = h * (0.32 + hash(i, 2) * 0.12);
      ctx.beginPath(); ctx.arc(cx, h * 0.45, r, 0, 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(190,215,245,.5)';
    rr(ctx, 4, h * 0.7, w - 8, h * 0.18, h * 0.09); ctx.fill();
  };

  ST.steel = (ctx, w, h, base) => {
    rr(ctx, 0, 0, w, h, 2);
    ctx.fillStyle = grad(ctx, 0, h, shade(base, 0.3), shade(base, -0.3));
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    for (let x = 10; x < w - 8; x += 16) rr(ctx, x, h / 2 - 2, 9, 4, 2), ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillRect(1, 1, w - 2, 2);
    ctx.fillStyle = 'rgba(255,200,0,.9)';
    ctx.fillRect(0, h - 3, w, 3);
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.5;
    rr(ctx, 0.75, 0.75, w - 1.5, h - 1.5, 2); ctx.stroke();
  };

  ST.bridge = (ctx, w, h, base) => {
    ctx.strokeStyle = shade(base, -0.45);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 2); ctx.lineTo(w, 2);
    ctx.stroke();
    for (let x = 0, i = 0; x < w; x += 14, i++) {
      ctx.fillStyle = shade(base, hash(i, 1) * 0.2 - 0.1);
      rr(ctx, x + 1, 3, Math.min(12, w - x - 1), h - 3, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(x + 2, 4, Math.min(10, w - x - 3), 2);
      ctx.strokeStyle = 'rgba(40,20,5,.6)'; ctx.lineWidth = 1;
      rr(ctx, x + 1.5, 3.5, Math.min(11, w - x - 2), h - 4, 2); ctx.stroke();
    }
    ctx.strokeStyle = '#7a5a34';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, h - 2); ctx.lineTo(w, h - 2); ctx.stroke();
  };

  function spikeRow(ctx, w, h, base) {
    const n = Math.max(1, Math.round(w / 20)), sw = w / n;
    ctx.fillStyle = '#4a4f59';
    ctx.fillRect(0, h - 4, w, 4);
    for (let i = 0; i < n; i++) {
      const x0 = i * sw;
      ctx.fillStyle = grad(ctx, 0, 0, shade(base, 0.35), shade(base, -0.35), x0, x0 + sw);
      ctx.beginPath(); ctx.moveTo(x0 + 1, h - 3); ctx.lineTo(x0 + sw / 2, 1); ctx.lineTo(x0 + sw - 1, h - 3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.moveTo(x0 + sw / 2, 3); ctx.lineTo(x0 + sw / 2 - 2, h * 0.55); ctx.lineTo(x0 + sw / 2 - 0.5, h * 0.55); ctx.fill();
    }
  }
  ST.spike = (ctx, w, h, base) => spikeRow(ctx, w, h, base);
  ST.spikeDown = (ctx, w, h, base) => { ctx.translate(0, h); ctx.scale(1, -1); spikeRow(ctx, w, h, base); };

  ST.thorns = (ctx, w, h, base) => {
    ctx.fillStyle = shade(base, -0.25);
    rr(ctx, 0, h * 0.35, w, h * 0.65, 8); ctx.fill();
    for (let i = 0; i < w / 10; i++) {
      ctx.fillStyle = shade(base, hash(i, 1) * 0.3 - 0.1);
      ctx.beginPath(); ctx.arc(5 + i * 10, h * 0.5 + hash(i, 2) * 6, 8 + hash(i, 3) * 3, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#f4efe0';
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1;
    for (let i = 0; i < w / 9; i++) {
      const x = 4 + i * 9, y = h * 0.3 + hash(i, 4) * h * 0.5, a = hash(i, 5) * 6.28;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(-2.5, 0); ctx.lineTo(0, -8); ctx.lineTo(2.5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  };

  function liquid(ctx, w, h, t, c0, c1, c2, alpha, amp) {
    ctx.save(); clipRect(ctx, w, h);
    const surf = (x, ph) => 5 + Math.sin(x / 9 + t * 2 + ph) * amp + Math.sin(x / 5 - t * 3 + ph) * amp * 0.5;
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, c0); g.addColorStop(0.3, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) ctx.lineTo(x, surf(x, 0));
    ctx.lineTo(w, h); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) (x ? ctx.lineTo(x, surf(x, 0)) : ctx.moveTo(x, surf(x, 0)));
    ctx.stroke();
    ctx.restore();
  }
  function bubbles(ctx, w, h, t, col, maxR) {
    ctx.fillStyle = col;
    for (let i = 0; i < w / 14; i++) {
      const ph = (t * (0.25 + hash(i, 6) * 0.3) + hash(i, 8)) % 1;
      const r = 1.2 + hash(i, 9) * maxR * (1 - ph * 0.5);
      ctx.beginPath(); ctx.arc(hash(i, 7) * w, h - ph * (h - 6), r, 0, 7); ctx.fill();
    }
  }
  ST.lava = (ctx, w, h, base, t) => {
    liquid(ctx, w, h, t, '#ffe066', base, shade(base, -0.55), 1, 2.4);
    ctx.save(); clipRect(ctx, w, h); bubbles(ctx, w, h, t, 'rgba(255,230,120,.85)', 3); ctx.restore();
    ctx.strokeStyle = 'rgba(80,10,0,.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(0.75, 0.75, w - 1.5, h - 1.5);
  };
  ST.water = (ctx, w, h, base, t) => {
    liquid(ctx, w, h, t, shade(base, 0.35), base, shade(base, -0.5), 0.88, 1.8);
    ctx.save(); clipRect(ctx, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    for (let x = ((t * 18) % 40) - 40; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 6, h); ctx.lineTo(x + 20, 8); ctx.lineTo(x + 14, 8); ctx.fill(); }
    bubbles(ctx, w, h, t, 'rgba(255,255,255,.55)', 2);
    ctx.restore();
  };
  ST.poison = (ctx, w, h, base, t) => {
    liquid(ctx, w, h, t, shade(base, 0.35), base, shade(base, -0.6), 0.95, 2);
    ctx.save(); clipRect(ctx, w, h); bubbles(ctx, w, h, t * 1.4, 'rgba(210,255,150,.8)', 4); ctx.restore();
    ctx.strokeStyle = 'rgba(20,60,0,.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(0.75, 0.75, w - 1.5, h - 1.5);
  };

  ST.saw = (ctx, w, h, base, t) => {
    const r = Math.min(w, h) / 2 - 1;
    ctx.translate(w / 2, h / 2);
    ctx.rotate(t * 9);
    const n = 14;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n;
      ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
      ctx.lineTo(Math.cos(a + Math.PI / n * 0.3) * r, Math.sin(a + Math.PI / n * 0.3) * r);
      ctx.lineTo(Math.cos(a + Math.PI / n) * r * 0.8, Math.sin(a + Math.PI / n) * r * 0.8);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    g.addColorStop(0, shade(base, 0.5)); g.addColorStop(1, shade(base, -0.4));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, 7); ctx.stroke();
    ctx.fillStyle = '#39404c'; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, 7); ctx.fill();
    ctx.fillStyle = '#d7dde6'; ctx.beginPath(); ctx.arc(-1, -1, r * 0.08, 0, 7); ctx.fill();
  };
  ST.fire = (ctx, w, h, base, t) => {
    ctx.fillStyle = 'rgba(255,70,15,.22)'; ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 12) {
      const flame = h * (0.45 + 0.4 * hash(x, 2));
      ctx.fillStyle = '#ff4b19';
      ctx.beginPath(); ctx.moveTo(x, h); ctx.quadraticCurveTo(x + 5, h - flame - Math.sin(t * 8 + x) * 4, x + 10, h); ctx.fill();
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(x + 3, h); ctx.quadraticCurveTo(x + 5, h - flame * .55, x + 7, h); ctx.fill();
    }
  };
  ST.electric = (ctx, w, h) => {
    ctx.fillStyle = 'rgba(157,124,255,.18)'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e8deff'; ctx.lineWidth = 3;
    for (let x = 6; x < w; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 5, h * .35); ctx.lineTo(x - 3, h * .62); ctx.lineTo(x + 3, h); ctx.stroke(); }
  };
  ST.acid = (ctx, w, h, base, t) => {
    ctx.fillStyle = '#8fcf24'; ctx.fillRect(0, 4, w, h - 4);
    ctx.fillStyle = '#dfff65';
    for (let x = 0; x < w; x += 12) { ctx.beginPath(); ctx.arc(x + 6, 5 + Math.sin(t * 5 + x) * 2, 6, 0, Math.PI); ctx.fill(); }
  };
  ST.laser = (ctx, w, h) => {
    ctx.fillStyle = 'rgba(255,49,91,.16)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff315b'; ctx.fillRect(w / 2 - 3, 0, 6, h);
    ctx.fillStyle = '#fff2f6'; ctx.fillRect(w / 2 - 1, 0, 2, h);
  };

  // Blöcke ohne eigenen Rahmen
  const NO_OUTLINE = { spike: 1, spikeDown: 1, thorns: 1, lava: 1, water: 1, poison: 1, saw: 1, fire: 1, electric: 1, acid: 1, laser: 1, bounce: 1, conveyor: 1, plank: 1, cloud: 1, steel: 1, bridge: 1 };

  // Sprite-Cache für statische Blöcke
  const sprites = new Map();
  function getSprite(b, def, base) {
    const key = b.type + '|' + b.w + '|' + b.h + '|' + base;
    let s = sprites.get(key);
    if (s) return s;
    if (sprites.size > 400) sprites.clear();
    s = document.createElement('canvas');
    s.width = Math.max(1, Math.ceil(b.w * S));
    s.height = Math.max(1, Math.ceil(b.h * S));
    const c = s.getContext('2d');
    c.scale(S, S);
    ST[def.style](c, b.w, b.h, base, 0, def);
    if (!NO_OUTLINE[def.style]) {
      c.strokeStyle = 'rgba(15,10,10,.65)';
      c.lineWidth = 2;
      c.strokeRect(1, 1, b.w - 2, b.h - 2);
    }
    sprites.set(key, s);
    return s;
  }

  function drawBlock(ctx, b, t) {
    const def = BLOCK_TYPES[b.type];
    if (!def) return;
    t = t == null ? performance.now() / 1000 : t;
    const base = b.color || def.color;
    ctx.save();
    if (b.solid === false) ctx.globalAlpha = 0.45;
    if (def.anim) {
      ctx.translate(b.x, b.y);
      ST[def.style](ctx, b.w, b.h, base, t, def);
    } else {
      ctx.drawImage(getSprite(b, def, base), b.x, b.y, b.w, b.h);
    }
    ctx.restore();
  }
  export { drawBlock };

  // ---- Hintergrund (einmal vorgerendert) ----
  let bgCanvas = null;
  function pine(x, y, s, c1, c2) {
    return (ctx) => {
      ctx.fillStyle = '#5b4030';
      ctx.fillRect(x - s * 0.07, y - s * 0.2, s * 0.14, s * 0.2);
      for (let k = 0; k < 3; k++) {
        const w = s * (0.5 - k * 0.1), top = y - s * (0.45 + k * 0.3), bot = y - s * (0.12 + k * 0.28);
        ctx.fillStyle = grad(ctx, 0, 0, c1, c2, x - w, x + w);
        ctx.beginPath(); ctx.moveTo(x, top - s * 0.18); ctx.lineTo(x + w, bot); ctx.lineTo(x - w, bot); ctx.closePath(); ctx.fill();
      }
    };
  }
  function paintBg(ctx) {
    const W = C.W, H = C.H;
    ctx.fillStyle = grad(ctx, 0, H * 0.9, '#5ea9e6', '#d9eef2');
    ctx.fillRect(0, 0, W, H);
    // Sonne
    const sun = ctx.createRadialGradient(1050, 110, 10, 1050, 110, 220);
    sun.addColorStop(0, 'rgba(255,248,200,.95)'); sun.addColorStop(0.15, 'rgba(255,240,170,.6)'); sun.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff7cf'; ctx.beginPath(); ctx.arc(1050, 110, 34, 0, 7); ctx.fill();
    // Berge (zwei Lagen)
    const mountains = (peaks, base, shadeC, snow, baseY) => {
      for (const [px, ph, pw] of peaks) {
        const top = baseY - ph;
        ctx.fillStyle = base;
        ctx.beginPath(); ctx.moveTo(px - pw, baseY); ctx.lineTo(px - pw * 0.25, top + ph * 0.25); ctx.lineTo(px, top); ctx.lineTo(px + pw * 0.3, top + ph * 0.3); ctx.lineTo(px + pw, baseY); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shadeC;
        ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px + pw * 0.3, top + ph * 0.3); ctx.lineTo(px + pw, baseY); ctx.lineTo(px + pw * 0.1, baseY); ctx.lineTo(px - pw * 0.05, top + ph * 0.45); ctx.closePath(); ctx.fill();
        if (snow) {
          ctx.save();
          ctx.beginPath(); ctx.moveTo(px - pw, baseY); ctx.lineTo(px - pw * 0.25, top + ph * 0.25); ctx.lineTo(px, top); ctx.lineTo(px + pw * 0.3, top + ph * 0.3); ctx.lineTo(px + pw, baseY); ctx.closePath(); ctx.clip();
          ctx.fillStyle = 'rgba(255,255,255,.92)';
          ctx.beginPath(); ctx.moveTo(px - pw, top - 5);
          const sy = top + ph * 0.28;
          ctx.lineTo(px - pw * 0.45, sy); ctx.lineTo(px - pw * 0.28, sy - 12); ctx.lineTo(px - pw * 0.12, sy + 10); ctx.lineTo(px + pw * 0.05, sy - 6); ctx.lineTo(px + pw * 0.2, sy + 12); ctx.lineTo(px + pw * 0.45, sy - 2); ctx.lineTo(px + pw, top - 5);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
    };
    mountains([[160, 230, 220], [480, 290, 260], [800, 250, 240], [1130, 310, 270], [1280, 200, 180]], '#8fa9c6', '#7893b2', true, 520);
    mountains([[40, 170, 190], [330, 140, 200], [650, 180, 220], [970, 150, 210], [1230, 175, 200]], '#7f9fb5', '#6d8ca3', false, 540);
    // Hügel mit Bäumen
    const hill = (y0, amp, f, ph, c0, c1) => {
      ctx.fillStyle = grad(ctx, y0 - amp, H, c0, c1);
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 10) ctx.lineTo(x, y0 - Math.sin(x / f + ph) * amp - Math.sin(x / (f * 0.37) + ph * 2) * amp * 0.25);
      ctx.lineTo(W, H); ctx.fill();
    };
    hill(500, 30, 170, 0.5, '#8cc58a', '#5f9a6a');
    for (let i = 0; i < 14; i++) {
      const x = 30 + i * 95 + hash(i, 1) * 40, y = 508 + hash(i, 2) * 14;
      pine(x, y, 56 + hash(i, 3) * 22, '#4c9560', '#2f6e47')(ctx);
    }    hill(540, 22, 120, 2.1, '#6fb36d', '#3f7d4d');
    for (let i = 0; i < 9; i++) {
      const x = 60 + i * 150 + hash(i, 5) * 60, y = 552;
      pine(x, y, 70 + hash(i, 6) * 25, '#3f8a52', '#245c3a')(ctx);
    }
    // Abgrund unten
    ctx.fillStyle = grad(ctx, H - 80, H, 'rgba(10,20,40,0)', 'rgba(10,20,40,.75)');
    ctx.fillRect(0, H - 80, W, 80);
  }
  const CLOUDS = [[100, 70, 1.1, 5], [420, 130, 0.8, 8], [760, 50, 1.3, 4], [1040, 170, 0.9, 7], [250, 210, 0.7, 6]];
  function drawCloud(ctx, x, y, s) {
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.ellipse(x + 30 * s, y + 24 * s, 52 * s, 9 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.94)';
    ctx.beginPath();
    ctx.arc(x, y + 10 * s, 18 * s, 0, 7);
    ctx.arc(x + 24 * s, y, 24 * s, 0, 7);
    ctx.arc(x + 52 * s, y + 8 * s, 20 * s, 0, 7);
    ctx.rect(x, y + 10 * s, 52 * s, 18 * s);
    ctx.fill();
  }
  function drawBackground(ctx, t) {
    if (!bgCanvas) {
      bgCanvas = document.createElement('canvas');
      bgCanvas.width = C.W * S; bgCanvas.height = C.H * S;
      const c = bgCanvas.getContext('2d');
      c.scale(S, S);
      paintBg(c);
    }
    ctx.drawImage(bgCanvas, 0, 0, C.W, C.H);
    for (const [x, y, s, sp] of CLOUDS) drawCloud(ctx, ((x + t * sp) % (C.W + 240)) - 120, y, s);
  }

  // ---- Start / Ziel ----
  function drawStart(ctx, s, t) {
    ctx.save();
    // Spawn-Platte
    ctx.fillStyle = 'rgba(70,200,110,.22)';
    rr(ctx, s.x, s.y + s.h - 6, s.w, 6, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(46,157,79,.9)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
    ctx.setLineDash([]);
    // Fahne
    const px = s.x + 6, py = s.y - 8;
    ctx.fillStyle = '#6b4b2e'; ctx.fillRect(px, py, 3, s.h + 8);
    ctx.fillStyle = '#e6c15a'; ctx.beginPath(); ctx.arc(px + 1.5, py, 3, 0, 7); ctx.fill();
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath(); ctx.moveTo(px + 3, py + 2);
    for (let i = 0; i <= 10; i++) ctx.lineTo(px + 3 + i * 2.4, py + 2 + i * 0.6 + Math.sin(t * 5 + i * 0.7) * 2);
    for (let i = 10; i >= 0; i--) ctx.lineTo(px + 3 + i * 2.4, py + 15 - i * 0.6 + Math.sin(t * 5 + i * 0.7) * 2);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawGoal(ctx, g, t) {
    ctx.save();
    const { x, y, w, h } = g;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.5);
    const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 5, x + w / 2, y + h / 2, 60);
    glow.addColorStop(0, 'rgba(255,220,100,' + (0.35 + pulse * 0.2) + ')'); glow.addColorStop(1, 'rgba(255,220,100,0)');
    ctx.fillStyle = glow; ctx.fillRect(x - 60, y - 40, w + 120, h + 90);
    // Turm
    ctx.fillStyle = grad(ctx, y, y + h, '#f1a88c', '#d57a5e', x, x + w);
    ctx.fillRect(x, y + 10, w, h - 10);
    ctx.fillStyle = '#c96e53';
    for (let k = 0; k < 3; k++) ctx.fillRect(x + k * (w / 3) + 1, y, w / 3 - 3, 12);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x + 2, y + 12, 4, h - 14);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) ctx.fillRect(x + 4 + c * 18 + (r % 2) * 6, y + 16 + r * 12, 12, 1.5);
    // Fenster + Tor
    ctx.fillStyle = '#2d3b5e'; ctx.fillRect(x + w - 14, y + 20, 4, 10);
    ctx.beginPath(); ctx.moveTo(x + w / 2 - 10, y + h); ctx.lineTo(x + w / 2 - 10, y + h - 16); ctx.arc(x + w / 2, y + h - 16, 10, Math.PI, 0); ctx.lineTo(x + w / 2 + 10, y + h); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,90,' + (0.35 + pulse * 0.3) + ')';
    ctx.beginPath(); ctx.arc(x + w / 2, y + h - 14, 5, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(40,15,10,.75)'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 11, w - 2, h - 12);
    // Fahne
    ctx.fillStyle = '#5a3d25'; ctx.fillRect(x + w / 2 - 1, y - 24, 2.5, 26);
    ctx.fillStyle = '#e53935';
    ctx.beginPath(); ctx.moveTo(x + w / 2 + 1.5, y - 24);
    for (let i = 0; i <= 8; i++) ctx.lineTo(x + w / 2 + 1.5 + i * 2.4, y - 24 + i * 0.5 + Math.sin(t * 6 + i * 0.8) * 1.8);
    for (let i = 8; i >= 0; i--) ctx.lineTo(x + w / 2 + 1.5 + i * 2.4, y - 12 - i * 0.5 + Math.sin(t * 6 + i * 0.8) * 1.8);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---- Agent ----
  function drawAgent(ctx, a, color, isBest, tick, t) {
    ctx.save();
    if (a.onGround) {
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.beginPath(); ctx.ellipse(a.x + a.w / 2, a.y + a.h + 0.5, 8, 2.4, 0, 0, 7); ctx.fill();
    }
    ctx.translate(a.x + a.w / 2, a.y);
    ctx.scale(a.facing, 1);
    ctx.translate(-9, 0);
    const moving = a.onGround && Math.abs(a.vx) > 0.3;
    const sw = moving ? Math.sin(tick * 0.45 + a.x * 0.03) * 3.2 : 0;
    const air = !a.onGround;
    const dark = shade(color, -0.4);
    const outline = isBest ? '#ffc400' : 'rgba(25,15,10,.85)';
    ctx.lineWidth = isBest ? 2 : 1.3;
    ctx.lineJoin = 'round';
    // hinterer Arm
    ctx.save(); ctx.translate(9, 15); ctx.rotate(air ? (a.vy < 0 ? -2.6 : -1.6) : -sw * 0.18);
    ctx.fillStyle = '#d9a46c'; rr(ctx, -1.5, -1, 3, 7.5, 1.5); ctx.fill(); ctx.restore();
    // Beine + Schuhe
    const leg = (dx, lift) => {
      ctx.fillStyle = '#463a52'; ctx.fillRect(dx, a.h - 9 - lift, 4, 6);
      ctx.fillStyle = '#f2f2f2'; rr(ctx, dx - 0.5, a.h - 3.5 - lift, 5.5, 3.5, 1.5); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.stroke();
    };
    if (air) { leg(4, a.vy < 0 ? 2 : 0); leg(10, a.vy < 0 ? 0 : 2); }
    else { leg(4 + sw, sw > 0 ? 1 : 0); leg(10 - sw, sw < 0 ? 1 : 0); }
    // Körper
    ctx.fillStyle = grad(ctx, 12, 23, color, dark);
    rr(ctx, 2, 12, 14, 12, 4); ctx.fill();
    ctx.lineWidth = isBest ? 2 : 1.3; ctx.strokeStyle = outline; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; rr(ctx, 4, 13.5, 4, 2, 1); ctx.fill();
    // Kopf
    ctx.fillStyle = grad(ctx, 1, 15, '#ffd9a8', '#e7ae75');
    ctx.beginPath(); ctx.arc(9, 8, 7.4, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5d3d25';
    ctx.beginPath(); ctx.arc(9, 7.2, 7.5, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(15, 5.6); ctx.lineTo(10, 3.8); ctx.lineTo(4, 5.6); ctx.closePath(); ctx.fill();
    // Auge
    const blink = ((t * 1000 + a.x * 9) % 3000) < 110;
    if (blink) { ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10.5, 8.5); ctx.lineTo(14, 8.5); ctx.stroke(); }
    else {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(12.3, 8.5, 2.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(12.9, 8.6, 1.1, 0, 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,120,120,.45)'; ctx.beginPath(); ctx.arc(14, 11, 1.6, 0, 7); ctx.fill();
    // vorderer Arm
    ctx.save(); ctx.translate(9, 15); ctx.rotate(air ? (a.vy < 0 ? -2.9 : -1.2) : sw * 0.18);
    ctx.fillStyle = '#e7ae75'; rr(ctx, -1.5, -1, 3, 7.5, 1.5); ctx.fill(); ctx.restore();
    // Krone für den Besten
    if (isBest) {
      ctx.fillStyle = '#ffc400'; ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(4, 0.5); ctx.lineTo(4.5, -5); ctx.lineTo(7, -2); ctx.lineTo(9, -6); ctx.lineTo(11, -2); ctx.lineTo(13.5, -5); ctx.lineTo(14, 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  // ---- Partikel (nur Optik, beeinflusst die Simulation nicht) ----
  const fx = [];
  export const spawnBurst = function (x, y, colors, n, power) {
    if (fx.length > 600) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.5 + Math.random()) * (power || 3);
      fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, life: 0, max: 30 + Math.random() * 25, c: colors[i % colors.length], r: 1.5 + Math.random() * 2.2 });
    }
  };
  export function clearFx() { fx.length = 0; }
  function updateFx(f) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const p = fx[i];
      p.life += f;
      p.vy += 0.25 * f;
      p.x += p.vx * f;
      p.y += p.vy * f;
      if (p.life >= p.max) fx.splice(i, 1);
    }
  }
  function drawFx(ctx) {
    for (const p of fx) {
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSensorRays(ctx, agent) {
    if (!agent.rays || !agent.rays.length) return;
    ctx.save();
    ctx.lineWidth = 1.35;
    ctx.setLineDash([5, 4]);
    for (const ray of agent.rays) {
      ctx.strokeStyle = ray.kind === 'deadly' ? 'rgba(255,75,75,.88)' : ray.kind === 'solid' ? 'rgba(70,190,255,.78)' : 'rgba(220,230,245,.38)';
      ctx.beginPath(); ctx.moveTo(ray.x1, ray.y1); ctx.lineTo(ray.x2, ray.y2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ray.kind === 'deadly' ? '#ff5b5b' : ray.kind === 'solid' ? '#55c7ff' : 'rgba(230,240,255,.65)';
      ctx.beginPath(); ctx.arc(ray.x2, ray.y2, ray.kind === 'none' ? 2 : 3, 0, Math.PI * 2); ctx.fill();
      ctx.setLineDash([5, 4]);
    }
    ctx.restore();
  }

  // view = { level, agents, tick, colors[], bestIndex, showSensors }
  let lastRender = 0;
  export const render = function (ctx, view) {
    const now = performance.now();
    const t = now / 1000;
    const f = lastRender ? Math.min(3, (now - lastRender) / 16.667) : 1;
    lastRender = now;
    drawBackground(ctx, t);
    const lvl = view.level;
    for (let i = 0; i < lvl.blocks.length; i++) drawBlock(ctx, lvl.blocks[i], t);
    if (lvl.goal) drawGoal(ctx, lvl.goal, t);
    if (lvl.start) drawStart(ctx, lvl.start, t);
    const ags = view.agents || [];
    for (let i = 0; i < ags.length; i++) {
      if (i === view.bestIndex) continue;
      const a = ags[i];
      if (a.alive || a.finished) drawAgent(ctx, a, view.colors[i], false, view.tick, t);
    }
    const bi = view.bestIndex;
    if (bi >= 0 && ags[bi] && view.showSensors !== false) drawSensorRays(ctx, ags[bi]);
    if (bi >= 0 && ags[bi] && (ags[bi].alive || ags[bi].finished)) drawAgent(ctx, ags[bi], view.colors[bi], true, view.tick, t);
    updateFx(f);
    drawFx(ctx);
  };

export { overlap, shade };
