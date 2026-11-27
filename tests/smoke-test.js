import assert from 'node:assert/strict';
import { C, createAgent, sense, stepAgent, fitness, BLOCK_TYPES, BLOCK_TYPE_KEYS, assistControl, reconcileAgentsAfterLevelEdit } from '../js/engine.js';
import { LAYERS, genomeSize, randomGenome, makeRng, forward, upgradeLegacyGenome, genomeSizeFor, PREVIOUS_LAYERS, LEGACY_LAYERS, OLDEST_LAYERS } from '../js/nn.js';
import { GA, MAX_POPULATION } from '../js/ai.js';
import { Level } from '../js/level.js';

assert.deepEqual(LAYERS, [77, 40, 28, 14, 2]);
assert.equal(genomeSize(), 4704, 'The expanded network should expose 4,704 trainable parameters.');
assert.equal(BLOCK_TYPE_KEYS.length, 36);
assert.equal(genomeSize(), 77 * 40 + 40 + 40 * 28 + 28 + 28 * 14 + 14 + 14 * 2 + 2);
const easy = Level.preset('easy');
assert.ok(easy.start && easy.goal && easy.blocks.length >= 4);
assert.ok(Level.preset('gaps').blocks.some((b) => b.type === 'lava'));
assert.ok(Level.preset('obstacles').blocks.some((b) => b.type === 'saw'));
const exampleLevels = Level.presets();
assert.equal(exampleLevels.length, 15, 'The editor should offer exactly 15 example levels.');
assert.equal(new Set(exampleLevels.map((level) => level.id)).size, 15, 'Every example level needs a unique id.');
function jumpHorizontalReach(fromY, toY, jumpSpeed) {
  const gravity = C.GRAVITY;
  const rise = fromY - toY;
  const maxRise = (jumpSpeed * jumpSpeed) / (2 * gravity);
  if (rise > maxRise - 8) return -1;
  const flightTicks = rise >= 0
    ? (jumpSpeed + Math.sqrt(Math.max(0, jumpSpeed * jumpSpeed - 2 * gravity * rise))) / gravity
    : (jumpSpeed + Math.sqrt(jumpSpeed * jumpSpeed + 2 * gravity * -rise)) / gravity;
  return Math.max(0, C.MAX_SPEED * flightTicks - 16);
}

function hasReachablePresetRoute(course) {
  const supports = course.blocks
    .filter((block) => BLOCK_TYPES[block.type] && BLOCK_TYPES[block.type].kind !== 'deadly')
    .map((block, index) => ({ ...block, index }));
  const starts = supports.filter((surface) =>
    Math.abs(surface.y - (course.start.y + course.start.h)) <= 1
    && course.start.x + course.start.w > surface.x
    && course.start.x < surface.x + surface.w
  );
  const goalSurfaces = supports.filter((surface) =>
    course.goal.x + course.goal.w > surface.x
    && course.goal.x < surface.x + surface.w
    && course.goal.y < surface.y
    && course.goal.y + course.goal.h > surface.y - C.AGENT_H
  );
  const visited = new Set(starts.map((surface) => surface.index));
  const queue = [...starts];
  while (queue.length) {
    const from = queue.shift();
    const info = BLOCK_TYPES[from.type];
    const jumpSpeed = info.kind === 'bounce'
      ? Math.abs(info.bounce || C.BOUNCE)
      : Math.abs(C.JUMP);
    for (const to of supports) {
      if (visited.has(to.index)) continue;
      const horizontalGap = Math.max(
        0,
        to.x - (from.x + from.w),
        from.x - (to.x + to.w)
      );
      if (horizontalGap <= jumpHorizontalReach(from.y, to.y, jumpSpeed)) {
        visited.add(to.index);
        queue.push(to);
      }
    }
  }
  return goalSurfaces.some((surface) => visited.has(surface.index));
}

const routeSignatures = new Set();
for (const preset of exampleLevels) {
  const course = Level.preset(preset.id);
  assert.ok(course.start && course.goal, preset.id + ' needs start and goal markers.');
  assert.ok(course.blocks.length >= 8, preset.id + ' should have a detailed, authored course.');
  assert.ok(course.blocks.every((block) => BLOCK_TYPES[block.type]), preset.id + ' must only use known block types.');
  assert.ok(course.blocks.every((block) => block.x >= 0 && block.y >= 0 && block.x + block.w <= C.W && block.y + block.h <= C.H), preset.id + ' blocks must stay inside the level.');
  assert.ok(course.start.x !== course.goal.x || course.start.y !== course.goal.y, preset.id + ' needs a real route.');
  assert.ok(hasReachablePresetRoute(course), preset.id + " must have a route whose jumps fit the game's physics.");
  routeSignatures.add(JSON.stringify({
    start: course.start, goal: course.goal,
    blocks: course.blocks.map(({type,x,y,w,h}) => [type,x,y,w,h])
  }));
}
assert.equal(routeSignatures.size, 15, 'All 15 routes, start/goal positions, and layouts must be individually unique.');
assert.ok(exampleLevels.some((item) => Level.preset(item.id).goal.y < Level.preset(item.id).start.y), 'Some courses should climb.');
assert.ok(exampleLevels.some((item) => Level.preset(item.id).goal.y > Level.preset(item.id).start.y), 'Some courses should descend.');
assert.ok(exampleLevels.some((item) => {
  const heights = Level.preset(item.id).blocks.filter((block) => ['platform','bridge','cloud','steel'].includes(block.type)).map((block) => block.y);
  return heights.length >= 5 && Math.max(...heights) - Math.min(...heights) >= 160;
}), 'The collection should contain strong vertical routes.');
assert.equal(BLOCK_TYPES.superBounce.kind, 'bounce');
assert.equal(BLOCK_TYPES.boostR.kind, 'conveyor');
assert.equal(BLOCK_TYPES.fire.kind, 'deadly');
assert.equal(BLOCK_TYPES.laser.kind, 'deadly');
// Rückwärtsbewegung: ein deutlicher gegenteiliger Netzwerkausgang darf
// nicht durch den Zielrichtungs-Assistenten auf Vorwärtslaufen gezwungen werden.
const reverseAgent = createAgent(easy);
reverseAgent.onGround = true;
const reverseInput = new Float32Array(LAYERS[0]);
reverseInput[24] = 1; // Ziel liegt rechts.
const reverseControl = assistControl(reverseAgent, reverseInput, [-0.9, 0.1], easy);
assert.ok(reverseControl.move < -0.8, 'The neural policy must be able to walk backwards from a goal to the right.');
const reverseLeftInput = new Float32Array(LAYERS[0]);
reverseLeftInput[24] = -1; // Ziel liegt links.
const reverseLeftControl = assistControl(reverseAgent, reverseLeftInput, [0.9, 0.1], easy);
assert.ok(reverseLeftControl.move > 0.8, 'The neural policy must also be able to walk backwards from a goal to the left.');

const agent = createAgent(easy);
const input = new Float32Array(LAYERS[0]);
sense(agent, easy, input);
assert.equal(input.length, 77);
assert.ok(input.slice(65, 77).every(Number.isFinite), 'All expanded environment and surface sensors must be finite.');
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
assert.equal(sensorAgent.rays[0].blockType, 'wall', 'Raycasts must preserve the exact block type.');
assert.equal(sensorAgent.detectedBlock.type, 'wall', 'The agent must identify the wall in front of it.');
assert.equal(sensorInput[28 + BLOCK_TYPE_KEYS.indexOf('wall')], 1, 'The neural network must receive a dedicated wall input.');
const hazardSenseLevel = { ...sensorLevel, blocks: [{ type: 'lava', x: 95, y: 80, w: 30, h: 90, solid: true }] };
const hazardSenseAgent = createAgent(hazardSenseLevel);
const hazardSenseInput = new Float32Array(LAYERS[0]);
sense(hazardSenseAgent, hazardSenseLevel, hazardSenseInput);
assert.equal(hazardSenseAgent.detectedBlock.type, 'lava', 'The agent must distinguish lava from an ordinary wall.');
assert.equal(hazardSenseInput[28 + BLOCK_TYPE_KEYS.indexOf('lava')], 1, 'Lava must activate its own neural input.');
assert.ok(sensorInput[28 + BLOCK_TYPE_KEYS.length] > 0, 'The neural network must receive the distance to the detected block.');
assert.ok(sensorAgent.rays[8].x2 < sensorAgent.rays[8].x1, 'The rear ray must point behind the agent.');
assert.ok(sensorInput[6] > 0 && sensorInput[6] < 1, 'The wall distance must be normalized.');
sensorAgent.onGround = true; // Reflexsprünge werden nur am Boden ausgelöst.
const wallReflex = assistControl(sensorAgent, sensorInput, new Float32Array([0.2, 0]));
assert.equal(wallReflex.jump, true, 'The reflex controller should jump before a nearby wall.');
assert.equal(wallReflex.assistedJump, true);

// Eine hohe Wand auf der direkten Zielroute löst nach kurzem Prüfen einen
// kontrollierten Umweg aus, statt endlos gegen die Wand zu springen.
const detourLevel = {
  start: { x: 20, y: 500, w: 40, h: 40 },
  goal: { x: 500, y: 500, w: 40, h: 60 },
  blocks: [{ type: 'wall', x: 100, y: 300, w: 40, h: 260, solid: true }],
};
const detourAgent = createAgent(detourLevel);
detourAgent.x = 70; detourAgent.y = 500; detourAgent.onGround = true; detourAgent.vx = 0;
const detourInput = new Float32Array(LAYERS[0]);
let detourControl;
for (let tick = 0; tick < 19; tick++) {
  sense(detourAgent, detourLevel, detourInput);
  detourControl = assistControl(detourAgent, detourInput, new Float32Array([1, 1]), detourLevel);
}
assert.equal(detourControl.detouring, true, 'A tall wall must activate route searching.');
assert.ok(detourControl.move < 0, 'Route searching must move away from the blocked direct route.');
assert.equal(detourControl.jump, false, 'The agent must not keep jumping into the wall while detouring.');

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
assert.equal(trace.activations.length, 5);
assert.ok(out.every(Number.isFinite));
const oldLength = genomeSizeFor(OLDEST_LAYERS);
const oldGenome = new Float32Array(oldLength).fill(0.125);
const migrated = upgradeLegacyGenome(oldGenome);
assert.equal(migrated.length, genomeSize());
const previousLength = genomeSizeFor([28, 12, 8, 2]);
const previousGenome = new Float32Array(previousLength).fill(0.25);
const migratedPrevious = upgradeLegacyGenome(previousGenome);
assert.equal(migratedPrevious.length, genomeSize());
assert.equal(migratedPrevious[0], previousGenome[0]);
assert.equal(migratedPrevious[77 * 40], previousGenome[28 * 12]);
const legacy14 = new Float32Array(genomeSizeFor(LEGACY_LAYERS)).fill(0.15);
assert.equal(upgradeLegacyGenome(legacy14).length, genomeSize());
assert.equal(migrated[0], oldGenome[0]);
assert.equal(migrated[77 * 40], oldGenome[6 * 12]);
const previousArchitecture = new Float32Array(genomeSizeFor(PREVIOUS_LAYERS)).fill(0.2);
assert.equal(upgradeLegacyGenome(previousArchitecture).length, genomeSize(), 'The previous semantic network must migrate.');
const ga = new GA(99);
const genomes = ga.initialGenomes(6, migrated, 0.1);
const next = ga.nextGeneration(genomes, genomes.map((_, i) => i), 6, 0.1);
assert.equal(next.genomes.length, 6);
assert.ok(next.genomes.every((g) => g.length === genomeSize()));
const strategyGa = new GA(101, { tournamentSize: 7, eliteCount: 4, crossoverRate: 1, mutationStrength: 0.8, adaptiveMutation: false, stagnationGenerations: 3, stagnationBoost: 2.2 });
assert.equal(strategyGa.options.tournamentSize, 7);
assert.equal(strategyGa.options.eliteCount, 4);
assert.equal(strategyGa.options.mutationStrength, 0.8);
assert.equal(strategyGa.options.adaptiveMutation, false);
const parentA = new Float32Array([1, 2, 3]);
const parentB = new Float32Array([4, 5, 6]);
assert.deepEqual(Array.from(strategyGa.crossover(parentA, parentB)), [1, 2, 3], 'A 100% crossover share selects the first parent for every gene.');
strategyGa.configure({ tournamentSize: 99, eliteCount: 99, crossoverRate: 200, mutationStrength: 0 });
assert.equal(strategyGa.options.tournamentSize, 8, 'Tournament size is clamped.');
assert.equal(strategyGa.options.eliteCount, 8, 'Elite count is clamped.');
assert.equal(strategyGa.options.crossoverRate, 1, 'Crossover share is clamped.');
assert.equal(strategyGa.options.mutationStrength, 0.35, 'Mutation strength has a safe minimum/default.');
const largeGa = new GA(100);
const largeGenomes = largeGa.initialGenomes(16, migrated, 0.1);
const largeNext = largeGa.nextGeneration(largeGenomes, largeGenomes.map((_, i) => i), 16, 0.1);
assert.equal(largeNext.genomes.length, 16, 'Adaptive mutation and two elites must preserve population size.');
assert.equal(largeGa.initialGenomes(100, migrated, 0.1).length, MAX_POPULATION, 'Initial population must be capped at 75.');
assert.equal(largeGa.nextGeneration(largeGenomes, largeGenomes.map((_, i) => i), 100, 0.1).genomes.length, MAX_POPULATION, 'Later generations must also be capped at 75.');
assert.ok(Number.isFinite(fitness(agent, 1200)));
stepAgent(agent, easy, { move: 1, jump: false }, 1);

const specialLevel = { start: { x: 0, y: 0, w: 40, h: 40 }, goal: { x: 1000, y: 0, w: 40, h: 60 }, blocks: [{ type: 'superBounce', x: 100, y: 200, w: 60, h: 20, solid: true }] };
const bouncingAgent = createAgent(specialLevel);
bouncingAgent.x = 110; bouncingAgent.y = 173; bouncingAgent.vy = 2;
stepAgent(bouncingAgent, specialLevel, { move: 0, jump: false }, 2);
assert.equal(bouncingAgent.vy, -16, 'Super trampolines should launch higher than normal trampolines.');
const hazardLevel = { ...specialLevel, blocks: [{ type: 'electric', x: 100, y: 100, w: 60, h: 50, solid: true }] };
const hazardAgent = createAgent(hazardLevel);
hazardAgent.x = 110; hazardAgent.y = 110;
stepAgent(hazardAgent, hazardLevel, { move: 0, jump: false }, 3);
assert.equal(hazardAgent.alive, false, 'New hazards must use the normal deadly collision path.');

// Live-Editor: eine Änderung muss dieselben Agenten weiterverwenden und sie
// sofort aus neuen festen Blöcken herauslösen, ohne die Generation zu spawnen.
const liveLevel = {
  start: { x: 20, y: 100, w: 40, h: 40 },
  goal: { x: 1000, y: 100, w: 40, h: 60 },
  blocks: [],
};
const liveAgents = [createAgent(liveLevel), createAgent(liveLevel)];
liveAgents[0].x = 200; liveAgents[0].y = 200;
liveAgents[1].x = 300; liveAgents[1].y = 200;
const firstLiveAgent = liveAgents[0];
liveLevel.blocks.push({ type: 'wall', x: 190, y: 190, w: 60, h: 60, solid: true });
reconcileAgentsAfterLevelEdit(liveAgents, liveLevel, 42);
assert.strictEqual(liveAgents[0], firstLiveAgent, 'Live edits must not respawn the population.');
assert.equal(liveAgents[0].alive, true, 'An agent overlapping a new solid should be ejected safely.');
assert.equal(liveAgents[0].x < 190 || liveAgents[0].x + liveAgents[0].w > 250 || liveAgents[0].y < 190 || liveAgents[0].y + liveAgents[0].h > 250, true, 'The agent must no longer overlap the new solid.');
liveLevel.blocks.push({ type: 'lava', x: liveAgents[1].x, y: liveAgents[1].y, w: 60, h: 40, solid: true });
reconcileAgentsAfterLevelEdit(liveAgents, liveLevel, 43);
assert.equal(liveAgents[1].alive, false, 'An agent inside a newly placed hazard must be removed immediately.');
console.log('Ki-Evo smoke tests passed.');
