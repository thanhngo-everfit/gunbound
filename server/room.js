import { XE, XE_LIST, PICKABLE, LEGENDARY, LEGEND_CHANCE, LEGEND_CHANCE_ROOM, moveBudget, SS_COOLDOWN, SUDDEN_TYPES, DRAIN_STEP, SCORE_RESPAWN_TURNS, ITEMS, START_GOLD, TELE_SHOT } from '../shared/xe.js';
import { planShot, BOT_NAMES } from './bot.js';
import { genTerrain, spawnPositions, standSpot, settle, moveStep, crawlPath, swimAshore, TANK_R, simulateShot, mulberry32, replayMs, rollWind, driftWind, newWeather, advanceWeather, hasPainted, MAPS, MAP_IDS, W, WATER_Y } from '../shared/physics.js';

const TURN_SECS = [15, 20, 30];
const SUDDEN_OPTIONS = [0, 20, 30, 40];
// camera flyover over the battlefield before the first turn
const INTRO_MS = 3400;
const AFK_TURN_MS = 4000;
const MAX_PLAYERS = 10;
const TEAM_SIZE = 5;
const TICK_MS = 33;
const LOAD_MAX_MS = 20000;

export class Room {
  // hooks: where career stats live (the Node server's data/stats.json, or Redis behind the Vercel functions).
  // The room only reads profiles and reports finished matches, so it runs the same in Node and in a browser worker.
  constructor(id, name, io, onChange, practice = false, hooks = {}) {
    this.id = id;
    this.hooks = { profile: () => null, recordMatch: () => {}, ...hooks };
    this.name = name;
    // practice rooms: solo training against dummy targets, no win/loss, no stats
    this.practice = practice;
    this.io = io;
    this.onChange = onChange;
    this.channel = 'room:' + id;
    this.members = new Map(); // token -> { player, team, xe, ready }
    this.hostToken = null;
    this.map = 'dong-co';
    // match settings, host-controlled. sudden = turn after which damage doubles (0 = off)
    // xeMode: 'pick' = everyone chooses (a player may still pick "?"), 'random' = the whole room is rolled at start
    // mode: 'solo' (last team standing) or 'score' (Gunbound Score: shared team lives, the dead respawn)
    // suddenType: see SUDDEN_TYPES
    this.settings = { turnSec: 20, sudden: 0, suddenType: 'double', xeMode: 'pick', mode: 'solo' };
    this.state = 'waiting';
    this.game = null;
  }

  // ---------- lobby / waiting room ----------

  info() {
    const host = this.members.get(this.hostToken);
    return {
      id: this.id, name: this.name, map: this.map, state: this.state,
      count: [...this.members.values()].filter(m => m.team).length,
      max: MAX_PLAYERS, host: host ? host.player.name : '', settings: this.settings, practice: this.practice,
    };
  }

  view() {
    return {
      ...this.info(),
      hostToken: undefined,
      members: [...this.members.values()].map(m => ({
        id: m.player.pid, name: m.player.name, gender: m.player.gender, team: m.team, xe: m.xe, ready: m.ready,
        host: m.player.token === this.hostToken, online: m.player.bot || !!m.player.socket, bot: !!m.player.bot,
        profile: m.player.bot ? null : this.hooks.profile(m.player.name),
      })),
    };
  }

  emit(ev, data) { this.io.to(this.channel).emit(ev, data); }
  sync() { this.emit('room:state', this.view()); this.onChange(); }

  teamCount(team) { return [...this.members.values()].filter(m => m.team === team).length; }

  join(player) {
    if (!this.members.has(player.token)) {
      let team = null;
      if (this.state === 'waiting') {
        const a = this.teamCount('A'), b = this.teamCount('B');
        if (a + b >= MAX_PLAYERS) return { error: 'Phòng đã đầy' };
        team = a <= b ? 'A' : 'B';
      }
      const pool = PICKABLE(), xe = pool[Math.floor(Math.random() * pool.length)].id;
      this.members.set(player.token, { player, team, xe, ready: false });
      if (!this.hostToken) this.hostToken = player.token;
    }
    player.roomId = this.id;
    player.socket?.join(this.channel);
    this.sync();
    this.sendGameTo(player);
    return { ok: true };
  }

  leave(player) {
    const m = this.members.get(player.token);
    if (!m) return;
    this.members.delete(player.token);
    player.socket?.leave(this.channel);
    player.roomId = null;
    if (this.game) {
      const t = this.game.tanks.find(t => t.token === player.token);
      if (t) t.connected = false;
      this.checkForfeit();
    }
    if (this.hostToken === player.token) this.hostToken = [...this.members.values()].find(m => !m.player.bot)?.player.token || null;
    this.sync();
  }

  onDisconnect(player) {
    if (this.game) {
      const t = this.game.tanks.find(t => t.token === player.token);
      if (t) t.connected = false;
    }
    this.sync();
  }

  onReconnect(player) {
    player.socket.join(this.channel);
    if (this.game) {
      const t = this.game.tanks.find(t => t.token === player.token);
      if (t) t.connected = true;
    }
    this.sync();
    this.sendGameTo(player);
  }

  // A room with only NPCs left is empty.
  isEmpty() { return ![...this.members.values()].some(m => !m.player.bot); }

  addBot(player, team) {
    if (player.token !== this.hostToken || this.state !== 'waiting' || !['A', 'B'].includes(team)) return;
    if (this.teamCount(team) >= TEAM_SIZE || this.teamCount('A') + this.teamCount('B') >= MAX_PLAYERS) return;
    this.botSeq = (this.botSeq || 0) + 1;
    const used = new Set([...this.members.values()].map(m => m.player.name));
    const name = BOT_NAMES.find(n => !used.has(n)) || `NPC ${this.botSeq}`;
    const bot = { token: `bot-${this.id}-${this.botSeq}`, pid: `b${this.id}-${this.botSeq}`, name, bot: true, socket: null, roomId: this.id,
      gender: ['m', 'f', 'm2', 'f2'][Math.floor(Math.random() * 4)] };
    const pool = PICKABLE(), xe = pool[Math.floor(Math.random() * pool.length)].id;
    this.members.set(bot.token, { player: bot, team, xe, ready: true });
    this.sync();
  }

  removeBot(player, pid) {
    if (player.token !== this.hostToken || this.state !== 'waiting') return;
    const m = [...this.members.values()].find(m => m.player.bot && m.player.pid === pid);
    if (!m) return;
    this.members.delete(m.player.token);
    this.sync();
  }

  setTeam(player, team) {
    const m = this.members.get(player.token);
    if (!m || this.state !== 'waiting' || !['A', 'B'].includes(team) || m.team === team) return;
    if (this.teamCount(team) >= TEAM_SIZE) return;
    m.team = team; m.ready = false;
    this.sync();
  }

  setXe(player, xe) {
    const m = this.members.get(player.token);
    // legendary xe can only come from a random pick, except in practice rooms where anything goes
    if (!m || this.state !== 'waiting' || ((!XE[xe] || (XE[xe].legendary && !this.practice)) && xe !== 'random')) return;
    m.xe = xe;
    this.sync();
  }

  setReady(player, ready) {
    const m = this.members.get(player.token);
    if (!m || this.state !== 'waiting') return;
    m.ready = !!ready;
    this.sync();
  }

  setMap(player, map) {
    if (player.token !== this.hostToken || this.state !== 'waiting' || !MAPS[map] && map !== 'random') return;
    this.map = map;
    this.sync();
  }

  setSettings(player, { turnSec, sudden, suddenType, xeMode, mode } = {}) {
    if (player.token !== this.hostToken || this.state !== 'waiting') return;
    if (SUDDEN_TYPES[suddenType]) this.settings.suddenType = suddenType;
    if (['solo', 'score'].includes(mode) && !this.practice) this.settings.mode = mode;
    if (['pick', 'random'].includes(xeMode)) this.settings.xeMode = xeMode;
    if (TURN_SECS.includes(Number(turnSec))) this.settings.turnSec = Number(turnSec);
    if (SUDDEN_OPTIONS.includes(Number(sudden))) this.settings.sudden = Number(sudden);
    this.sync();
  }

  chat(player, text) {
    const m = this.members.get(player.token);
    text = String(text || '').trim().slice(0, 200);
    if (!m || !text) return;
    this.emit('chat', { name: player.name, pid: player.pid, team: m.team, text });
  }

  // ---------- match ----------

  start(player) {
    if (player.token !== this.hostToken || this.state !== 'waiting') return { error: 'Chỉ chủ phòng mới được bắt đầu' };
    if (this.practice) this.addDummies();
    const fighters = [...this.members.values()].filter(m => m.team);
    if (!fighters.some(m => m.team === 'A') || !fighters.some(m => m.team === 'B')) return { error: 'Mỗi đội cần ít nhất 1 người' };
    const notReady = fighters.filter(m => !m.ready && m.player.token !== this.hostToken);
    if (notReady.length) return { error: `Chưa sẵn sàng: ${notReady.map(m => m.player.name).join(', ')}` };

    const seed = (Math.random() * 2 ** 31) | 0;
    const map = this.map === 'random' ? MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)] : this.map;
    const rand = mulberry32(seed);
    // painted maps come in two variants: as painted, or mirrored left-right
    const mirror = hasPainted(map) && rand() < 0.5;
    const mask = genTerrain(seed, map, mirror);
    const spots = spawnPositions(mask, fighters.length, rand).sort((a, b) => a.x - b.x);
    // fairness: teams alternate along the map instead of clumping
    const byTeam = { A: fighters.filter(m => m.team === 'A').sort(() => rand() - 0.5), B: fighters.filter(m => m.team === 'B').sort(() => rand() - 0.5) };
    let next = rand() < 0.5 ? 'A' : 'B';
    const order = spots.map(() => {
      if (!byTeam[next].length) next = next === 'A' ? 'B' : 'A';
      const m = byTeam[next].shift();
      next = next === 'A' ? 'B' : 'A';
      return m;
    });
    // Xe ngẫu nhiên: roll anyone who picked "?" (or everyone in all-random rooms), avoiding repeats while possible
    const used = new Set(order.filter(m => m.xe !== 'random' && this.settings.xeMode !== 'random').map(m => m.xe));
    // a random pick may land a legendary xe (Gunbound's Dragon/Knight thrill); otherwise a normal one
    const roll = chance => {
      const legend = LEGENDARY().filter(x => !used.has(x.id));
      const base = Math.random() < chance && legend.length ? legend : PICKABLE();
      const pool = base.filter(x => !used.has(x.id));
      const pick = (pool.length ? pool : base)[Math.floor(Math.random() * (pool.length || base.length))].id;
      used.add(pick);
      return pick;
    };
    const tanks = order.map((m, i) => {
      const rolled = !m.player.dummy && (m.xe === 'random' || this.settings.xeMode === 'random');
      const xeId = rolled ? roll(m.xe === 'random' ? LEGEND_CHANCE : LEGEND_CHANCE_ROOM) : m.xe;
      const xe = XE[xeId];
      const { x, y } = spots[i];
      return {
        id: 'p' + i, token: m.player.token, pid: m.player.pid, name: m.player.name, gender: m.player.gender, team: m.team, xe: xeId, rolled,
        x, y, facing: x < W / 2 ? 1 : -1, angle: Math.round((xe.angle[0] + xe.angle[1]) / 2),
        hp: xe.hp, maxHp: xe.hp, armor: xe.armor, alive: true, connected: m.player.bot || !!m.player.socket, bot: !!m.player.bot,
        ssCd: 0, ssReady: true, shield: xe.shield?.max || 0, maxShield: xe.shield?.max || 0, delay: Math.floor(rand() * 150), order: i,
        poison: null, blind: false, mark: false, armorBuff: 0, canRevive: xe.passive === 'revive',
        stats: { dealt: 0, kills: 0, shots: 0, gold: 0, deaths: 0 }, gold: START_GOLD, afk: 0,
        dummy: !!m.player.dummy,
      };
    });
    this.state = 'playing';
    // Score mode: each team shares (team size + 1) lives, like Gunbound
    const lives = this.settings.mode === 'score' && !this.practice
      ? { A: tanks.filter(t => t.team === 'A').length + 1, B: tanks.filter(t => t.team === 'B').length + 1 } : null;
    this.game = { seed, map, mirror, mask, tanks, lives, carves: [], zones: [], pillars: [], minions: [], moonZones: [], moonNight: null, wind: rollWind(), weather: newWeather(), waterY: WATER_Y, turn: null, turnNo: 0, phase: 'loading', timers: new Set(),
      loaded: Object.fromEntries(tanks.map(t => [t.id, t.bot ? 100 : 0])) };
    this.game.tick = setInterval(() => this.tick(), TICK_MS);
    this.emit('game:start', this.snapshot());
    this.sync();
    // start when everyone has loaded, or after LOAD_MAX_MS so one slow machine can't stall the room
    this.later(LOAD_MAX_MS, () => this.ready());
    return { ok: true };
  }

  progress(player, pct) {
    const g = this.game;
    if (!g || g.phase !== 'loading') return;
    const t = g.tanks.find(t => t.token === player.token);
    if (!t) return;
    g.loaded[t.id] = Math.max(g.loaded[t.id] || 0, Math.min(100, Math.round(Number(pct) || 0)));
    this.emit('game:loading', { id: t.id, pct: g.loaded[t.id] });
    if (g.tanks.every(t => t.bot || !t.connected || g.loaded[t.id] >= 100)) this.ready();
  }

  ready() {
    const g = this.game;
    if (!g || g.phase !== 'loading') return;
    g.phase = 'ready';
    this.emit('game:ready', { introMs: INTRO_MS });
    this.later(INTRO_MS, () => this.nextTurn());
  }

  later(ms, fn) {
    const g = this.game;
    const h = setTimeout(() => { g.timers.delete(h); if (this.game === g) fn(); }, ms);
    g.timers.add(h);
    return h;
  }

  publicTank(t) {
    const { token, stats, ...rest } = t;
    return { ...rest, poison: !!t.poison, stats };
  }

  snapshot() {
    const g = this.game;
    return {
      seed: g.seed, map: g.map, carves: g.carves, zones: g.zones, wind: g.wind, turnNo: g.turnNo,
      tanks: g.tanks.map(t => this.publicTank(t)),
      turn: g.turn ? { id: g.turn.id, msLeft: Math.max(0, g.turn.endsAt - Date.now()), moveLeft: g.turn.moveLeft } : null,
      phase: g.phase, loaded: g.loaded, roomName: this.name, settings: this.settings, mirror: g.mirror, waterY: g.waterY, practice: this.practice, weather: g.weather,
      lives: g.lives, sudden: this.suddenOn(), pillars: g.pillars, minions: g.minions, moonZones: g.moonZones, moonNight: g.moonNight,
    };
  }

  sendGameTo(player) {
    if (this.game && player.socket) player.socket.emit('game:start', { ...this.snapshot(), rejoin: true });
  }

  // Đột tử is on once the match passes the chosen turn
  suddenOn() {
    const g = this.game;
    return !!(g && this.settings.sudden && g.turnNo > this.settings.sudden && !this.practice);
  }

  // SS availability: Gunbound cooldown, except that SS-death frees it and Double/Big-bomb death lock it
  ssOk(t) {
    if (!this.suddenOn()) return t.ssCd <= 0;
    const type = this.settings.suddenType;
    return type === 'ss' ? true : type === 'drain' ? t.ssCd <= 0 : false;
  }

  // Score mode: every new death spends one team life; the dead come back after a few turns if lives remain
  processDeaths() {
    const g = this.game;
    for (const t of g.tanks) {
      if (t.alive || t.deathSeen) continue;
      t.deathSeen = true;
      t.stats.deaths++;
      if (!g.lives || t.dummy) continue;
      g.lives[t.team] = Math.max(0, g.lives[t.team] - 1);
      if (g.lives[t.team] > 0) t.respawnAt = g.turnNo + SCORE_RESPAWN_TURNS;
      this.emit('game:lives', { lives: g.lives, id: t.id, respawnAt: t.respawnAt || null, turnNo: g.turnNo });
    }
  }

  // Score mode: drop a dead xe back in at the point its player chose (or a random one), blown a little by the wind
  respawn(t) {
    const g = this.game;
    let x = Math.round(t.dropX ?? (160 + Math.random() * (W - 320)));
    x += Math.round(Math.cos((g.wind.a * Math.PI) / 180) * g.wind.s * 4);
    x = Math.max(40, Math.min(W - 40, x));
    let y = standSpot(g.mask, x);
    // nowhere to stand here (water, cliff): search outward for the nearest good ground
    for (let d = 20; y >= g.waterY && d < W; d += 20) {
      for (const nx of [x - d, x + d]) {
        if (nx < 40 || nx > W - 40) continue;
        const ny = standSpot(g.mask, nx);
        if (ny < g.waterY) { x = nx; y = ny; break; }
      }
    }
    const xe = XE[t.xe];
    Object.assign(t, { x, y, alive: true, hp: xe.hp, shield: t.maxShield || 0, poison: null, blind: false, mark: false, armorBuff: 0, deathSeen: false, respawnAt: null, dropX: null, ssCd: 0 });
    // come back at the back of the queue, not ahead of everyone
    t.delay = Math.max(...g.tanks.filter(o => o.alive && o !== t).map(o => o.delay), t.delay);
    this.emit('game:respawn', { id: t.id, x: t.x, y: t.y, hp: t.hp, delay: t.delay, lives: g.lives });
  }

  // Score mode: a dead player picks where to fall back in
  setDrop(player, { x } = {}) {
    const g = this.game;
    const t = g?.tanks.find(t => t.token === player.token);
    if (!t || t.alive || !t.respawnAt || !Number.isFinite(Number(x))) return;
    t.dropX = Math.max(40, Math.min(W - 40, Math.round(Number(x))));
    this.emit('game:drop', { id: t.id, x: t.dropX });
  }

  // Máu Cạn Dần: at the start of each round after sudden death, everyone loses k × DRAIN_STEP HP
  applyDrain() {
    const g = this.game;
    const alive = g.tanks.filter(t => t.alive);
    g.roundLeft = (g.roundLeft ?? 0) - 1;
    if (g.roundLeft > 0) return;
    g.roundLeft = alive.length;
    g.drainRound = (g.drainRound || 0) + 1;
    const amt = g.drainRound * DRAIN_STEP, events = [];
    for (const t of alive) {
      t.hp -= amt;
      events.push({ type: 'dmg', id: t.id, amt, hp: Math.max(0, t.hp), kind: 'drain' });
      if (t.hp <= 0) { t.hp = 0; t.alive = false; events.push({ type: 'die', id: t.id }); }
    }
    this.emit('game:tick', { events, zones: g.zones, waterY: g.waterY, drain: amt, tanks: g.tanks.map(x => this.publicTank(x)) });
  }

  nextTurn() {
    const g = this.game;
    if (!g) return;
    this.processDeaths();
    if (this.checkWin()) return;
    for (const d of g.tanks) if (!d.alive && d.respawnAt && g.turnNo + 1 >= d.respawnAt) this.respawn(d);
    // everyone is down at once (Score): bring the waiting ones back now instead of stalling
    if (!g.tanks.some(t => t.alive)) for (const d of g.tanks) if (d.respawnAt) this.respawn(d);
    g.turnNo++;
    if (this.settings.sudden && !this.practice && g.turnNo === this.settings.sudden + 1) {
      this.emit('game:sudden', { turn: g.turnNo, type: this.settings.suddenType });
      g.roundLeft = 0;
    }
    if (this.suddenOn() && this.settings.suddenType === 'drain') {
      this.applyDrain();
      this.processDeaths();
      if (this.checkWin()) return;
    }
    const alive = g.tanks.filter(t => t.alive);
    if (!alive.length) return this.finish(null, false);
    const t = alive.reduce((a, b) => (b.delay < a.delay || (b.delay === a.delay && b.order < a.order) ? b : a));
    // Băng Phong: a frozen xe loses this whole turn (it thaws, and waits at the back of the queue)
    if (t.frozen) {
      t.frozen = false;
      t.delay += 600;
      g.phase = 'anim';
      this.emit('game:skip', { id: t.id, frozen: true });
      this.later(1100, () => this.nextTurn());
      return;
    }
    // first turn keeps the match's rolled wind; later turns only drift it sometimes
    const prevWind = g.wind;
    if (g.turnNo > 1) g.wind = driftWind(g.wind);
    const windChanged = g.turnNo > 1 && (prevWind.s !== g.wind.s || prevWind.a !== g.wind.a);
    const weatherChanged = g.turnNo > 1 && advanceWeather(g.weather);
    t.armorBuff = 0;
    if (t.ssCd > 0) t.ssCd--;
    // Giáp ảo refills at the start of the xe's own turn
    let shieldUp = 0;
    const sh = XE[t.xe].shield;
    if (sh && t.shield < t.maxShield) { shieldUp = Math.min(sh.regen, t.maxShield - t.shield); t.shield += shieldUp; }
    for (const x of g.tanks) x.ssReady = this.ssOk(x);
    // players who let the clock run out twice in a row get short turns until they act again
    const ms = t.connected && t.afk < 2 ? this.settings.turnSec * 1000 : AFK_TURN_MS;
    g.turn = { id: t.id, endsAt: Date.now() + ms, moveLeft: moveBudget(XE[t.xe]), moved: 0, input: { left: false, right: false }, item: null, itemDelay: 0 };
    // Xúc Tu Trói: a rooted xe cannot move this turn
    if (t.rooted) { g.turn.moveLeft = 0; t.rooted = false; t.rootedNow = true; } else t.rootedNow = false;
    // Thánh Thể (Kỳ Lân passive): allies close by heal a little at the start of its turn
    if (t.xe === 'kylan') {
      const events = [];
      for (const a of g.tanks) {
        if (a === t || !a.alive || a.team !== t.team || Math.abs(a.x - t.x) > 120) continue;
        const amt = Math.min(30, a.maxHp - a.hp);
        if (amt > 0) { a.hp += amt; events.push({ type: 'heal', id: a.id, amt, hp: a.hp, aura: true }); }
      }
      if (events.length) this.emit('game:tick', { events, zones: g.zones, waterY: g.waterY, tanks: g.tanks.map(x => this.publicTank(x)) });
    }
    g.phase = 'turn';
    g.turn.timer = this.later(ms, () => this.skip(t, true));
    if (t.dummy) this.later(700, () => this.skip(t, false));
    else if (t.bot) this.later(1200 + Math.random() * 1300, () => this.botAct(t));
    const delays = Object.fromEntries(g.tanks.map(x => [x.id, x.delay]));
    this.emit('game:turn', { id: t.id, wind: g.wind, windChanged, weather: g.weather, weatherChanged, msLeft: ms, turnNo: g.turnNo, moveLeft: g.turn.moveLeft, rooted: t.rootedNow, delays, ssCd: t.ssCd, ssReady: t.ssReady, blind: t.blind, sudden: this.suddenOn(), lives: g.lives, shield: t.shield, shieldUp });
  }

  // NPC turn: turn toward the target, show the aim, then fire.
  botAct(t) {
    const g = this.game;
    if (!g || g.phase !== 'turn' || g.turn?.id !== t.id) return;
    const bot = this.members.get(t.token)?.player || { token: t.token };
    // NPCs use items too: heal when hurt, sometimes double up when rich
    if (t.hp < t.maxHp * 0.35 && t.gold >= ITEMS.heal.cost) this.useItem(bot, { item: 'heal' });
    else if (t.gold >= ITEMS.dual.cost + 200 && Math.random() < 0.4) this.useItem(bot, { item: 'dual' });
    const plan = planShot(g, t);
    t.facing = plan.facing;
    t.angle = plan.angle;
    this.emit('game:pos', { id: t.id, x: t.x, y: t.y, facing: t.facing, moveLeft: g.turn.moveLeft });
    this.emit('game:aim', { id: t.id, angle: t.angle });
    this.later(700, () => this.fire(bot, { angle: plan.angle, power: plan.power, shot: plan.shot }));
  }

  activeTank(player) {
    const g = this.game;
    if (!g || g.phase !== 'turn' || !g.turn) return null;
    const t = g.tanks.find(t => t.id === g.turn.id);
    return t && t.token === player.token && t.alive ? t : null;
  }

  // Items: bought with in-match gold, one per turn, before firing.
  useItem(player, { item } = {}) {
    const t = this.activeTank(player);
    const it = ITEMS[item];
    const g = this.game;
    if (!t || !it || g.turn.item || t.gold < it.cost || this.suddenOn()) return;
    t.gold -= it.cost;
    g.turn.item = item;
    g.turn.itemDelay = it.delay;
    t.afk = 0;
    const ev = { id: t.id, item, gold: t.gold };
    if (item === 'heal') { const amt = Math.min(300, t.maxHp - t.hp); t.hp += amt; ev.heal = amt; ev.hp = t.hp; }
    this.emit('game:item', ev);
  }

  input(player, { left, right }) {
    if (!this.activeTank(player)) return;
    this.game.turn.input = { left: !!left, right: !!right };
  }

  aim(player, { angle }) {
    const t = this.activeTank(player);
    if (!t) return;
    const [lo, hi] = XE[t.xe].angle;
    t.angle = Math.max(lo, Math.min(hi, Math.round(Number(angle) || lo)));
    this.io.to(this.channel).except(player.socket?.id || '').emit('game:aim', { id: t.id, angle: t.angle });
  }

  addDummies() {
    for (const m of [...this.members.values()]) if (m.player.dummy) this.members.delete(m.player.token);
    for (let i = 0; i < 2; i++) {
      const bot = { token: `dummy-${this.id}-${i}`, pid: `d${this.id}-${i}`, name: `Bia Tập ${i + 1}`, bot: true, dummy: true, socket: null, roomId: this.id, gender: 'm' };
      this.members.set(bot.token, { player: bot, team: 'B', xe: XE_LIST[(i * 3 + 2) % XE_LIST.length].id, ready: true });
    }
    for (const m of this.members.values()) if (!m.player.bot) m.team = 'A';
  }

  tick() {
    const g = this.game;
    if (!g || g.phase !== 'turn' || !g.turn) return;
    const t = g.tanks.find(t => t.id === g.turn.id);
    const { left, right } = g.turn.input;
    const dir = left && !right ? -1 : right && !left ? 1 : 0;
    if (!t || !dir) return;
    let changed = t.facing !== dir;
    t.facing = dir;
    if (g.turn.moveLeft > 0 && moveStep(g.mask, t, dir)) { g.turn.moveLeft--; g.turn.moved++; changed = true; }
    if (changed) this.emit('game:pos', { id: t.id, x: t.x, y: t.y, facing: t.facing, moveLeft: g.turn.moveLeft });
    if (t.y > g.waterY) {
      // Bơi Lội: the penguin swims back to shore the first time
      const spot = t.xe === 'canhcut' && !t.swam && swimAshore(g.mask, t, g.waterY);
      if (spot) { t.swam = true; t.x = spot.x; t.y = spot.y; this.emit('game:pos', { id: t.id, x: t.x, y: t.y, facing: t.facing, moveLeft: g.turn.moveLeft, swim: true }); return; }
      t.alive = false; t.hp = 0;
      this.emit('game:fell', { id: t.id });
      this.endTurn(t, 0, 1200);
    }
  }

  fire(player, { angle, power, shot }) {
    const t = this.activeTank(player);
    if (!t) return;
    const xe = XE[t.xe];
    if (!xe.shots[shot]) return;
    if (shot === 'ss' && !this.ssOk(t)) return;
    const g = this.game;
    const [lo, hi] = xe.angle;
    t.angle = Math.max(lo, Math.min(hi, Math.round(Number(angle) || lo)));
    power = Math.max(0, Math.min(100, Number(power) || 0));
    g.phase = 'anim';
    clearTimeout(g.turn.timer);

    const sudden = this.suddenOn() ? this.settings.suddenType : null;
    const before = new Map(g.tanks.map(x => [x.id, { alive: x.alive, x: x.x }]));
    const item = g.turn.item;
    // Đột tử Bom To: +30% damage and 1.5× blast radius
    const dmgMul = (sudden === 'bigbomb' ? 1.3 : 1) * (item === 'power' ? 1.3 : 1);
    const rMul = sudden === 'bigbomb' ? 1.5 : 1;
    const sim = () => simulateShot({ mask: g.mask, tanks: g.tanks, wind: g.wind, shooter: t, angle: t.angle, power, shotKey: shot, dmgMul, rMul, waterY: g.waterY, weather: g.weather.active, pillars: g.pillars, moonZones: g.moonZones,
      gravityMul: g.moonNight ? (g.moonNight.team === t.team ? g.moonNight.ally : g.moonNight.foe) : 1,
      shotOverride: item === 'tele' ? { ...TELE_SHOT, look: xe.shots.s1.look } : null });
    const res = sim();
    // Bắn Đôi (item, or Đột tử Bắn Đôi): the same shot again right after, merged into one replay
    if ((item === 'dual' || sudden === 'double') && t.alive) {
      const off = res.frames + 20;
      const r2 = sim();
      for (const p of r2.paths) p.start += off;
      for (const e of r2.events) e.f += off;
      res.paths.push(...r2.paths); res.events.push(...r2.events); res.zones.push(...r2.zones);
      res.frames = off + r2.frames; res.dealt += r2.dealt; res.kills += r2.kills;
      for (const [id, amt] of Object.entries(r2.taken)) res.taken[id] = (res.taken[id] || 0) + amt;
    }
    t.afk = 0;
    // SS cooldown: the next SS_COOLDOWN of this player's turns are locked (decremented at each turn start)
    if (shot === 'ss' && sudden !== 'ss') t.ssCd = SS_COOLDOWN + 1;
    const bonus = this.shotBonus(t, shot, res, before);
    const gold = bonus.reduce((a, b) => a + b.gold, 0);
    t.gold += gold; t.stats.gold += gold;
    for (const e of res.events) if (e.type === 'carve') g.carves.push([e.x, e.y, e.r]);
    g.zones.push(...res.zones);
    // pillars and marks last whole rounds (every living xe gets a turn), not single global turns
    const round = g.tanks.filter(x => x.alive).length;
    for (const q of res.pillars) q.turns = q.turns * round;
    g.pillars.push(...res.pillars);
    for (const z of res.moonZones) z.turns = z.turns * round;
    g.moonZones.push(...res.moonZones);
    if (res.moonNight) g.moonNight = { ...res.moonNight, turns: res.moonNight.turns * round };
    t.heavy = 0; // Bánh Mochi's weight lasts one shot
    for (const e of res.events) if (e.type === 'status' && e.mark) { const v = g.tanks.find(x => x.id === e.id); if (v) v.markTurns = round + 1; }
    const ms = xe.shots[shot].minions;
    // armed: false = they sit out the first turn so the enemy can see them and get away (Raon's rule)
    if (ms) for (const m of res.minions) g.minions.push({ id: `m${++this.minionSeq || (this.minionSeq = 1)}`, x: m.x, y: m.y, team: t.team, owner: t.id, life: ms.life * g.tanks.filter(x => x.alive).length, range: ms.range, dmg: ms.dmg, poison: ms.poison, armed: false });
    // Long Nộ (Rồng passive): hurt dragons are fired up for their next shot; firing spends it
    if (t.xe === 'rong') t.fury = false;
    for (const id of Object.keys(res.taken)) { const v = g.tanks.find(x => x.id === id); if (v && v.xe === 'rong' && v !== t && v.alive) v.fury = true; }
    t.stats.dealt += res.dealt; t.stats.kills += res.kills; t.stats.shots++;
    if (xe.shots[shot].selfArmor) t.armorBuff = xe.shots[shot].selfArmor;
    // Rụt Mai: refill Giáp ảo; allies standing close get armour until their own next turn
    const sg = xe.shots[shot];
    if (sg.shieldGain && t.alive) {
      t.shield = Math.min(t.maxShield, t.shield + sg.shieldGain);
      res.events.push({ type: 'shieldUp', id: t.id, shield: t.shield, f: res.frames });
      if (sg.allyArmor) for (const a of g.tanks) {
        if (a === t || !a.alive || a.team !== t.team || Math.abs(a.x - t.x) > sg.allyArmor.r) continue;
        a.armorBuff = Math.max(a.armorBuff || 0, sg.allyArmor.v);
        res.events.push({ type: 'status', id: a.id, armor: true, f: res.frames });
      }
    }

    this.emit('game:shot', {
      id: t.id, angle: t.angle, power, shot, facing: t.facing,
      paths: res.paths, events: res.events, frames: res.frames, zones: res.zones, bonus, sudden, item, pillars: g.pillars, minions: g.minions, moonZones: g.moonZones, moonNight: g.moonNight,
      tanks: g.tanks.map(x => this.publicTank(x)),
    });
    this.endTurn(t, (item === 'tele' ? 700 : xe.shots[shot].delay) + g.turn.itemDelay, replayMs(res.frames, shot === 'ss') + 1600);
  }

  // Gunbound-style shot bonuses, paid in gold.
  shotBonus(t, shot, res, before) {
    const g = this.game;
    const hitFoes = Object.keys(res.taken).map(id => g.tanks.find(x => x.id === id)).filter(v => v && v.team !== t.team);
    const hitAllies = Object.keys(res.taken).map(id => g.tanks.find(x => x.id === id)).filter(v => v && v.team === t.team && v !== t);
    const kills = g.tanks.filter(v => v.team !== t.team && before.get(v.id).alive && !v.alive).length;
    const out = [];
    if (hitFoes.length) {
      out.push({ text: 'Trúng đích', gold: Math.round(res.dealt / 4) });
      if (t.angle >= 70) out.push({ text: 'Thưởng góc cao', gold: 150 });
      const far = Math.max(...hitFoes.map(v => Math.abs(before.get(v.id).x - t.x)));
      if (far > 1100) out.push({ text: 'Bắn xa', gold: 200 });
      if (res.dealt >= 350) out.push({ text: 'Phát bắn tuyệt vời', gold: 250 });
      if (hitFoes.length >= 2) out.push({ text: 'Trúng nhiều mục tiêu', gold: 120 * hitFoes.length });
      if (shot === 'ss') out.push({ text: 'Tuyệt chiêu', gold: 100 });
    }
    if (kills) out.push({ text: kills >= 2 ? 'Hạ gục kép' : 'Hạ gục', gold: kills >= 2 ? 800 : 300 });
    // Hất văng (Gunbound "Bunge"): an enemy knocked into the water by this shot
    const bunged = res.events.filter(e => e.type === 'die' && e.drown && g.tanks.find(x => x.id === e.id)?.team !== t.team).length;
    if (bunged) out.push({ text: 'Hất văng', gold: 100 * bunged });
    if (res.boomerang && hitFoes.length) out.push({ text: 'Boomerang', gold: 80 });
    // Gunbound pays a small bonus for shooting through the weather
    if (res.twisted) out.push({ text: 'Qua lốc xoáy', gold: 50 });
    if (res.zapped) out.push({ text: 'Đạn nhiễm điện', gold: 50 });
    if (hitAllies.length) out.push({ text: 'Bắn trúng đồng đội', gold: -100 * hitAllies.length });
    return out;
  }

  skip(t, timeout) {
    const g = this.game;
    if (!g || g.phase !== 'turn' || g.turn?.id !== t.id) return;
    g.phase = 'anim';
    clearTimeout(g.turn.timer);
    this.emit('game:skip', { id: t.id, timeout });
    if (timeout) t.afk++;
    this.endTurn(t, 800 + g.turn.itemDelay, 600);
  }

  endTurn(t, shotDelay, waitMs) {
    const g = this.game;
    g.phase = 'anim';
    t.delay += shotDelay + g.turn.moved;
    t.blind = false;
    this.later(waitMs, () => {
      this.applyTurnEffects();
      this.later(g.lastTickHad ? 900 : 100, () => this.nextTurn());
    });
  }

  // Poison and burning ground tick once per global turn.
  applyTurnEffects() {
    const g = this.game;
    const events = [];
    const hurt = (t, amt, kind) => {
      if (!t.alive || amt <= 0) return;
      t.hp -= amt;
      events.push({ type: 'dmg', id: t.id, amt, hp: Math.max(0, t.hp), kind });
      if (t.hp <= 0) {
        if (t.canRevive) { t.canRevive = false; t.hp = Math.round(t.maxHp * 0.25); events.push({ type: 'revive', id: t.id, hp: t.hp }); }
        else { t.hp = 0; t.alive = false; events.push({ type: 'die', id: t.id }); }
      }
    };
    for (const t of g.tanks) {
      if (t.poison && t.alive) {
        const pz = t.poison;
        hurt(t, pz.dmg, 'poison');
        // Đuôi Tử Thần: the poison jumps to one clean neighbour of the victim's team each turn
        if (pz.spread && t.alive) {
          const next = g.tanks.find(o => o !== t && o.alive && !o.poison && o.team === t.team && Math.hypot(o.x - t.x, o.y - t.y) <= pz.spread);
          if (next) { next.poison = { dmg: Math.round(pz.dmg / 2), turns: 2 }; events.push({ type: 'status', id: next.id, poison: true, spread: true }); }
        }
        if (--pz.turns <= 0) t.poison = null;
      }
      // Mắt Đêm lasts two turns
      if (t.markTurns > 0 && --t.markTurns <= 0) { t.mark = false; events.push({ type: 'status', id: t.id, unmark: true }); }
    }
    // Ổ Bọ Con: waiting baby scorpions crawl to the nearest enemy in range and sting
    for (const m of g.minions) {
      m.life--;
      if (!m.armed) { m.armed = true; continue; }
      // walk along the ground toward the nearest enemy; sting only if actually reached
      const foes = g.tanks.filter(o => o.alive && o.team !== m.team && Math.abs(o.x - m.x) <= m.range + TANK_R)
        .sort((a, b) => Math.abs(a.x - m.x) - Math.abs(b.x - m.x));
      for (const v of foes) {
        // crawlPath walks the air row just above the ground; minions and tanks store the ground row
        const path = crawlPath(g.mask, m.x, m.y - 1, v.x, m.range, g.waterY);
        const [ex, ey] = path[path.length - 1];
        if (Math.abs(ex - v.x) > TANK_R || Math.abs(ey + 1 - v.y) > 30) continue;
        events.push({ type: 'minion', mid: m.id, path, id: v.id });
        hurt(v, Math.round(m.dmg * (1 - Math.min(0.6, v.armor))), 'poison');
        if (v.alive) { v.poison = { ...m.poison }; events.push({ type: 'status', id: v.id, poison: true }); }
        m.life = 0;
        break;
      }
    }
    g.minions = g.minions.filter(m => m.life > 0);
    // Gậy Như Ý pillars stand for a couple of turns
    for (const q of g.pillars) q.turns--;
    if (g.pillars.some(q => q.turns <= 0)) events.push({ type: 'pillarGone' });
    g.pillars = g.pillars.filter(q => q.turns > 0);
    for (const z of g.moonZones) z.turns--;
    g.moonZones = g.moonZones.filter(z => z.turns > 0);
    if (g.moonNight && --g.moonNight.turns <= 0) { g.moonNight = null; events.push({ type: 'moonnightEnd' }); }
    for (const z of g.zones) {
      for (const t of g.tanks) if (Math.hypot(t.x - z.x, t.y - 6 - z.y) < z.r + 12) hurt(t, z.dmg, 'burn');
      z.turns--;
    }
    g.zones = g.zones.filter(z => z.turns > 0);
    // Núi Lửa hazard: from turn 15 the lava climbs 18 px every 3 turns
    let lavaRose = false;
    if (g.map === 'nui-lua' && g.turnNo >= 15 && g.turnNo % 3 === 0 && g.waterY > 760) {
      g.waterY -= 18; lavaRose = true;
      for (const t of g.tanks) {
        if (!t.alive || t.y <= g.waterY) continue;
        const spot = t.xe === 'canhcut' && !t.swam && swimAshore(g.mask, t, g.waterY);
        if (spot) { t.swam = true; t.x = spot.x; t.y = spot.y; events.push({ type: 'swim', id: t.id, x: t.x, y: t.y }); continue; }
        t.hp = 0; t.alive = false; events.push({ type: 'die', id: t.id, drown: true });
      }
    }
    if (this.practice) for (const t of g.tanks) if (t.dummy) { t.hp = t.maxHp; t.alive = true; }
    g.lastTickHad = events.length > 0 || lavaRose;
    this.emit('game:tick', { events, zones: g.zones, waterY: g.waterY, lavaRose, pillars: g.pillars, minions: g.minions, moonZones: g.moonZones, moonNight: g.moonNight, tanks: g.tanks.map(x => this.publicTank(x)) });
  }

  checkForfeit() {
    const g = this.game;
    if (!g) return;
    for (const team of ['A', 'B']) {
      if (!g.tanks.some(t => t.team === team && t.connected && this.members.has(t.token))) {
        this.finish(team === 'A' ? 'B' : 'A', true);
        return;
      }
    }
  }

  checkWin() {
    const g = this.game;
    if (this.practice) return !g.tanks.some(t => t.alive && !t.dummy) && (this.finish(null, false), true);
    // Score: a team is out when its lives are gone, or when nobody of it is on the field (Gunbound rule).
    // A one-player team would lose on its first death that way, so it only loses when its lives run out.
    const standing = team => {
      const onField = g.tanks.some(t => t.alive && t.team === team);
      if (!g.lives) return onField;
      const solo = g.tanks.filter(t => t.team === team).length === 1;
      return g.lives[team] > 0 && (onField || solo);
    };
    const a = standing('A');
    const b = standing('B');
    if (a && b) return false;
    this.finish(a ? 'A' : b ? 'B' : null, false);
    return true;
  }

  finish(winner, forfeit) {
    const g = this.game;
    if (!g) return;
    clearInterval(g.tick);
    for (const h of g.timers) clearTimeout(h);
    this.processDeaths();
    const players = g.tanks.filter(t => !t.dummy).map(t => ({ id: t.id, name: t.name, team: t.team, xe: t.xe, alive: t.alive, hp: t.hp, bot: !!t.bot, ...t.stats }));
    // rank-ups for the results screen (compare the ladder before and after this match)
    const counted = winner && !this.practice;
    const before = counted ? new Map(players.filter(p => !p.bot).map(p => [p.id, profile(p.name)])) : null;
    if (counted) this.hooks.recordMatch(players, winner);
    if (counted) for (const p of players) {
      const b = before.get(p.id);
      if (!b) continue;
      const a = profile(p.name);
      p.gpGain = a.gp - b.gp;
      p.rankId = a.rankId; p.rankName = a.rank;
      if (a.rankId !== b.rankId && a.gp >= b.gp) p.rankUp = { from: b.rank, to: a.rank, id: a.rankId };
    }
    const mvp = players.reduce((a, b) => (b.dealt + b.kills * 300 > (a ? a.dealt + a.kills * 300 : -1) ? b : a), null);
    this.emit('game:end', { winner, forfeit, players, mvp: mvp?.id, practice: this.practice });
    this.game = null;
    this.state = 'waiting';
    for (const m of this.members.values()) {
      m.ready = !!m.player.bot;
      if (!m.team) {
        const a = this.teamCount('A'), b = this.teamCount('B');
        if (a + b < MAX_PLAYERS) m.team = a <= b ? 'A' : 'B';
      }
    }
    this.sync();
  }

  destroy() {
    if (this.game) {
      clearInterval(this.game.tick);
      for (const h of this.game.timers) clearTimeout(h);
    }
  }
}
