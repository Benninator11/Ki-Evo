/* main.js — Anwendungsstart, Evolution, UI und Import/Export */
import {
  C, CATEGORIES, BLOCK_TYPES, BLOCK_TYPE_KEYS, createAgent, fitness as calcFitness, sense, stepAgent, assistControl,
  render as renderScene, drawBlock, spawnBurst, clearFx, reconcileAgentsAfterLevelEdit,
} from './engine.js';
import { LAYERS, genomeSize, forward, upgradeLegacyGenome } from './nn.js';
import { GA, MAX_POPULATION } from './ai.js';
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
    levelMix: false,
    originalLevel: null,
    lastMixKey: '',
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
  let deathAudioContext = null;
  let lastDeathPopAt = 0;

  function unlockDeathAudio() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      if (!deathAudioContext) deathAudioContext = new AudioCtx();
      if (deathAudioContext.state === 'suspended') deathAudioContext.resume();
    } catch (e) { /* Audio ist optional */ }
  }

  function playDeathPop() {
    if (!deathAudioContext || deathAudioContext.state !== 'running') return;
    const nowMs = performance.now();
    if (nowMs - lastDeathPopAt < 90) return;
    lastDeathPopAt = nowMs;
    try {
      const now = deathAudioContext.currentTime;
      const osc = deathAudioContext.createOscillator();
      const gain = deathAudioContext.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(390, now);
      osc.frequency.exponentialRampToValueAtTime(105, now + 0.105);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      osc.connect(gain);
      gain.connect(deathAudioContext.destination);
      osc.start(now);
      osc.stop(now + 0.14);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    } catch (e) { /* Audio-Fehler darf das Training nicht stoppen */ }
  }
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
    pop: () => Math.max(1, Math.min(MAX_POPULATION, Math.floor(+$('popRange').value || 1))),
    mut: () => +$('mutRange').value / 100,
    speed: () => +$('speedRange').value,
    maxTicks: () => Math.round(Math.max(5, Math.min(120, +$('timeInput').value || 20)) * 60),
    genetics: () => ({
      tournamentSize: +$('tournamentRange').value,
      eliteCount: +$('eliteRange').value,
      crossoverRate: +$('crossoverRange').value / 100,
      mutationStrength: +$('strengthRange').value / 100,
      adaptiveMutation: $('adaptiveMutation').checked,
      stagnationGenerations: +$('stagnationRange').value,
      stagnationBoost: +$('boostRange').value / 10,
    }),
  };

  // ---------- Level-Änderungen ----------
  let saveTimer = 0;
  function saveLevelSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => lsSet(KEY_LEVEL, { format: 'platformer-ki-level', version: 1, level: Level.toJSON(L()) }), 250);
  }

  function onLevelChanged() {
    saveLevelSoon();
    // Live-Änderungen sind Teil derselben Generation. Alle Agenten behalten
    // Genome, Tick-Zähler und Fortschritt; nur ungültige Überlappungen werden
    // sofort und sicher bereinigt.
    if (state.mode !== 'edit' && state.agents.length) reconcileAgentsAfterLevelEdit(state.agents, L(), state.tick);
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
    unlockDeathAudio();
    state.levelMix = $('levelMix').checked;
    state.originalLevel = Level.toJSON(L());
    state.lastMixKey = '';
    if (state.levelMix) setNextMixLevel();
    if (!levelReady()) { toast('Bitte zuerst Start und Ziel setzen.', 2600); return; }
    state.popSize = settings.pop();
    state.ga = new GA((Date.now() ^ 0x9e3779b9) >>> 0, settings.genetics());
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
      const control = assistControl(a, input, out, level);
      stepAgent(a, level, control, state.tick);
      if (a.alive && !a.finished) active++;
      else {
        if (!a.finished) playDeathPop();
        if (fxOn) {
          if (a.finished) spawnBurst(a.x + a.w / 2, a.y + a.h / 2, ['#ffc400', '#ff5252', '#4da3ff', '#5bd96b'], 14, 3.5);
          else if (a.y < C.H) spawnBurst(a.x + a.w / 2, a.y + a.h / 2, [state.colors[i] || '#d94f4f', '#f2c48d', '#5d3d25'], 9, 2.8);
        }
      }
    }
    state.tick++;
    if (active === 0 || state.tick >= state.maxTicks) endGeneration();
  }

  function setNextMixLevel() {
    const presets = Level.presets();
    if (!presets.length) return;
    let preset, mirrored, key;
    for (let attempt = 0; attempt < 30; attempt++) {
      preset = presets[Math.floor(Math.random() * presets.length)];
      mirrored = Math.random() < 0.5;
      key = preset.id + (mirrored ? ':mirror' : ':normal');
      if (key !== state.lastMixKey) break;
    }
    state.lastMixKey = key;
    const level = Level.preset(preset.id);
    if (mirrored) {
      const mirror = (item) => ({ ...item, x: C.W - item.x - item.w });
      level.blocks = level.blocks.map(mirror);
      level.start = mirror(level.start);
      level.goal = mirror(level.goal);
    }
    Editor.setLevel(level);
    state._mixLabel = preset.name + (mirrored ? ' · gespiegelt' : '');
  }

  function endGeneration() {
    const ags = state.agents;
    const fitness = ags.map((a) => calcFitness(a, state.maxTicks));
    state.ga.configure(settings.genetics());
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
    if (state.levelMix) setNextMixLevel();
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
    if (state.originalLevel) Editor.setLevel(Level.sanitize(state.originalLevel));
    state.originalLevel = null;
    state.levelMix = false;
    state.lastMixKey = '';
    $('levelMix').checked = false;
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
      version: 3,
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
    } else if (['65,12,8,2', '28,12,8,2', '14,12,8,2', '6,12,8,2'].includes(layers)
      || genome.length === 65 * 12 + 12 + 12 * 8 + 8 + 8 * 2 + 2
      || genome.length === 28 * 12 + 12 + 12 * 8 + 8 + 8 * 2 + 2
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
      state.ga.configure(settings.genetics());
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
    const bestAgent = state.bestIndex >= 0 ? ags[state.bestIndex] : null;
    const detected = bestAgent && bestAgent.detectedBlock;
    $('infoBlock').textContent = detected ? detected.label : (bestAgent ? 'Freie Bahn' : '–');
  }

  function updateUI() {
    const live = state.mode === 'running';
    const btn = $('btnPlay');
    btn.textContent = state.mode === 'edit' ? '▶ Start' : state.mode === 'running' ? '⏸ Pause' : '▶ Weiter';
    $('btnNext').disabled = state.mode === 'edit';
    // Der Editor bleibt auch während des Trainings bedienbar. Vorlagen und
    // "Level leeren" behalten ihr bisheriges Verhalten (sie pausieren).
    for (const id of ['btnPlaceStart', 'btnPlaceGoal', 'btnDelete']) $(id).disabled = false;
    for (const id of ['btnExample', 'btnClearLevel']) $(id).disabled = false;
    document.querySelectorAll('.tile').forEach((t) => { t.draggable = true; t.classList.remove('disabled'); });
    $('editorPanel').title = live ? 'Live-Editor: Änderungen gelten sofort für diese Generation' : '';
    const mixStatus = $('levelMixStatus');
    if (mixStatus) mixStatus.textContent = state.levelMix ? 'Aktiv · ' + (state._mixLabel || 'wechselnde Level') : 'Aus';
    updateInfo();
  }

  function drawNetwork() {
    const cv = $('network');
    if (!cv) return;
    const c = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const t = performance.now() / 1000;
    c.clearRect(0, 0, W, H);

    // Deep neural-grid backdrop with a softly lit center.
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#111e2c'); bg.addColorStop(.55, '#172b3b'); bg.addColorStop(1, '#101b29');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const glow = c.createRadialGradient(W * .52, H * .48, 15, W * .52, H * .48, W * .68);
    glow.addColorStop(0, 'rgba(42,124,151,.18)'); glow.addColorStop(1, 'rgba(13,25,39,0)');
    c.fillStyle = glow; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(119,177,208,.07)'; c.lineWidth = 1;
    for (let x = 0; x < W; x += 28) { c.beginPath(); c.moveTo(x + .5, 0); c.lineTo(x + .5, H); c.stroke(); }
    for (let y = 0; y < H; y += 28) { c.beginPath(); c.moveTo(0, y + .5); c.lineTo(W, y + .5); c.stroke(); }

    const trace = state.networkTrace;
    const genome = trace.genome;
    const activations = trace.activations;
    if (!genome || !activations) {
      c.textAlign = 'center';
      c.fillStyle = '#9bb5c8'; c.font = '600 16px system-ui, sans-serif';
      c.fillText('Neuronales Netz wartet auf das Training', W / 2, H / 2 - 4);
      c.fillStyle = '#66859b'; c.font = '12px system-ui, sans-serif';
      c.fillText('Starte eine Generation, um die Signale live zu verfolgen.', W / 2, H / 2 + 19);
      return;
    }

    const xPos = LAYERS.map((_, index) => 52 + index * (W - 132) / (LAYERS.length - 1));
    const layerNodes = LAYERS.map((count, layer) => Array.from({ length: count }, (_, i) => ({
      x: xPos[layer], y: (H - 64) * (i + .5) / count + 30,
    })));

    // Subtle glass columns keep the layers readable behind the connections.
    for (let layer = 0; layer < LAYERS.length; layer++) {
      const x = xPos[layer] - (layer === 0 ? 13 : 18);
      c.fillStyle = layer === LAYERS.length - 1 ? 'rgba(255,199,87,.075)' : 'rgba(117,185,214,.055)';
      c.fillRect(x, 26, layer === 0 ? 26 : 36, H - 52);
      c.strokeStyle = layer === LAYERS.length - 1 ? 'rgba(255,204,104,.22)' : 'rgba(143,205,229,.14)';
      c.strokeRect(x + .5, 26.5, (layer === 0 ? 26 : 36) - 1, H - 53);
    }

    // Connections: positive signal = mint, negative signal = coral.
    let offset = 0;
    for (let layer = 0; layer < LAYERS.length - 1; layer++) {
      const inputCount = LAYERS[layer], outputCount = LAYERS[layer + 1];
      for (let o = 0; o < outputCount; o++) {
        for (let i = 0; i < inputCount; i++) {
          const weight = genome[offset + o * inputCount + i];
          const contribution = weight * activations[layer][i];
          const strength = Math.min(.72, .055 + Math.abs(contribution) * .78);
          const from = layerNodes[layer][i], to = layerNodes[layer + 1][o];
          c.strokeStyle = contribution >= 0
            ? 'rgba(78,235,171,' + strength + ')'
            : 'rgba(255,111,115,' + strength + ')';
          c.lineWidth = Math.min(2.1, .35 + Math.abs(weight) * .7);
          c.beginPath(); c.moveTo(from.x, from.y); c.lineTo(to.x, to.y); c.stroke();

          // A few travelling signal motes make active connections feel alive.
          if (Math.abs(contribution) > .34 && ((i * 7 + o * 11 + layer * 13) % 37 === 0)) {
            const phase = (t * (0.45 + Math.abs(contribution)) + (i + o * 3) * .071) % 1;
            const px = from.x + (to.x - from.x) * phase;
            const py = from.y + (to.y - from.y) * phase;
            c.fillStyle = contribution >= 0 ? 'rgba(151,255,211,.95)' : 'rgba(255,187,170,.95)';
            c.beginPath(); c.arc(px, py, 1.2 + Math.abs(contribution), 0, Math.PI * 2); c.fill();
          }
        }
      }
      offset += inputCount * outputCount + outputCount;
    }

    // Nodes get a halo proportional to their current activation.
    for (let layer = 0; layer < LAYERS.length; layer++) {
      for (let i = 0; i < LAYERS[layer]; i++) {
        const node = layerNodes[layer][i];
        const value = activations[layer][i];
        const intensity = Math.min(1, .18 + Math.abs(value) * .82);
        const radius = layer === 0 ? 2.35 : layer === LAYERS.length - 1 ? 7 : 5.4;
        const positive = value >= 0;
        if (layer > 0 && Math.abs(value) > .16) {
          const halo = c.createRadialGradient(node.x, node.y, 1, node.x, node.y, radius * 2.8);
          halo.addColorStop(0, positive ? 'rgba(91,240,176,.35)' : 'rgba(255,113,119,.32)');
          halo.addColorStop(1, 'rgba(30,60,80,0)');
          c.fillStyle = halo; c.beginPath(); c.arc(node.x,node.y,radius*2.8,0,Math.PI*2); c.fill();
        }
        c.fillStyle = positive
          ? 'rgba(89,231,166,' + intensity + ')'
          : 'rgba(255,111,118,' + intensity + ')';
        c.strokeStyle = layer === LAYERS.length - 1 ? '#fff0c8' : 'rgba(225,245,255,.78)';
        c.lineWidth = layer === LAYERS.length - 1 ? 1.6 : 1;
        c.beginPath(); c.arc(node.x, node.y, radius, 0, Math.PI * 2); c.fill(); c.stroke();
        if (layer === LAYERS.length - 1) {
          c.fillStyle = 'rgba(255,255,255,.85)';
          c.beginPath(); c.arc(node.x - 1.7, node.y - 1.7, 1.5, 0, Math.PI * 2); c.fill();
        }
      }
    }

    const titles = LAYERS.map((count, index) => index === 0 ? count + ' Eingänge' : index === LAYERS.length - 1 ? 'Ausgabe' : count + ' Neuronen');
    c.font = '600 12px system-ui, sans-serif'; c.textAlign = 'center';
    titles.forEach((title, i) => {
      c.fillStyle = '#d2e4ef'; c.fillText(title, xPos[i], 17);
      c.fillStyle = 'rgba(103,184,211,.65)'; c.fillRect(xPos[i] - 13, 21, 26, 2);
    });
    c.textAlign = 'left'; c.font = '9px system-ui, sans-serif'; c.fillStyle = '#88a9bd';
    c.fillText('POSITION  ·  RAYCASTS  ·  ZIEL  ·  ' + BLOCK_TYPE_KEYS.length + ' BLOCKTYPEN  ·  DISTANZ', 9, H - 8);
    c.textAlign = 'right'; c.font = '600 9px system-ui, sans-serif'; c.fillStyle = '#d9eaf3';
    const outputLayer = layerNodes[LAYERS.length - 1];
    c.fillText('MOVE', W - 7, outputLayer[0].y + 3);
    c.fillText('JUMP', W - 7, outputLayer[1].y + 3);
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
      isLocked: () => false,
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

    // Beispiel-Level sauber und ohne doppelte Einträge aufbauen.
    const presetSelect = $('levelPreset');
    presetSelect.replaceChildren();
    const presetGroups = new Map();
    for (const item of Level.presets()) {
      if (!presetGroups.has(item.category)) {
        const group = document.createElement('optgroup');
        group.label = item.category;
        presetGroups.set(item.category, group);
        presetSelect.appendChild(group);
      }
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      presetGroups.get(item.category).appendChild(option);
    }
    presetSelect.value = 'level-1';

    // Editor-Buttons
    $('btnPlaceStart').onclick = () => { Editor.arm(Editor.armed && Editor.armed.kind === 'start' ? null : { kind: 'start' }); };
    $('btnPlaceGoal').onclick = () => { Editor.arm(Editor.armed && Editor.armed.kind === 'goal' ? null : { kind: 'goal' }); };
    $('chkGrid').onchange = (e) => { Editor.gridOn = e.target.checked; };
    $('btnDelete').onclick = () => Editor.deleteSelected();
    const loadSelectedPreset = () => {
      try {
        applyLevel(Level.preset(presetSelect.value));
        toast('Level geladen: ' + presetSelect.options[presetSelect.selectedIndex].textContent, 1800);
      } catch (error) {
        console.error('Beispiel-Level konnte nicht geladen werden:', error);
        toast('Level konnte nicht geladen werden: ' + error.message, 3500);
      }
    };
    presetSelect.onchange = loadSelectedPreset;
    $('btnExample').onclick = loadSelectedPreset;
    $('chkSensors').onchange = () => { state.showSensors = $('chkSensors').checked; };
    $('btnClearLevel').onclick = () => {
      if (L().blocks.length || L().start || L().goal) { if (!confirm('Level wirklich leeren?')) return; }
      applyLevel(Level.empty());
    };

    // Block-Menü
    const withSel = (fn) => () => { const s = Editor.selected; if (s && typeof s !== 'string') { fn(s); Editor.clampBlock(s); Editor.onChange(); } };
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
    const refreshGeneticLabels = () => {
      $('tournamentVal').textContent = $('tournamentRange').value;
      $('eliteVal').textContent = $('eliteRange').value;
      $('crossoverVal').textContent = $('crossoverRange').value + ' %';
      $('strengthVal').textContent = $('strengthRange').value + ' %';
      $('stagnationVal').textContent = $('stagnationRange').value;
      $('boostVal').textContent = (+$('boostRange').value / 10).toFixed(1).replace('.', ',') + '×';
      if (state.ga) state.ga.configure(settings.genetics());
    };
    for (const id of ['tournamentRange', 'eliteRange', 'crossoverRange', 'strengthRange', 'stagnationRange', 'boostRange']) $(id).oninput = refreshGeneticLabels;
    $('adaptiveMutation').onchange = refreshGeneticLabels;

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
