/* main.js — Anwendungsstart, Evolution, UI und Import/Export */
import {
  C, CATEGORIES, BLOCK_TYPES, createAgent, fitness as calcFitness, sense, stepAgent,
  render as renderScene, drawBlock, spawnBurst, clearFx,
} from './engine.js';
import { LAYERS, genomeSize, forward, upgradeLegacyGenome } from './nn.js';
import { GA } from './ai.js';
import { Level, Editor } from './level.js';

  const $ = (id) => document.getElementById(id);

  const KEY_LEVEL = 'platformerKI.level.v1';
  const KEY_AI = 'platformerKI.ai.v2';
  const LEGACY_KEY_AI = 'platformerKI.ai.v1';

  // ---------- Zustand ----------
  const state = {
    mode: 'edit', // 'edit' | 'running' | 'paused'
    showSensors: true,
    ga: null,
    gen: 0,
    genomes: [],
    agents: [],
    colors: [],
    bestIndex: -1,
    tick: 0,
    maxTicks: 1200,
    history: [], // { best, avg }
    goalEver: false,
    seedGenome: null, // geladene/gespeicherte KI, mit der das Training beginnt
    seedInfo: null,
    popSize: 50,
    networkTrace: { activations: null, genome: null },
  };

  const canvas = $('game');
  canvas.width = C.W * C.SCALE;
  canvas.height = C.H * C.SCALE;
  const ctx = canvas.getContext('2d');
  const L = () => Editor.level;

  // ---------- localStorage ----------
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignorieren */ } }
  function lsGet(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignorieren */ } }

  // ---------- Toast / Overlay ----------
  let toastTimer = 0, overlayTimer = 0;
  function toast(text, ms) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms || 1800);
  }
  function overlay(text, cls, ms) {
    const o = $('overlay');
    o.textContent = text;
    o.className = 'overlay ' + (cls || '');
    o.hidden = false;
    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => { o.hidden = true; }, ms || 1500);
  }

  // ---------- Einstellungen ----------
  const settings = {
    pop: () => +$('popRange').value,
    mut: () => +$('mutRange').value / 100,
    speed: () => +$('speedRange').value,
    maxTicks: () => Math.round(Math.max(5, Math.min(120, +$('timeInput').value || 20)) * 60),
  };

  // ---------- Level-Änderungen ----------
  let saveTimer = 0;
  function saveLevelSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => lsSet(KEY_LEVEL, { format: 'platformer-ki-level', version: 1, level: Level.toJSON(L()) }), 250);
  }

  function onLevelChanged() {
    saveLevelSoon();
    if (state.genomes.length) {
      // Level geändert -> aktuelle Generation neu starten, alter Rekord ist nicht mehr vergleichbar
      if (state.ga) state.ga.resetBestFitness();
      spawn();
    }
    updateUI();
  }

  // ---------- Training ----------
  function levelReady() {
    const l = L();
    return !!(l.start && l.goal);
  }

  function spawn() {
    state.tick = 0;
    clearFx();
    state.maxTicks = settings.maxTicks();
    if (!levelReady()) { state.agents = []; state.colors = []; state.bestIndex = -1; return false; }
    state.agents = state.genomes.map(() => createAgent(L()));
    state.colors = state.agents.map(() => '#d94f4f');
    state.bestIndex = -1;
    return true;
  }

  function startTraining() {
    if (!levelReady()) { toast('Bitte zuerst Start und Ziel setzen.', 2600); return; }
    state.popSize = settings.pop();
    state.ga = new GA((Date.now() ^ 0x9e3779b9) >>> 0);
    state.genomes = state.ga.initialGenomes(state.popSize, state.seedGenome, settings.mut());
    if (state.seedGenome) state.ga.best = { genome: Float32Array.from(state.seedGenome), fitness: -Infinity };
    state.gen = 1;
    state.history = [];
    state.goalEver = false;
    spawn();
    state.mode = 'running';
    acc = 0;
    if (state.seedGenome) toast('Training startet mit der geladenen KI', 2200);
    updateUI();
  }

  function togglePlay() {
    if (state.mode === 'edit') startTraining();
    else if (state.mode === 'running') { state.mode = 'paused'; updateUI(); }
    else if (state.mode === 'paused') {
      if (!levelReady()) { toast('Bitte zuerst Start und Ziel setzen.', 2600); return; }
      if (!state.agents.length) spawn();
      state.mode = 'running';
      acc = 0;
      updateUI();
    }
  }

  function stepSim() {
    const level = L();
    const input = stepSim.input || (stepSim.input = new Float32Array(LAYERS[0]));
    const out = stepSim.out || (stepSim.out = new Float32Array(2));
    let active = 0;
    const fxOn = settings.speed() <= 10 && !document.hidden;
    for (let i = 0; i < state.agents.length; i++) {
      const a = state.agents[i];
      if (!a.alive || a.finished) continue;
      sense(a, level, input);
      forward(state.genomes[i], input, out);
      stepAgent(a, level, { move: out[0], jump: out[1] > 0.5 }, state.tick);
      if (a.alive && !a.finished) active++;
      else if (fxOn) {
        if (a.finished) spawnBurst(a.x + a.w / 2, a.y + a.h / 2, ['#ffc400', '#ff5252', '#4da3ff', '#5bd96b'], 14, 3.5);
        else if (a.y < C.H) spawnBurst(a.x + a.w / 2, a.y + a.h / 2, [state.colors[i] || '#d94f4f', '#f2c48d', '#5d3d25'], 9, 2.8);
      }
    }
    state.tick++;
    if (active === 0 || state.tick >= state.maxTicks) endGeneration();
  }

  function endGeneration() {
    const ags = state.agents;
    const fitness = ags.map((a) => calcFitness(a, state.maxTicks));
    const res = state.ga.nextGeneration(state.genomes, fitness, settings.pop(), settings.mut());
    const avg = fitness.reduce((s, v) => s + v, 0) / (fitness.length || 1);
    state.history.push({ best: res.bestFitness, avg });
    if (state.history.length > 400) state.history.shift();

    const finished = ags.filter((a) => a.finished).length;
    if (finished && !state.goalEver) {
      state.goalEver = true;
      overlay('Ziel erreicht!', 'win', 1800);
    } else {
      toast('Generation ' + state.gen + ' abgeschlossen · beste Fitness ' + res.bestFitness.toFixed(0) + (finished ? ' · ' + finished + '× im Ziel' : ''), 1400);
    }

    // beste KI sichern
    if (state.ga.best.genome) {
      state.seedGenome = Float32Array.from(state.ga.best.genome);
      state.seedInfo = { generation: state.gen, fitness: state.ga.best.fitness };
      lsSet(KEY_AI, aiToJSON());
    }

    state.genomes = res.genomes;
    state.gen++;
    spawn();
  }

  function nextGenerationNow() {
    if (state.mode === 'edit' || !state.agents.length) return;
    endGeneration();
    updateUI();
  }

  function resetAll() {
    if ((state.mode !== 'edit' || state.seedGenome) && !confirm('Training zurücksetzen? Die gespeicherte KI im Browser wird dabei gelöscht.')) return;
    state.mode = 'edit';
    state.ga = null;
    state.gen = 0;
    state.genomes = [];
    state.agents = [];
    state.colors = [];
    state.bestIndex = -1;
    state.history = [];
    state.goalEver = false;
    state.seedGenome = null;
    state.seedInfo = null;
    state.tick = 0;
    lsDel(KEY_AI);
    updateUI();
  }

  // ---------- Speichern / Laden ----------
  function aiToJSON() {
    return {
      format: 'platformer-ki-ai',
      version: 2,
      layers: LAYERS,
      generation: state.seedInfo ? state.seedInfo.generation : state.gen,
      fitness: state.seedInfo ? state.seedInfo.fitness : null,
      genome: Array.from(state.seedGenome || []),
    };
  }

  function parseAI(ai) {
    if (!ai || !Array.isArray(ai.genome)) return null;
    if (!ai.genome.every((v) => typeof v === 'number' && isFinite(v))) throw new Error('KI enthält ungültige Gewichte.');
    let genome = Float32Array.from(ai.genome);
    const layers = Array.isArray(ai.layers) ? ai.layers.join(',') : '';
    if (genome.length === genomeSize() && (!layers || layers === LAYERS.join(','))) {
      // Aktuelles Format.
    } else if (layers === '14,12,8,2' || layers === '6,12,8,2'
      || genome.length === 14 * 12 + 12 + 12 * 8 + 8 + 8 * 2 + 2
      || genome.length === 6 * 12 + 12 + 12 * 8 + 8 + 8 * 2 + 2) {
      genome = upgradeLegacyGenome(genome);
    } else {
      throw new Error('KI passt nicht zur Netzwerk-Architektur.');
    }
    return { genome, generation: +ai.generation || 0, fitness: typeof ai.fitness === 'number' ? ai.fitness : null };
  }

  function applyAI(p) {
    state.seedGenome = p.genome;
    state.seedInfo = { generation: p.generation, fitness: p.fitness };
    lsSet(KEY_AI, aiToJSON());
    if (state.mode !== 'edit' && state.ga) {
      // laufendes Training mit der geladenen KI neu aufsetzen
      state.genomes = state.ga.initialGenomes(settings.pop(), p.genome, settings.mut());
      state.ga.best = { genome: Float32Array.from(p.genome), fitness: -Infinity };
      spawn();
    }
  }

  function applyLevel(lv) {
    if (state.mode === 'running') state.mode = 'paused';
    Editor.setLevel(lv);
    onLevelChanged();
  }

  function download(name, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function saveLevelFile() {
    download('level.json', { format: 'platformer-ki-level', version: 1, level: Level.toJSON(L()) });
  }
  function saveAIFile() {
    if (!state.seedGenome) { toast('Noch keine trainierte KI vorhanden – erst eine Generation abschließen.', 2800); return; }
    download('ki.json', aiToJSON());
  }
  function saveAllFile() {
    const o = { format: 'platformer-ki-save', version: 1, level: Level.toJSON(L()) };
    if (state.seedGenome) o.ai = aiToJSON();
    download('level-und-ki.json', o);
  }

  function readFile(file, cb) {
    const fr = new FileReader();
    fr.onload = () => {
      try { cb(JSON.parse(fr.result)); }
      catch (e) { toast('Datei konnte nicht geladen werden: ' + e.message, 3500); }
    };
    fr.onerror = () => toast('Datei konnte nicht gelesen werden.', 3000);
    fr.readAsText(file);
  }

  function importLevel(obj) {
    const lvRaw = obj && obj.level ? obj.level : obj;
    const lv = Level.sanitize(lvRaw);
    let withAI = false;
    if (obj && obj.ai) { const p = parseAI(obj.ai); if (p) { applyAI(p); withAI = true; } }
    applyLevel(lv);
    toast(withAI ? 'Level und KI geladen' : 'Level geladen', 2000);
  }
  function importAI(obj) {
    const p = parseAI(obj && obj.ai ? obj.ai : obj);
    if (!p) throw new Error('Keine KI in dieser Datei.');
    applyAI(p);
    updateUI();
    toast('KI geladen (Generation ' + p.generation + ')' + (state.mode === 'edit' ? ' – sie wird beim Start als Ausgangspunkt genutzt' : ''), 3000);
  }

  // ---------- UI ----------
  function fmt(n) { return n == null || !isFinite(n) ? '–' : n.toFixed(0); }

  function updateColors() {
    const ags = state.agents;
    if (!ags.length) return;
    const f = ags.map((a) => calcFitness(a, state.maxTicks));
    let mn = Infinity, mx = -Infinity, bi = 0;
    for (let i = 0; i < f.length; i++) {
      if (f[i] < mn) mn = f[i];
      if (f[i] > mx) { mx = f[i]; bi = i; }
    }
    const span = mx - mn || 1;
    for (let i = 0; i < f.length; i++) {
      const t = (f[i] - mn) / span;
      state.colors[i] = 'hsl(' + Math.round(8 + t * 130) + ',70%,52%)';
    }
    state.bestIndex = bi;
    state._liveBest = mx;
    const bestAgent = ags[bi];
    if (bestAgent && bestAgent.sensorValues && state.genomes[bi]) {
      const out = updateColors.out || (updateColors.out = new Float32Array(2));
      forward(state.genomes[bi], bestAgent.sensorValues, out, state.networkTrace);
      drawNetwork();
    }
  }

  function updateInfo() {
    const ags = state.agents;
    const alive = ags.filter((a) => a.alive && !a.finished).length;
    const finished = ags.filter((a) => a.finished).length;
    $('infoGen').textContent = state.gen;
    $('infoPop').textContent = state.mode === 'edit' ? '0 / 0' : alive + ' / ' + ags.length;
    $('infoBest').textContent = state.mode === 'edit' ? '–' : fmt(state._liveBest);
    const rec = state.ga && state.ga.best.fitness > -Infinity ? state.ga.best.fitness : state.seedInfo && state.seedInfo.fitness;
    $('infoBestEver').textContent = fmt(rec);
    const g = $('infoGoal');
    g.textContent = finished ? 'Ja (' + finished + ')' : state.goalEver ? 'Zuvor ja' : 'Nein';
    g.classList.toggle('yes', !!finished || state.goalEver);
    $('infoMut').textContent = Math.round(settings.mut() * 100) + ' %';
    $('infoTime').textContent = (state.tick / 60).toFixed(1) + ' s';
  }

  function updateUI() {
    const locked = state.mode === 'running';
    const btn = $('btnPlay');
    btn.textContent = state.mode === 'edit' ? '▶ Start' : state.mode === 'running' ? '⏸ Pause' : '▶ Weiter';
    $('btnNext').disabled = state.mode === 'edit';
    for (const id of ['btnPlaceStart', 'btnPlaceGoal', 'btnExample', 'btnClearLevel', 'btnDelete']) $(id).disabled = locked;
    document.querySelectorAll('.tile').forEach((t) => { t.draggable = !locked; t.classList.toggle('disabled', locked); });
    $('editorPanel').title = locked ? 'Zum Bearbeiten zuerst pausieren' : '';
    updateInfo();
  }

  function drawNetwork() {
    const cv = $('network');
    if (!cv) return;
    const c = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#202833'; c.fillRect(0, 0, W, H);
    const trace = state.networkTrace;
    const genome = trace.genome;
    const activations = trace.activations;
    if (!genome || !activations) {
      c.fillStyle = '#94a0b2'; c.font = '16px system-ui, sans-serif'; c.textAlign = 'center';
      c.fillText('Starte das Training, um das aktive neuronale Netz zu sehen.', W / 2, H / 2);
      return;
    }
    const xPos = [86, 330, 575, 820];
    const layerNodes = LAYERS.map((count, layer) => Array.from({ length: count }, (_, i) => ({
      x: xPos[layer], y: (H - 46) * (i + 0.5) / count + 20,
    })));
    let offset = 0;
    for (let layer = 0; layer < LAYERS.length - 1; layer++) {
      const inputCount = LAYERS[layer], outputCount = LAYERS[layer + 1];
      for (let o = 0; o < outputCount; o++) {
        for (let i = 0; i < inputCount; i++) {
          const weight = genome[offset + o * inputCount + i];
          const contribution = weight * activations[layer][i];
          const from = layerNodes[layer][i], to = layerNodes[layer + 1][o];
          const strength = Math.min(0.82, 0.12 + Math.abs(contribution) * 0.62);
          c.strokeStyle = contribution >= 0 ? `rgba(65,220,135,${strength})` : `rgba(255,93,93,${strength})`;
          c.lineWidth = Math.min(2.4, 0.45 + Math.abs(weight) * 0.58);
          c.beginPath(); c.moveTo(from.x, from.y); c.lineTo(to.x, to.y); c.stroke();
        }
      }
      offset += inputCount * outputCount + outputCount;
    }
    for (let layer = 0; layer < LAYERS.length; layer++) {
      for (let i = 0; i < LAYERS[layer]; i++) {
        const node = layerNodes[layer][i];
        const value = activations[layer][i];
        const alpha = Math.min(1, 0.35 + Math.abs(value) * 0.65);
        c.fillStyle = value >= 0 ? `rgba(55,210,125,${alpha})` : `rgba(255,90,90,${alpha})`;
        c.strokeStyle = '#dce5ef'; c.lineWidth = 1;
        c.beginPath(); c.arc(node.x, node.y, layer === 0 ? 5.2 : 6.1, 0, Math.PI * 2); c.fill(); c.stroke();
      }
    }
    const titles = ['28 Sensoren', '12 Neuronen', '8 Neuronen', 'Steuerung'];
    c.font = '600 12px system-ui, sans-serif'; c.fillStyle = '#b9c4d2'; c.textAlign = 'center';
    titles.forEach((title, i) => c.fillText(title, xPos[i], 16));
    c.textAlign = 'left'; c.font = '8px system-ui, sans-serif'; c.fillStyle = '#b9c4d2';
    const sensorNames = ['X-Position', 'Y-Position', 'Tempo X', 'Tempo Y', 'Zielabstand', 'Boden', 'Vorne', 'Oben vorn', 'Oben steil', 'Oben', 'Unten vorn', 'Unten steil', 'Boden vorn', 'Boden mitte', 'Hinten', 'Hinten oben', 'Hinten unten', 'Vorne oben steil', 'Vorne unten steil', 'Boden links', 'Boden rechts', 'Boden voraus', 'Seitlich oben', 'Seitlich unten', 'Ziel X', 'Ziel Y', 'Gefahrabstand', 'Gefahr Y'];
    for (let i = 0; i < sensorNames.length; i++) c.fillText(sensorNames[i], 4, layerNodes[0][i].y + 3);
    c.textAlign = 'right'; c.fillStyle = '#e7ebf1';
    c.fillText('Bewegung', W - 6, layerNodes[3][0].y + 3);
    c.fillText('Springen', W - 6, layerNodes[3][1].y + 3);
  }

  function drawChart() {
    const cv = $('chart'), c = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    c.clearRect(0, 0, W, H);
    const h = state.history;
    c.fillStyle = '#94a0b2';
    c.font = '11px system-ui, sans-serif';
    if (h.length < 2) { c.fillText('Noch keine Daten', 10, H / 2); return; }
    const mx = Math.max(1, ...h.map((e) => e.best));
    const pad = 6;
    const line = (key, col) => {
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath();
      h.forEach((e, i) => {
        const x = pad + (i / (h.length - 1)) * (W - 2 * pad);
        const y = H - pad - (e[key] / mx) * (H - 2 * pad - 10);
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      });
      c.stroke();
    };
    line('avg', '#4da3ff');
    line('best', '#ffc400');
    c.fillText('max ' + mx.toFixed(0) + ' · Gen ' + h.length, pad + 2, 12);
  }

  // ---------- Loop ----------
  let last = performance.now();
  let acc = 0;
  let chartT = 0;

  function frame(ts) {
    const dt = Math.min(100, ts - last);
    last = ts;
    if (state.mode === 'running') {
      acc += dt * settings.speed();
      let n = 0;
      while (acc >= C.TICK_MS && n < 600 && state.mode === 'running') {
        stepSim();
        acc -= C.TICK_MS;
        n++;
      }
      if (n >= 600) acc = 0;
    }
    updateColors();
    ctx.setTransform(C.SCALE, 0, 0, C.SCALE, 0, 0);
    renderScene(ctx, { level: L(), agents: state.agents, tick: state.tick, colors: state.colors, bestIndex: state.bestIndex, showSensors: state.showSensors });
    Editor.drawOverlay(ctx, state.mode !== 'running');
    if (state.mode !== 'edit') updateInfo();
    if (ts - chartT > 250) { chartT = ts; drawChart(); }
    requestAnimationFrame(frame);
  }

  // ---------- Verdrahtung ----------
  function init() {
    // Level aus localStorage (sonst leer)
    let level = Level.empty();
    const saved = lsGet(KEY_LEVEL);
    if (saved && saved.level) { try { level = Level.sanitize(saved.level); } catch (e) { /* leer */ } }

    Editor.init({
      canvas,
      level,
      isLocked: () => state.mode === 'running',
      onChange: onLevelChanged,
      onSelect: refreshProps,
      onArm: refreshArm,
    });

    // gespeicherte KI
    try {
      const ai = lsGet(KEY_AI) || lsGet(LEGACY_KEY_AI);
      const p = ai && parseAI(ai);
      if (p) { state.seedGenome = p.genome; state.seedInfo = { generation: p.generation, fitness: p.fitness }; state.gen = 0; }
    } catch (e) { /* ignorieren */ }

    // Palette (nach Kategorien gruppiert)
    const pal = $('palette');
    const sel = $('propType');
    for (const cat of CATEGORIES) {
      const h = document.createElement('h4');
      h.textContent = cat;
      pal.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'palette-grid';
      pal.appendChild(grid);
      const og = document.createElement('optgroup');
      og.label = cat;
      sel.appendChild(og);
      for (const type of Object.keys(BLOCK_TYPES)) {
        const def = BLOCK_TYPES[type];
        if (def.cat !== cat) continue;
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.draggable = true;
        tile.dataset.type = type;
        tile.title = def.label;
        const cv = document.createElement('canvas');
        cv.width = 128; cv.height = 80;
        const c2 = cv.getContext('2d');
        const sc = Math.min(110 / def.w, 64 / def.h, 1.6);
        c2.translate((128 - def.w * sc) / 2, (80 - def.h * sc) / 2);
        c2.scale(sc, sc);
        drawBlock(c2, { type, x: 0, y: 0, w: def.w, h: def.h, color: def.color, solid: true });
        tile.appendChild(cv);
        const lb = document.createElement('span');
        lb.textContent = def.label;
        tile.appendChild(lb);
        grid.appendChild(tile);
        Editor.bindPaletteTile(tile, type);
        const o = document.createElement('option');
        o.value = type; o.textContent = def.label;
        og.appendChild(o);
      }
    }

    // Editor-Buttons
    $('btnPlaceStart').onclick = () => { if (state.mode !== 'running') Editor.arm(Editor.armed && Editor.armed.kind === 'start' ? null : { kind: 'start' }); };
    $('btnPlaceGoal').onclick = () => { if (state.mode !== 'running') Editor.arm(Editor.armed && Editor.armed.kind === 'goal' ? null : { kind: 'goal' }); };
    $('chkGrid').onchange = (e) => { Editor.gridOn = e.target.checked; };
    $('btnDelete').onclick = () => Editor.deleteSelected();
    $('btnExample').onclick = () => applyLevel(Level.preset($('levelPreset').value));
    $('chkSensors').onchange = () => { state.showSensors = $('chkSensors').checked; };
    $('btnClearLevel').onclick = () => {
      if (L().blocks.length || L().start || L().goal) { if (!confirm('Level wirklich leeren?')) return; }
      applyLevel(Level.empty());
    };

    // Block-Menü
    const withSel = (fn) => () => { const s = Editor.selected; if (s && typeof s !== 'string' && state.mode !== 'running') { fn(s); Editor.clampBlock(s); Editor.onChange(); } };
    sel.onchange = withSel((b) => {
      const oldDef = BLOCK_TYPES[b.type];
      b.type = sel.value;
      if (b.color === oldDef.color) b.color = BLOCK_TYPES[b.type].color;
      $('propColor').value = b.color;
    });
    $('propW').oninput = withSel((b) => { const v = parseInt($('propW').value, 10); if (v >= 10) b.w = v; });
    $('propH').oninput = withSel((b) => { const v = parseInt($('propH').value, 10); if (v >= 10) b.h = v; });
    $('propColor').oninput = withSel((b) => { b.color = $('propColor').value; });
    $('propSolid').onchange = withSel((b) => { b.solid = $('propSolid').checked; });

    // Training-Steuerung
    $('btnPlay').onclick = togglePlay;
    $('btnNext').onclick = nextGenerationNow;
    $('btnReset').onclick = resetAll;
    $('popRange').oninput = () => { $('popVal').textContent = $('popRange').value; };
    $('mutRange').oninput = () => { $('mutVal').textContent = $('mutRange').value + ' %'; updateInfo(); };
    $('speedRange').oninput = () => { $('speedVal').textContent = $('speedRange').value + '×'; };

    // Speichern / Laden
    $('btnSaveLevel').onclick = saveLevelFile;
    $('btnSaveAI').onclick = saveAIFile;
    $('btnSaveAll').onclick = saveAllFile;
    $('fileLevel').onchange = (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (f) readFile(f, importLevel);
    };
    $('fileAI').onchange = (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (f) readFile(f, importAI);
    };

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)) { e.preventDefault(); togglePlay(); }
    });

    refreshProps(null);
    updateUI();
    drawNetwork();
    requestAnimationFrame(frame);

    if (state.seedGenome) toast('Gespeicherte KI gefunden – Training setzt damit fort (Reset = neu beginnen)', 3500);
  }

  function refreshProps(s) {
    const box = $('props');
    const isBlock = s && typeof s !== 'string';
    box.hidden = !isBlock;
    $('propsHint').hidden = !!isBlock;
    if (isBlock) {
      $('propType').value = s.type;
      if (document.activeElement !== $('propW')) $('propW').value = Math.round(s.w);
      if (document.activeElement !== $('propH')) $('propH').value = Math.round(s.h);
      $('propColor').value = s.color || BLOCK_TYPES[s.type].color;
      $('propSolid').checked = s.solid !== false;
    }
  }

  function refreshArm(a) {
    document.querySelectorAll('.tile').forEach((t) => t.classList.toggle('armed', !!(a && a.kind === 'block' && a.type === t.dataset.type)));
    $('btnPlaceStart').classList.toggle('armed', !!(a && a.kind === 'start'));
    $('btnPlaceGoal').classList.toggle('armed', !!(a && a.kind === 'goal'));
  }

  export const app = { state, startTraining, togglePlay, nextGenerationNow, resetAll };

  init();