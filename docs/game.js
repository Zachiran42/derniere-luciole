(function (global) {
  'use strict';
  const ID = 'derniere-luciole';
  const VERSION = 2;
  const LEVEL_COUNT = 20;
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const NAMES = ['Deux chemins', 'La réserve cachée', 'Le premier verrou', 'Une recharge au bon moment', 'Le détour des graines', 'Garder du nectar', 'Le passage épineux', 'Ne brûle pas tes ponts', 'Le prix du raccourci', 'Deux portes, un levier', 'Petite réserve, grands choix', 'La route de secours', 'Une lumière bien placée', 'Le plein ne suffit pas', 'La longue clairière', 'Le dernier détour', 'Une porte de trop', 'Deux façons de rentrer', 'Chaque pas se prépare', 'Le jardin des choix'];
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const integer = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
  const count = flags => flags.filter(Boolean).length;
  const clone = value => JSON.parse(JSON.stringify(value));
  // Twenty cyclic boards. Independent state-space tests prove their light budgets and pars.
  const CAMPAIGN = [
  {
    "cap": 8,
    "par": 11,
    "map": "#######/#L#..L#/#....o#/#.....#/#..o.S#/#E...##/#######"
  },
  {
    "cap": 7,
    "par": 15,
    "map": "#######/#..ELo#/#..#+.#/##L#..#/#..S.o#/#.o####/#######"
  },
  {
    "cap": 7,
    "par": 15,
    "map": "#######/#.LT+.#/#.#o.S#/#E....#/#.#.#L#/#.oG.o#/#######"
  },
  {
    "cap": 7,
    "par": 19,
    "map": "#######/#o#.L.#/#L#oGS#/#E.T#.#/#.....#/#..o+^#/#######"
  },
  {
    "cap": 7,
    "par": 19,
    "map": "#######/#L..+.#/#o.S^G#/#...#o#/##....#/#Eo#LT#/#######"
  },
  {
    "cap": 7,
    "par": 17,
    "map": "#######/#S#GE.#/#..o#.#/#.+..^#/##oT..#/##LL.o#/#######"
  },
  {
    "cap": 7,
    "par": 20,
    "map": "#######/#E..To#/###...#/#Lo..L#/#G+^S.#/#o^#.##/#######"
  },
  {
    "cap": 7,
    "par": 21,
    "map": "#######/#E.G^o#/##o.L.#/#.^+TL#/#.#...#/#.S#o##/#######"
  },
  {
    "cap": 7,
    "par": 17,
    "map": "#######/#ELGo##/#.#+^##/#...S.#/#.T...#/#^oL#o#/#######"
  },
  {
    "cap": 7,
    "par": 16,
    "map": "#######/#o..o##/#LG.L^#/#..o#T#/#E#G.+#/#^.#S.#/#######"
  },
  {
    "cap": 6,
    "par": 16,
    "map": "#######/#.S^Lo#/#oGL#T#/#.^.o.#/##+.GE#/##.#..#/#######"
  },
  {
    "cap": 7,
    "par": 17,
    "map": "#######/##EoT.#/#.L##.#/#o.G#S#/#+#o^^#/#GL.#.#/#######"
  },
  {
    "cap": 6,
    "par": 17,
    "map": "#######/##L.Go#/#..E#.#/#o..L.#/#T^#oG#/#+^S..#/#######"
  },
  {
    "cap": 6,
    "par": 16,
    "map": "#######/#^..#L#/#.S.T.#/##..Go#/#+LG#.#/#o^.oE#/#######"
  },
  {
    "cap": 7,
    "par": 17,
    "map": "#######/#...o.#/#L.S.##/#.o#T+#/#^.G.o#/#G^E#L#/#######"
  },
  {
    "cap": 6,
    "par": 19,
    "map": "#######/###ToE#/#+LG..#/#o.^.L#/##.S..#/#G.^o.#/#######"
  },
  {
    "cap": 6,
    "par": 19,
    "map": "#######/##G.#^#/#+o..S#/#.#.L.#/#T.LG^#/#Eo..o#/#######"
  },
  {
    "cap": 7,
    "par": 17,
    "map": "#######/#TGEL.#/#o^.#o#/#..L#.#/#^o.GS#/##+...#/#######"
  },
  {
    "cap": 6,
    "par": 16,
    "map": "#######/#o.S.##/##^.L.#/#.GTo##/#^+...#/#o.GLE#/#######"
  },
  {
    "cap": 6,
    "par": 17,
    "map": "#######/#.o^GL#/#E#.#T#/#.#S.o#/#...G^#/#oL+..#/#######"
  }
];
  function generateLevel(number) {
    const level = clamp(Math.floor(number) || 1, 1, LEVEL_COUNT);
    const definition = CAMPAIGN[level - 1], rows = definition.map.split('/'), width = rows[0].length;
    const cells = [], seeds = [], lanterns = [], nectars = [], gates = [], switches = [], thorns = [];
    let start = -1, exit = -1;
    rows.join('').split('').forEach((char, tile) => {
      cells.push(char === '#' ? 1 : 0);
      if (char === 'S') start = tile;
      if (char === 'E') exit = tile;
      if (char === 'o') seeds.push(tile);
      if (char === 'L') lanterns.push(tile);
      if (char === '+') nectars.push(tile);
      if (char === 'G') gates.push(tile);
      if (char === 'T') switches.push(tile);
      if (char === '^') thorns.push(tile);
    });
    return { level, name: NAMES[level - 1], width, height: rows.length, cells, start, exit, seeds, lanterns, nectars, gates, switches, thorns, capacity: definition.cap, par: definition.par };
  }
  function traverse(cells, width, start) {
    const queue = [start], distance = Array(cells.length).fill(-1), parent = Array(cells.length).fill(-1);
    distance[start] = 0;
    let farthest = start;
    for (let i = 0; i < queue.length; i++) {
      const tile = queue[i], x = tile % width, y = Math.floor(tile / width);
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, next = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= cells.length / width || cells[next] || distance[next] !== -1) continue;
        distance[next] = distance[tile] + 1; parent[next] = tile; queue.push(next);
        if (distance[next] > distance[farthest]) farthest = next;
      }
    }
    return { distance, parent, farthest };
  }
  function freshState(level) {
    return { level: level.level, x: level.start % level.width, y: Math.floor(level.start / level.width), energy: level.capacity, moves: 0, seeds: level.seeds.map(() => false), lit: level.lanterns.map(() => false), nectar: level.nectars.map(() => false), open: false, status: 'playing' };
  }
  function validState(data, level) {
    if (!data || data.game !== ID || data.version !== VERSION || !integer(data.level, 1, LEVEL_COUNT)) return false;
    level = level || generateLevel(data.level);
    if (!integer(data.x, 0, level.width - 1) || !integer(data.y, 0, level.height - 1)) return false;
    const tile = data.y * level.width + data.x;
    if (level.cells[tile] || level.gates.includes(tile) && !data.open) return false;
    if (!integer(data.energy, 0, level.capacity) || !integer(data.moves, 0, 100000) || typeof data.open !== 'boolean') return false;
    for (const [key, size] of [['seeds', level.seeds.length], ['lit', level.lanterns.length], ['nectar', level.nectars.length]]) {
      if (!Array.isArray(data[key]) || data[key].length !== size || !data[key].every(v => typeof v === 'boolean')) return false;
    }
    if (!['playing', 'won', 'lost'].includes(data.status)) return false;
    const won = tile === level.exit && data.seeds.every(Boolean);
    if (data.status === 'playing' && (data.energy === 0 || won)) return false;
    if (data.status === 'won' && !won) return false;
    if (data.status === 'lost' && (data.energy !== 0 || won)) return false;
    if (!level.switches.length && data.open) return false;
    for (const [tiles, flags] of [[level.seeds, data.seeds], [level.lanterns, data.lit], [level.nectars, data.nectar]]) {
      const index = tiles.indexOf(tile);
      if (index >= 0 && !flags[index]) return false;
    }
    const sx = level.start % level.width, sy = Math.floor(level.start / level.width);
    if (data.moves < Math.abs(data.x - sx) + Math.abs(data.y - sy)) return false;
    if (data.moves === 0 && (tile !== level.start || data.energy !== level.capacity || data.open || data.seeds.some(Boolean) || data.lit.some(Boolean) || data.nectar.some(Boolean))) return false;
    return true;
  }
  function box(c, x, y, width, height, radius, fill) {
    c.beginPath(); c.moveTo(x + radius, y); c.arcTo(x + width, y, x + width, y + height, radius);
    c.arcTo(x + width, y + height, x, y + height, radius); c.arcTo(x, y + height, x, y, radius); c.arcTo(x, y, x + width, y, radius); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
  }
  function label(c, text, x, y, size, color, weight, align) {
    c.font = (weight || 500) + ' ' + size + 'px system-ui, sans-serif'; c.fillStyle = color; c.textAlign = align || 'left'; c.fillText(text, x, y);
  }
  function createGame(api) {
    api = api || {};
    const progress = api.progress && typeof api.progress === 'object' ? api.progress : (api.progress = {});
    if (!progress.luciole || typeof progress.luciole !== 'object' || Array.isArray(progress.luciole)) progress.luciole = {};
    const records = progress.luciole;
    records.unlocked = integer(records.unlocked, 1, LEVEL_COUNT) ? records.unlocked : 1;
    records.level = integer(records.level, 1, records.unlocked) ? records.level : 1;
    if (!records.best || typeof records.best !== 'object' || Array.isArray(records.best)) records.best = {};
    for (const key of Object.keys(records.best)) {
      const best = records.best[key];
      if (!integer(Number(key), 1, LEVEL_COUNT) || !best || !integer(best.moves, 0, 100000) || !integer(best.stars, 1, 3)) delete records.best[key];
    }
    if (records.rulesVersion !== VERSION) {
      if (Object.keys(records.best).length) records.legacyBest = { ...(records.legacyBest && typeof records.legacyBest === 'object' && !Array.isArray(records.legacyBest) ? records.legacyBest : {}), ...clone(records.best) };
      records.best = {}; records.rulesVersion = VERSION;
    }
    let level = generateLevel(records.level), state = null, touch = null, clock = 0, bump = 0, toastTime = -10, ended = false;
    const call = (name, ...args) => { if (typeof api[name] === 'function') return api[name](...args); };
    function hud() {
      call('hud', 'Lumière', state.energy + '/' + level.capacity, 'Graines', count(state.seeds) + '/' + level.seeds.length, level.gates.length ? 'Portes G' : 'Pas', level.gates.length ? state.open ? 'OUVERTES' : 'FERMÉES' : state.moves);
    }
    function toast(message) { if (clock - toastTime >= .4) { toastTime = clock; call('toast', message); } }
    function load(number, save) {
      level = generateLevel(number); state = freshState(level); records.level = level.level;
      touch = null; bump = 0; ended = false; hud(); if (save) call('save');
    }
    function score() { return Math.max(100, 1500 - Math.max(0, state.moves - level.par) * 45) + state.level * 60 + state.energy * 5; }
    function finish(won) {
      if (ended || state.status !== 'playing') return;
      state.status = won ? 'won' : 'lost'; ended = true;
      if (won) {
        const stars = state.moves <= level.par ? 3 : state.moves <= level.par + 4 ? 2 : 1;
        const previous = records.best[state.level];
        if (!previous || state.moves < previous.moves || state.moves === previous.moves && state.energy > (previous.energy || 0)) records.best[state.level] = { moves: state.moves, energy: state.energy, stars };
        records.unlocked = Math.max(records.unlocked, Math.min(LEVEL_COUNT, state.level + 1)); call('save');
        call('end', state.level === LEVEL_COUNT ? 'Le jardin retrouve ses graines !' : 'Les graines sont à l’abri', stars + '/3 étoiles · ' + state.moves + ' pas · ' + state.energy + ' lumière restante. Objectif parfait : ' + level.par + ' pas.', score(), true);
      } else {
        call('save'); call('end', 'Ta réserve est vide', 'Prépare l’ordre des graines et des recharges. Une lanterne sert une fois ; le nectar ajoute 3 lumière et les ronces coûtent 2.', 0, false);
      }
    }
    function move(dx, dy) {
      if (!state || state.status !== 'playing') return false;
      const x = state.x + dx, y = state.y + dy, tile = y * level.width + x;
      if (x < 0 || y < 0 || x >= level.width || y >= level.height || level.cells[tile]) { bump = .15; return false; }
      if (level.gates.includes(tile) && !state.open) { bump = .15; toast('Porte G fermée : marche sur l’interrupteur ↔.'); return false; }
      state.x = x; state.y = y; state.moves++;
      state.energy = Math.max(0, state.energy - (level.thorns.includes(tile) ? 2 : 1));
      let index = level.seeds.indexOf(tile);
      if (index >= 0) state.seeds[index] = true;
      index = level.lanterns.indexOf(tile);
      if (index >= 0 && !state.lit[index]) { state.lit[index] = true; state.energy = level.capacity; toast('Lanterne : plein de lumière. Elle ne servira plus.'); }
      index = level.nectars.indexOf(tile);
      if (index >= 0 && !state.nectar[index]) { state.nectar[index] = true; state.energy = Math.min(level.capacity, state.energy + 3); toast('Nectar consommé : +3 lumière, sans dépasser la réserve.'); }
      if (level.switches.includes(tile)) { state.open = !state.open; toast(state.open ? 'Interrupteur ↔ : toutes les portes G sont ouvertes.' : 'Interrupteur ↔ : les portes G sont refermées.'); }
      hud();
      if (tile === level.exit && state.seeds.every(Boolean)) finish(true);
      else if (state.energy === 0) finish(false);
      else { if (tile === level.exit) toast('Il manque ' + (level.seeds.length - count(state.seeds)) + ' graine(s) avant de sortir.'); call('save'); }
      return true;
    }
    function geometry() { const tile = 46, side = tile * level.width; return { tile, side, left: (420 - side) / 2, top: 148 }; }
    function navigate(delta) { const next = state.level + delta; if (next >= 1 && next <= records.unlocked && next <= LEVEL_COUNT) load(next, true); else if (next > records.unlocked) toast('Rapporte les graines pour ouvrir la clairière suivante.'); }
    function pointer(type, x, y) {
      if (type === 'down') { touch = { x, y }; return; }
      if (type === 'cancel') { touch = null; return; }
      if (type !== 'up' || !touch || !state) return;
      const origin = touch; touch = null;
      const swipeX = x - origin.x, swipeY = y - origin.y;
      if (Math.max(Math.abs(swipeX), Math.abs(swipeY)) > 18) { move(Math.abs(swipeX) > Math.abs(swipeY) ? Math.sign(swipeX) : 0, Math.abs(swipeY) >= Math.abs(swipeX) ? Math.sign(swipeY) : 0); return; }
      if (y >= 555 && y <= 595) { if (x >= 24 && x <= 67) { navigate(-1); return; } if (x >= 353 && x <= 396) { navigate(1); return; } }
      const g = geometry(), dx = x - (g.left + (state.x + .5) * g.tile), dy = y - (g.top + (state.y + .5) * g.tile);
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      move(Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0, Math.abs(dy) >= Math.abs(dx) ? Math.sign(dy) : 0);
    }
    function key(value, down) {
      if (!down) return;
      const controls = { arrowup: [0, -1], w: [0, -1], z: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], q: [-1, 0], arrowright: [1, 0], d: [1, 0] };
      const direction = controls[String(value).toLowerCase()]; if (direction) move(...direction);
    }
    function update(dt) { if (Number.isFinite(dt)) { clock += clamp(dt, 0, .1); bump = Math.max(0, bump - clamp(dt, 0, .1)); } }
    function draw(c) {
      if (!state) return;
      c.save(); c.textBaseline = 'alphabetic'; c.clearRect(0, 0, 420, 600);
      const background = c.createLinearGradient(0, 0, 420, 600); background.addColorStop(0, '#11252d'); background.addColorStop(1, '#081720'); c.fillStyle = background; c.fillRect(0, 0, 420, 600);
      for (let i = 0; i < 20; i++) { const x = (i * 79.7 + Math.sin(clock * .2 + i) * 5) % 420, y = (i * 113.1 + clock * .7) % 600; c.fillStyle = 'rgba(189,225,171,.055)'; c.beginPath(); c.arc(x, y, 1.5, 0, 7); c.fill(); }
      label(c, 'PUZZLES DE LUMIÈRE · CAMPAGNE 2', 24, 26, 10, '#91b9ae', 700);
      label(c, 'Dernière Luciole', 24, 59, 27, '#f1efd9', 800);
      box(c, 352, 34, 43, 31, 10, '#2b4649'); label(c, String(state.level).padStart(2, '0'), 373.5, 55, 15, '#d5edb3', 800, 'center');
      box(c, 24, 78, 372, 44, 12, '#1b343c'); label(c, 'LUMIÈRE', 37, 96, 10, '#b3cec4', 700); label(c, state.energy + ' / ' + level.capacity, 37, 113, 12, state.energy <= 2 ? '#ffb09a' : '#e5efba', 800);
      const pip = 228 / level.capacity;
      for (let i = 0; i < level.capacity; i++) box(c, 143 + i * pip, 92, pip - 5, 17, 5, i < state.energy ? state.energy <= 2 ? '#ef9c80' : '#d0e69b' : '#345057');
      label(c, level.name, 210, 139, 11, '#a4c8ba', 600, 'center');
      const g = geometry(), px = g.left + (state.x + .5) * g.tile, py = g.top + (state.y + .5) * g.tile;
      box(c, g.left - 7, g.top - 7, g.side + 14, g.side + 14, 15, '#07151e');
      c.save(); c.translate(bump > 0 ? Math.sin(bump * 100) * 2 : 0, 0);
      for (let y = 0; y < level.height; y++) for (let x = 0; x < level.width; x++) {
        const tile = y * level.width + x, left = g.left + x * g.tile, top = g.top + y * g.tile;
        if (level.cells[tile]) { box(c, left + 2, top + 2, g.tile - 4, g.tile - 4, 7, '#213a40'); c.fillStyle = '#2d4e4f'; c.fillRect(left + 8, top + 5, g.tile - 16, 2); }
        else { box(c, left + 1, top + 1, g.tile - 2, g.tile - 2, 6, '#132b31'); c.fillStyle = '#2a4749'; c.beginPath(); c.arc(left + g.tile / 2, top + g.tile / 2, 1.2, 0, 7); c.fill(); }
      }
      function center(tile) { return [g.left + (tile % level.width + .5) * g.tile, g.top + (Math.floor(tile / level.width) + .5) * g.tile]; }
      for (const tile of level.thorns) {
        const [x, y] = center(tile); box(c, x - 18, y - 18, 36, 36, 6, '#442e35');
        c.strokeStyle = '#ca927d'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 15, y + 11); c.lineTo(x - 10, y - 7); c.lineTo(x - 4, y + 8); c.moveTo(x + 15, y + 11); c.lineTo(x + 10, y - 7); c.lineTo(x + 4, y + 8); c.stroke();
        label(c, '−2', x, y + 3, 13, '#ffd2ac', 800, 'center');
      }
      for (const tile of level.gates) {
        const [x, y] = center(tile); box(c, x - 18, y - 18, 36, 36, 6, state.open ? '#163c43' : '#214455'); c.strokeStyle = state.open ? '#6ca6ae' : '#90d7e9'; c.lineWidth = 2; c.stroke();
        c.beginPath();
        if (state.open) { c.moveTo(x - 15, y - 14); c.lineTo(x - 15, y + 14); c.moveTo(x + 15, y - 14); c.lineTo(x + 15, y + 14); }
        else for (const offset of [-9, 9]) { c.moveTo(x + offset, y - 14); c.lineTo(x + offset, y + 14); }
        c.stroke(); label(c, 'G', x, y + 5, 12, state.open ? '#8ec4c7' : '#d0f1f5', 800, 'center');
      }
      for (const tile of level.switches) {
        const [x, y] = center(tile); c.fillStyle = state.open ? '#649eab' : '#3c6578'; c.beginPath(); c.arc(x, y, 15, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#a5e3ef'; c.lineWidth = 2; c.stroke(); label(c, '↔', x, y + 5, 20, '#eefbff', 800, 'center');
      }
      level.lanterns.forEach((tile, index) => {
        const [x, y] = center(tile), used = state.lit[index];
        if (!used) { const glow = c.createRadialGradient(x, y, 1, x, y, 29); glow.addColorStop(0, 'rgba(239,204,122,.16)'); glow.addColorStop(1, 'rgba(239,204,122,0)'); c.fillStyle = glow; c.fillRect(x - 29, y - 29, 58, 58); }
        c.strokeStyle = used ? '#5b7472' : '#e9c775'; c.lineWidth = 2; box(c, x - 7, y - 7, 14, 18, 3, used ? '#263f42' : '#9d8348'); c.stroke(); c.beginPath(); c.arc(x, y - 9, 4, Math.PI, 0); c.stroke(); label(c, used ? '×' : 'L', x, y + 6, 11, used ? '#74918d' : '#fff0b6', 800, 'center');
      });
      level.nectars.forEach((tile, index) => {
        const [x, y] = center(tile); if (state.nectar[index]) { label(c, '·', x, y + 4, 18, '#456d6b', 500, 'center'); return; }
        c.fillStyle = '#226769'; c.strokeStyle = '#89e1d0'; c.lineWidth = 1.5; c.beginPath(); for (let i = 0; i < 6; i++) { const angle = i * Math.PI / 3; if (!i) c.moveTo(x + Math.cos(angle) * 16, y + Math.sin(angle) * 16); else c.lineTo(x + Math.cos(angle) * 16, y + Math.sin(angle) * 16); } c.closePath(); c.fill(); c.stroke(); label(c, '+3', x, y + 4, 11, '#c3f9df', 800, 'center');
      });
      level.seeds.forEach((tile, index) => {
        const [x, y] = center(tile); if (state.seeds[index]) { label(c, '✓', x, y + 5, 14, '#426c5d', 700, 'center'); return; }
        c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillStyle = '#bfdb89'; c.shadowColor = '#a9cf6f'; c.shadowBlur = 9; box(c, -7, -7, 14, 14, 4, '#c3e393'); c.shadowBlur = 0; c.fillStyle = '#506a39'; c.fillRect(-1, -5, 2, 10); c.restore();
      });
      const [ex, ey] = center(level.exit), ready = state.seeds.every(Boolean);
      c.strokeStyle = ready ? '#d7f3ac' : '#6a9185'; c.lineWidth = 2; c.beginPath(); c.arc(ex, ey, 15, 0, Math.PI * 2); c.stroke(); label(c, 'E', ex, ey + 5, 14, ready ? '#eaf7be' : '#8dafa1', 800, 'center');
      const aura = c.createRadialGradient(px, py, 2, px, py, 42); aura.addColorStop(0, 'rgba(228,242,167,.17)'); aura.addColorStop(1, 'rgba(228,242,167,0)'); c.fillStyle = aura; c.fillRect(px - 42, py - 42, 84, 84);
      c.fillStyle = 'rgba(191,229,203,.7)'; c.beginPath(); c.ellipse(px - 7, py - 4, 8, 4.5 + Math.sin(clock * 12) * .3, -.7, 0, 7); c.fill(); c.beginPath(); c.ellipse(px + 7, py - 4, 8, 4.5 + Math.sin(clock * 12) * .3, .7, 0, 7); c.fill(); c.fillStyle = '#f2edab'; c.beginPath(); c.ellipse(px, py + 1, 5, 8, 0, 0, 7); c.fill(); c.fillStyle = '#264448'; c.beginPath(); c.arc(px, py - 5, 4, 0, 7); c.fill();
      c.restore();
      label(c, count(state.seeds) + '/' + level.seeds.length + ' graines ◇ puis E · À 0 : perte, sauf arrivée réussie', 210, 491, 11, '#e4ead2', 700, 'center');
      label(c, 'L = plein ×1 · Nectar +3 ×1 · Ronces −2', 210, 510, 11, '#b1c7b5', 600, 'center');
      label(c, level.gates.length ? 'Marche sur ↔ pour ouvrir / refermer les portes G.' : 'Les lanternes sont des réserves : choisis quand les utiliser.', 210, 528, 10, '#83a7aa', 500, 'center');
      label(c, 'Tape du côté voulu · Flèches / glissement', 210, 547, 11, '#b7d3cc', 600, 'center');
      box(c, 24, 558, 43, 35, 10, '#213d43'); label(c, '‹', 45.5, 583, 23, state.level > 1 ? '#c3dbcc' : '#526f74', 500, 'center');
      box(c, 353, 558, 43, 35, 10, '#213d43'); label(c, '›', 374.5, 583, 23, state.level < records.unlocked ? '#c3dbcc' : '#526f74', 500, 'center');
      label(c, 'Clairière ' + state.level + '/20 · Parfait : ' + level.par + ' pas', 210, 571, 11, '#d4dfc7', 700, 'center');
      const best = records.best[state.level]; label(c, best ? 'Meilleur : ' + best.moves + ' pas · ' + '★'.repeat(best.stars) : 'Choisis l’ordre des graines et des recharges.', 210, 589, 10, '#8ea9a4', 500, 'center');
      c.restore();
    }
    function snapshot() { return state ? { game: ID, version: VERSION, ...clone(state), score: state.status === 'won' ? score() : 0 } : null; }
    function restore(data) {
      try {
        if (!data || !integer(data.level, 1, LEVEL_COUNT)) return false;
        const candidate = generateLevel(data.level); if (!validState(data, candidate)) return false;
        level = candidate; state = { level: data.level, x: data.x, y: data.y, energy: data.energy, moves: data.moves, seeds: data.seeds.slice(), lit: data.lit.slice(), nectar: data.nectar.slice(), open: data.open, status: data.status };
        records.level = data.level; records.unlocked = Math.max(records.unlocked, Math.min(LEVEL_COUNT, data.level + (data.status === 'won' ? 1 : 0))); touch = null; ended = state.status !== 'playing'; hud(); return true;
      } catch (_) { return false; }
    }
    function next() { if (!state || state.status !== 'won') return; if (state.level < LEVEL_COUNT) load(state.level + 1, true); else { load(1, true); toast('Les 20 clairières sont sauvées. Essaie d’obtenir les 60 étoiles.'); } }
    return { reset: () => load(records.level, true), update, draw, pointer, key, snapshot, restore, next };
  }
  if (global) global.createGame = createGame;
  if (typeof module !== 'undefined' && module.exports) module.exports = { createGame, generateLevel, freshState, validState, traverse, LEVEL_COUNT };
})(typeof window !== 'undefined' ? window : globalThis);


