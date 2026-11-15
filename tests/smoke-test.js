import assert from 'node:assert/strict';
import { C, createAgent, sense, stepAgent, fitness, BLOCK_TYPES, assistControl } from '../js/engine.js';
import { LAYERS, genomeSize, randomGenome, makeRng, forward, upgradeLegacyGenome, LEGACY_LAYERS } from '../js/nn.js';
import { GA } from '../js/ai.js';
import { Level } from '../js/level.js';

assert.deepEqual(LAYERS, [28, 12, 8, 2]);
assert.equal(genomeSize(), 28 * 12 + 12 + 12 * 8 + 8 + 8 * 2 + 2);
const easy = Level.preset('easy');
assert.ok(easy.start && easy.goal && easy.blocks.length >= 4);
assert.ok(Level.preset('gaps').blocks.some((b) => b.type === 'lava'));
assert.ok(Level.preset('obstacles').blocks.some((b) => b.type === 'saw'));
const agent = createAgent(easy);
const input = new Float32Array(LAYERS[0]);
sense(agent, easy, input);
assert.equal(input.length, 28);
assert.equal(agent.rays.length, 18);
assert.ok(input.slice(24).every(Number.isFinite));
assert.ok(input.every(Number.isFinite));
assert.equal(agent.rays[0].kind, 'solid', 'The starter preset contains a forward obstacle.');

const sensorLevel = {
  start: { x: 20, y: 100, w: 40, h: 40 },
  goal: { x: 400, y: 100, w: 40, h: 60 },
  blocks: [{ type: 'wall', x: 95, y: 80, w: 30, h: 90, solid: true }],
};
const sensorAgent = createAgent(sensorLevel);
const sensorInput = new Float32Array(LAYERS[0]);
sense(sensorAgent, sensorLevel, sensorInput);
assert.equal(sensorAgent.rays.length, 18);
assert.equal(sensorAgent.rays[0].kind, 'solid', 'The forward ray must detect a wall.');
assert.ok(sensorAgent.rays[8].x2 < sensorAgent.rays[8].x1, 'The rear ray must point behind the agent.');
assert.ok(sensorInput[6] > 0 && sensorInput[6] < 1, 'The wall distance must be normalized.');
sensorAgent.onGround = true; // Reflexsprünge werden nur am Boden ausgelöst.
const wallReflex = assistControl(sensorAgent, sensorInput, new Float32Array([0.2, 0]));
assert.equal(wallReflex.jump, true, 'The reflex controller should jump before a nearby wall.');
assert.equal(wallReflex.assistedJump, true);

const baselineFitness = fitness({ startDist: 100, bestDist: 80, exploration: 0, idle: 0 }, 1200);
const exploredFitness = fitness({ startDist: 100, bestDist: 80, exploration: 2, idle: 0 }, 1200);
const idleFitness = fitness({ startDist: 100, bestDist: 80, exploration: 0, idle: 100 }, 1200);
assert.ok(exploredFitness > baselineFitness, 'Exploring new cells should improve fitness.');
assert.ok(idleFitness < baselineFitness, 'Long inactivity should reduce fitness.');
const rng = makeRng(1234);
const genome = randomGenome(rng);
const out = new Float32Array(2);
const trace = {};
forward(genome, input, out, trace);
assert.equal(trace.activations.length, 4);
assert.ok(out.every(Number.isFinite));
const oldLength = LEGACY_LAYERS[0] * LEGACY_LAYERS[1] + LEGACY_LAYERS[1] + LEGACY_LAYERS[1] * LEGACY_LAYERS[2] + LEGACY_LAYERS[2] + LEGACY_LAYERS[2] * LEGACY_LAYERS[3] + LEGACY_LAYERS[3];
const oldGenome = new Float32Array(oldLength).fill(0.125);
const migrated = upgradeLegacyGenome(oldGenome);
assert.equal(migrated.length, genomeSize());
const previousLength = 14 * 12 + 12 + 12 * 8 + 8 + 8 * 2 + 2;
const previousGenome = new Float32Array(previousLength).fill(0.25);
const migratedPrevious = upgradeLegacyGenome(previousGenome);
assert.equal(migratedPrevious.length, genomeSize());
assert.equal(migratedPrevious[0], previousGenome[0]);
assert.equal(migrated[0], oldGenome[0]);
assert.equal(migrated[28 * 12], oldGenome[6 * 12]);
const ga = new GA(99);
const genomes = ga.initialGenomes(6, migrated, 0.1);
const next = ga.nextGeneration(genomes, genomes.map((_, i) => i), 6, 0.1);
assert.equal(next.genomes.length, 6);
assert.ok(next.genomes.every((g) => g.length === genomeSize()));
const largeGa = new GA(100);
const largeGenomes = largeGa.initialGenomes(16, migrated, 0.1);
const largeNext = largeGa.nextGeneration(largeGenomes, largeGenomes.map((_, i) => i), 16, 0.1);
assert.equal(largeNext.genomes.length, 16, 'Adaptive mutation and two elites must preserve population size.');
assert.ok(Number.isFinite(fitness(agent, 1200)));
stepAgent(agent, easy, { move: 1, jump: false }, 1);
console.log('Ki-Evo smoke tests passed.');