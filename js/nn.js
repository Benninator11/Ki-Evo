/* nn.js — Neuronales Netz (MLP) in reinem JavaScript.
   Das Genom ist ein flaches Float32Array mit allen Gewichten/Biases.
   Layout je Schicht: erst Gewichte (in*out, zeilenweise je Ausgang), dann Biases (out). */

  // Eingabe 14 -> 12 -> 8 -> Ausgabe 2 (links/rechts, springen)
  export const LAYERS = [14, 12, 8, 2];
export const LEGACY_LAYERS = [6, 12, 8, 2];

  export function genomeSize() {
    let n = 0;
    for (let l = 0; l < LAYERS.length - 1; l++) n += LAYERS[l] * LAYERS[l + 1] + LAYERS[l + 1];
    return n;
  }

  // Seedbarer Zufall (mulberry32) -> reproduzierbare GA-Läufe
  export function makeRng(seed) {
    let s = seed >>> 0;
    const rng = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.gauss = function () {
      let u = 0;
      while (u === 0) u = rng();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
    };
    return rng;
  }

  export function randomGenome(rng) {
    const g = new Float32Array(genomeSize());
    let p = 0;
    for (let l = 0; l < LAYERS.length - 1; l++) {
      const std = 1.5 / Math.sqrt(LAYERS[l]);
      const nw = LAYERS[l] * LAYERS[l + 1];
      for (let i = 0; i < nw; i++) g[p++] = rng.gauss() * std;
      for (let i = 0; i < LAYERS[l + 1]; i++) g[p++] = rng.gauss() * 0.3;
    }
    return g;
  }

  const bufA = new Float32Array(32);
  const bufB = new Float32Array(32);

  // Vorwärtsdurchlauf. out[0] = Bewegung (-1..1, tanh), out[1] = Springen (0..1, sigmoid)
  export function forward(genome, input, out, trace) {
    let src = input;
    let dst = bufA;
    let p = 0;
    const last = LAYERS.length - 2;
    if (trace) {
      if (!trace.activations || trace.activations.length !== LAYERS.length) trace.activations = LAYERS.map((n) => new Float32Array(n));
      trace.activations[0].set(input);
      trace.genome = genome;
    }
    for (let l = 0; l <= last; l++) {
      const nin = LAYERS[l], nout = LAYERS[l + 1];
      for (let o = 0; o < nout; o++) {
        let s = 0;
        for (let i = 0; i < nin; i++) s += genome[p + o * nin + i] * src[i];
        s += genome[p + nin * nout + o];
        if (l === last) dst[o] = o === 0 ? Math.tanh(s) : 1 / (1 + Math.exp(-s));
        else dst[o] = Math.tanh(s);
      }
      if (trace) trace.activations[l + 1].set(dst.subarray(0, nout));
      p += nin * nout + nout;
      src = dst;
      dst = dst === bufA ? bufB : bufA;
    }
    out[0] = src[0];
    out[1] = src[1];
    return out;
  }


// Migriert gespeicherte Version-1-Netze (6 Eingaben) auf die neue 14-Sensor-Architektur.
// Die bisherigen Gewichte bleiben erhalten; neue Raycast-Verbindungen starten neutral.
export function upgradeLegacyGenome(oldGenome) {
  const oldFirstSize = LEGACY_LAYERS[0] * LEGACY_LAYERS[1] + LEGACY_LAYERS[1];
  const newFirstSize = LAYERS[0] * LAYERS[1] + LAYERS[1];
  const expectedOld = oldFirstSize
    + LEGACY_LAYERS[1] * LEGACY_LAYERS[2] + LEGACY_LAYERS[2]
    + LEGACY_LAYERS[2] * LEGACY_LAYERS[3] + LEGACY_LAYERS[3];
  if (!(oldGenome instanceof Float32Array) || oldGenome.length !== expectedOld) {
    throw new Error('Alte KI-Datei hat eine unerwartete Netzwerkgröße.');
  }
  const upgraded = new Float32Array(genomeSize());
  for (let neuron = 0; neuron < LEGACY_LAYERS[1]; neuron++) {
    for (let input = 0; input < LEGACY_LAYERS[0]; input++) {
      upgraded[neuron * LAYERS[0] + input] = oldGenome[neuron * LEGACY_LAYERS[0] + input];
    }
    upgraded[LAYERS[0] * LAYERS[1] + neuron] = oldGenome[LEGACY_LAYERS[0] * LEGACY_LAYERS[1] + neuron];
  }
  upgraded.set(oldGenome.subarray(oldFirstSize), newFirstSize);
  return upgraded;
}