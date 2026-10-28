'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createGame, generateLevel, LEVEL_COUNT} = require('../docs/game.js');
const directions = [[1, 0, 'ArrowRight'], [-1, 0, 'ArrowLeft'], [0, 1, 'ArrowDown'], [0, -1, 'ArrowUp']];

function setup(progress = {}) {
  const ends = [], game = createGame({progress, end: (...args) => ends.push(args), hud() {}, toast() {}, save() {}});
  return {game, ends, progress};
}
function press(game, key) { game.key(key, true); game.key(key, false); }

// Independent search includes finite light and one-use lantern recharges.
function solve(level) {
  const queue = [{tile: level.start, energy: level.capacity, lit: 0, parent: -1, key: null}];
  const seen = new Set([level.start + ':' + level.capacity + ':0']);
  const allLit = (1 << level.lanterns.length) - 1;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const state = queue[cursor];
    if (state.tile === level.exit && state.lit === allLit) {
      const keys = [];
      for (let n = cursor; queue[n].parent !== -1; n = queue[n].parent) keys.push(queue[n].key);
      return keys.reverse();
    }
    for (const [dx, dy, key] of directions) {
      const x = state.tile % level.width + dx, y = Math.floor(state.tile / level.width) + dy;
      if (x < 0 || y < 0 || x >= level.width || y >= level.width) continue;
      const tile = y * level.width + x;
      if (level.cells[tile]) continue;
      let energy = state.energy - 1, lit = state.lit;
      const lamp = level.lanterns.indexOf(tile);
      if (lamp !== -1 && !(lit & (1 << lamp))) { lit |= 1 << lamp; energy = level.capacity; }
      const won = tile === level.exit && lit === allLit;
      if (energy <= 0 && !won) continue;
      const id = tile + ':' + energy + ':' + lit;
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push({tile, energy, lit, parent: cursor, key});
    }
  }
  return null;
}

test('all 20 distinct levels are solvable with finite light, then unlock in the real game', () => {
  const {game, ends, progress} = setup(), signatures = new Set();
  game.reset();
  assert.equal(LEVEL_COUNT, 20);
  for (let number = 1; number <= LEVEL_COUNT; number++) {
    const level = generateLevel(number), keys = solve(level);
    assert.ok(keys, 'independent search must find a legal light route at level ' + number);
    assert.equal(keys.length, level.par, 'the par is attainable');
    signatures.add(JSON.stringify([level.cells, level.start, level.exit]));
    assert.equal(game.snapshot().level, number);
    for (const key of keys) press(game, key);
    assert.equal(game.snapshot().status, 'won', 'actual controls must complete level ' + number);
    assert.equal(ends.length, number);
    assert.equal(ends[number - 1][3], true);
    assert.equal(progress.luciole.best[number].stars, 3);
    press(game, 'ArrowUp');
    assert.equal(ends.length, number, 'terminal input must not repeat the result');
    game.next();
  }
  assert.equal(signatures.size, 20);
  assert.equal(progress.luciole.unlocked, 20);
  assert.equal(game.snapshot().level, 1);
});

test('save round trip copies arrays and rejects corrupt data without changing the game', () => {
  const a = setup(), b = setup(), level = generateLevel(1);
  a.game.reset(); press(a.game, solve(level)[0]);
  const saved = JSON.parse(JSON.stringify(a.game.snapshot()));
  assert.equal(b.game.restore(saved), true);
  assert.deepEqual(b.game.snapshot(), saved);
  saved.lit[0] = !saved.lit[0];
  assert.notDeepEqual(b.game.snapshot().lit, saved.lit);
  const good = b.game.snapshot();
  for (const corrupt of [null, {}, {...good, version: 9}, {...good, energy: -1}, {...good, x: 0, y: 0}, {...good, lit: []}, {...good, status: 'won'}, {...good, moves: Infinity}]) {
    assert.equal(b.game.restore(corrupt), false);
    assert.deepEqual(b.game.snapshot(), good);
  }
});

test('light exhaustion ends once; restored terminal results stay silent', () => {
  const {game, ends} = setup(), level = generateLevel(1), first = solve(level)[0];
  const reverse = {ArrowRight: 'ArrowLeft', ArrowLeft: 'ArrowRight', ArrowUp: 'ArrowDown', ArrowDown: 'ArrowUp'};
  game.reset();
  for (let n = 0; n < level.capacity; n++) press(game, n % 2 ? reverse[first] : first);
  assert.equal(game.snapshot().status, 'lost');
  assert.equal(ends.length, 1);
  assert.equal(ends[0][3], false);
  press(game, first); assert.equal(ends.length, 1);
  const restored = setup();
  assert.equal(restored.game.restore(game.snapshot()), true);
  assert.equal(restored.ends.length, 0);
});

test('swipes and adjacent taps move one cell; walls do not consume energy', () => {
  const a = setup(), b = setup(), level = generateLevel(1), key = solve(level)[0];
  const [dx, dy] = directions.find(d => d[2] === key);
  a.game.reset();
  a.game.pointer('down', 210, 300); a.game.pointer('up', 210 + dx * 40, 300 + dy * 40);
  assert.equal(a.game.snapshot().moves, 1);
  b.game.reset();
  const tile = Math.floor(342 / level.width), left = (420 - tile * level.width) / 2, top = 145 + (342 - tile * level.width) / 2;
  const x = left + (level.start % level.width + dx + .5) * tile;
  const y = top + (Math.floor(level.start / level.width) + dy + .5) * tile;
  b.game.pointer('down', x, y); b.game.pointer('up', x, y);
  assert.equal(b.game.snapshot().moves, 1);
  b.game.reset();
  const initial = b.game.snapshot();
  for (const [mx, my, blockedKey] of directions) {
    if (level.cells[(initial.y + my) * level.width + initial.x + mx]) {
      press(b.game, blockedKey);
      assert.deepEqual(b.game.snapshot(), initial);
      break;
    }
  }
});
