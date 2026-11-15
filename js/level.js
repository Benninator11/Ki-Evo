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

    preset(id) {
      const B = (type, x, y, w, h) => ({ type, x, y, w, h, color: BLOCK_TYPES[type].color, solid: true });
      const levels = {
        easy: {
          blocks: [B('ground', 0, 560, 430, 80), B('ground', 470, 560, 810, 80), B('brick', 230, 520, 40, 40), B('brick', 270, 480, 40, 80), B('spike', 360, 540, 40, 20), B('cloud', 620, 470, 120, 20)],
          start: { x: 40, y: 520, w: C.START_SIZE.w, h: C.START_SIZE.h }, goal: { x: 1200, y: 500, w: C.GOAL_SIZE.w, h: C.GOAL_SIZE.h },
        },
        gaps: {
          blocks: [B('ground', 0, 560, 260, 80), B('ground', 370, 560, 210, 80), B('ground', 700, 560, 205, 80), B('ground', 1030, 560, 250, 80), B('lava', 260, 610, 110, 30), B('lava', 580, 610, 120, 30), B('lava', 905, 610, 125, 30), B('cloud', 275, 470, 105, 18), B('cloud', 590, 445, 120, 18), B('cloud', 920, 470, 120, 18), B('spike', 175, 540, 40, 20), B('spike', 1080, 540, 40, 20)],
          start: { x: 40, y: 520, w: C.START_SIZE.w, h: C.START_SIZE.h }, goal: { x: 1200, y: 500, w: C.GOAL_SIZE.w, h: C.GOAL_SIZE.h },
        },
        obstacles: {
          blocks: [B('ground', 0, 560, 1280, 80), B('brick', 180, 520, 40, 40), B('brick', 220, 480, 40, 80), B('spike', 350, 540, 80, 20), B('saw', 500, 520, 40, 40), B('wall', 650, 440, 40, 120), B('platform', 735, 465, 135, 16), B('spike', 910, 540, 80, 20), B('convR', 1030, 540, 100, 20), B('metal', 1150, 480, 40, 80)],
          start: { x: 40, y: 520, w: C.START_SIZE.w, h: C.START_SIZE.h }, goal: { x: 1200, y: 460, w: C.GOAL_SIZE.w, h: C.GOAL_SIZE.h },
        },
      };
      const selected = levels[id] || levels.easy;
      return JSON.parse(JSON.stringify(selected));
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
