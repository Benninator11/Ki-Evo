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
  export const BLOCK_TYPE_KEYS = Object.keys(BLOCK_TYPES);
  const BLOCK_TYPE_INDEX = Object.fromEntries(BLOCK_TYPE_KEYS.map((key, index) => [key, index]));
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
      detectedBlock: null,
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
    let bestBlock = null;

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
        bestBlock = block;
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
      ray: { name: config.name, x1: ox, y1: oy, x2: ox + dx * bestDistance, y2: oy + dy * bestDistance, kind: bestKind, blockType: bestBlock ? bestBlock.type : null, blockLabel: bestBlock && BLOCK_TYPES[bestBlock.type] ? BLOCK_TYPES[bestBlock.type].label : null, distance: bestDistance, length: config.length },
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

    // Semantische Sicht: exakten Blocktyp vor dem Agenten als One-hot-Vektor
    // plus normierte Entfernung an das neuronale Netz weitergeben.
    const forwardRayIndices = [0, 1, 2, 11];
    let nearestForward = null;
    for (const rayIndex of forwardRayIndices) {
      const ray = a.rays[rayIndex];
      if (!ray || ray.kind === 'none' || !ray.blockType) continue;
      if (!nearestForward || ray.distance < nearestForward.distance) nearestForward = ray;
    }
    for (let i = 0; i < BLOCK_TYPE_KEYS.length; i++) out[28 + i] = 0;
    if (nearestForward) {
      const typeIndex = BLOCK_TYPE_INDEX[nearestForward.blockType];
      if (typeIndex !== undefined) out[28 + typeIndex] = 1;
      out[28 + BLOCK_TYPE_KEYS.length] = Math.max(0, Math.min(1, 1 - nearestForward.distance / nearestForward.length));
      a.detectedBlock = { type: nearestForward.blockType, label: nearestForward.blockLabel, distance: nearestForward.distance };
    } else {
      out[28 + BLOCK_TYPE_KEYS.length] = 0;
      a.detectedBlock = null;
    }
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
    ctx.fillStyle = grad(ctx, 0, h, shade(base, 0.14), shade(base, -0.48));
    ctx.fillRect(0, 0, w, h);
    const top = Math.min(9, h);
    ctx.fillStyle = '#315f38';
    ctx.fillRect(0, 0, w, top + 2);
    ctx.fillStyle = '#65b94c';
    ctx.fillRect(0, 0, w, Math.min(4, h));
    ctx.fillStyle = '#8bd85e';
    ctx.fillRect(0, 1, w, Math.min(1.5, h));
    for (let x = 0; x < w; x += 7) {
      const blade = 2 + hash(x, 17) * 5;
      ctx.strokeStyle = hash(x, 18) > 0.45 ? '#377f3c' : '#a1df62';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 2, top + 1);
      ctx.lineTo(x + 1 + hash(x, 19) * 4, top - blade);
      ctx.stroke();
    }
    // Mehrere Erdschichten statt einer glatten braunen Fläche.
    ctx.fillStyle = 'rgba(45,29,22,.22)';
    ctx.fillRect(0, Math.min(12, h), w, Math.max(0, h - 12));
    for (let layer = 0; layer < 3; layer++) {
      const y = Math.min(h - 2, 17 + layer * 12);
      if (y <= top || y >= h) continue;
      ctx.strokeStyle = ['rgba(225,177,112,.34)','rgba(71,44,30,.34)','rgba(227,194,139,.16)'][layer];
      ctx.lineWidth = layer === 0 ? 2 : 1;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 5) {
        const yy = y + Math.sin(x / 19 + layer * 2) * 1.6 + (hash(Math.floor(x / 5), layer) - .5) * 1.5;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    for (let i = 0; i < (w * h) / 240; i++) {
      const x = hash(i, 1) * w, y = top + 5 + hash(i, 2) * Math.max(1, h - top - 5);
      const r = 1 + hash(i, 4) * 2.5;
      ctx.fillStyle = hash(i, 3) > .5 ? 'rgba(35,27,23,.25)' : 'rgba(238,190,131,.27)';
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.4, r * .65, hash(i, 5), 0, Math.PI * 2); ctx.fill();
    }
    // Kleine Wurzeln in der freigelegten Erdwand.
    if (h > 34) {
      ctx.strokeStyle = 'rgba(37,71,34,.55)';
      ctx.lineWidth = 1;
      for (let x = 12; x < w; x += 31) {
        ctx.beginPath();
        ctx.moveTo(x, top + 1);
        ctx.quadraticCurveTo(x + 5, top + 9, x - 2 + hash(x, 9) * 5, Math.min(h - 3, top + 18));
        ctx.stroke();
      }
    }
    bevel(ctx, w, h, 'rgba(255,255,255,.24)', 'rgba(0,0,0,.34)', Math.min(3, h / 5));
  };

    ST.stone = (ctx, w, h, base) => {
    ctx.fillStyle = shade(base, -.55); ctx.fillRect(0, 0, w, h);
    tiles(w, h, 40, (x, y, tw, th, i, j) => {
      ctx.save(); ctx.translate(x, y);
      const v = hash(i, j);
      rr(ctx, 1.5, 1.5, tw - 3, th - 3, 3);
      ctx.fillStyle = grad(ctx, 0, 0, shade(base, .18 + v * .08), shade(base, -.22 - v * .08)); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1; ctx.stroke();
      // Faceted rock planes and layered mineral grain.
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(3,3); ctx.lineTo(tw*.55,3); ctx.lineTo(tw*.34,th*.48); ctx.lineTo(3,th*.68); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.13)'; ctx.beginPath(); ctx.moveTo(tw-3,3); ctx.lineTo(tw-3,th-3); ctx.lineTo(tw*.48,th-3); ctx.lineTo(tw*.68,th*.54); ctx.closePath(); ctx.fill();
      for(let k=0;k<13;k++){const px=4+hash(i*13+k,j)*Math.max(1,tw-8),py=4+hash(j*17+k,i)*Math.max(1,th-8);ctx.fillStyle=k%2?'rgba(255,255,255,.2)':'rgba(0,0,0,.18)';ctx.beginPath();ctx.arc(px,py,.5+hash(k,i)*1.2,0,Math.PI*2);ctx.fill();}
      if(v>.55){ctx.strokeStyle='rgba(25,20,22,.38)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(tw*.28,3);ctx.lineTo(tw*.42,th*.36);ctx.lineTo(tw*.34,th*.58);ctx.lineTo(tw*.62,th-3);ctx.stroke();}
      ctx.restore();
    });
    bevel(ctx,w,h,'rgba(255,255,255,.35)','rgba(0,0,0,.42)',3);
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
    const plank = 20;
    for(let x=0,i=0;x<w;x+=plank,i++){
      ctx.fillStyle=grad(ctx,0,h,shade(base,.16+hash(i,1)*.06),shade(base,-.22-hash(i,2)*.05));
      ctx.fillRect(x+1,0,Math.min(plank-2,w-x-1),h);
      ctx.strokeStyle='rgba(255,224,167,.22)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+2,2);ctx.lineTo(x+2,h-2);ctx.stroke();
      ctx.strokeStyle='rgba(45,22,9,.3)';
      for(let k=0;k<3;k++){const yy=5+hash(i,k+5)*Math.max(1,h-10);ctx.beginPath();ctx.moveTo(x+5,yy);ctx.bezierCurveTo(x+10,yy-3,x+13,yy+3,x+plank-5,yy);ctx.stroke();}
      if(h>18){ctx.strokeStyle='rgba(70,35,15,.5)';ctx.beginPath();ctx.ellipse(x+plank/2,h*.5,3,1.7,0,0,Math.PI*2);ctx.stroke();}
    }
    // Metal nails at each plank end.
    for(let x=8;x<w;x+=plank){for(const y of [5,h-5]){ctx.fillStyle='#60452f';ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,225,177,.8)';ctx.fillRect(x-1,y-1,.9,.9);}}
    bevel(ctx,w,h,'rgba(255,231,184,.38)','rgba(0,0,0,.4)',3);
  };

    ST.sand = (ctx, w, h, base) => {
    ctx.fillStyle = grad(ctx, 0, h, shade(base, 0.18), shade(base, -0.28));
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,247,209,.42)';
    ctx.fillRect(0, 0, w, Math.min(3, h));
    ctx.save(); clipRect(ctx, w, h);
    // Windgeformte Sandrippen mit wechselnder Helligkeit.
    for (let y = 9; y < h; y += 9) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const yy = y + Math.sin(x / (13 + y * .15) + y * .4) * 2;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.strokeStyle = y % 18 ? 'rgba(126,83,40,.20)' : 'rgba(255,243,190,.38)';
      ctx.lineWidth = y % 18 ? 1 : 2;
      ctx.stroke();
    }
    for (let i = 0; i < (w * h) / 45; i++) {
      const x = hash(i, 3) * w, y = hash(i, 4) * h;
      ctx.fillStyle = hash(i, 2) > .5 ? 'rgba(255,255,255,.42)' : 'rgba(113,76,33,.24)';
      ctx.fillRect(x, y, .8 + hash(i, 6) * 1.2, .8 + hash(i, 7) * 1.2);
    }
    for (let i = 0; i < w / 55; i++) {
      const x = 8 + hash(i, 11) * Math.max(1, w - 16), y = h * (.35 + hash(i, 12) * .45);
      ctx.fillStyle = 'rgba(125,91,53,.28)';
      ctx.beginPath(); ctx.ellipse(x, y, 3 + hash(i, 13) * 3, 1.2, -.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    bevel(ctx, w, h, 'rgba(255,255,255,.38)', 'rgba(92,60,28,.35)', 2);
  };

    ST.snow = (ctx, w, h, base) => {
    ctx.fillStyle = grad(ctx, 0, h, '#e8f7ff', '#7296bb');
    ctx.fillRect(0, 0, w, h);
    ctx.save(); clipRect(ctx, w, h);
    // Eisschichten unter der Schneekappe.
    for (let y = 14; y < h; y += 11) {
      ctx.strokeStyle = y % 22 ? 'rgba(46,105,151,.17)' : 'rgba(255,255,255,.42)';
      ctx.lineWidth = y % 22 ? 1 : 2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 5) {
        const yy = y + Math.sin(x / 17 + y) * 1.8;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    for (let i = 0; i < w / 7; i++) {
      const x = hash(i, 8) * w, y = 16 + hash(i, 9) * Math.max(1, h - 18);
      ctx.fillStyle = 'rgba(255,255,255,.68)';
      ctx.beginPath(); ctx.arc(x, y, .7 + hash(i, 10) * 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    const cap = Math.min(12, h);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, Math.max(2, cap - 3));
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.fillRect(0, 0, w, Math.min(3, h));
    for (let x = 0; x < w; x += 12) {
      ctx.fillStyle = hash(x, 3) > .5 ? '#f9fdff' : '#cce8f8';
      ctx.beginPath();
      ctx.arc(x + 5, cap - 3, 4 + hash(x, 4) * 3, 0, Math.PI);
      ctx.fill();
    }
    bevel(ctx, w, h, 'rgba(255,255,255,.72)', 'rgba(40,80,130,.38)', 2);
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
    ctx.fillStyle = grad(ctx, 0, h, shade(base, .22), shade(base, -.35));
    ctx.fillRect(0, 0, w, h);
    tiles(w, h, 40, (x, y, tw, th, i, j) => {
      ctx.save(); ctx.translate(x, y);
      rr(ctx, 2, 2, tw - 4, th - 4, 3);
      ctx.fillStyle = grad(ctx, 0, th, shade(base, .18), shade(base, -.25));
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 1;
      ctx.stroke();
      // Geprägte Diagonalrippen und zentrale Wartungslinie.
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(6, th - 7); ctx.lineTo(tw - 7, 6); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(6, th - 4); ctx.lineTo(tw - 5, 7); ctx.stroke();
      for (const [nx, ny] of [[7,7],[tw-7,7],[7,th-7],[tw-7,th-7]]) {
        ctx.fillStyle = '#4c5968'; ctx.beginPath(); ctx.arc(nx, ny, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = .7;
        ctx.beginPath(); ctx.moveTo(nx - 1, ny); ctx.lineTo(nx + 1, ny); ctx.stroke();
      }
      if (tw > 26 && th > 26) {
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        rr(ctx, tw * .35, th * .35, tw * .3, th * .3, 2); ctx.fill();
      }
      ctx.restore();
    });
    bevel(ctx, w, h, 'rgba(255,255,255,.48)', 'rgba(0,0,0,.42)', 2.5);
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
    ctx.fillStyle=grad(ctx,0,h,shade(base,.32),shade(base,-.4));ctx.fillRect(0,0,w,h);
    tiles(w,h,40,(x,y,tw,th,i,j)=>{
      const cx=x+tw/2,cy=y+th/2;
      // Large cut facets, inner prism and sharp glints.
      const facets=[
        [[x+2,y+2],[cx,y+3],[cx-3,cy],[x+3,y+th-3]],
        [[cx,y+3],[x+tw-2,y+2],[x+tw-3,y+th-3],[cx+2,cy]],
        [[x+3,y+th-3],[cx-3,cy],[cx+2,cy],[x+tw-3,y+th-3]]
      ];
      facets.forEach((p,k)=>{ctx.fillStyle=['rgba(255,255,255,.34)','rgba(255,255,255,.12)','rgba(5,15,65,.24)'][k];ctx.beginPath();ctx.moveTo(...p[0]);p.slice(1).forEach(q=>ctx.lineTo(...q));ctx.closePath();ctx.fill();});
      ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x+4,y+4);ctx.lineTo(cx,y+5);ctx.lineTo(x+tw-5,y+4);ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,.3)';ctx.beginPath();ctx.moveTo(cx, y+6);ctx.lineTo(cx+2,th-5);ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.75)';ctx.beginPath();ctx.arc(x+tw*.28,y+th*.25,1.4,0,Math.PI*2);ctx.fill();
    });
    bevel(ctx,w,h,'rgba(255,255,255,.72)','rgba(0,0,60,.48)',3);
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
    const glow = ctx.createRadialGradient(w*.5,h*.78,1,w*.5,h*.78,Math.max(w,h)*.95);
    glow.addColorStop(0,'rgba(255,177,37,.52)');
    glow.addColorStop(.48,'rgba(255,72,14,.22)');
    glow.addColorStop(1,'rgba(255,35,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(-w*.18,-h*.25,w*1.36,h*1.3);
    for (let i = 0; i < Math.max(3, Math.ceil(w/10)); i++) {
      const x = (i + .5) * w / Math.max(3, Math.ceil(w/10));
      const flicker = Math.sin(t*10 + i*2.1) * 2.4 + Math.sin(t*6.3+i)*1.6;
      const height = h * (.46 + hash(i, 2) * .43) + flicker;
      ctx.fillStyle = i%2 ? '#ff4a13' : '#ff7418';
      ctx.beginPath();
      ctx.moveTo(x-w*.11,h);
      ctx.bezierCurveTo(x-w*.2,h-height*.25,x-w*.02,h-height*.78+flicker,x+Math.sin(t*8+i)*2,h-height);
      ctx.bezierCurveTo(x+w*.14,h-height*.65,x+w*.2,h-height*.24,x+w*.11,h);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd34c';
      ctx.beginPath();
      ctx.moveTo(x-w*.055,h);
      ctx.quadraticCurveTo(x-w*.07,h-height*.35,x+Math.sin(t*9+i)*1.5,h-height*.62);
      ctx.quadraticCurveTo(x+w*.08,h-height*.34,x+w*.055,h);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,220,.72)';
      ctx.beginPath(); ctx.ellipse(x+Math.sin(t*7+i)*1.2,h-2,1.3,1.8,0,0,Math.PI*2); ctx.fill();
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


  // ---- Hochwertige Material-Details für sämtliche Blocktypen ----
  // Diese Ebene ergänzt die vorhandenen Grundtexturen, ohne die Geometrie
  // oder die Kollisionsdaten der Blöcke zu verändern.
  function drawMaterialDetails(ctx, w, h, style, base, t) {
    ctx.save();
    clipRect(ctx, w, h);
    const speckle = (count, light, dark, size) => {
      for (let i = 0; i < count; i++) {
        const x = hash(i + style.length * 7, 31) * w;
        const y = hash(i + style.length * 11, 47) * h;
        ctx.fillStyle = hash(i, 53) > .5 ? light : dark;
        const r = size * (.45 + hash(i, 59));
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    };
    switch (style) {
      case 'ground':
        speckle(Math.max(8, w * h / 90), 'rgba(245,202,146,.30)', 'rgba(35,24,18,.24)', 1.3);
        ctx.strokeStyle = 'rgba(36,25,20,.24)'; ctx.lineWidth = 1;
        for (let x = 9; x < w; x += 31) {
          ctx.beginPath(); ctx.moveTo(x, h * .42); ctx.lineTo(x + 4, h * .56); ctx.lineTo(x - 2, h * .7); ctx.stroke();
        }
        break;
      case 'stone':
        ctx.strokeStyle = 'rgba(235,244,255,.22)'; ctx.lineWidth = 1;
        for (let i = 0; i < Math.max(1, Math.floor(w / 45)); i++) {
          const x = 5 + hash(i, 65) * Math.max(1, w - 10), y = 4 + hash(i, 66) * Math.max(1, h - 8);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 5); ctx.lineTo(x + 1, y + 10); ctx.lineTo(x + 8, y + 16); ctx.stroke();
        }
        speckle(Math.max(5, w * h / 150), 'rgba(255,255,255,.14)', 'rgba(0,0,0,.12)', .9);
        break;
      case 'brick':
        ctx.strokeStyle = 'rgba(255,226,207,.26)'; ctx.lineWidth = .8;
        for (let y = 20; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
        break;
      case 'wood':
      case 'plank':
      case 'bridge':
        ctx.strokeStyle = 'rgba(255,224,174,.25)'; ctx.lineWidth = .8;
        for (let y = 7; y < h; y += 11) {
          ctx.beginPath();
          for (let x = 0; x <= w; x += 5) {
            const yy = y + Math.sin(x / 10 + y) * 1.1;
            if (!x) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
          }
          ctx.stroke();
        }
        if (w > 25 && h > 18) {
          ctx.strokeStyle = 'rgba(67,35,17,.45)';
          ctx.beginPath(); ctx.ellipse(w * .68, h * .55, 4, 2, -.2, 0, Math.PI * 2); ctx.stroke();
        }
        break;
      case 'sand':
        speckle(Math.max(14, w * h / 28), 'rgba(255,248,211,.55)', 'rgba(125,82,39,.22)', .65);
        ctx.strokeStyle = 'rgba(255,249,213,.26)'; ctx.lineWidth = 1;
        for (let y = 8; y < h; y += 12) {
          ctx.beginPath(); ctx.moveTo(0,y); ctx.quadraticCurveTo(w*.45,y-2,w,y+1); ctx.stroke();
        }
        break;
      case 'snow':
      case 'ice':
        ctx.strokeStyle = 'rgba(255,255,255,.58)'; ctx.lineWidth = .85;
        for (let i = 0; i < Math.max(2, w / 25); i++) {
          const x = 5 + hash(i, 71) * Math.max(1, w - 10), y = 5 + hash(i, 72) * Math.max(1, h - 10);
          ctx.beginPath(); ctx.moveTo(x-3,y); ctx.lineTo(x+3,y); ctx.moveTo(x,y-3); ctx.lineTo(x,y+3); ctx.stroke();
        }
        break;
      case 'moss':
        speckle(Math.max(8, w * h / 75), 'rgba(166,226,103,.5)', 'rgba(37,89,42,.35)', 1.8);
        ctx.strokeStyle = 'rgba(199,241,133,.45)'; ctx.lineWidth = 1;
        for (let x = 5; x < w; x += 15) {
          ctx.beginPath(); ctx.moveTo(x, 2); ctx.quadraticCurveTo(x-4, 7, x+2, 11); ctx.stroke();
        }
        break;
      case 'metal':
      case 'steel':
        ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = .7;
        for (let y = 7; y < h; y += 5) { ctx.beginPath(); ctx.moveTo(3,y); ctx.lineTo(w-3,y); ctx.stroke(); }
        for (const [x,y] of [[5,5],[w-5,5],[5,h-5],[w-5,h-5]]) {
          ctx.fillStyle = '#39495a'; ctx.beginPath(); ctx.arc(x,y,2.2,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(x-1,y); ctx.lineTo(x+1,y); ctx.stroke();
        }
        break;
      case 'gold':
        speckle(Math.max(4, w * h / 230), 'rgba(255,255,220,.75)', 'rgba(153,91,0,.18)', 1.5);
        break;
      case 'crystal':
      case 'obsidian':
        ctx.strokeStyle = style === 'crystal' ? 'rgba(255,255,255,.38)' : 'rgba(212,139,255,.4)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(2,h*.28); ctx.lineTo(w*.42,h*.48); ctx.lineTo(w-3,h*.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(w*.18,h-2); ctx.lineTo(w*.52,h*.52); ctx.lineTo(w*.82,h-2); ctx.stroke();
        break;
      case 'candy':
        for (let i = 0; i < Math.max(5, w / 5); i++) {
          const x = hash(i, 81) * w, y = hash(i, 82) * h;
          ctx.save(); ctx.translate(x,y); ctx.rotate(hash(i,83)*Math.PI);
          ctx.fillStyle = ['#fff3a6','#b8f4ff','#ffffff','#9dffb5'][i % 4];
          rr(ctx,-2,-.7,4,1.4,.7); ctx.fill(); ctx.restore();
        }
        break;
      case 'mud':
      case 'slime':
        ctx.fillStyle = 'rgba(255,255,255,.22)';
        for (let i = 0; i < Math.max(2, w / 25); i++) {
          const x = 5 + hash(i, 91) * Math.max(1,w-10), y = h*.3 + hash(i,92)*h*.55;
          ctx.beginPath(); ctx.ellipse(x,y,2.5,1.2,-.3,0,Math.PI*2); ctx.fill();
        }
        break;
      case 'bounce':
        ctx.strokeStyle = 'rgba(255,255,255,.38)'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(4,h*.22); ctx.lineTo(w-4,h*.22); ctx.stroke();
        speckle(Math.max(3,w/12),'rgba(255,255,255,.6)','rgba(0,0,0,.2)',.8);
        break;
      case 'conveyor':
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        for (let x = 7; x < w; x += 24) { ctx.beginPath(); ctx.arc(x,h/2,1.3,0,Math.PI*2); ctx.fill(); }
        break;
      case 'cloud':
        ctx.strokeStyle = 'rgba(255,255,255,.48)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          const x = w * (.2 + i * .28), y = h * (.65 + .08 * Math.sin(i));
          ctx.beginPath(); ctx.moveTo(x-9,y); ctx.quadraticCurveTo(x,y-4,x+9,y); ctx.stroke();
        }
        break;
      case 'spike':
      case 'spikeDown':
        ctx.strokeStyle = 'rgba(255,255,255,.68)'; ctx.lineWidth = 1.2;
        for (let x = 10; x < w; x += 20) {
          ctx.beginPath();
          if (style === 'spike') { ctx.moveTo(x-3,h-5); ctx.lineTo(x,h*.35); }
          else { ctx.moveTo(x-3,5); ctx.lineTo(x,h*.65); }
          ctx.stroke();
        }
        break;
      case 'thorns':
        ctx.strokeStyle = 'rgba(198,255,155,.6)'; ctx.lineWidth = 1;
        for (let x = 7; x < w; x += 12) {
          ctx.beginPath(); ctx.moveTo(x,h*.48); ctx.lineTo(x+2,h*.22); ctx.moveTo(x,h*.48); ctx.lineTo(x-3,h*.68); ctx.stroke();
        }
        break;
      case 'lava':
        ctx.strokeStyle = 'rgba(255,248,154,.7)'; ctx.lineWidth = 1.3;
        for (let x = 8; x < w; x += 20) {
          const y = 7 + Math.sin(x*.2+t*2)*1.8;
          ctx.beginPath(); ctx.moveTo(x-4,y); ctx.quadraticCurveTo(x,y-2,x+5,y); ctx.stroke();
        }
        break;
      case 'water':
        ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.2;
        for (let x = 7; x < w; x += 22) {
          const y = 6 + Math.sin(x*.16+t*2.4)*2;
          ctx.beginPath(); ctx.moveTo(x-5,y); ctx.quadraticCurveTo(x,y-2,x+5,y); ctx.stroke();
        }
        break;
      case 'poison':
      case 'acid':
        ctx.fillStyle = 'rgba(235,255,175,.7)';
        for (let x = 9; x < w; x += 23) {
          const y = h*.45 + Math.sin(t*3+x)*2;
          ctx.beginPath(); ctx.arc(x,y,1.5,0,Math.PI*2); ctx.fill();
        }
        break;
      case 'saw':
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-w*.1,0); ctx.lineTo(w*.2,h*.2); ctx.stroke();
        break;
      case 'fire': {
        const glow = ctx.createRadialGradient(w*.5,h*.72,1,w*.5,h*.72,Math.max(w,h)*.8);
        glow.addColorStop(0,'rgba(255,190,40,.24)'); glow.addColorStop(1,'rgba(255,60,10,0)');
        ctx.fillStyle = glow; ctx.fillRect(0,0,w,h);
        break;
      }
      case 'electric':
        ctx.strokeStyle = 'rgba(255,255,255,.82)'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(w*.2,0); ctx.lineTo(w*.48,h*.35); ctx.lineTo(w*.35,h*.62); ctx.lineTo(w*.72,h); ctx.stroke();
        break;
      case 'laser':
        ctx.shadowColor = '#ff315b'; ctx.shadowBlur = 9;
        ctx.fillStyle = 'rgba(255,180,195,.45)'; ctx.fillRect(w*.42,0,w*.16,h);
        ctx.shadowBlur = 0;
        break;
      default:
        speckle(Math.max(3,w*h/300),'rgba(255,255,255,.12)','rgba(0,0,0,.12)',.8);
    }
    ctx.restore();
  }

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
    drawMaterialDetails(c, b.w, b.h, def.style, base, 0);
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

    // Einheitliches Finish für alle Bauteile: weicher Bodenschatten,
    // dezente Lichtkante und dunkle Materialkante – passend zum Level-Look.
    const rounded = ['spike','spikeDown','thorns','fire','electric','laser'].includes(def.style) ? 2 : 5;
    ctx.shadowColor = 'rgba(7, 13, 22, .38)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    if (def.anim) {
      ctx.translate(b.x, b.y);
      ST[def.style](ctx, b.w, b.h, base, t, def);
      drawMaterialDetails(ctx, b.w, b.h, def.style, base, t);
    } else {
      ctx.drawImage(getSprite(b, def, base), b.x, b.y, b.w, b.h);
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Glanzkante oben und feine Außenkontur lassen die Blöcke auch bei
    // kleinen Größen und in der Palette klarer und hochwertiger wirken.
    ctx.beginPath();
    if (typeof rr === 'function') rr(ctx, b.x + 0.75, b.y + 0.75, Math.max(0, b.w - 1.5), Math.max(0, b.h - 1.5), rounded);
    else ctx.rect(b.x + 0.75, b.y + 0.75, Math.max(0, b.w - 1.5), Math.max(0, b.h - 1.5));
    ctx.strokeStyle = 'rgba(8, 14, 24, .42)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (b.h >= 8 && b.w >= 8) {
      ctx.beginPath();
      ctx.moveTo(b.x + rounded, b.y + 1.5);
      ctx.lineTo(b.x + b.w - rounded, b.y + 1.5);
      ctx.strokeStyle = 'rgba(255,255,255,.34)';
      ctx.lineWidth = Math.min(2, Math.max(1, b.h / 18));
      ctx.stroke();
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
    // Tiefes Himmelblau oben, warmes Licht am Horizont.
    ctx.fillStyle = grad(ctx, 0, H, '#3c83bd', '#d8edf0');
    ctx.fillRect(0, 0, W, H);
    const skyGlow = ctx.createRadialGradient(1010, 90, 18, 1010, 90, 410);
    skyGlow.addColorStop(0, 'rgba(255,244,187,.75)');
    skyGlow.addColorStop(.25, 'rgba(255,231,167,.24)');
    skyGlow.addColorStop(1, 'rgba(255,231,167,0)');
    ctx.fillStyle = skyGlow; ctx.fillRect(560, 0, 720, 540);
    // Sun halo with a few faint atmospheric rays.
    ctx.save();
    ctx.translate(1030, 112);
    ctx.rotate(-.24);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = 'rgba(255,245,202,' + (0.018 + (i % 3) * .006) + ')';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-11 + i * 2.7, -270);
      ctx.lineTo(22 + i * 3, -270);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const sun = ctx.createRadialGradient(1030, 112, 4, 1030, 112, 86);
    sun.addColorStop(0, 'rgba(255,255,228,.98)');
    sun.addColorStop(.22, 'rgba(255,244,193,.85)');
    sun.addColorStop(.55, 'rgba(255,225,145,.28)');
    sun.addColorStop(1, 'rgba(255,225,145,0)');
    ctx.fillStyle = sun; ctx.fillRect(930, 12, 200, 200);
    ctx.fillStyle = '#fff8dc'; ctx.beginPath(); ctx.arc(1030, 112, 28, 0, Math.PI * 2); ctx.fill();

    // High, distant peaks with multiple rock facets and snow shelves.
    const mountain = (x, baseY, width, height, colorA, colorB, snow) => {
      const peakX = x + width * .48, peakY = baseY - height;
      ctx.fillStyle = colorA;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + width * .22, peakY + height * .42);
      ctx.lineTo(peakX, peakY);
      ctx.lineTo(x + width * .66, peakY + height * .34);
      ctx.lineTo(x + width, baseY);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = colorB;
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(x + width * .66, peakY + height * .34);
      ctx.lineTo(x + width, baseY);
      ctx.lineTo(x + width * .55, baseY);
      ctx.lineTo(x + width * .34, peakY + height * .47);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.13)';
      ctx.beginPath();
      ctx.moveTo(x + width * .22, peakY + height * .42);
      ctx.lineTo(peakX, peakY);
      ctx.lineTo(x + width * .34, peakY + height * .47);
      ctx.lineTo(x + width * .47, baseY);
      ctx.closePath(); ctx.fill();
      if (snow) {
        ctx.fillStyle = '#f7fbff';
        ctx.beginPath();
        ctx.moveTo(x + width * .22, peakY + height * .42);
        ctx.lineTo(peakX, peakY);
        ctx.lineTo(x + width * .66, peakY + height * .34);
        ctx.lineTo(x + width * .55, peakY + height * .31);
        ctx.lineTo(x + width * .43, peakY + height * .38);
        ctx.lineTo(x + width * .35, peakY + height * .27);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(191,220,239,.7)';
        ctx.beginPath();
        ctx.moveTo(peakX, peakY);
        ctx.lineTo(x + width * .66, peakY + height * .34);
        ctx.lineTo(x + width * .55, peakY + height * .31);
        ctx.lineTo(x + width * .47, peakY + height * .2);
        ctx.closePath(); ctx.fill();
      }
    };
    // Far ridges get a little haze to create depth.
    ctx.fillStyle = 'rgba(239,249,250,.28)';
    ctx.fillRect(0, 360, W, 120);
    [
      [-80,520,310,230], [190,530,350,290], [510,530,330,245],
      [800,530,360,305], [1080,540,300,245]
    ].forEach((p,i) => mountain(p[0],p[1],p[2],p[3],i%2?'#8eaac4':'#a4bad0',i%2?'#718eac':'#7d99b8',true));
    [
      [-140,550,270,150], [120,550,280,178], [395,552,310,160],
      [700,555,290,180], [990,552,340,170]
    ].forEach((p,i) => mountain(p[0],p[1],p[2],p[3],i%2?'#7298aa':'#81a7b4',i%2?'#587f92':'#608b9b',false));

    // Three rolling forest layers; silhouettes shrink with distance.
    const ridge = (y, amp, freq, phase, c0, c1) => {
      ctx.fillStyle = grad(ctx, y - amp, H, c0, c1);
      ctx.beginPath(); ctx.moveTo(0,H);
      for (let x = 0; x <= W; x += 8) {
        const yy = y - Math.sin(x / freq + phase) * amp - Math.sin(x / (freq * .42) + phase * 2) * amp * .22;
        ctx.lineTo(x, yy);
      }
      ctx.lineTo(W,H); ctx.closePath(); ctx.fill();
    };
    ridge(493,25,155,.6,'#9cc98f','#6da875');
    for (let i = 0; i < 24; i++) {
      const x = -10 + i * 58 + hash(i,31) * 24;
      const y = 504 + hash(i,32) * 18;
      pine(x,y,34 + hash(i,33) * 24,'#5eaa6c','#397b50')(ctx);
    }
    ridge(535,20,118,2.2,'#79b978','#477f5a');
    for (let i = 0; i < 17; i++) {
      const x = -20 + i * 82 + hash(i,41) * 30;
      const y = 550 + hash(i,42) * 12;
      pine(x,y,54 + hash(i,43) * 30,'#438d56','#285e42')(ctx);
    }
    // A darker foreground fringe, softly blurred by atmospheric haze.
    ridge(574,13,90,1.1,'#477a53','#244a3c');
    ctx.fillStyle = 'rgba(238,250,245,.12)';
    ctx.fillRect(0, 486, W, 74);
    // Fine airborne pollen / distant sparkle dots are static so rendering remains cheap.
    for (let i = 0; i < 65; i++) {
      const x = hash(i,51) * W, y = 300 + hash(i,52) * 240;
      ctx.fillStyle = 'rgba(255,255,230,' + (0.10 + hash(i,53) * .22) + ')';
      ctx.beginPath(); ctx.arc(x,y,.6 + hash(i,54)*1.1,0,Math.PI*2); ctx.fill();
    }
    const vignette = ctx.createLinearGradient(0, 0, 0, H);
    vignette.addColorStop(0, 'rgba(12,35,65,.08)');
    vignette.addColorStop(.68, 'rgba(16,46,55,0)');
    vignette.addColorStop(1, 'rgba(5,23,30,.34)');
    ctx.fillStyle = vignette; ctx.fillRect(0,0,W,H);
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
    const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
    const moving = a.onGround && Math.abs(a.vx) > .3;
    const swing = moving ? Math.sin(tick * .42 + a.x * .035) * 2.2 : 0;
    const airborne = !a.onGround;
    const pulse = .5 + .5 * Math.sin(t * 7 + a.x * .08);
    // A soft personal light makes the lead bot easy to follow.
    if (isBest) {
      const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 25);
      glow.addColorStop(0, 'rgba(255,208,77,.28)');
      glow.addColorStop(1, 'rgba(255,208,77,0)');
      ctx.fillStyle = glow; ctx.fillRect(cx - 26, cy - 26, 52, 52);
      ctx.strokeStyle = 'rgba(255,211,86,' + (.35 + pulse * .35) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(cx, cy + 2, 12 + pulse * 2, 15 + pulse * 2, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (a.onGround) {
      ctx.fillStyle = 'rgba(0,0,0,.26)';
      ctx.beginPath(); ctx.ellipse(cx, a.y + a.h + 1, 8, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.translate(cx, a.y);
    ctx.scale(a.facing || 1, 1);
    // Small antenna and its light.
    ctx.strokeStyle = '#263b50'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(9, 4); ctx.lineTo(9, 1); ctx.stroke();
    ctx.fillStyle = isBest ? '#ffd15c' : color;
    ctx.beginPath(); ctx.arc(9, 1, 1.8 + pulse * .35, 0, Math.PI * 2); ctx.fill();
    // Back arm.
    ctx.save(); ctx.translate(4, 15); ctx.rotate(airborne ? (a.vy < 0 ? -.45 : .55) : -swing * .12);
    ctx.fillStyle = shade(color, -.28); rr(ctx, -2, -1, 3.5, 8, 1.5); ctx.fill();
    ctx.fillStyle = '#a8c7d7'; ctx.fillRect(-1.5, 5, 2.5, 2); ctx.restore();
    // Legs with mechanical knee joints.
    const leg = (x, lift) => {
      ctx.strokeStyle = '#263647'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, 21); ctx.lineTo(x + (x < 9 ? -1 : 1), 24 - lift); ctx.stroke();
      ctx.fillStyle = '#9aafc1'; ctx.beginPath(); ctx.arc(x, 21, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e9f4fa'; rr(ctx, x - 2.8, 23 - lift, 5.5, 2.8, 1.2); ctx.fill();
      ctx.fillStyle = '#33475a'; ctx.fillRect(x - 1.8, 25 - lift, 4, 1);
    };
    leg(6, airborne ? (a.vy < 0 ? 1.5 : 0) : Math.max(0, swing));
    leg(12, airborne ? (a.vy < 0 ? 0 : 1.5) : Math.max(0, -swing));
    // Compact armored body with colored core.
    ctx.fillStyle = shade(color, -.38); rr(ctx, 2, 12, 14, 11, 3); ctx.fill();
    ctx.fillStyle = grad(ctx, 3, 22, shade(color, .28), shade(color, -.18));
    rr(ctx, 3, 12, 12, 9, 2.5); ctx.fill();
    ctx.strokeStyle = isBest ? '#ffe08a' : 'rgba(11,26,40,.9)'; ctx.lineWidth = isBest ? 1.8 : 1.1;
    rr(ctx, 2.5, 11.5, 13, 12, 3); ctx.stroke();
    // Chest power cell and two tiny status LEDs.
    ctx.fillStyle = '#162c40'; rr(ctx, 6, 15, 6, 4.5, 1.2); ctx.fill();
    ctx.fillStyle = isBest ? '#ffe17b' : '#9df3ff';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 4;
    rr(ctx, 7, 16, 4, 2.5, .8); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#eaffff'; ctx.fillRect(4, 13, 1.5, 1.5); ctx.fillRect(12.5, 13, 1.5, 1.5);
    // Helmet and dark glass visor.
    ctx.fillStyle = '#dceaf2';
    rr(ctx, 2, 2, 14, 11, 4); ctx.fill();
    ctx.strokeStyle = isBest ? '#ffe08a' : '#344c60'; ctx.lineWidth = 1.2; rr(ctx, 2, 2, 14, 11, 4); ctx.stroke();
    ctx.fillStyle = '#14283b'; rr(ctx, 3.5, 5, 11, 5.2, 2.2); ctx.fill();
    // Eyes follow the facing direction; a brief blink is kept subtle.
    const blink = ((t * 1000 + a.x * 13) % 3700) < 95;
    if (blink) {
      ctx.strokeStyle = '#a8f7ff'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(6, 7.8); ctx.lineTo(8.5, 7.8); ctx.moveTo(10, 7.8); ctx.lineTo(12.5, 7.8); ctx.stroke();
    } else {
      ctx.fillStyle = isBest ? '#ffe08a' : '#a8f5ff';
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.arc(7.3, 7.5, 1.25, 0, Math.PI * 2); ctx.arc(11.5, 7.5, 1.25, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    // Ear modules and front arm.
    ctx.fillStyle = '#718da4'; rr(ctx, .5, 5.5, 2.2, 4, 1); ctx.fill();
    ctx.fillStyle = '#718da4'; rr(ctx, 15.3, 5.5, 2.2, 4, 1); ctx.fill();
    ctx.save(); ctx.translate(14, 15); ctx.rotate(airborne ? (a.vy < 0 ? -.55 : .6) : swing * .12);
    ctx.fillStyle = shade(color, -.12); rr(ctx, -1, -1, 3.5, 8, 1.5); ctx.fill();
    ctx.fillStyle = '#e1f3fa'; ctx.beginPath(); ctx.arc(.7, 7, 1.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // Gold crest for the current best agent.
    if (isBest) {
      ctx.fillStyle = '#ffd45d'; ctx.strokeStyle = '#8c5b16'; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(4, 3); ctx.lineTo(4.5, -1.5); ctx.lineTo(7.2, 1); ctx.lineTo(9, -3); ctx.lineTo(10.8, 1); ctx.lineTo(13.5, -1.5); ctx.lineTo(14, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
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
      if (p.kind === 'spark') {
        p.vy -= 0.045 * f;
        p.vx *= Math.pow(.985, f);
      } else if (p.kind === 'bubble') {
        p.vy -= 0.018 * f;
        p.vx *= Math.pow(.992, f);
      } else {
        p.vy += 0.25 * f;
      }
      p.x += p.vx * f;
      p.y += p.vy * f;
      if (p.life >= p.max) fx.splice(i, 1);
    }
  }
  function drawFx(ctx) {
    for (const p of fx) {
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.c;
      if (p.kind === 'bubble') {
        ctx.strokeStyle = p.c;
        ctx.lineWidth = .9;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.beginPath(); ctx.arc(p.x-p.r*.3, p.y-p.r*.3, Math.max(.45,p.r*.22), 0, Math.PI*2); ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.save();
        ctx.shadowColor = p.c; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.strokeStyle = p.c; ctx.lineWidth = Math.max(.7,p.r*.65);
        ctx.beginPath(); ctx.moveTo(p.x-p.vx*2, p.y-p.vy*2); ctx.lineTo(p.x,p.y); ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }


  const ambientEmitters = new WeakMap();
  function emitAmbientBlockFx(block, def, t) {
    if (!def || block.solid === false) return;
    const style = def.style;
    const settings = {
      fire:     { every: .045, count: 2, colors: ['#fff3a0','#ffd34d','#ff8a24','#ff4b18'], type: 'spark', speed: 2.1 },
      lava:     { every: .085, count: 2, colors: ['#fff18a','#ffbd3d','#ff681e'], type: 'spark', speed: 1.45 },
      electric: { every: .075, count: 2, colors: ['#ffffff','#e5d8ff','#9d7cff'], type: 'spark', speed: 1.6 },
      acid:     { every: .12, count: 1, colors: ['#efff9a','#c9f34b'], type: 'bubble', speed: .7 },
      poison:   { every: .16, count: 1, colors: ['#dcff91','#8fea55'], type: 'bubble', speed: .55 },
      water:    { every: .20, count: 1, colors: ['#e6fbff','#8edcff'], type: 'bubble', speed: .48 },
      crystal:  { every: .30, count: 1, colors: ['#ffffff','#a7f0ff','#67dfff'], type: 'spark', speed: .42 },
      gold:     { every: .34, count: 1, colors: ['#fff7b0','#ffe06a'], type: 'spark', speed: .35 },
      candy:    { every: .42, count: 1, colors: ['#ffffff','#aef4ff','#ffd1e7'], type: 'spark', speed: .28 },
    }[style];
    if (!settings || fx.length > 560) return;
    let state = ambientEmitters.get(block);
    if (!state) { state = { last: t }; ambientEmitters.set(block, state); return; }
    if (t - state.last < settings.every) return;
    state.last = t;
    for (let i = 0; i < settings.count && fx.length < 600; i++) {
      const x = block.x + 4 + Math.random() * Math.max(1, block.w - 8);
      const y = style === 'fire' || style === 'lava' || style === 'electric'
        ? block.y + block.h - 2 - Math.random() * Math.min(5, block.h)
        : block.y + block.h * (.45 + Math.random() * .42);
      const speed = settings.speed * (.55 + Math.random() * .9);
      fx.push({
        x, y,
        vx: (Math.random() - .5) * (settings.type === 'spark' ? 1.15 : .32),
        vy: settings.type === 'bubble' ? -speed : -speed * (.75 + Math.random()*.5),
        life: 0, max: 22 + Math.random() * 30,
        c: settings.colors[(Math.random() * settings.colors.length) | 0],
        r: settings.type === 'bubble' ? 1.2 + Math.random() * 2.1 : .9 + Math.random() * 1.7,
        kind: settings.type
      });
    }
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
    for (let i = 0; i < lvl.blocks.length; i++) {
      const block = lvl.blocks[i];
      drawBlock(ctx, block, t);
      emitAmbientBlockFx(block, BLOCK_TYPES[block.type], t);
    }
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
