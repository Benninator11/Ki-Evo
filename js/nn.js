/* nn.js — Neuronales Netz (MLP) in reinem JavaScript.
   Das Genom ist ein flaches Float32Array mit allen Gewichten/Biases.
   Layout je Schicht: erst Gewichte (in*out, zeilenweise je Ausgang), dann Biases (out). */
(function () {
  'use strict';
  const PK = (window.PK = window.PK || {});
  const LAYERS = [6, 12, 8, 2];
  function genomeSize() {
    let n = 0;
    for (let l = 0; l < LAYERS.length - 1; l++) n += LAYERS[l] * LAYERS[l + 1] + LAYERS[l + 1];
    return n;
  }
  function makeRng(seed) {
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
  function randomGenome(rng) {
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
  function forward(genome, input, out) {
    let src = input, dst = bufA, p = 0;
    const last = LAYERS.length - 2;
    for (let l = 0; l <= last; l++) {
      const nin = LAYERS[l], nout = LAYERS[l + 1];
      for (let o = 0; o < nout; o++) {
        let s = 0;
        for (let i = 0; i < nin; i++) s += genome[p + o * nin + i] * src[i];
        s += genome[p + nin * nout + o];
        if (l === last) dst[o] = o === 0 ? Math.tanh(s) : 1 / (1 + Math.exp(-s));
        else dst[o] = Math.tanh(s);
      }
      p += nin * nout + nout;
      src = dst;
      dst = dst === bufA ? bufB : bufA;
    }
    out[0] = src[0]; out[1] = src[1];
    return out;
  }
  PK.NN = { LAYERS, genomeSize, randomGenome, forward, makeRng };
})();