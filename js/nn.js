/* nn.js — Mehrschichtiges neuronales Netz für Ki-Evo.
   Das Genom enthält Gewichte und Biases jeder Schicht in einem Float32Array. */
export const LAYERS = [65, 32, 24, 12, 2];
export const PREVIOUS_LAYERS = [65, 12, 8, 2];
export const LEGACY_LAYERS = [14, 12, 8, 2];
export const OLDEST_LAYERS = [6, 12, 8, 2];
export const OLDER_SEMANTIC_LAYERS = [28, 12, 8, 2];

export function genomeSizeFor(layers = LAYERS) {
  let size = 0;
  for (let layer = 0; layer < layers.length - 1; layer++) {
    size += layers[layer] * layers[layer + 1] + layers[layer + 1];
  }
  return size;
}
export function genomeSize() { return genomeSizeFor(LAYERS); }

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
  const genome = new Float32Array(genomeSize());
  let offset = 0;
  for (let layer = 0; layer < LAYERS.length - 1; layer++) {
    const inputCount = LAYERS[layer], outputCount = LAYERS[layer + 1];
    const std = 1.5 / Math.sqrt(inputCount);
    const weightCount = inputCount * outputCount;
    for (let i = 0; i < weightCount; i++) genome[offset++] = rng.gauss() * std;
    for (let i = 0; i < outputCount; i++) genome[offset++] = rng.gauss() * 0.3;
  }
  return genome;
}

const bufA = new Float32Array(32);
const bufB = new Float32Array(32);

export function forward(genome, input, out, trace) {
  let src = input;
  let dst = bufA;
  let offset = 0;
  const last = LAYERS.length - 2;
  if (trace) {
    if (!trace.activations || trace.activations.length !== LAYERS.length) {
      trace.activations = LAYERS.map((count) => new Float32Array(count));
    }
    trace.activations[0].set(input);
    trace.genome = genome;
  }
  for (let layer = 0; layer <= last; layer++) {
    const inputCount = LAYERS[layer], outputCount = LAYERS[layer + 1];
    for (let neuron = 0; neuron < outputCount; neuron++) {
      let sum = 0;
      for (let i = 0; i < inputCount; i++) sum += genome[offset + neuron * inputCount + i] * src[i];
      sum += genome[offset + inputCount * outputCount + neuron];
      dst[neuron] = layer === last
        ? (neuron === 0 ? Math.tanh(sum) : 1 / (1 + Math.exp(-sum)))
        : Math.tanh(sum);
    }
    if (trace) trace.activations[layer + 1].set(dst.subarray(0, outputCount));
    offset += inputCount * outputCount + outputCount;
    src = dst;
    dst = dst === bufA ? bufB : bufA;
  }
  out[0] = src[0];
  out[1] = src[1];
  return out;
}

// Migriert ältere Netze, indem vorhandene Neuronen/Gewichte übernommen und
// zusätzliche Neuronen mit kleinen Zufallsgewichten sinnvoll initialisiert werden.
export function upgradeLegacyGenome(oldGenome) {
  const layouts = [PREVIOUS_LAYERS, OLDER_SEMANTIC_LAYERS, LEGACY_LAYERS, OLDEST_LAYERS];
  const oldLayers = layouts.find((layers) => oldGenome instanceof Float32Array
    && oldGenome.length === genomeSizeFor(layers));
  if (!oldLayers) throw new Error('Alte KI-Datei hat eine unerwartete Netzwerkgröße.');

  let seed = oldGenome.length;
  for (let i = 0; i < oldGenome.length; i += 17) seed = (Math.imul(seed, 31) + Math.round(oldGenome[i] * 10000)) >>> 0;
  const upgraded = randomGenome(makeRng(seed));
  let oldOffset = 0;
  for (let oldLayer = 0; oldLayer < oldLayers.length - 1; oldLayer++) {
    const newLayer = oldLayer === oldLayers.length - 2 ? LAYERS.length - 2 : oldLayer;
    const oldIn = oldLayers[oldLayer], oldOut = oldLayers[oldLayer + 1];
    const newIn = LAYERS[newLayer], newOut = LAYERS[newLayer + 1];
    const newOffset = genomeSizeFor(LAYERS.slice(0, newLayer + 1)) - LAYERS[newLayer + 1];
    const copyIn = Math.min(oldIn, newIn), copyOut = Math.min(oldOut, newOut);
    for (let neuron = 0; neuron < copyOut; neuron++) {
      for (let inputIndex = 0; inputIndex < copyIn; inputIndex++) {
        upgraded[newOffset + neuron * newIn + inputIndex] =
          oldGenome[oldOffset + neuron * oldIn + inputIndex];
      }
      upgraded[newOffset + newIn * newOut + neuron] =
        oldGenome[oldOffset + oldIn * oldOut + neuron];
    }
    oldOffset += oldIn * oldOut + oldOut;
  }
  return upgraded;
}
