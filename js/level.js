/* level.js — Level-Datenmodell (JSON, Speichern/Laden) und Level-Editor (Drag & Drop) */
import { C, BLOCK_TYPES, overlap } from './engine.js';


  // ---------- Datenmodell ----------
  export const Level = {
    empty() {
      return { blocks: [], start: null, goal: null };
    },

    sample() {
      const B = (type, x, y, w, h) => ({ type, x, y, w, h, color: BLOCK_TYPES[type].color, solid: true });
      return {
        blocks: [
          B('ground', 0, 560, 520, 80),
          B('brick', 200, 520, 40, 40),
          B('brick', 240, 480, 40, 80),
          B('spike', 360, 540, 60, 20),
          B('lava', 520, 600, 80, 40),
          B('ground', 600, 560, 680, 80),
          B('cloud', 760, 470, 120, 20),
          B('metal', 900, 480, 40, 80),
          B('spike', 1020, 540, 40, 20),
        ],
        start: { x: 40, y: 520, w: C.START_SIZE.w, h: C.START_SIZE.h },
        goal: { x: 1200, y: 500, w: C.GOAL_SIZE.w, h: C.GOAL_SIZE.h },
      };
    },

    presets() {
      return [
        ['level-1','01 · Erste Schritte','Einfach'],
        ['level-2','02 · Kleine Stufe','Einfach'],
        ['level-3','03 · Zwei Sprünge','Einfach'],
        ['level-4','04 · Der erste Abgrund','Einfach'],
        ['level-5','05 · Treppenpfad','Einfach'],
        ['level-6','06 · Schmale Brücken','Fortgeschritten'],
        ['level-7','07 · Sägewerk','Fortgeschritten'],
        ['level-8','08 · Eisiger Aufstieg','Fortgeschritten'],
        ['level-9','09 · Förderband-Chaos','Fortgeschritten'],
        ['level-10','10 · Trampolinroute','Fortgeschritten'],
        ['level-11','11 · Ruinen-Labyrinth','Schwer'],
        ['level-12','12 · Laser-Korridor','Schwer'],
        ['level-13','13 · Säurekammern','Sehr schwer'],
        ['level-14','14 · Das Prüfungsfeld','Sehr schwer'],
        ['level-15','15 · Der Evo-Gipfel','Extrem'],
      ].map(([id, name, category]) => ({ id, name, category }));
    },

    preset(id) {
      const B = (type, x, y, w, h) => ({ type, x, y, w, h, color: BLOCK_TYPES[type].color, solid: true });
      const legacy = {
        easy: [B('ground',0,560,430,80),B('ground',470,560,810,80),B('brick',230,520,40,40),B('brick',270,480,40,80),B('spike',360,540,40,20),B('cloud',620,470,120,20)],
        gaps: [B('ground',0,560,260,80),B('ground',370,560,210,80),B('ground',700,560,205,80),B('ground',1030,560,250,80),B('lava',260,610,110,30),B('lava',580,610,120,30),B('lava',905,610,125,30),B('cloud',275,470,105,18),B('cloud',590,445,120,18),B('cloud',920,470,120,18),B('spike',175,540,40,20),B('spike',1080,540,40,20)],
        obstacles: [B('ground',0,560,1280,80),B('brick',180,520,40,40),B('brick',220,480,40,80),B('spike',350,540,80,20),B('saw',500,520,40,40),B('wall',650,440,40,120),B('platform',735,465,135,16),B('spike',910,540,80,20),B('convR',1030,540,100,20),B('metal',1150,480,40,80)]
      };
      if (legacy[id]) return { blocks: JSON.parse(JSON.stringify(legacy[id])), start:{x:40,y:520,w:C.START_SIZE.w,h:C.START_SIZE.h}, goal:{x:1200,y:500,w:C.GOAL_SIZE.w,h:C.GOAL_SIZE.h} };
      const layouts = {
        1: [["ground",0,560,1280,80],["brick",250,520,40,40],["cloud",520,485,130,18],["brick",830,520,40,40]],
        2: [["ground",0,560,1280,80],["brick",180,520,40,40],["brick",220,480,40,80],["cloud",430,470,120,18],["brick",720,520,80,40],["cloud",980,455,130,18]],
        3: [["ground",0,560,320,80],["ground",390,560,390,80],["ground",850,560,430,80],["cloud",315,475,100,18],["cloud",700,455,110,18],["spike",570,540,40,20]],
        4: [["ground",0,560,360,80],["ground",500,560,300,80],["ground",940,560,340,80],["lava",360,610,140,30],["lava",800,610,140,30],["cloud",380,470,110,18],["cloud",810,450,110,18]],
        5: [["ground",0,560,1280,80],["brick",180,520,80,40],["brick",300,480,80,80],["brick",430,440,80,120],["cloud",570,410,120,18],["brick",760,480,80,80],["brick",900,520,80,40],["spike",1060,540,60,20]],
        6: [["ground",0,560,190,80],["ground",330,560,170,80],["ground",650,560,180,80],["ground",980,560,300,80],["bridge",190,490,140,16],["bridge",500,455,150,16],["bridge",830,475,150,16],["spike",110,540,40,20],["spike",730,540,40,20]],
        7: [["ground",0,560,1280,80],["saw",210,510,42,42],["saw",420,470,42,42],["saw",650,510,42,42],["saw",880,465,42,42],["saw",1080,510,42,42],["platform",300,470,100,16],["platform",740,445,100,16]],
        8: [["snow",0,560,1280,80],["ice",120,520,180,40],["spike",340,540,60,20],["cloud",420,465,130,18],["ice",600,520,160,40],["spike",800,540,60,20],["platform",900,455,130,16],["snow",1080,520,200,40]],
        9: [["ground",0,560,1280,80],["convR",120,540,180,20],["convL",360,540,180,20],["boostR",600,540,120,20],["convL",780,540,160,20],["boostR",1000,540,140,20],["spike",550,520,40,20],["saw",900,480,40,40]],
        10: [["ground",0,560,1280,80],["bounce",160,540,70,20],["platform",300,430,120,16],["superBounce",490,540,80,20],["platform",650,380,140,16],["bounce",860,540,70,20],["cloud",990,420,130,18],["spike",1120,540,50,20]],
        11: [["moss",0,560,1280,80],["wall",170,440,45,120],["platform",230,470,120,16],["brick",390,480,45,80],["spike",500,540,70,20],["wall",620,400,45,160],["bridge",690,435,120,16],["saw",850,500,42,42],["wall",990,430,45,130],["cloud",1050,390,120,18]],
        12: [["metal",0,560,1280,80],["laser",190,420,20,140],["platform",260,475,120,16],["spike",410,540,60,20],["laser",540,390,20,170],["platform",610,440,120,16],["saw",770,500,42,42],["laser",900,410,20,150],["bridge",970,465,130,16],["spike",1130,540,60,20]],
        13: [["metal",0,560,1280,80],["acid",150,540,110,30],["platform",270,465,100,16],["thorns",410,535,70,25],["acid",530,540,120,30],["wall",690,420,45,140],["spikeDown",760,390,45,20],["platform",820,450,100,16],["acid",960,540,120,30],["fire",1110,500,60,30]],
        14: [["obsidian",0,560,1280,80],["wall",130,440,45,120],["saw",230,500,42,42],["laser",330,405,18,155],["platform",390,455,110,16],["acid",530,540,90,30],["wall",660,390,45,170],["spikeDown",730,380,45,20],["saw",820,490,42,42],["laser",930,400,18,160],["platform",990,450,110,16],["fire",1140,500,60,30]],
        15: [["metal",0,560,1280,80],["lava",110,600,140,40],["platform",170,445,100,16],["laser",300,390,18,170],["saw",380,495,42,42],["acid",470,540,100,30],["wall",600,370,50,190],["spikeDown",660,350,50,20],["superBounce",740,540,70,20],["laser",850,380,18,180],["thorns",920,535,80,25],["saw",1030,470,42,42],["fire",1130,500,60,30]],
      };
      const match = /^level-(\\d+)$/.exec(id || '');
      const n = match ? Math.max(1, Math.min(15, +match[1])) : 1;
      return {
        blocks: layouts[n].map(([type,x,y,w,h]) => B(type,x,y,w,h)),
        start: { x:40, y:520, w:C.START_SIZE.w, h:C.START_SIZE.h },
        goal: { x:1200, y:500, w:C.GOAL_SIZE.w, h:C.GOAL_SIZE.h }
      };
    },

    toJSON(level) {
      return JSON.parse(JSON.stringify(level));
    },

    // Prüft/bereinigt importierte Daten. Wirft Error bei unbrauchbarem Format.
    sanitize(obj) {
      if (!obj || typeof obj !== 'object' || !Array.isArray(obj.blocks)) throw new Error('Kein gültiges Level.');
      const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
      const out = { blocks: [], start: null, goal: null };
      for (const b of obj.blocks) {
        if (!b || !BLOCK_TYPES[b.type]) continue;
        const def = BLOCK_TYPES[b.type];
        out.blocks.push({
          type: b.type,
          x: num(b.x, 0),
          y: num(b.y, 0),
          w: Math.max(10, num(b.w, def.w)),
          h: Math.max(10, num(b.h, def.h)),
          color: typeof b.color === 'string' && /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : def.color,
          solid: b.solid !== false,
        });
      }
      if (obj.start && isFinite(obj.start.x) && isFinite(obj.start.y)) out.start = { x: obj.start.x, y: obj.start.y, w: C.START_SIZE.w, h: C.START_SIZE.h };
      if (obj.goal && isFinite(obj.goal.x) && isFinite(obj.goal.y)) out.goal = { x: obj.goal.x, y: obj.goal.y, w: C.GOAL_SIZE.w, h: C.GOAL_SIZE.h };
      return out;
    },
  };

  // ---------- Editor ----------
  const HANDLE = 14; // Größe des Resize-Griffs (Welt-Pixel)

  export const Editor = {
    level: null,
    canvas: null,
    onChange: null,
    isLocked: () => false,
    armed: null, // { kind:'block', type } | { kind:'start' } | { kind:'goal' }
    selected: null, // Block-Objekt | 'start' | 'goal' | null
    gridOn: true,
    hover: null, // {x,y} Weltkoordinate für Vorschau
    drag: null,
    paletteDragType: null,

    init(opts) {
      this.canvas = opts.canvas;
      this.level = opts.level;
      this.onChange = opts.onChange || function () {};
      this.isLocked = opts.isLocked || this.isLocked;
      this.onSelect = opts.onSelect || function () {};
      this.onArm = opts.onArm || function () {};
      this._bind();
    },

    setLevel(level) {
      this.level = level;
      this.selected = null;
      this.drag = null;
      this.onSelect(null);
    },

    snap(v) {
      return this.gridOn ? Math.round(v / C.GRID) * C.GRID : Math.round(v);
    },

    toWorld(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * C.W, y: ((e.clientY - r.top) / r.height) * C.H };
    },

    arm(a) {
      this.armed = a;
      this.onArm(a);
    },

    clampBlock(b) {
      b.w = Math.max(10, Math.min(C.W, b.w));
      b.h = Math.max(10, Math.min(C.H, b.h));
      b.x = Math.max(0, Math.min(C.W - b.w, b.x));
      b.y = Math.max(0, Math.min(C.H - b.h, b.y));
    },

    // ---- Hit-Tests ----
    markerAt(p) {
      const L = this.level;
      for (const k of ['goal', 'start']) {
        const m = L[k];
        if (m && overlap({ x: p.x, y: p.y, w: 1, h: 1 }, m)) return k;
      }
      return null;
    },
    blockAt(p) {
      const bl = this.level.blocks;
      for (let i = bl.length - 1; i >= 0; i--) {
        const b = bl[i];
        if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b;
      }
      return null;
    },
    onHandle(p) {
      const s = this.selected;
      if (!s || typeof s === 'string') return false;
      return p.x >= s.x + s.w - HANDLE && p.x <= s.x + s.w + 4 && p.y >= s.y + s.h - HANDLE && p.y <= s.y + s.h + 4;
    },

    // ---- Aktionen ----
    placeBlock(type, cx, cy, centered) {
      const def = BLOCK_TYPES[type];
      const b = { type, x: 0, y: 0, w: def.w, h: def.h, color: def.color, solid: true };
      b.x = this.snap(centered ? cx - b.w / 2 : cx);
      b.y = this.snap(centered ? cy - b.h / 2 : cy);
      this.clampBlock(b);
      this.level.blocks.push(b);
      this.select(b);
      this.onChange();
      return b;
    },
    placeMarker(kind, cx, cy) {
      const size = kind === 'start' ? C.START_SIZE : C.GOAL_SIZE;
      const m = { x: this.snap(cx - size.w / 2), y: this.snap(cy - size.h / 2), w: size.w, h: size.h };
      m.x = Math.max(0, Math.min(C.W - m.w, m.x));
      m.y = Math.max(0, Math.min(C.H - m.h, m.y));
      this.level[kind] = m;
      this.select(kind);
      this.onChange();
    },
    deleteSelected() {
      const s = this.selected;
      if (!s || typeof s === 'string') return;
      const i = this.level.blocks.indexOf(s);
      if (i >= 0) this.level.blocks.splice(i, 1);
      this.select(null);
      this.onChange();
    },
    select(s) {
      this.selected = s;
      this.onSelect(s);
    },

    // ---- Events ----
    _bind() {
      const cv = this.canvas;
      const self = this;

      cv.addEventListener('pointerdown', (e) => {
        if (e.button === 2) return;
        if (self.isLocked()) return;
        const p = self.toWorld(e);
        if (self.onHandle(p)) {
          self.drag = { mode: 'resize', moved: false };
          cv.setPointerCapture(e.pointerId);
          return;
        }
        const m = self.markerAt(p);
        if (m) {
          self.select(m);
          self.drag = { mode: 'move', offX: p.x - self.level[m].x, offY: p.y - self.level[m].y, moved: false };
          cv.setPointerCapture(e.pointerId);
          return;
        }
        const b = self.blockAt(p);
        if (b) {
          self.select(b);
          self.drag = { mode: 'move', offX: p.x - b.x, offY: p.y - b.y, moved: false };
          cv.setPointerCapture(e.pointerId);
          return;
        }
        // leerer Bereich
        if (self.armed) {
          if (self.armed.kind === 'block') self.placeBlock(self.armed.type, p.x, p.y, true);
          else {
            self.placeMarker(self.armed.kind, p.x, p.y);
            self.arm(null);
          }
        } else self.select(null);
      });

      cv.addEventListener('pointermove', (e) => {
        const p = self.toWorld(e);
        self.hover = p;
        const d = self.drag;
        if (!d) {
          if (!self.isLocked()) {
            cv.style.cursor = self.onHandle(p) ? 'nwse-resize' : self.markerAt(p) || self.blockAt(p) ? 'move' : self.armed ? 'copy' : 'default';
          } else cv.style.cursor = 'default';
          return;
        }
        const s = self.selected;
        if (d.mode === 'move') {
          if (typeof s === 'string') {
            const m = self.level[s];
            m.x = Math.max(0, Math.min(C.W - m.w, self.snap(p.x - d.offX)));
            m.y = Math.max(0, Math.min(C.H - m.h, self.snap(p.y - d.offY)));
          } else if (s) {
            s.x = self.snap(p.x - d.offX);
            s.y = self.snap(p.y - d.offY);
            self.clampBlock(s);
          }
          d.moved = true;
        } else if (d.mode === 'resize' && s && typeof s !== 'string') {
          s.w = Math.max(self.gridOn ? C.GRID : 10, self.snap(p.x - s.x));
          s.h = Math.max(self.gridOn ? C.GRID : 10, self.snap(p.y - s.y));
          self.clampBlock(s);
          d.moved = true;
        }
        if (d.moved) {
          self.onSelect(s, true);
          // Live-Editor: Bewegungen gelten schon während des Ziehens für die
          // laufende Simulation, nicht erst beim Loslassen der Maustaste.
          self.onChange();
        }
      });

      const end = () => {
        const d = self.drag;
        self.drag = null;
        if (d && d.moved) self.onChange();
      };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      cv.addEventListener('pointerleave', () => { self.hover = null; });

      cv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (self.isLocked()) return;
        const p = self.toWorld(e);
        const b = self.blockAt(p);
        if (b) { self.select(b); self.deleteSelected(); }
        else { self.arm(null); self.select(null); }
      });

      // HTML5 Drag & Drop aus der Palette
      cv.addEventListener('dragover', (e) => {
        if (self.isLocked() || !self.paletteDragType) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        self.hover = self.toWorld(e);
      });
      cv.addEventListener('dragleave', () => { self.hover = null; });
      cv.addEventListener('drop', (e) => {
        if (self.isLocked()) return;
        e.preventDefault();
        const t = self.paletteDragType || (e.dataTransfer.getData('text/plain') || '').replace('block:', '');
        self.paletteDragType = null;
        if (!BLOCK_TYPES[t]) return;
        const p = self.toWorld(e);
        self.placeBlock(t, p.x, p.y, true);
      });

      document.addEventListener('keydown', (e) => {
        const tag = (e.target && e.target.tagName) || '';
        if (/INPUT|SELECT|TEXTAREA/.test(tag)) return;
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (!self.isLocked() && self.selected) { e.preventDefault(); self.deleteSelected(); }
        } else if (e.key === 'Escape') {
          self.arm(null);
          self.select(null);
        }
      });
    },

    // Palette-Kachel verbinden (draggable + Klick = "armed")
    bindPaletteTile(el, type) {
      const self = this;
      el.addEventListener('dragstart', (e) => {
        if (self.isLocked()) { e.preventDefault(); return; }
        self.paletteDragType = type;
        e.dataTransfer.setData('text/plain', 'block:' + type);
        e.dataTransfer.effectAllowed = 'copy';
      });
      el.addEventListener('dragend', () => { self.paletteDragType = null; self.hover = null; });
      el.addEventListener('click', () => {
        if (self.isLocked()) return;
        const same = self.armed && self.armed.kind === 'block' && self.armed.type === type;
        self.arm(same ? null : { kind: 'block', type });
      });
    },

    // Raster, Auswahl, Vorschau
    drawOverlay(ctx, show) {
      if (!show) return;
      if (this.gridOn) {
        ctx.save();
        ctx.lineWidth = 1;
        for (let x = 0; x <= C.W; x += C.GRID) {
          ctx.strokeStyle = x % 40 === 0 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.05)';
          ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, C.H); ctx.stroke();
        }
        for (let y = 0; y <= C.H; y += C.GRID) {
          ctx.strokeStyle = y % 40 === 0 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.05)';
          ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(C.W, y + 0.5); ctx.stroke();
        }
        ctx.restore();
      }
      const s = this.selected;
      if (s) {
        const r = typeof s === 'string' ? this.level[s] : s;
        if (r) {
          ctx.save();
          ctx.strokeStyle = '#1976d2';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
          ctx.setLineDash([]);
          if (typeof s !== 'string') {
            ctx.fillStyle = '#1976d2';
            ctx.fillRect(r.x + r.w - HANDLE + 4, r.y + r.h - HANDLE + 4, HANDLE - 4, HANDLE - 4);
          }
          ctx.restore();
        }
      }
      // Vorschau-Block beim Platzieren
      const t = this.paletteDragType ? { kind: 'block', type: this.paletteDragType } : this.armed;
      if (t && this.hover && !this.drag) {
        let w, h;
        if (t.kind === 'block') { w = BLOCK_TYPES[t.type].w; h = BLOCK_TYPES[t.type].h; }
        else { const sz = t.kind === 'start' ? C.START_SIZE : C.GOAL_SIZE; w = sz.w; h = sz.h; }
        const x = this.snap(this.hover.x - w / 2), y = this.snap(this.hover.y - h / 2);
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = t.kind === 'start' ? '#2ecc71' : t.kind === 'goal' ? '#e53935' : BLOCK_TYPES[t.type].color;
        ctx.fillRect(x, y, w, h);
        ctx.restore();
      }
      if (!this.level.blocks.length && !this.level.start && !this.level.goal) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.font = '600 24px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Ziehe Blöcke aus der Palette hierher – oder lade das Beispiel-Level', C.W / 2, C.H / 2);
        ctx.restore();
      }
    },
  };
