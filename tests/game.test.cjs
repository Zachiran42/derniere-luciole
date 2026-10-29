'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createGame, generateLevel, LEVEL_COUNT} = require('../docs/game.js');
const DIRECTIONS = [[1, 0, 'ArrowRight'], [0, 1, 'ArrowDown'], [-1, 0, 'ArrowLeft'], [0, -1, 'ArrowUp']];
const all = flags => (1 << flags.length) - 1;
function setup(progress = {}) { const ends = [], game = createGame({progress, end: (...args) => ends.push(args), hud() {}, toast() {}, save() {}}); return {game, ends, progress}; }
function press(game, key) { game.key(key, true); game.key(key, false); }
function run(game, route) { for (const key of route) press(game, key); }

// Independent rules/search: never uses production movement or a supplied solution.
function advance(board, state, direction, options = {}) {
  const [dx, dy] = direction, x = state.tile % board.width + dx, y = Math.floor(state.tile / board.width) + dy;
  if (x < 0 || y < 0 || x >= board.width || y >= board.height) return null;
  const tile = y * board.width + x;
  if (board.cells[tile] || board.gates.includes(tile) && !state.open) return null;
  let energy = state.energy - (board.thorns.includes(tile) ? 2 : 1), seeds = state.seeds, lamps = state.lamps, nectar = state.nectar, open = state.open;
  let index = board.seeds.indexOf(tile); if (index >= 0) seeds |= 1 << index;
  index = board.lanterns.indexOf(tile); if (index >= 0 && !(lamps & (1 << index))) { lamps |= 1 << index; energy = board.capacity; }
  index = board.nectars.indexOf(tile); if (index >= 0 && !(nectar & (1 << index))) { if (options.noNectar) return null; nectar |= 1 << index; energy = Math.min(board.capacity, energy + 3); }
  if (board.switches.includes(tile)) { if (options.noSwitch) return null; open = !open; }
  const won = tile === board.exit && seeds === all(board.seeds);
  if (energy <= 0 && !won) return null;
  return {tile, energy, seeds, lamps, nectar, open};
}
function solve(board, options = {}) {
  const initial = {tile: board.start, energy: board.capacity, seeds: 0, lamps: 0, nectar: 0, open: false};
  let first = initial;
  for (const key of options.prefix || []) { const direction = DIRECTIONS.find(d => d[2] === key); first = advance(board, first, direction, options); if (!first) return null; }
  const nodes = [{...first, parent: -1, key: null}], best = new Map();
  const signature = s => [s.tile, s.seeds, s.lamps, s.nectar, Number(s.open)].join(':');
  best.set(signature(first), first.energy);
  for (let cursor = 0; cursor < nodes.length; cursor++) {
    const s = nodes[cursor];
    if (s.tile === board.exit && s.seeds === all(board.seeds) && s.energy >= (options.finishEnergy || 0)) {
      const route = [];
      for (let p = cursor; nodes[p].parent >= 0; p = nodes[p].parent) route.push(nodes[p].key);
      return {route: [...options.prefix || [], ...route.reverse()], final: s, visited: nodes.length};
    }
    for (const direction of DIRECTIONS) {
      const next = advance(board, s, direction, options); if (!next) continue;
      const id = signature(next);
      // Earlier states with >= light dominate a later visit with the same resources.
      if ((best.get(id) ?? -1) >= next.energy) continue;
      best.set(id, next.energy); nodes.push({...next, parent: cursor, key: direction[2]});
    }
  }
  return null;
}
function topology(board) {
  let vertices = 0, edges = 0, branches = 0;
  for (let tile = 0; tile < board.cells.length; tile++) if (!board.cells[tile]) {
    vertices++; let degree = 0;
    for (const [dx, dy] of DIRECTIONS) { const x = tile % board.width + dx, y = Math.floor(tile / board.width) + dy; if (x >= 0 && y >= 0 && x < board.width && y < board.height && !board.cells[y * board.width + x]) degree++; }
    edges += degree; if (degree >= 3) branches++;
  }
  return {cycles: edges / 2 - vertices + 1, branches};
}
function replayModel(board, route) { let state = {tile: board.start, energy: board.capacity, seeds: 0, lamps: 0, nectar: 0, open: false}; const visits = []; for (const key of route) { state = advance(board, state, DIRECTIONS.find(d => d[2] === key)); assert.ok(state); visits.push(state.tile); } return {state, visits}; }

test('twenty distinct cyclic boards are solved optimally by an independent resource-aware search', () => {
  const {game, ends, progress} = setup(), terrain = new Set(); game.reset();
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    const board = generateLevel(n), result = solve(board), graph = topology(board);
    assert.ok(result, 'board ' + n + ' has a legal solution');
    assert.equal(result.route.length, board.par, 'par is the true shortest light-aware route');
    assert.ok(graph.cycles >= 2 && graph.branches >= 5, 'terrain offers real loops and junctions');
    assert.equal(board.seeds.length, n === 1 ? 2 : 3);
    if (n > 1) assert.ok(result.route.length >= 14, 'planning starts after the introduction');
    if (n >= 3) {
      const replay = replayModel(board, result.route);
      assert.ok(replay.visits.some(tile => board.gates.includes(tile)), 'gates are useful, not decoration');
      assert.ok(replay.visits.some(tile => board.switches.includes(tile)), 'the lever must be planned');
    }
    terrain.add(board.cells.join(''));
    assert.equal(game.snapshot().level, n); run(game, result.route);
    assert.equal(game.snapshot().status, 'won'); assert.equal(ends.length, n); assert.equal(ends[n - 1][3], true);
    assert.equal(progress.luciole.best[n].stars, 3); assert.equal(game.snapshot().version, 2);
    press(game, 'ArrowRight'); assert.equal(ends.length, n, 'results never repeat'); game.next();
  }
  assert.equal(terrain.size, 20); assert.equal(progress.luciole.unlocked, 20); assert.equal(game.snapshot().level, 1);
});

test('the opening has two winning first choices and a longer recharge route preserves more light', () => {
  const board = generateLevel(1), results = DIRECTIONS.map(d => solve(board, {prefix: [d[2]]})).filter(Boolean);
  assert.ok(results.length >= 2, 'the first map already offers two viable initial directions');
  const short = solve(board), cautious = solve(board, {finishEnergy: 3});
  assert.ok(cautious && cautious.route.length > short.route.length);
  assert.ok(cautious.final.energy > short.final.energy, 'the detour buys reserve instead of free steps');
  assert.ok(cautious.final.lamps !== short.final.lamps, 'the longer route actually uses a different recharge plan');
});

test('optional nectar has a measurable detour tradeoff, and switches shorten or enable routes', () => {
  let alternatives = 0, usefulNectar = 0, shortcutAlternatives = 0;
  for (let n = 2; n <= LEVEL_COUNT; n++) {
    const board = generateLevel(n), normal = solve(board), without = solve(board, {noNectar: true});
    if (normal.final.nectar) usefulNectar++;
    if (without && without.route.length > normal.route.length) alternatives++;
    if (n >= 3) { const closed = solve(board, {noSwitch: true}); if (closed) { assert.ok(closed.route.length > normal.route.length); shortcutAlternatives++; } }
  }
  assert.ok(usefulNectar >= 12, 'nectar changes many optimal plans');
  assert.ok(alternatives >= 6, 'six maps support a longer route without using nectar');
  assert.ok(shortcutAlternatives >= 1, 'at least one gate can also be bypassed through a longer route');
});

test('resource effects are single use, thorns cost two, and the lever opens then closes gates', () => {
  const board = generateLevel(3), {game} = setup(); game.reset();
  function place(tile, overrides = {}) {
    const s = {game: 'derniere-luciole', version: 2, level: 3, x: tile % board.width, y: Math.floor(tile / board.width), energy: board.capacity, moves: 30, seeds: board.seeds.map(p => p === tile), lit: board.lanterns.map(p => p === tile), nectar: board.nectars.map(p => p === tile), open: false, status: 'playing', ...overrides};
    assert.equal(game.restore(s), true); return s;
  }
  function neighbor(tile) { return DIRECTIONS.map(d => ({d, tile: tile - d[0] - d[1] * board.width})).find(p => !board.cells[p.tile] && !board.gates.includes(p.tile) && !board.switches.includes(p.tile)); }
  const gate = board.gates[0], besideGate = neighbor(gate); place(besideGate.tile); const blocked = game.snapshot(); press(game, besideGate.d[2]); assert.deepEqual(game.snapshot(), blocked, 'a shut gate does not spend light');
  const lever = board.switches[0], besideLever = neighbor(lever); place(besideLever.tile); press(game, besideLever.d[2]); assert.equal(game.snapshot().open, true);
  const reverse = DIRECTIONS.find(d => d[0] === -besideLever.d[0] && d[1] === -besideLever.d[1]); press(game, reverse[2]); press(game, besideLever.d[2]); assert.equal(game.snapshot().open, false);
  const lamp = board.lanterns[0], besideLamp = neighbor(lamp); place(besideLamp.tile, {energy: 3}); press(game, besideLamp.d[2]); assert.equal(game.snapshot().energy, board.capacity);
  const lampBack = DIRECTIONS.find(d => d[0] === -besideLamp.d[0] && d[1] === -besideLamp.d[1]); press(game, lampBack[2]); press(game, besideLamp.d[2]); assert.ok(game.snapshot().energy < board.capacity, 'lit lantern never recharges twice');
  const nectar = board.nectars[0], besideNectar = neighbor(nectar); place(besideNectar.tile, {energy: 3}); press(game, besideNectar.d[2]); assert.equal(game.snapshot().energy, 5); assert.ok(game.snapshot().nectar.some(Boolean));
  const nectarBack = DIRECTIONS.find(d => d[0] === -besideNectar.d[0] && d[1] === -besideNectar.d[1]); press(game, nectarBack[2]); press(game, besideNectar.d[2]); assert.equal(game.snapshot().energy, 3, 'nectar also works only once');
  const thornBoard = generateLevel(7), thorn = thornBoard.thorns[0], direction = DIRECTIONS.find(d => !thornBoard.cells[thorn - d[0] - d[1] * thornBoard.width] && !thornBoard.gates.includes(thorn - d[0] - d[1] * thornBoard.width));
  const previous = thorn - direction[0] - direction[1] * thornBoard.width;
  const fixture = {game: 'derniere-luciole', version: 2, level: 7, x: previous % 7, y: Math.floor(previous / 7), energy: 5, moves: 30, seeds: thornBoard.seeds.map(p => p === previous), lit: thornBoard.lanterns.map(p => p === previous), nectar: thornBoard.nectars.map(p => p === previous), open: true, status: 'playing'};
  assert.equal(game.restore(fixture), true); press(game, direction[2]); assert.equal(game.snapshot().energy, 3);
});

test('tap anywhere on each relative side, swipe and keyboard all move a single cell', () => {
  const board = generateLevel(1), game = setup().game; game.reset(); const g = {left: 49, top: 148, tile: 46};
  const available = DIRECTIONS.filter(([dx, dy]) => !board.cells[board.start + dx + dy * board.width]);
  for (const [dx, dy] of available) {
    game.reset(); const px = g.left + (game.snapshot().x + .5) * g.tile, py = g.top + (game.snapshot().y + .5) * g.tile;
    const x = px + dx * 160, y = py + dy * 160; game.pointer('down', x, y); game.pointer('up', x, y);
    assert.equal(game.snapshot().moves, 1); assert.equal(game.snapshot().x, board.start % 7 + dx); assert.equal(game.snapshot().y, Math.floor(board.start / 7) + dy);
  }
  game.reset(); const [dx, dy, key] = available[0]; game.pointer('down', 210, 300); game.pointer('up', 210 + dx * 45, 300 + dy * 45); assert.equal(game.snapshot().moves, 1);
  game.reset(); press(game, key); assert.equal(game.snapshot().moves, 1);
  game.reset(); const before = game.snapshot(); game.pointer('down', 0, 0); game.pointer('cancel', 0, 0); game.pointer('up', 300, 300); assert.deepEqual(game.snapshot(), before);
});

test('version two round trips deeply, rejects impossible/corrupt states, and cleanly rejects v1 saves', () => {
  const a = setup(), b = setup(); a.game.reset(); run(a.game, solve(generateLevel(1)).route.slice(0, 4)); const saved = JSON.parse(JSON.stringify(a.game.snapshot()));
  assert.equal(b.game.restore(saved), true); assert.deepEqual(b.game.snapshot(), saved); saved.seeds[0] = !saved.seeds[0]; assert.notDeepEqual(b.game.snapshot().seeds, saved.seeds);
  const before = b.game.snapshot();
  for (const bad of [null, {}, {...before, version: 1}, {...before, energy: -1}, {...before, x: 0, y: 0}, {...before, seeds: []}, {...before, nectar: [true]}, {...before, open: 'yes'}, {...before, status: 'won'}, {...before, moves: 0}]) { assert.equal(b.game.restore(bad), false); assert.deepEqual(b.game.snapshot(), before); }
  const gateBoard = generateLevel(3), gate = gateBoard.gates[0];
  assert.equal(b.game.restore({...before, level: 3, x: gate % 7, y: Math.floor(gate / 7), seeds: [false, false, false], lit: [false, false], nectar: [false], open: false}), false);
});

test('old unlocks and records migrate without deleting legacy achievements', () => {
  const progress = {luciole: {unlocked: 13, level: 7, best: {1: {moves: 12, stars: 3}, 7: {moves: 25, stars: 2}}}};
  const legacy = JSON.parse(JSON.stringify(progress.luciole.best)); const a = setup(progress); a.game.reset();
  assert.equal(progress.luciole.unlocked, 13); assert.equal(a.game.snapshot().level, 7); assert.deepEqual(progress.luciole.legacyBest, legacy); assert.deepEqual(progress.luciole.best, {}); assert.equal(progress.luciole.rulesVersion, 2);
  setup(progress); assert.deepEqual(progress.luciole.legacyBest, legacy, 'subsequent launches preserve the archive');
});

test('light exhaustion ends once; terminal restoration and canvas drawing remain pure', () => {
  const {game, ends, progress} = setup(), board = generateLevel(1); game.reset();
  const start = board.start, direction = DIRECTIONS.find(d => !board.cells[start + d[0] + d[1] * board.width] && !board.lanterns.includes(start + d[0] + d[1] * board.width));
  const reverse = DIRECTIONS.find(d => d[0] === -direction[0] && d[1] === -direction[1]);
  for (let i = 0; i < board.capacity; i++) press(game, (i % 2 ? reverse : direction)[2]);
  assert.equal(game.snapshot().status, 'lost'); assert.equal(ends.length, 1); press(game, direction[2]); assert.equal(ends.length, 1);
  const restored = setup(); assert.equal(restored.game.restore(game.snapshot()), true); assert.equal(restored.ends.length, 0);
  const gradient = {addColorStop() {}}, context = new Proxy({createLinearGradient: () => gradient, createRadialGradient: () => gradient}, {get(target, key) {return key in target ? target[key] : () => {};}});
  game.reset(); const before = game.snapshot(), recordBefore = JSON.stringify(progress); for (let i = 0; i < 4; i++) game.draw(context);
  assert.deepEqual(game.snapshot(), before); assert.equal(JSON.stringify(progress), recordBefore, 'rendering never changes progress');
});

test('unplanned random movement rarely wins the later resource puzzles', () => {
  let wins = 0, attempts = 0;
  for (const level of [2, 5, 10, 15, 20]) for (let seed = 1; seed <= 50; seed++) {
    let random = seed * 7919; const progress = {luciole: {unlocked: 20, level, rulesVersion: 2, best: {}}}, {game} = setup(progress); game.reset();
    for (let i = 0; i < 180 && game.snapshot().status === 'playing'; i++) { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; press(game, DIRECTIONS[random >>> 30][2]); }
    if (game.snapshot().status === 'won') wins++; attempts++;
  }
  assert.ok(wins <= 3, 'random wandering should not bypass planning (' + wins + '/' + attempts + ')');
});

