/* ai.js — Genetischer Algorithmus über die NN-Gewichte (Genome).
   Selektion: Turnier · Crossover: uniform · Mutation: Gauß-Rauschen · Elitismus: bester Agent bleibt unverändert */
import { makeRng, randomGenome } from './nn.js';


  const TOURNAMENT_K = 3;
  const MUT_SIGMA = 0.35;

  export class GA {
    constructor(seed) {
      this.rng = makeRng(seed);
      // bester je gesehener Agent für das aktuelle Level (nötig für Populationsgröße 1)
      this.best = { genome: null, fitness: -Infinity };
    }

    initialGenomes(n, seedGenome, mutRate) {
      const out = [];
      for (let i = 0; i < n; i++) {
        if (seedGenome) out.push(i === 0 ? Float32Array.from(seedGenome) : this.mutate(seedGenome, Math.max(mutRate, 0.1)));
        else out.push(randomGenome(this.rng));
      }
      return out;
    }

    mutate(genome, rate) {
      const g = Float32Array.from(genome);
      for (let i = 0; i < g.length; i++) {
        if (this.rng() < rate) g[i] += this.rng.gauss() * MUT_SIGMA;
      }
      return g;
    }

    crossover(a, b) {
      const c = new Float32Array(a.length);
      for (let i = 0; i < c.length; i++) c[i] = this.rng() < 0.5 ? a[i] : b[i];
      return c;
    }

    tournament(fitness) {
      let best = -1;
      for (let k = 0; k < TOURNAMENT_K; k++) {
        const i = Math.floor(this.rng() * fitness.length);
        if (best < 0 || fitness[i] > fitness[best]) best = i;
      }
      return best;
    }

    // Erzeugt die nächste Generation. Gibt { genomes, bestIndex, bestFitness } zurück.
    nextGeneration(genomes, fitness, popSize, mutRate) {
      let bi = 0;
      for (let i = 1; i < fitness.length; i++) if (fitness[i] > fitness[bi]) bi = i;
      if (fitness[bi] > this.best.fitness) this.best = { genome: Float32Array.from(genomes[bi]), fitness: fitness[bi] };

      const next = [];
      if (popSize < 2) {
        // Einzelner Agent: Hill-Climbing um den besten bekannten Stand
        next.push(this.mutate(this.best.genome, Math.max(mutRate, 0.05)));
      } else {
        next.push(Float32Array.from(genomes[bi])); // Elite unverändert
        while (next.length < popSize) {
          const pa = this.tournament(fitness);
          let pb = this.tournament(fitness);
          if (pb === pa && genomes.length > 1) pb = (pb + 1 + Math.floor(this.rng() * (genomes.length - 1))) % genomes.length;
          next.push(this.mutate(this.crossover(genomes[pa], genomes[pb]), mutRate));
        }
      }
      return { genomes: next, bestIndex: bi, bestFitness: fitness[bi] };
    }

    // Level geändert -> alte Bestwerte sind nicht mehr vergleichbar
    resetBestFitness() {
      this.best.fitness = -Infinity;
    }
  }