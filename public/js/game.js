import { XE, ITEMS, ITEM_IDS, SS_COOLDOWN, SUDDEN_TYPES, DRAIN_STEP } from '/shared/xe.js';
import { W, H, WATER_Y, PIVOT, genTerrain, carve, surface, bodyTilt, worldAngle, barrelTip, windVec, G as GRAV, VMAX, WIND_K, FLYERS as FLYER_SET } from '/shared/physics.js';
import { partWorld, drawBabyScorpion, LOOKS, drawXe, drawProjectile, paintTerrain, carveTerrain, makeScenery, drawSky, drawBackdrop, drawWater, drawPortrait, TEAM_COLORS, THEMES, hairFor } from './art.js';
import { ASSETS, xeSprite, drawSmooth, loadAssets, iconUrl, rankIcon } from './assets.js';
import { MAPS, REPLAY_SPEED, SS_DELAY_FRAMES, WEATHERS } from '/shared/physics.js';
import { Particles } from './fx.js';

const HUD_H = 150;
const CHARGE_MS = 2400; // 0→100 while SPACE is held (1.7 s felt too fast)
const TEAM_NAME = { A: 'Đội Đỏ', B: 'Đội Xanh' };
// On-screen size (world px, longest side) of projectile sprites that need to differ from the default.
// Projectiles read big and glowing in Gunbound (~4-5% of the playfield height with the glow).
const SHOT_SIZE = { 'rong-ss': 96, 'phuong-ss': 88, 'bachtuoc-ss': 76, 'camap-ss': 72, 'cu-ss': 56, 'kimquy-ss': 66, 'tethien-s2': 76, 'voi-ss': 64, 'kylan-ss': 66, 'rong-s1': 48 };
// smoke ribbon: how many sim frames of trail follow the shell, and how long it lingers after landing
const RIBBON_LEN = 45;
const RIBBON_LINGER = 24;
const RIBBON_GAP = 5; // sim frames kept clear right behind the shell
// Projectile orientation, for the 2026-10-01 sheets (proj-f / proj-g) and the new xe (proj-e).
// spun in flight: balls, splats, the banana, the halo, the spiral tentacle
const SPIN = new Set(['tethien-s1', 'kylan-s2', 'voi-s1', 'voi-ss', 'bachtuoc-s1', 'bachtuoc-s2', 'gau-s2', 'gau-ss', 'canhcut-ss', 'tho-s2']);
// drawn as-is, never turned with the flight (only mirrored when flying left): the stomping foot, the dripping
// fireball, the eye sigil, the nimbus cloud, the kraken rising from its ink swirl
const NO_ROTATE = new Set(['rong-s2', 'cu-s2', 'tethien-ss', 'bachtuoc-ss', 'tho-s1', 'tho-ss']);
// sprites whose "forward" isn't to the right: the crystal shard, the feather and the staff are painted pointing up-right,
// the owl's dart down-left
const ROT_OFF = { 'kylan-s1': 0.87, 'phuong-s1': 0.87, 'tethien-s2': 0.9, 'cu-s1': -2.36, 'gau-s1': Math.PI, 'canhcut-s1': 0.8, 'canhcut-s2': -0.33 };
// painted facing left: mirrored before turning with the flight (the sliding penguin)
const MIRROR = new Set(['canhcut-s2']);
// creatures and fins kept right side up when flying left
const UPRIGHT = new Set(['rong-s1', 'rong-ss', 'phuong-s2', 'phuong-ss', 'kimquy-s2', 'bocap-s1', 'bocap-ss', 'cu-ss', 'camap-s2', 'camap-ss', 'canhcut-s1', 'canhcut-s2']);

const $ = id => document.getElementById(id);
// errors go to the console and, a few per minute at most, to /api/log so they can be read back later
let errSent = 0, errWindow = 0;
export function reportError(where, e) {
  console.error(where, e);
  const now = Date.now();
  if (now - errWindow > 60000) { errWindow = now; errSent = 0; }
  if (++errSent > 3) return;
  fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ where, message: String(e?.message || e), stack: String(e?.stack || '').slice(0, 1500), page: location.host }) }).catch(() => {});
}

export class Game {
  constructor({ socket, myPid, sfx, onSys, onExit, onQuit, getProfile }) {
    this.onQuit = onQuit;
    this.getProfile = getProfile || (() => null);
    this.socket = socket;
    this.myPid = myPid;
    this.sfx = sfx;
    this.onSys = onSys;
    this.onExit = onExit;
    this.canvas = $('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.mctx = $('minimap').getContext('2d');
    this.fx = new Particles();
    this.keys = {};
    this.time = 0;
    this.cam = { x: 0, y: 300 };
    this.zoom = 1;
    this.shake = 0;
    this.beams = [];
    this.clones = [];
    this.jaws = [];
    this.ribbons = [];
    this.dark = 0;
    this.rising = [];
    this.erupts = []; // painted ground effects that pop up and sink back (Tượng Tinh's lava quake)
    this.flash = null;
    this.pAcc = 0;
    this.frame = 0;
    this.hudCache = {};

    this.handlers = {
      'game:turn': d => this.onTurn(d),
      'game:pos': d => this.onPos(d),
      'game:aim': d => { const t = this.tank(d.id); if (t) t.angle = d.angle; },
      'game:shot': d => this.onShot(d),
      'game:skip': d => this.onSkip(d),
      'game:tick': d => this.onTick(d),
      'game:fell': d => this.onFell(d),
      'game:end': d => this.onEnd(d),
      'game:item': d => this.onItem(d),
      'game:lives': d => this.onLives(d),
      'game:respawn': d => this.onRespawn(d),
      'game:drop': d => { this.drops[d.id] = d.x; },
    };
    // events that arrive while the battlefield is still loading are replayed afterwards
    for (const [k, fn] of Object.entries(this.handlers)) this.handlers[k] = d => (this.loaded ? fn(d) : this.queue.push(() => fn(d)));
    this.handlers['game:loading'] = d => this.setLoad(d.id, d.pct);
    this.handlers['game:ready'] = d => { this.serverReady = true; this.introMs = d?.introMs || 0; if (this.loaded) this.beginIntro(); };
    this.handlers['game:sudden'] = d => {
      const st = SUDDEN_TYPES[d?.type] || SUDDEN_TYPES.double;
      this.suddenOn = true;
      this.banner(`ĐỘT TỬ: ${st.name.toUpperCase()}!`, true);
      this.onSys(`Đột tử (${st.name}): ${st.desc}. Vật phẩm bị khoá.`);
      this.sfx.ss();
      this.refreshItems?.();
    };
    this.queue = [];
    this.loaded = false;
    for (const [k, fn] of Object.entries(this.handlers)) socket.on(k, fn);

    this.onKeyDown = e => this.keyDown(e);
    this.onKeyUp = e => this.keyUp(e);
    this.onResize = () => this.resize();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    this.bindMouse();
    this.bindButtons();
    this.resize();
    this.loop = ts => {
      // schedule the next frame first: one exception in update/render used to stop the loop for good, which
      // froze the whole match ("đơ", the turn clock stopped)
      this.raf = requestAnimationFrame(this.loop);
      const dt = Math.min(0.05, this.lastTs ? (ts - this.lastTs) / 1000 : 0.016);
      this.lastTs = ts;
      this.time += dt;
      try { this.update(dt); } catch (e) { reportError('update', e); }
      // a throw between save() and restore() would leave the context dirty: reset it for the next frame
      try { this.render(); } catch (e) { reportError('render', e); try { this.ctx.reset?.(); } catch {} }
    };
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.sfx.stopMusic();
    for (const [k, fn] of Object.entries(this.handlers)) this.socket.off(k, fn);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    this.unbindMouse?.();
    $('result').classList.remove('show');
    $('loading').classList.remove('show', 'hide');
    $('quit-modal').classList.remove('show');
  }

  // ---------- setup ----------

  async start(snap) {
    this.loaded = false;
    this.serverReady = snap.phase !== 'loading';
    this.map = snap.map;
    this.tanks = snap.tanks.map(t => ({ ...t, dx: t.x, dy: t.y, hitT: -9, hair: hairFor(t.name) }));
    this.me = this.tanks.find(t => t.pid === this.myPid) || null;
    this.showLoading(snap);
    const report = async pct => {
      this.setLoad(this.me?.id, pct);
      if (this.me && snap.phase === 'loading') this.socket.emit('game:progress', { pct });
      await new Promise(r => setTimeout(r, 30)); // let the loading screen paint
    };
    await report(5);
    await loadAssets();
    this.drawLoadCards();
    await report(35);
    this.seed = snap.seed;
    this.mask = genTerrain(snap.seed, snap.map, snap.mirror);
    this.waterY = snap.waterY || WATER_Y;
    this.practice = !!snap.practice;
    this.settings = snap.settings || {};
    this.lives = snap.lives || null;
    this.suddenOn = !!snap.sudden;
    this.drops = {};
    this.pillars = (snap.pillars || []).map(q => ({ ...q, bornT: -9 }));
    this.minions = snap.minions || [];
    this.moonZones = (snap.moonZones || []).map(z => ({ ...z, bornT: -9 }));
    this.moonNight = snap.moonNight || null;
    this.weather = snap.weather || null;
    this.weatherT0 = this.time;
    this.oldWeather = null;
    this.bolts = [];
    await report(55);
    this.terrain = paintTerrain(this.mask, snap.map, snap.mirror);
    this.tctx = this.terrain.getContext('2d');
    await report(80);
    for (const [x, y, r] of snap.carves) { carve(this.mask, x, y, r); carveTerrain(this.tctx, x, y, r, this.map); }
    this.scenery = makeScenery(snap.seed, snap.map);
    this.zones = snap.zones || [];
    this.wind = snap.wind;
    this.anim = null;
    this.activeId = null;
    this.selShot = 's1';
    this.power = 0;
    this.charging = false;
    this.fired = false;
    this.lastPower = undefined; // one marker for every shot: they all fly the same curve
    this.lastAngle = undefined;
    this.ghost = null;
    this.powerMark = undefined; // a mark the player clicks onto the power bar to aim the next shot by
    this.angle = this.me ? this.me.angle : 45;
    $('result').classList.remove('show');
    this.drawLoadMap();
    await report(100);
    this.setupHud();
    this.renderWeatherBar(false);
    if (snap.turn) this.onTurn({ ...snap.turn, wind: snap.wind, turnNo: snap.turnNo, silent: true });
    else {
      const focus = this.me || this.tanks[0];
      this.cam.x = focus.x - this.viewW() / 2;
      this.cam.y = focus.y - this.viewH() * 0.6;
    }
    this.loaded = true;
    const queued = this.queue.splice(0);
    for (const fn of queued) fn();
    if (this.serverReady) { if (snap.phase === 'ready' || snap.phase === 'loading') this.beginIntro(); else setTimeout(() => this.hideLoading(), 400); }
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
    this.sfx.startMusic(this.map);
  }

  // ---------- loading screen ----------

  showLoading(snap) {
    const el = $('loading');
    el.classList.remove('hide');
    el.classList.add('show');
    for (const team of ['A', 'B']) {
      $('ld-' + team).innerHTML = this.tanks.filter(t => t.team === team).map(t => `
        <div class="ld-card${XE[t.xe].legendary ? ' legend' : ''}" data-id="${t.id}">
          <canvas width="208" height="168"></canvas>
          <div class="ld-info"><div class="ld-name">${esc(t.name)}${t.bot ? ' 🤖' : ''}</div><div class="ld-xe">${t.rolled ? '🎲 ' : ''}${XE[t.xe].name}${XE[t.xe].legendary ? ' <b class="ld-lg">HUYỀN THOẠI</b>' : ''}</div><div class="ld-bar"><i></i></div></div>
          <div class="ld-pct">0%</div>
        </div>`).join('') + Array.from({ length: Math.max(0, 5 - this.tanks.filter(t => t.team === team).length) }, () => '<div class="ld-card empty"><div class="ld-chev">❯❯❯</div></div>').join('');
    }
    const st = snap.settings || {};
    $('ld-rules-extra').textContent = `Mỗi lượt ${st.turnSec || 20} giây · ${st.sudden ? `Đột tử sau lượt ${st.sudden} (${(SUDDEN_TYPES[st.suddenType] || SUDDEN_TYPES.double).name})` : 'Không đột tử'}${st.mode === 'score' && !snap.practice ? ' · Tính mạng (Score)' : ''}${st.xeMode === 'random' ? ' · Xe ngẫu nhiên' : ''}`;
    const nA = this.tanks.filter(t => t.team === 'A').length, nB = this.tanks.filter(t => t.team === 'B').length;
    $('ld-mode').textContent = `${nA} : ${nB}`;
    $('ld-room').textContent = snap.roomName || '';
    $('ld-mapname').textContent = MAPS[snap.map]?.name || '';
    for (const [id, pct] of Object.entries(snap.loaded || {})) this.setLoad(id, pct);
    for (const t of this.tanks) if (t.bot) this.setLoad(t.id, 100);
    this.drawLoadCards();
  }

  drawLoadCards() {
    for (const card of document.querySelectorAll('.ld-card')) {
      const t = this.tank(card.dataset.id);
      if (t) drawPortrait(card.querySelector('canvas'), t.xe, t.team, 40, t.hair, t.gender);
    }
  }

  setLoad(id, pct) {
    const card = id && document.querySelector(`.ld-card[data-id="${id}"]`);
    if (!card) return;
    card.querySelector('.ld-bar i').style.width = pct + '%';
    card.querySelector('.ld-pct').textContent = pct + '%';
    card.classList.toggle('done', pct >= 100);
  }

  hideLoading() {
    const el = $('loading');
    if (!el.classList.contains('show')) return;
    el.classList.add('hide');
    setTimeout(() => el.classList.remove('show', 'hide'), 750);
  }

  // Whole battlefield with every player's spawn, like the strip under Gunbound's loading screen.
  drawLoadMap() {
    for (const [id, big] of [['ld-map', true], ['ld-thumb', false]]) {
      const c = $(id), m = c.getContext('2d');
      const cw = c.width, ch = c.height;
      m.clearRect(0, 0, cw, ch);
      const bg = ASSETS.bg[this.map];
      if (bg) m.drawImage(bg, 0, 0, cw, ch);
      const top = 180, k = Math.min(cw / W, ch / (H - top));
      const ox = (cw - W * k) / 2, oy = ch - (H - top) * k;
      m.drawImage(this.terrain, 0, top + (this.terrain.pad || 0), W, H - top, ox, oy, W * k, (H - top) * k);
      if (!big) continue;
      m.font = "800 16px 'Baloo 2', sans-serif";
      m.textAlign = 'center';
      for (const t of this.tanks) {
        const x = ox + t.x * k, y = oy + (t.y - top) * k;
        m.fillStyle = TEAM_COLORS[t.team];
        m.strokeStyle = '#fff'; m.lineWidth = 2;
        m.fillRect(x - 7, y - 16, 14, 14); m.strokeRect(x - 7, y - 16, 14, 14);
        m.lineWidth = 4; m.strokeStyle = 'rgba(0,0,0,0.75)';
        m.strokeText(t.name, x, y - 22);
        m.fillStyle = t === this.me ? '#ffe14a' : '#fff';
        m.fillText(t.name, x, y - 22);
      }
    }
  }

  tank(id) { return this.tanks.find(t => t.id === id); }
  isMyTurn() { return this.me && this.activeId === this.me.id && this.me.alive && !this.anim && !this.fired; }
  viewW() { return this.vw / this.zoom; }
  viewH() { return (this.vh - HUD_H) / this.zoom; }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    this.canvas.width = this.vw * this.dpr; this.canvas.height = this.vh * this.dpr;
    this.zoom = this.zoom || 1;
    // Gunbound framing (measured from match video): about 44% of the map width on screen, xe about 10% of the playfield height.
    // Fit ~1150 world px across, but always keep at least ~560 world px of height visible.
    this.baseZoom = Math.max(0.7, Math.min(2.2, this.vw / 1150, (this.vh - HUD_H) / 560));
    if (!this.userZoom) this.zoom = this.baseZoom;
  }

  syncTanks(list) {
    for (const s of list) {
      const t = this.tank(s.id);
      if (!t) continue;
      const { x, y, ...rest } = s;
      Object.assign(t, rest);
      t.x = x; t.y = y;
    }
  }

  // ---------- server events ----------

  onTurn({ id, wind, windChanged, weather, weatherChanged, msLeft, moveLeft, delays, ssCd, ssReady, blind, silent, sudden, lives, turnNo, shield, shieldUp, rooted }) {
    if (rooted && !silent && this.me && id === this.me.id) setTimeout(() => this.banner('BỊ TRÓI: LƯỢT NÀY KHÔNG ĐI ĐƯỢC'), 900);
    if (turnNo !== undefined) this.turnNo = turnNo;
    if (sudden !== undefined) this.suddenOn = sudden;
    if (lives) this.lives = lives;
    if (weather) this.setWeather(weather, weatherChanged && !silent);
    this.activeId = id;
    this.wind = wind;
    if (windChanged && !silent) { const el = $('wind-dial'); el.classList.remove('changed'); void el.offsetWidth; el.classList.add('changed'); this.fx && this.onSys && this.onSys(`Gió đổi: ${wind.s}`); }
    this.turnEndsAt = performance.now() + msLeft;
    this.moveLeft = moveLeft;
    this.fired = false;
    this.charging = false;
    this.power = 0;
    this.lastTickSec = null;
    this.lastInput = null;
    this.manualUntil = 0;
    this.pendingItem = null;
    const t = this.tank(id);
    if (t && !silent) t.turnT = this.time;
    if (delays) for (const x of this.tanks) if (delays[x.id] !== undefined) x.delay = delays[x.id];
    if (t && ssCd !== undefined) { t.ssCd = ssCd; t.ssReady = ssReady; }
    if (t && shield !== undefined) { t.shield = shield; if (shieldUp > 0 && !silent) { t.shieldUpT = this.time; this.fx.text(t.dx, t.dy - 110, `+${shieldUp} GIÁP ẢO`, '#6fe0ff', 18); } }
    if (t && blind !== undefined) t.blind = blind;
    const mine = this.me && this.me.id === id;
    $('ink').classList.toggle('on', !!(mine && this.me.blind));
    if (mine) {
      this.angle = this.me.angle;
      if (this.selShot === 'ss' && !this.me.ssReady) this.selShot = 's1';
      if (!silent) { this.banner('LƯỢT CỦA BẠN!'); this.sfx.ding(); }
    }
    this.renderTurnOrder();
    this.refreshShots();
    this.refreshItems();
    this.drawDial();
    if (this.practice && mine) this.showPracticeTip(); else $('practice-tip').classList.remove('show');
  }

  // ---------- weather ----------

  setWeather(w, changed) {
    const prev = this.weather?.active;
    this.weather = w;
    if (!changed) { this.renderWeatherBar(false); return; }
    // the old one fades out where it stood, the new one grows in at its random spot
    this.oldWeather = prev && prev.type !== 'clear' ? { ...prev, t0: this.time } : null;
    this.weatherT0 = this.time;
    this.renderWeatherBar(true);
    const a = w.active;
    if (a.type === 'tornado') { this.banner(`LỐC XOÁY ${a.dir > 0 ? '→' : '←'}`); this.sfx.whoosh(); }
    if (a.type === 'thunder') { this.banner('CỘT SÉT XUẤT HIỆN!'); this.sfx.zap(); }
    if (a.type === 'tornado') this.onSys(`Lốc xoáy (hất ${a.dir > 0 ? 'sang phải' : 'sang trái'}) xuất hiện trong ${w.turnsLeft} lượt. Đạn bay vào sẽ bị cuốn lên rồi hất theo chiều xoáy.`);
    if (a.type === 'thunder') this.onSys(`Cột sét xuất hiện trong ${w.turnsLeft} lượt. Đạn bay qua cột sẽ nhiễm điện: nổ ở đâu, sét đánh xuống đó (+${WEATHERS.thunder.dmg} sát thương).`);
    else if (prev && prev.type !== 'clear') this.onSys(`${WEATHERS[prev.type].name} đã tan.`);
  }

  renderWeatherBar(slide) {
    const bar = $('weather-bar');
    if (!this.weather || !bar) return;
    bar.innerHTML = this.weather.queue.map((t, i) => {
      const url = iconUrl('w-' + t);
      return `<div class="ws ${i === 1 ? 'on' : ''} ${i === 0 ? 'past' : ''}" title="${WEATHERS[t].name}${i === 1 ? ` · còn ${this.weather.turnsLeft} lượt` : ''}">${url ? `<img src="${url}" alt="">` : WEATHERS[t].name[0]}</div>`;
    }).join('');
    if (slide) { bar.classList.remove('slide'); void bar.offsetWidth; bar.classList.add('slide'); }
  }

  // appear: grow in over 1 s; disappear: fade out over 1 s
  weatherAlpha(w, t0, out) {
    const k = Math.min(1, (this.time - t0) / 1);
    return out ? 1 - k : k;
  }

  drawWeather(ctx) {
    const cur = this.weather?.active;
    if (cur && cur.type !== 'clear') this.drawWeatherColumn(ctx, cur, this.weatherAlpha(cur, this.weatherT0, false));
    if (this.oldWeather) {
      const a = this.weatherAlpha(this.oldWeather, this.oldWeather.t0, true);
      if (a <= 0) this.oldWeather = null; else this.drawWeatherColumn(ctx, this.oldWeather, a);
    }
  }

  // lowest open ground in a column (skips tree tops and overhangs); lightning still hits the highest point
  groundBelow(x) {
    for (let y = 200; y < this.waterY; y++) {
      if (this.mask[y * W + x] && !this.mask[(y - 1) * W + x] && !this.mask[Math.max(0, y - 40) * W + x]) return y;
    }
    return this.waterY;
  }

  drawWeatherColumn(ctx, w, alpha) {
    const ground = w.type === 'tornado' ? (w.ground ??= this.groundBelow(w.x)) : Math.min(surface(this.mask, w.x, 0), this.waterY);
    const top = this.cam.y - 80, t = this.time;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (w.type === 'tornado') this.drawTornado(ctx, w, top, ground, t);
    else if (w.type === 'thunder') this.drawThunderBeam(ctx, w, top, ground, t);
    ctx.restore();
  }

  // Gunbound's tornado: a narrow white twisted column from the sky to the ground, like a drill or a rope.
  // White helix bands with blue undersides scroll up it, turning the way it throws.
  drawTornado(ctx, w, top, ground, t) {
    const d = w.dir || 1, half = WEATHERS.tornado.half;
    const cxAt = y => w.x + Math.sin(y * 0.011 + t * 1.4) * 7 + Math.sin(y * 0.029 - t * 2.1) * 3;
    const hwAt = y => half * (0.78 + 0.22 * Math.min(1, Math.max(0, (y - ground + 90) / 90))) + Math.sin(y * 0.05 + t * 3) * 1.5;
    const STEP = 8, ys = [];
    for (let y = top; y < ground; y += STEP) ys.push(y);
    ys.push(ground);
    // soft air halo
    const halo = ctx.createLinearGradient(w.x - half * 2.2, 0, w.x + half * 2.2, 0);
    halo.addColorStop(0, 'rgba(210,230,255,0)'); halo.addColorStop(0.5, 'rgba(210,230,255,0.28)'); halo.addColorStop(1, 'rgba(210,230,255,0)');
    ctx.fillStyle = halo; ctx.fillRect(w.x - half * 2.2, top, half * 4.4, ground - top);
    // body outline
    const body = new Path2D();
    ys.forEach((y, i) => (i ? body.lineTo(cxAt(y) - hwAt(y), y) : body.moveTo(cxAt(y) - hwAt(y), y)));
    for (let i = ys.length - 1; i >= 0; i--) body.lineTo(cxAt(ys[i]) + hwAt(ys[i]), ys[i]);
    body.closePath();
    const fill = ctx.createLinearGradient(w.x - half, 0, w.x + half, 0);
    fill.addColorStop(0, 'rgba(120,160,215,0.82)'); fill.addColorStop(0.3, 'rgba(225,238,255,0.9)');
    fill.addColorStop(0.55, 'rgba(255,255,255,0.95)'); fill.addColorStop(1, 'rgba(110,150,210,0.82)');
    ctx.fillStyle = fill; ctx.fill(body);
    ctx.save();
    ctx.clip(body);
    // helix bands: each is a curve from one edge to the other, rising over time
    const GAP = 22, phase = ((t * 70) % GAP + GAP) % GAP;
    for (let y0 = ground + GAP - phase; y0 > top - GAP; y0 -= GAP) {
      const cx = cxAt(y0), hw = hwAt(y0), tilt = 13 * d;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(80,120,190,0.55)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(cx - hw, y0 + tilt + 3); ctx.quadraticCurveTo(cx, y0 + 7, cx + hw, y0 - tilt + 3); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx - hw, y0 + tilt); ctx.quadraticCurveTo(cx, y0 + 4, cx + hw, y0 - tilt); ctx.stroke();
    }
    // a bright core streak and darker rims for the round look
    const rim = ctx.createLinearGradient(w.x - half, 0, w.x + half, 0);
    rim.addColorStop(0, 'rgba(60,95,160,0.45)'); rim.addColorStop(0.18, 'rgba(60,95,160,0)'); rim.addColorStop(0.82, 'rgba(60,95,160,0)'); rim.addColorStop(1, 'rgba(60,95,160,0.45)');
    ctx.fillStyle = rim; ctx.fillRect(w.x - half * 1.4, top, half * 2.8, ground - top);
    ctx.restore();
    ctx.strokeStyle = 'rgba(70,105,165,0.7)'; ctx.lineWidth = 1.5; ctx.stroke(body);
    // swirling dust skirt where it touches the ground
    for (let i = 0; i < 3; i++) {
      const rx = half * (1.25 + i * 0.35), ry = 7 + i * 3, a0 = t * 4 * d + i * 2;
      ctx.strokeStyle = `rgba(245,250,255,${0.75 - i * 0.2})`; ctx.lineWidth = 3.5 - i;
      ctx.beginPath(); ctx.ellipse(w.x, ground - 6 - i * 5, rx, ry, 0, a0, a0 + Math.PI * 1.3); ctx.stroke();
    }
    if (Math.random() < 0.5 * ctx.globalAlpha) {
      const a0 = Math.random() * 6;
      this.fx.add({ x: w.x + Math.cos(a0) * half * 1.3, y: ground - 4 - Math.random() * 30, vx: d * (1.2 + Math.random() * 1.8), vy: -1.4 - Math.random(), g: 0.02, drag: 0.97, life: 40, max: 40, r: 2 + Math.random() * 2.5, color: Math.random() < 0.5 ? '#9ad070' : '#d8c09a', chunk: true, rot: 0, spin: 0.35 * d });
    }
    // which way it throws: a small arrow tag above the dust
    const ay = ground - 58, ax = w.x + d * (half + 22);
    ctx.fillStyle = '#ffe14a'; ctx.strokeStyle = '#0b1633'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(ax + d * 14, ay); ctx.lineTo(ax - d * 2, ay - 11); ctx.lineTo(ax - d * 2, ay - 5); ctx.lineTo(ax - d * 12, ay - 5);
    ctx.lineTo(ax - d * 12, ay + 5); ctx.lineTo(ax - d * 2, ay + 5); ctx.lineTo(ax - d * 2, ay + 11); ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // Gunbound's lightning weather: a narrow beam of electric light down the map with arcs crackling inside.
  // Shells that cross it get electrified (see physics); the bolt itself lands where they hit.
  drawThunderBeam(ctx, w, top, ground, t) {
    const half = WEATHERS.thunder.half;
    ctx.save();
    // a solid electric-violet body first so the beam reads on a bright sky, then the glow on top
    const bodyG = ctx.createLinearGradient(w.x - half, 0, w.x + half, 0);
    bodyG.addColorStop(0, 'rgba(70,60,200,0)'); bodyG.addColorStop(0.25, 'rgba(80,70,210,0.32)');
    bodyG.addColorStop(0.5, 'rgba(120,110,240,0.42)'); bodyG.addColorStop(0.75, 'rgba(80,70,210,0.32)'); bodyG.addColorStop(1, 'rgba(70,60,200,0)');
    ctx.fillStyle = bodyG; ctx.fillRect(w.x - half, top, half * 2, ground - top);
    ctx.strokeStyle = 'rgba(200,210,255,0.6)'; ctx.lineWidth = 1.5;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(w.x + sx * half * 0.62, top); ctx.lineTo(w.x + sx * half * 0.62, ground); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter';
    const beam = ctx.createLinearGradient(w.x - half * 1.8, 0, w.x + half * 1.8, 0);
    beam.addColorStop(0, 'rgba(120,150,255,0)'); beam.addColorStop(0.3, 'rgba(120,150,255,0.18)');
    beam.addColorStop(0.47, 'rgba(210,225,255,0.45)'); beam.addColorStop(0.5, 'rgba(255,255,235,0.7)');
    beam.addColorStop(0.53, 'rgba(210,225,255,0.45)'); beam.addColorStop(0.7, 'rgba(120,150,255,0.18)'); beam.addColorStop(1, 'rgba(120,150,255,0)');
    const pulse = 0.8 + 0.2 * Math.sin(t * 9) + (Math.random() < 0.04 ? 0.5 : 0);
    ctx.globalAlpha *= Math.min(1, pulse);
    ctx.fillStyle = beam; ctx.fillRect(w.x - half * 1.8, top, half * 3.6, ground - top);
    // arcs are regenerated a dozen times a second so the beam crackles
    const seed = Math.floor(t * 12);
    if (w.arcSeed !== seed) {
      w.arcSeed = seed;
      w.arcs = [0, 1, 2].map(() => {
        const pts = [], y1 = top + Math.random() * (ground - top) * 0.6, y2 = Math.min(ground, y1 + 180 + Math.random() * 320);
        for (let y = y1; y < y2; y += 16 + Math.random() * 18) pts.push([w.x + (Math.random() - 0.5) * half * 1.5, y]);
        return pts;
      });
    }
    for (const pts of w.arcs) {
      for (const [lw, c] of [[7, 'rgba(110,150,255,0.35)'], [2.2, 'rgba(240,248,255,0.95)']]) {
        ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineJoin = 'round';
        ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      }
    }
    // glow pooled on the ground
    const pool = ctx.createRadialGradient(w.x, ground, 2, w.x, ground, half * 2.2);
    pool.addColorStop(0, 'rgba(230,240,255,0.7)'); pool.addColorStop(1, 'rgba(120,150,255,0)');
    ctx.fillStyle = pool; ctx.beginPath(); ctx.ellipse(w.x, ground, half * 2.2, half * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (Math.random() < 0.25 * ctx.globalAlpha) this.fx.add({ x: w.x + (Math.random() - 0.5) * half * 2, y: ground - 4, vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 2, g: 0.12, drag: 0.96, life: 18, max: 18, r: 1.8, color: '#dfe8ff' });
  }

  // electrified shell: little arcs jumping around it
  drawZapAura(ctx, p) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 34);
    g.addColorStop(0, 'rgba(200,220,255,0.6)'); g.addColorStop(1, 'rgba(120,150,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 34, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 3; k++) {
      let a = Math.random() * Math.PI * 2, r = 10;
      ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      for (let i = 0; i < 3; i++) { a += (Math.random() - 0.3) * 1.1; r += 6 + Math.random() * 5; ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); }
      ctx.strokeStyle = 'rgba(235,245,255,0.95)'; ctx.lineWidth = 1.8; ctx.stroke();
    }
    ctx.restore();
  }

  // a thick forked bolt: blue glow, pale body, white core
  drawBolts(ctx) {
    for (const b of this.bolts) {
      const k = b.life / b.max, flick = b.life % 4 < 2 ? 1 : 0.7;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const line of [b.pts, ...b.forks]) {
        const main = line === b.pts;
        for (const [lw, c] of [[main ? 22 : 10, `rgba(90,130,255,${0.35 * k})`], [main ? 10 : 5, `rgba(180,210,255,${0.85 * k * flick})`], [main ? 4 : 2, `rgba(255,255,255,${k})`]]) {
          ctx.strokeStyle = c; ctx.lineWidth = lw;
          ctx.beginPath(); line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        }
      }
      // splash of light where it lands
      const [ex, ey] = b.pts[b.pts.length - 1];
      const r = 70 * (0.6 + 0.4 * k);
      const g = ctx.createRadialGradient(ex, ey, 4, ex, ey, r);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * k})`); g.addColorStop(1, 'rgba(120,150,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // Practice room coaching: short tips that rotate each turn.
  showPracticeTip() {
    const tips = [
      'Giữ SPACE để lấy lực, thả ra để bắn. Vạch vàng trên thanh lực là lực lần trước.',
      'Gió có hướng 360°: gió thổi lên làm đạn bay xa hơn, thổi xuống làm đạn rơi sớm.',
      'Đường chấm mờ là quỹ đạo phát bắn trước. Chỉnh góc hoặc lực một chút rồi bắn lại.',
      'Góc từ 70° trở lên được +10% sát thương và thưởng vàng "Góc cao".',
      'Phím 4–7 dùng vật phẩm (trước khi bắn): Bắn Đôi, Dịch Chuyển, Hồi Máu, Đạn Mạnh.',
      'SS dùng được ngay; bắn xong sẽ khoá 4 lượt của bạn (🔒). Nhấn 3 để chọn.',
      'Di chuyển tốn "Lực đi" và làm lượt sau của bạn tới chậm hơn một chút.',
    ];
    const el = $('practice-tip');
    el.textContent = '🎯 ' + tips[(this.tipIdx = ((this.tipIdx ?? -1) + 1) % tips.length)];
    el.classList.add('show');
  }

  onPos({ id, x, y, facing, moveLeft }) {
    const t = this.tank(id);
    if (!t) return;
    t.x = x; t.y = y; t.facing = facing;
    if (id === this.activeId) this.moveLeft = moveLeft;
    if (t === this.me) this.drawDial();
  }

  onShot(d) {
    this.pendingState = { pillars: d.pillars, minions: d.minions, moonZones: d.moonZones, moonNight: d.moonNight };
    const t = this.tank(d.id);
    if (t) { t.angle = d.angle; t.facing = d.facing; }
    const ss = d.shot === 'ss';
    // SS waits for the cut-in before the projectile leaves
    // replay position comes from wall-clock time so a slow or throttled browser stays in step with the server
    this.anim = { d, f: ss ? -SS_DELAY_FRAMES : 0, t0: performance.now(), f0: ss ? -SS_DELAY_FRAMES : 0, ei: 0, xe: t?.xe, shot: d.shot };
    if (this.me && t === this.me) this.lastAngle = d.angle;
    this.fired = true;
    this.charging = false;
    this.manualUntil = 0;
    this.sendInput(false, false);
    const shot = XE[t.xe].shots[d.shot];
    if (ss) { this.cutIn(t, shot.name); this.sfx.ss(); this.shake = 8; }
    const fireFx = () => {
      this.sfx.fire();
      t.fireT = this.time;
      this.signatureFire(t, d.shot);
      const a = (d.angle * Math.PI) / 180;
      const mx = t.x + Math.cos(a) * t.facing * 34, my = t.y - PIVOT - Math.sin(a) * 34;
      this.fx.add({ x: mx, y: my, flash: true, life: 12, max: 12, r: 46, color: '#ffd23a' });
      this.fx.add({ x: mx, y: my, ring: true, life: 14, max: 14, r: 8, grow: 3, color: '#fff6c4' });
      this.fx.boom(shot.look, mx, my, 8, false);
      // muzzle smoke drifting off the barrel
      for (let k = 0; k < 4; k++) this.fx.add({ x: mx, y: my, vx: Math.cos(a) * t.facing * (0.6 + Math.random()) + (Math.random() - 0.5), vy: -Math.sin(a) * (0.6 + Math.random()) - 0.4, g: -0.01, drag: 0.96, life: 40 + k * 6, max: 46 + k * 6, r: 6 + k * 2, color: 'rgba(235,235,240,0.5)' });
    };
    if (ss) setTimeout(fireFx, (SS_DELAY_FRAMES / (60 * REPLAY_SPEED)) * 1000); else fireFx();
    this.fx.text(t.dx, t.dy - 104, shot.name, ss ? '#ff9ae6' : '#ffe16a', 22);
  }

  // Gunbound-style SS cut-in: the xe and pilot sweep across a coloured band with speed lines.
  cutIn(t, name) {
    const el = $('ss-cutin');
    const [c1, c2] = XE[t.xe].colors;
    el.style.setProperty('--c1', c1);
    el.style.setProperty('--c2', c2);
    el.querySelector('.ci-name').textContent = name;
    el.querySelector('.ci-player').textContent = t.name;
    const cv = el.querySelector('canvas');
    const sprite = xeSprite(t.xe, t.gender);
    const cx = cv.getContext('2d');
    cx.clearRect(0, 0, cv.width, cv.height);
    if (sprite) {
      const k = Math.min(cv.width / sprite.width, cv.height / sprite.height) * 0.95;
      drawSmooth(cx, sprite, (cv.width - sprite.width * k) / 2, cv.height - sprite.height * k, sprite.width * k, sprite.height * k);
    }
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    this.flash = { color: c1, life: 20, max: 20 };
  }

  onItem({ id, item, gold, heal, hp }) {
    const t = this.tank(id);
    if (!t) return;
    t.gold = gold;
    if (hp !== undefined) t.hp = hp;
    if (t === this.me) { this.pendingItem = item; this.refreshItems(); }
    const it = ITEMS[item];
    this.fx.text(t.dx, t.dy - 110, `${it.icon} ${it.name}`, '#d8c8ff', 22);
    if (heal) { this.fx.text(t.dx, t.dy - 88, '+' + heal, '#7dff9a', 26); this.fx.sparkle(t.dx, t.dy - 32, '#b6ffcf'); this.sfx.heal(); }
    else this.fx.sparkle(t.dx, t.dy - 32, '#d8c8ff');
  }

  useItem(item) {
    if (!this.isMyTurn() || this.pendingItem || !this.me || (this.me.gold || 0) < ITEMS[item].cost) return;
    this.socket.emit('game:item', { item });
  }

  refreshItems() {
    const me = this.me;
    for (const b of $('items').querySelectorAll('[data-item]')) {
      const it = ITEMS[b.dataset.item];
      b.classList.toggle('on', this.pendingItem === b.dataset.item);
      // Đột tử locks items, like Gunbound
      b.disabled = !me || !this.isMyTurn() || !!this.pendingItem || (me.gold || 0) < it.cost || this.suddenOn;
    }
  }

  onSkip({ id, timeout, frozen }) {
    const t = this.tank(id);
    if (t) this.fx.text(t.dx, t.dy - 104, frozen ? 'ĐÓNG BĂNG · MẤT LƯỢT' : timeout ? 'HẾT GIỜ!' : 'BỎ LƯỢT', frozen ? '#bff4ff' : '#cfd8ff', 24);
    if (t && frozen) t.frozen = false;
    this.fired = true;
    this.sendInput(false, false);
  }

  onTick({ events, zones, tanks, waterY, lavaRose, drain, pillars, minions, moonZones, moonNight }) {
    for (const e of events) this.applyEvent(e);
    if (moonZones) this.moonZones = moonZones.map(z => ({ ...z, bornT: (this.moonZones || []).find(o => o.x === z.x && o.y === z.y)?.bornT ?? -9 }));
    if (moonNight !== undefined) this.moonNight = moonNight;
    if (pillars) this.syncPillars(pillars);
    if (minions) this.syncMinions(minions);
    if (drain) { this.banner(`MÁU CẠN DẦN: -${drain}`); this.onSys(`Đột tử: mọi xe mất ${drain} máu (vòng sau mất ${drain + DRAIN_STEP}).`); this.shake = 6; }
    this.zones = zones;
    if (waterY) this.waterY = waterY;
    if (lavaRose) { this.banner('DUNG NHAM DÂNG CAO!'); this.shake = 8; this.onSys('Dung nham đang dâng lên, tránh xa chỗ thấp!'); }
    this.syncTanks(tanks);
    this.renderTurnOrder();
  }

  // Score mode
  onLives({ lives, id, respawnAt, turnNo }) {
    this.lives = lives;
    const t = this.tank(id);
    if (!t) return;
    t.respawnAt = respawnAt;
    const team = t.team === 'A' ? 'Đội Đỏ' : 'Đội Xanh';
    this.onSys(respawnAt ? `${team} mất 1 mạng (còn ${lives[t.team]}). ${t.name} sẽ hồi sinh sau ${respawnAt - turnNo} lượt.` : `${team} đã hết mạng!`);
    if (this.me && t.id === this.me.id && respawnAt) {
      this.banner('BẤM VÀO BẢN ĐỒ ĐỂ CHỌN ĐIỂM HỒI SINH');
      this.onSys('Bấm vào bản đồ để chọn chỗ rơi xuống khi hồi sinh (gió sẽ thổi lệch một chút). Không chọn thì hệ thống chọn ngẫu nhiên.');
    }
  }

  onRespawn({ id, x, y, hp, delay, lives }) {
    const t = this.tank(id);
    if (!t) return;
    Object.assign(t, { x, y, dx: x, dy: y, hp, delay, alive: true, respawnAt: null, poison: null, blind: false, mark: false, deathT: undefined, spawnT: this.time, ssCd: 0 });
    delete this.drops[id];
    if (lives) this.lives = lives;
    this.fx.sparkle(x, y - 30, '#fff4a0');
    this.onSys(`✨ ${t.name} đã hồi sinh!`);
    this.renderTurnOrder();
  }

  onFell({ id }) {
    const t = this.tank(id);
    if (!t) return;
    t.alive = false; t.hp = 0;
    this.fx.splash(t.x, this.waterY, THEMES[this.map].lava);
    this.sfx.splash();
    this.onSys(`${t.name} đã rơi xuống vực!`);
  }

  onEnd(res) {
    this.activeId = null;
    this.winner = res.winner;
    setTimeout(() => this.showResult(res), 1800);
  }

  // ---------- replay ----------

  applyEvent(e) {
    const t = e.id ? this.tank(e.id) : null;
    switch (e.type) {
      case 'carve':
        carve(this.mask, e.x, e.y, e.r);
        carveTerrain(this.tctx, e.x, e.y, e.r, this.map);
        break;
      case 'boom': {
        // Tượng Tinh's quake pulses get painted lava effects instead of a generic explosion
        const lavaSS = this.anim?.xe === 'voi' && this.anim.shot === 'ss';
        if (lavaSS && !e.big && ASSETS.fx.lava) { this.quakePulse(e); break; }
        this.fx.boom(lavaSS ? 'lavarock' : e.look, e.x, e.y, e.r, e.big);
        this.fx.bubble(e.x, e.y, e.r);
        if (!lavaSS) this.fx.debris(e.x, e.y, e.r, this.groundColors(e.x, e.y, e.r));
        this.shake = Math.max(this.shake, e.r / (e.big ? 3 : 6));
        this.sfx.boom(e.r);
        this.focus = { x: e.x, y: e.y };
        const a = this.anim;
        if (a && a.shot === 'ss' && e.big && !a.ssDone?.has(`${Math.round(e.x)}`)) {
          (a.ssDone ||= new Set()).add(`${Math.round(e.x)}`);
          this.ssImpact(a.xe, e.x, e.y, e.r);
        } else if (e.look === 'jaw' && !ASSETS.proj.camap) this.jaws.push({ x: e.x, y: e.y, r: e.r, life: 45, max: 45 });
        break;
      }
      case 'dmg':
        if (!t) break;
        t.hp = e.hp; t.hitT = this.time; t.hitAmt = e.amt;
        // hit-stop: freeze the replay for a beat on heavy hits
        if (this.anim && e.amt >= 220) { this.anim.t0 += 90; this.shake = Math.max(this.shake, 9); }
        this.fx.text(t.dx, t.dy - 88, '-' + e.amt, e.kind === 'poison' ? '#3fd060' : e.kind === 'burn' ? '#ff8a1a' : '#ff2020', e.amt >= 300 ? 30 : 24, 'digit');
        break;
      case 'heal':
        if (!t) break;
        t.hp = e.hp;
        if (e.amt > 0) this.fx.text(t.dx, t.dy - 88, '+' + e.amt, '#7dff9a', 26);
        this.fx.sparkle(t.dx, t.dy - 32, '#b6ffcf');
        this.sfx.heal();
        break;
      case 'die':
        if (!t) break;
        t.alive = false; t.hp = 0; t.deathT = this.time;
        this.punch = { t0: this.time, x: t.dx, y: t.dy - 40 };
        if (!e.drown) this.fx.boom('fire', t.dx, t.dy - 16, 40, true);
        else { this.fx.splash(t.dx, this.waterY, THEMES[this.map].lava); this.sfx.splash(); }
        this.fx.text(t.dx, t.dy - 116, 'HẠ GỤC!', '#ffcf3a', 36);
        this.sfx.die();
        {
          const by = e.by && this.tank(e.by);
          this.onSys(by && by !== t ? `${by.name} đã hạ gục ${t.name}!` : `${t.name} đã bị hạ!`);
        }
        break;
      case 'revive':
        if (!t) break;
        t.hp = e.hp; t.alive = true; t.canRevive = false;
        this.fx.sparkle(t.dx, t.dy - 32, '#ffb030');
        this.fx.boom('phoenix', t.dx, t.dy - 20, 30, false);
        this.fx.text(t.dx, t.dy - 116, 'TÁI SINH!', '#ffb030', 34);
        break;
      case 'move':
        if (t) { t.x = e.x; t.y = e.y; }
        break;
      case 'yank':
        if (t) { t.x = e.x; this.fx.text(t.dx, t.dy - 98, e.pull ? 'BỊ KÉO!' : 'BỊ ĐẨY!', '#9fe0ff', 22); }
        break;
      // Giáp ảo
      case 'shield':
        if (!t) break;
        t.shield = e.shield; t.shieldHitT = this.time;
        this.fx.text(t.dx + 18, t.dy - 70, '-' + e.amt, '#6fe0ff', 20, 'digit');
        this.fx.add({ x: t.dx, y: t.dy - 32, ring: true, life: 16, max: 16, r: 30, grow: 2, color: '#9fefff' });
        if (e.broke) {
          this.fx.text(t.dx, t.dy - 112, 'VỠ GIÁP ẢO!', '#6fe0ff', 22);
          for (let k = 0; k < 14; k++) { const a = Math.random() * Math.PI * 2; this.fx.add({ x: t.dx + Math.cos(a) * 34, y: t.dy - 32 + Math.sin(a) * 34, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3 - 1, g: 0.12, drag: 0.97, life: 34, max: 34, r: 3 + Math.random() * 3, color: '#bff4ff', chunk: true, rot: 0, spin: 0.3 }); }
        }
        break;
      case 'shieldUp':
        if (!t) break;
        t.shield = e.shield; t.shieldUpT = this.time;
        this.fx.text(t.dx, t.dy - 104, 'RỤT MAI! +GIÁP ẢO', '#6fe0ff', 20);
        break;
      case 'status':
        if (!t) break;
        if (e.armor) { t.armorBuff = 0.2; this.fx.text(t.dx, t.dy - 104, 'ĐƯỢC CHE MAI +20% GIÁP', '#ffe16a', 18); }
        if (e.root) { t.rooted = true; this.fx.text(t.dx, t.dy - 124, 'BỊ TRÓI', '#b765d8', 20); }
        if (e.unmark) t.mark = false;
        if (e.thorns) this.fx.text(t.dx, t.dy - 124, 'DÍNH GAI ĐỘC', '#7dff9a', 18);
        if (e.spread) this.fx.text(t.dx, t.dy - 124, 'ĐỘC LÂY LAN', '#7dff9a', 18);
        if (e.chill) { this.fx.text(t.dx, t.dy - 124, `LẠNH CÓNG · CHẬM LƯỢT +${e.chill}`, '#bff4ff', 18); }
        if (e.freeze) { t.frozen = true; this.fx.text(t.dx, t.dy - 124, 'ĐÓNG BĂNG!', '#bff4ff', 20); }
        if (e.heavy) { t.heavy = 1.35; this.fx.text(t.dx, t.dy - 124, 'NẶNG TRĨU · PHÁT SAU HỤT TẦM', '#ffe14a', 18); }
        if (e.poison) { t.poison = true; this.fx.text(t.dx, t.dy - 104, 'TRÚNG ĐỘC', '#7dff9a', 20); }
        if (e.blind) { t.blind = true; this.fx.text(t.dx, t.dy - 104, 'BỊ CHE MẮT', '#b765d8', 20); }
        if (e.mark) { t.mark = true; this.fx.text(t.dx, t.dy - 104, 'BỊ ĐÁNH DẤU', '#ffe14a', 20); }
        break;
      case 'splash':
        this.fx.splash(e.x, e.y, THEMES[this.map].lava);
        this.sfx.splash();
        break;
      case 'target':
        this.beams.push({ x: e.x, y: e.y, life: 50, max: 50 });
        this.focus = { x: e.x, y: e.y };
        break;
      case 'rumble':
        this.shake = 10;
        this.fx.debris(e.x, e.y, 30, this.groundColors(e.x, e.y, 20));
        this.fx.text(e.x, e.y - 30, '!!!', '#ff5a5a', 40);
        this.focus = { x: e.x, y: e.y };
        break;
      case 'clone':
        this.clones.push({ x: e.x, y: e.y, life: 80 });
        this.fx.sparkle(e.x, e.y - 20, '#ffd700');
        break;
      case 'beam':
        // Kỳ Lân's horn beam
        this.beams.push({ x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, w: e.w, life: 30, max: 30, light: true });
        this.sfx.zap?.();
        break;
      case 'transform':
        this.fx.add({ x: e.x, y: e.y, ring: true, life: 22, max: 22, r: 20, grow: 4, color: '#ffd23a' });
        this.fx.text(e.x, e.y - 40, 'HOÁ RỒNG!', '#ffd23a', 24);
        this.flash = { color: '#ffe0a0', life: 8, max: 8 };
        break;
      case 'grown':
        break;
      case 'reborn':
        this.fx.add({ x: e.x, y: e.y - 10, ring: true, life: 18, max: 18, r: 10, grow: 3, color: '#fff3a0' });
        this.fx.sparkle(e.x, e.y - 14, '#fff3a0');
        this.fx.text(e.x, e.y - 50, 'TÁI SINH!', '#ffd23a', 18);
        break;
      case 'pillar':
        this.pillars = [...(this.pillars || []), { x: e.x, y: e.y, h: e.h, w: e.w, bornT: this.time }];
        this.shake = Math.max(this.shake, 6);
        this.fx.text(e.x, e.y - e.h - 16, 'GẬY NHƯ Ý!', '#ffd700', 20);
        break;
      case 'minions':
        // each baby lands on its own spot: a little bounce, a puff of dust, then it waits in ambush
        for (const [x, y] of e.list) {
          this.minions = [...(this.minions || []), { id: 'new' + x, x, y, landT: this.time, seed: x % 7 }];
          this.fx.debris(x, y, 8, this.groundColors(x, y, 8));
          this.fx.add({ x, y: y - 2, ring: true, life: 16, max: 16, r: 6, grow: 2.2, color: '#b6ffcf' });
        }
        if (!this.anim?.minionText) { if (this.anim) this.anim.minionText = true; this.fx.text(e.x, e.y - 60, 'BỌ CON MAI PHỤC!', '#7dff9a', 20); }
        break;
      case 'minion': {
        // a baby scorpion scuttles from its nest to its victim
        this.scuttles = [...(this.scuttles || []), { path: e.path, t0: this.time }];
        this.minions = (this.minions || []).filter(m => m.id !== e.mid);
        break;
      }
      case 'aura':
        this.fx.add({ x: e.x, y: e.y, ring: true, life: 30, max: 30, r: 20, grow: e.r / 16, color: '#b765d8' });
        break;
      case 'lock':
        if (t) this.fx.text(t.dx, t.dy - 110, '🎯 KHOÁ MỒI', '#ffe14a', 20);
        break;
      case 'dive':
        this.fx.debris(e.x, e.y, 18, this.groundColors(e.x, e.y, 18));
        this.fx.text(e.x, e.y - 30, 'LẶN!', '#9fe0ff', 18);
        break;
      case 'bounce':
        this.fx.add({ x: e.x, y: e.y, ring: true, life: 14, max: 14, r: 6, grow: 2.4, color: '#bff4ff' });
        this.fx.text(e.x, e.y - 40, `NẢY ×${e.n}`, '#bff4ff', 18);
        this.sfx.tick?.();
        break;
      case 'combo':
        this.fx.text(e.x, e.y - 70, `BI-A! +${e.n} LẦN NẢY`, '#6fe0ff', 22);
        break;
      case 'dodge':
        if (t) { this.fx.text(t.dx, t.dy - 100, 'NÉ! MAY MẮN 🍀', '#ffe14a', 22); this.fx.sparkle(t.dx, t.dy - 40, '#fff3a0'); }
        break;
      case 'swim':
        if (t) { this.fx.splash(t.x, this.waterY, false); Object.assign(t, { x: e.x, y: e.y, dx: e.x, dy: e.y }); this.fx.text(e.x, e.y - 100, 'BƠI LÊN BỜ! 🐧', '#9fe0ff', 22); }
        break;
      case 'blizzard':
        for (let i = 0; i < 40; i++) this.fx.add({ x: e.x + (Math.random() - 0.5) * e.r * 2, y: e.y - 200 - Math.random() * 200, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 2, g: 0.02, drag: 0.99, life: 70, max: 70, r: 2.5, color: '#ffffff' });
        this.fx.text(e.x, e.y - 120, 'KỶ BĂNG HÀ!', '#bff4ff', 26);
        this.flash = { color: '#e0f6ff', life: 10, max: 10 };
        break;
      case 'moonzone':
        this.moonZones = [...(this.moonZones || []), { ...e, bornT: this.time }];
        this.fx.text(e.x, e.y - e.r, 'VẦNG TRĂNG KHUYẾT', '#ffe14a', 20);
        break;
      case 'moonnight':
        this.moonNight = { team: e.team };
        this.banner('ĐÊM TRĂNG RẰM!', true);
        this.onSys(`Đêm trăng rằm 1 vòng: đạn của đội ${e.team === 'A' ? 'Xanh' : 'Đỏ'} nặng ×1.3, đạn của đội ${e.team === 'A' ? 'Đỏ' : 'Xanh'} nhẹ ×0.85.`);
        break;
      case 'moonnightEnd':
        this.moonNight = null;
        this.onSys('Đêm trăng rằm đã qua.');
        break;
      case 'boomerang':
        this.fx.text(e.x, e.y - 60, 'BOOMERANG! +20%', '#ffe74a', 22);
        break;
      case 'teleport':
        if (t) {
          this.fx.sparkle(t.dx, t.dy - 30, '#d8c8ff');
          t.x = e.x; t.y = e.y; t.dx = e.x; t.dy = e.y;
          this.fx.sparkle(e.x, e.y - 30, '#d8c8ff');
          this.fx.add({ x: e.x, y: e.y - 30, ring: true, life: 24, max: 24, r: 10, grow: 3, color: '#d8c8ff' });
        }
        break;
      case 'tornado':
        this.fx.sparkle(e.x, e.y, '#d8e6ff');
        this.sfx.whoosh();
        this.fx.text(e.x, e.y - 30, 'LỐC XOÁY!', '#d8e6ff', 22);
        break;
      case 'zap':
        this.fx.sparkle(e.x, e.y, '#dfe8ff');
        this.fx.text(e.x, e.y - 30, 'NHIỄM ĐIỆN!', '#dfe8ff', 20);
        this.sfx.zap();
        break;
      case 'thunder': {
        // bolt from above the top of the screen down to where the electrified shell landed
        const y0 = Math.min(this.cam.y - 60, e.y - 500);
        const pts = [[e.x + (Math.random() - 0.5) * 60, y0]];
        for (let y = y0 + 34; y < e.y; y += 30 + Math.random() * 20) pts.push([e.x + (Math.random() - 0.5) * 46 * Math.min(1, (e.y - y) / 120 + 0.3), y]);
        pts.push([e.x, e.y]);
        const forks = [];
        for (let i = 0; i < 3; i++) {
          const from = pts[2 + Math.floor(Math.random() * Math.max(1, pts.length - 4))];
          if (!from) continue;
          const f = [from], dir = Math.random() < 0.5 ? -1 : 1;
          let [x, y] = from;
          for (let j = 0; j < 3; j++) { x += dir * (14 + Math.random() * 18); y += 18 + Math.random() * 20; f.push([x, y]); }
          forks.push(f);
        }
        this.bolts.push({ pts, forks, life: 24, max: 24 });
        this.fx.add({ x: e.x, y: e.y, ring: true, life: 20, max: 20, r: 12, grow: 5, color: '#dfe8ff' });
        this.flash = { color: '#e8e0ff', life: 10, max: 10 };
        this.shake = Math.max(this.shake, 10);
        this.sfx.thunder();
        break;
      }
      case 'split':
        this.fx.sparkle(e.x, e.y, '#ffffff');
        break;
    }
  }

  // Gunbound shot bonuses: gold lines in chat and a floating "+G" over the shooter.
  showBonus(d) {
    const t = this.tank(d.id);
    let total = 0;
    for (const b of d.bonus || []) {
      total += b.gold;
      this.onSys(`[${b.text}] ${b.gold > 0 ? '+' : ''}${b.gold} G`, 'bonus', t?.name);
    }
    if (t && total) this.fx.text(t.dx, t.dy - 120, `${total > 0 ? '+' : ''}${total} G`, total > 0 ? '#ffe14a' : '#ff8a8a', 26);
  }

  // A few colours of the ground around a crater, for the flying chunks.
  groundColors(x, y, r) {
    const cols = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, px = Math.round(x + Math.cos(a) * (r + 7)), py = Math.round(y + Math.sin(a) * (r + 7));
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const d = this.tctx.getImageData(px, py + (this.terrain.pad || 0), 1, 1).data;
      if (d[3] > 200) cols.push(`rgb(${d[0]},${d[1]},${d[2]})`);
    }
    const th = THEMES[this.map];
    return cols.length ? cols : [`rgb(${th.dirt.join(',')})`];
  }

  stepAnim(dt) {
    const a = this.anim;
    if (!a) return;
    a.f = a.f0 + ((performance.now() - a.t0) / 1000) * 60 * REPLAY_SPEED;
    if (a.f < 0) { this.projs = []; this.ribbons = []; return; }
    const evs = a.d.events;
    // incoming whistle ~0.6 s before each of the first few blasts
    const lead = 0.6 * 60 * REPLAY_SPEED;
    if (!a.whistled) a.whistled = new Set();
    for (const e of evs) {
      if (e.type !== 'boom' || a.whistled.size >= 3) continue;
      if (!a.whistled.has(e) && e.f - lead <= a.f && e.f > a.f) { a.whistled.add(e); this.sfx.whistle(); }
    }
    while (a.ei < evs.length && evs[a.ei].f <= a.f) this.applyEvent(evs[a.ei++]);
    this.projs = [];
    this.ribbons = [];
    for (const p of a.d.paths) {
      const n = p.pts.length / 2;
      const fi = a.f - p.start;
      // the smoke ribbon lingers a moment after the shell lands
      if (fi >= 0 && n > 1 && p.look !== 'quake' && fi < n + RIBBON_LINGER) this.ribbons.push({ pts: p.pts, head: Math.min(fi, n - 1), fade: Math.max(0, fi - (n - 1)) / RIBBON_LINGER });
      if (fi < 0 || fi >= n) continue;
      const i = Math.floor(fi), k = fi - i;
      const j = Math.min(n - 1, i + 1);
      const x = p.pts[i * 2] + (p.pts[j * 2] - p.pts[i * 2]) * k;
      const y = p.pts[i * 2 + 1] + (p.pts[j * 2 + 1] - p.pts[i * 2 + 1]) * k;
      const pi = Math.max(0, i - 1);
      const vx = p.pts[j * 2] - p.pts[pi * 2], vy = p.pts[j * 2 + 1] - p.pts[pi * 2 + 1];
      // Thiên Long flies as a fireball until it has been airborne long enough, then becomes the dragon
      let sprite = ASSETS.proj[a.xe]?.[a.shot];
      if (a.xe === 'rong' && a.shot === 'ss') sprite = p.morph != null && fi >= p.morph ? ASSETS.proj.rong.ss : ASSETS.proj.rong.s1;
      if (p.kind === 'drop') sprite = null;
      if (p.kind === 'hop') sprite = ASSETS.proj.phuong?.s2;
      this.projs.push({ look: p.look, x, y, vx, vy, start: p.start, age: fi, kind: p.kind, zapped: p.zap != null && fi >= p.zap, sprite, ss: a.shot === 'ss', xe: a.xe, shot: a.shot });
      if (this.frame % 3 === 0) this.fx.trail(p.look, x, y);
    }
    if (this.projs.length) {
      const lead = this.projs.reduce((a, b) => (b.start > a.start ? b : a));
      this.focus = { x: lead.x, y: lead.y };
    }
    if (a.f > a.d.frames + 40) {
      while (a.ei < evs.length) this.applyEvent(evs[a.ei++]);
      this.syncTanks(a.d.tanks);
      if (this.pendingState) { this.syncPillars(this.pendingState.pillars || []); this.syncMinions(this.pendingState.minions || []); this.moonZones = (this.pendingState.moonZones || []).map(z => ({ ...z, bornT: (this.moonZones || []).find(o => o.x === z.x && o.y === z.y)?.bornT ?? -9 })); this.moonNight = this.pendingState.moonNight || null; this.pendingState = null; }
      this.showBonus(a.d);
      if (this.practice && this.me && a.d.id === this.me.id && a.d.paths[0]) this.ghost = a.d.paths[0].pts;
      if (this.me && a.d.id === this.me.id) { this.pendingItem = null; this.refreshItems(); }
      this.anim = null;
      this.projs = [];
      this.renderTurnOrder();
    }
  }

  // ---------- input ----------

  typing() { return document.activeElement && document.activeElement.tagName === 'INPUT'; }

  keyDown(e) {
    if (this.typing()) return;
    if (e.key === 'Escape') { this.askQuit(!$('quit-modal').classList.contains('show')); return; }
    if (e.key === 'F8') { e.preventDefault(); if (this.isMyTurn()) this.socket.emit('game:pass'); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      $('game-chat').classList.add('typing');
      $('game-chat').querySelector('input').focus();
      return;
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
    this.sfx.ensure();
    const was = this.keys[e.key];
    this.keys[e.key] = true;
    if (!this.isMyTurn()) return;
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !was) {
      if (this.moveLeft <= 0) this.fx.text(this.me.dx, this.me.dy - 104, 'HẾT LỰC DI CHUYỂN', '#9fe0ff', 20);
      this.sendInput(this.keys.ArrowLeft, this.keys.ArrowRight);
    }
    if (e.key === ' ' && !was && !this.charging) { this.charging = true; this.chargeStart = performance.now(); this.power = 0; this.sendInput(false, false); }
    if (e.key === '1') this.selectShot('s1');
    if (e.key === '2') this.selectShot('s2');
    if (e.key === '3') this.selectShot('ss');
    for (const id of ITEM_IDS) if (e.key === ITEMS[id].key) this.useItem(id);
  }

  keyUp(e) {
    this.keys[e.key] = false;
    if (!this.isMyTurn()) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') this.sendInput(this.keys.ArrowLeft, this.keys.ArrowRight);
    if (e.key === ' ' && this.charging) this.fire();
  }

  sendInput(left, right) {
    const key = `${!!left}${!!right}`;
    if (this.lastInput === key) return;
    this.lastInput = key;
    this.socket.emit('game:input', { left: !!left, right: !!right });
  }

  ssOk() { return !!this.me?.ssReady; }

  selectShot(s) {
    if (s === 'ss' && !this.ssOk()) return;
    this.selShot = s;
    this.refreshShots();
  }

  fire() {
    this.power = Math.min(100, ((performance.now() - this.chargeStart) / CHARGE_MS) * 100);
    this.charging = false;
    this.fired = true;
    this.lastPower = this.power;
    this.socket.emit('game:fire', { angle: Math.round(this.angle), power: Math.round(this.power * 10) / 10, shot: this.selShot });
  }

  bindMouse() {
    const c = this.canvas;
    let drag = null;
    const down = e => { drag = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y }; };
    const move = e => {
      if (!drag) return;
      this.cam.x = drag.cx - (e.clientX - drag.x) / this.zoom;
      this.cam.y = drag.cy - (e.clientY - drag.y) / this.zoom;
      this.manualUntil = performance.now() + 5000;
    };
    const up = e => {
      // a click (not a drag) while dead in Score mode picks the respawn point
      const me = this.me;
      if (drag && me && !me.alive && me.respawnAt && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6 && e.target === c) {
        const wx = this.cam.x + e.clientX / this.zoom;
        this.socket.emit('game:drop', { x: Math.round(wx) });
      }
      drag = null;
    };
    const wheel = e => {
      e.preventDefault();
      const wx = this.cam.x + e.clientX / this.zoom, wy = this.cam.y + e.clientY / this.zoom;
      this.zoom = Math.max(0.45, Math.min(1.5, this.zoom * (1 - e.deltaY * 0.0012)));
      this.userZoom = true;
      this.cam.x = wx - e.clientX / this.zoom; this.cam.y = wy - e.clientY / this.zoom;
      this.manualUntil = performance.now() + 5000;
    };
    const mini = e => {
      const r = $('minimap').getBoundingClientRect();
      const wx = ((e.clientX - r.left) / r.width) * W, wy = ((e.clientY - r.top) / r.height) * H;
      this.cam.x = wx - this.viewW() / 2; this.cam.y = wy - this.viewH() / 2;
      this.manualUntil = performance.now() + 5000;
    };
    const hover = e => {
      if (!this.tanks || drag) return;
      const wx = this.cam.x + e.clientX / this.zoom, wy = this.cam.y + e.clientY / this.zoom;
      const t = this.tanks.find(t => t.alive && !this.hiddenFromMe(t) && Math.abs(t.dx - wx) < 36 && wy > t.dy - 80 && wy < t.dy + 30);
      const tip = $('tip');
      if (!t) { tip.classList.remove('show'); return; }
      const pr = this.getProfile(t.pid);
      tip.innerHTML = `<div class="tn ${t.team}">${esc(t.name)}${t.bot ? ' 🤖' : ''}</div><div class="tx">${XE[t.xe].name} · ${t.hp}/${t.maxHp} máu</div>` +
        (XE[t.xe].passive ? `<div class="tx">✦ ${XE[t.xe].passiveName}: ${XE[t.xe].passiveDesc}</div>` : '') +
        (pr ? `<div class="tr"><img class="ico" src="${rankIcon(pr.rankId)}" alt=""> ${pr.rank} · ${pr.gp} GP</div><table><tr><td>Số trận</td><td>${pr.games}</td></tr><tr><td>Tỉ lệ thắng</td><td>${pr.winRate}%</td></tr><tr><td>Sát thương TB</td><td>${pr.avgDmg}</td></tr><tr><td>Xe hay dùng</td><td>${pr.fav || '—'}</td></tr></table>` : '<div class="tr">NPC</div>');
      tip.style.left = Math.min(window.innerWidth - 230, e.clientX + 16) + 'px';
      tip.style.top = Math.max(10, e.clientY - 20) + 'px';
      tip.classList.add('show');
    };
    c.addEventListener('mousemove', hover);
    c.addEventListener('mouseleave', () => $('tip').classList.remove('show'));
    c.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    c.addEventListener('wheel', wheel, { passive: false });
    $('minimap').addEventListener('mousedown', mini);
    this.unbindMouse = () => {
      c.removeEventListener('mousedown', down);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      c.removeEventListener('wheel', wheel);
      $('minimap').removeEventListener('mousedown', mini);
    };
  }

  bindButtons() {
    for (const b of $('shots').querySelectorAll('[data-shot]')) b.onclick = () => this.isMyTurn() && this.selectShot(b.dataset.shot);
    $('btn-pass').onclick = () => { if (this.isMyTurn()) this.socket.emit('game:pass'); };
    // click the power bar to drop a mark there (click it again to clear it), to time the next shot by
    const bar = $('power-bar');
    bar.onpointerdown = e => {
      e.preventDefault();
      const r = bar.getBoundingClientRect(), pct = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
      this.powerMark = this.powerMark !== undefined && Math.abs(this.powerMark - pct) < 2 ? undefined : Math.round(pct * 10) / 10;
    };
    bar.oncontextmenu = e => { e.preventDefault(); this.powerMark = undefined; };
    $('btn-quit').onclick = () => this.askQuit(true);
    $('quit-no').onclick = () => this.askQuit(false);
    const mute = $('mute');
    mute.textContent = this.sfx.muted ? '🔇' : '🔊';
    mute.onclick = () => { this.sfx.setMuted(!this.sfx.muted); mute.textContent = this.sfx.muted ? '🔇' : '🔊'; };
    $('quit-yes').onclick = () => { this.askQuit(false); this.onQuit?.(); };
    $('result-back').onclick = () => this.onExit();
  }

  askQuit(open) { $('quit-modal').classList.toggle('show', open); }

  // ---------- update ----------

  update(dt) {
    this.frame++;
    this.stepAnim(dt);

    // my aiming and charging
    if (this.isMyTurn()) {
      const [lo, hi] = XE[this.me.xe].angle;
      const da = (this.keys.ArrowUp ? 1 : 0) - (this.keys.ArrowDown ? 1 : 0);
      if (da && !this.charging) {
        this.angle = Math.max(lo, Math.min(hi, this.angle + da * 32 * dt));
        this.me.angle = Math.round(this.angle);
        this.drawDial();
        const now = performance.now();
        if (now - (this.lastAimSent || 0) > 90 && this.sentAngle !== this.me.angle) {
          this.lastAimSent = now; this.sentAngle = this.me.angle;
          this.socket.emit('game:aim', { angle: this.me.angle });
        }
      }
      if (this.charging) {
        const p = Math.min(100, ((performance.now() - this.chargeStart) / CHARGE_MS) * 100);
        if (Math.floor(p / 6) !== Math.floor(this.power / 6)) this.sfx.charge(p);
        this.power = p;
      }
    }

    // tanks slide toward server positions; walking xe bob and kick up dust
    const k = Math.min(1, dt * 12);
    for (const t of this.tanks) {
      t.walking = t.alive && Math.abs(t.x - t.dx) > 0.25 && !this.anim;
      if (t.walking) {
        t.walkPhase = (t.walkPhase || 0) + dt * 11;
        if (this.frame % 7 === 0) this.fx.add({ x: t.dx - t.facing * 14, y: t.dy - 2, vx: -t.facing * 0.4, vy: -0.4, g: -0.01, drag: 0.97, life: 30, max: 30, r: 3 + Math.random() * 3, color: 'rgba(200,190,170,0.5)', smoke: true });
      }
      t.dx += (t.x - t.dx) * k;
      t.dy += (t.y - t.dy) * (t.y > t.dy ? Math.min(1, dt * 7) : k);
    }

    // lean with the ground like Gunbound mobiles (flyers stay level). The same tilt turns the aim (shared/physics bodyTilt).
    for (const t of this.tanks) {
      const target = t.alive ? bodyTilt(this.mask, t) : 0;
      t.tilt = (t.tilt || 0) + (target - (t.tilt || 0)) * Math.min(1, dt * 8);
    }

    // burning ground
    for (const z of this.zones) {
      if (Math.random() < 0.6) {
        const x = z.x + (Math.random() * 2 - 1) * z.r;
        const y = surface(this.mask, x, Math.max(0, z.y - z.r - 30));
        if (y < z.y + z.r + 30) this.fx.flame(x, y);
      }
    }
    if (THEMES[this.map].embers && Math.random() < 0.3) {
      this.fx.add({ x: this.cam.x + Math.random() * this.viewW(), y: this.waterY, vx: (Math.random() - 0.5) * 0.4, vy: -0.8 - Math.random(), life: 120, max: 120, r: 1.5, color: '#ff8a3a', glow: true });
    }

    this.pAcc += dt * 60;
    while (this.pAcc >= 1) {
      this.fx.update();
      for (const b of this.beams) b.life--;
      for (const c of this.clones) c.life--;
      for (const j of this.jaws) j.life--;
      for (const e of this.rising) e.life--;
      for (const e of this.erupts) { e.life--; if (e.vy) e.y += e.vy; }
      for (const b of this.bolts) b.life--;
      if (this.flash) this.flash.life--;
      this.pAcc--;
    }
    this.beams = this.beams.filter(b => b.life > 0);
    this.clones = this.clones.filter(c => c.life > 0);
    this.jaws = this.jaws.filter(j => j.life > 0);
    this.rising = this.rising.filter(e => e.life > 0);
    this.erupts = this.erupts.filter(e => e.life > 0);
    this.bolts = this.bolts.filter(b => b.life > 0);
    if (this.flash && this.flash.life <= 0) this.flash = null;
    this.shake *= Math.pow(0.02, dt);
    // SS darkens the battlefield while the shot is in the air
    const a = this.anim;
    const wantDark = a && a.shot === 'ss' && a.f < a.d.frames ? 0.62 : 0;
    this.dark += (wantDark - this.dark) * Math.min(1, dt * (wantDark ? 2.5 : 3.5));

    this.updateCamera(dt);
    this.updateHud();
  }

  // Match intro: diagonal wipe off the loading screen, then the camera sweeps across every spawn.
  beginIntro() {
    if (this.intro) return;
    const order = [...this.tanks].sort((a, b) => a.x - b.x);
    this.intro = { t0: performance.now(), ms: Math.max(1500, (this.introMs || 3000) - 300), order };
    this.hideLoading();
    this.cam.x = order[0].x - this.viewW() / 2;
    this.cam.y = order[0].y - this.viewH() * 0.6;
    setTimeout(() => { this.banner('BẮT ĐẦU!'); this.sfx.ding(); }, this.intro.ms * 0.55);
    for (const t of this.tanks) if (t.rolled) this.onSys(XE[t.xe].legendary ? `🌟 HUYỀN THOẠI! ${t.name} bốc trúng ${XE[t.xe].name}!` : `🎲 ${t.name} bốc được ${XE[t.xe].name}!`);
    const legend = this.me && XE[this.me.xe].legendary ? this.me : null;
    if (legend) setTimeout(() => { this.banner(`HUYỀN THOẠI: ${XE[legend.xe].name.toUpperCase()}!`, true); this.sfx.ding(); }, this.intro.ms * 0.55 + 1400);
  }

  updateCamera(dt) {
    let target = null, speed = 4;
    const intro = this.intro && performance.now() - this.intro.t0 < this.intro.ms ? this.intro : null;
    if (intro) {
      const k = (performance.now() - intro.t0) / intro.ms;
      const o = intro.order, f = Math.min(o.length - 1, k * (o.length - 1)), i = Math.floor(f);
      const A = o[i], B = o[Math.min(o.length - 1, i + 1)], u = f - i;
      target = { x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u - 40 };
      speed = 5;
    } else if (performance.now() < this.manualUntil) target = null;
    else if (this.punch) { target = { x: this.punch.x, y: this.punch.y }; speed = 7; }
    else if (this.anim) { target = this.focus; speed = 6; }
    else {
      const t = this.tank(this.activeId) || this.me;
      if (t) target = { x: t.dx, y: t.dy - 40 };
    }
    if (target) {
      const tx = target.x - this.viewW() / 2, ty = target.y - this.viewH() * 0.55;
      const k = Math.min(1, dt * speed);
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
    }
    const vw = this.viewW(), vh = this.viewH();
    this.cam.x = vw > W ? (W - vw) / 2 : Math.max(0, Math.min(W - vw, this.cam.x));
    this.cam.y = Math.max(-420, Math.min(H + 30 - vh, this.cam.y));
  }

  // ---------- render ----------

  render() {
    const ctx = this.ctx, dpr = this.dpr;
    const pk = this.punch ? (this.time - this.punch.t0) / 0.7 : 1;
    if (pk >= 1) this.punch = null;
    const z = this.zoom * (pk < 1 ? 1 + 0.14 * Math.sin(pk * Math.PI) : 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!drawBackdrop(ctx, ASSETS.bg[this.map], this.vw, this.vh, this.cam, z, this.viewW())) drawSky(ctx, this.vw, this.vh, this.cam, z, this.scenery, this.time);

    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, (-this.cam.x * z + sx) * dpr, (-this.cam.y * z + sy) * dpr);

    // sky strike beams
    for (const b of this.beams) {
      const k = b.life / b.max;
      if (b.light) {
        // Kỳ Lân horn beam: glow, body and white core along the line
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (const [lw, c] of [[b.w * 2.6, `rgba(190,160,255,${0.35 * k})`], [b.w * 1.2, `rgba(255,240,255,${0.8 * k})`], [Math.max(2, b.w * 0.35), `rgba(255,255,255,${k})`]]) {
          ctx.strokeStyle = c; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        }
        ctx.restore();
        continue;
      }
      const bw = b.wide || 30;
      const g = ctx.createLinearGradient(b.x - bw, 0, b.x + bw, 0);
      g.addColorStop(0, 'rgba(255,255,220,0)'); g.addColorStop(0.5, `rgba(255,250,200,${0.6 * k})`); g.addColorStop(1, 'rgba(255,255,220,0)');
      ctx.fillStyle = g;
      ctx.fillRect(b.x - bw, -500, bw * 2, b.y + 500);
    }

    ctx.drawImage(this.terrain, 0, -(this.terrain.pad || 0));
    this.drawWeather(ctx);

    for (const c of this.clones) {
      drawXe(ctx, 'tethien', { x: c.x, y: c.y + Math.sin(this.time * 4) * 3, facing: this.tank(this.activeId)?.facing || 1, angle: 45, team: 'A', t: this.time, alpha: Math.min(0.85, c.life / 30), colors: XE.tethien.colors });
    }

    this.tanks.forEach((t, i) => this.drawTank(ctx, t, i));
    this.drawDrops(ctx);
    this.drawPillars(ctx);
    this.drawMinions(ctx);
    this.drawForesight(ctx);
    this.drawMoon(ctx);
    // Đêm Trăng Rằm: the sky turns to a violet night for a round
    if (this.moonNight) { ctx.fillStyle = 'rgba(40,20,90,0.28)'; ctx.fillRect(this.cam.x - 200, this.cam.y - 200, this.viewW() + 400, this.viewH() + 600); }
    if (this.dark > 0.01) {
      ctx.fillStyle = `rgba(4,4,22,${this.dark})`;
      ctx.fillRect(this.cam.x - 200, this.cam.y - 200, this.viewW() + 400, this.viewH() + 600);
    }
    for (const r of this.ribbons) this.drawRibbon(ctx, r);
    if (this.practice && this.ghost && !this.anim) {
      ctx.save(); ctx.setLineDash([4, 7]); ctx.strokeStyle = 'rgba(125,255,154,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < this.ghost.length; i += 4) i ? ctx.lineTo(this.ghost[i], this.ghost[i + 1]) : ctx.moveTo(this.ghost[0], this.ghost[1]);
      ctx.stroke(); ctx.restore();
    }
    for (const p of this.projs || []) {
      if (p.zapped) this.drawZapAura(ctx, p);
      // Ổ Bọ Con: each baby scorpion flies on its own, curled up and tumbling
      if (p.xe === 'bocap' && p.shot === 's2') { drawBabyScorpion(ctx, p.x, p.y + 8, { state: 'fly', t: this.time, rot: this.time * 5 + p.start, size: 30, facing: p.vx < 0 ? -1 : 1 }); continue; }
      if (p.sprite && p.look !== 'quake') this.drawShotSprite(ctx, p);
      else drawProjectile(ctx, p.look, p.x, p.y, p.vx, p.vy, this.time);
    }
    this.fx.draw(ctx);
    for (const j of this.jaws) this.drawJaw(ctx, j);
    for (const e of this.rising) this.drawRising(ctx, e);
    for (const e of this.erupts) if (e.flat) this.drawErupt(ctx, e);
    for (const e of this.erupts) if (!e.flat) this.drawErupt(ctx, e);
    this.drawBolts(ctx);
    drawWater(ctx, this.map, this.waterY, this.time);
    const act = this.tank(this.activeId);
    if (act && act.alive && !this.anim && !(this.intro && performance.now() - this.intro.t0 < this.intro.ms)) this.drawGauge(ctx, act);
    this.tanks.forEach(t => this.drawLabel(ctx, t));
    this.tanks.forEach(t => this.drawBubble(ctx, t));

    if (this.flash) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = (this.flash.life / this.flash.max) * 0.45;
      ctx.fillStyle = this.flash.color;
      ctx.fillRect(0, 0, this.vw, this.vh);
      ctx.globalAlpha = 1;
    }
    if (this.frame % 3 === 0) this.drawMinimap();
  }

  // Ẩn Mực (Bạch Tuộc passive): under 30% HP it is only a faint smudge to the other team
  hiddenFromMe(t) {
    return t.xe === 'bachtuoc' && t.alive && t.hp < t.maxHp * 0.3 && !!this.me && t.team !== this.me.team;
  }

  drawTank(ctx, t, i) {
    if (this.hiddenFromMe(t)) {
      ctx.save(); ctx.globalAlpha = 0.1 + 0.05 * Math.sin(this.time * 3);
      this.drawTankInner(ctx, t, i);
      ctx.restore();
      return;
    }
    this.drawTankInner(ctx, t, i);
  }

  drawTankInner(ctx, t, i) {
    // knocked out: the xe flips up and fades, then a tombstone drops in
    if (!t.alive && t.deathT !== undefined && this.time - t.deathT < 1.1) {
      const k = (this.time - t.deathT) / 1.1;
      ctx.save();
      ctx.translate(t.dx, t.dy - Math.sin(k * Math.PI) * 60);
      ctx.rotate(k * Math.PI * 2.2 * (t.facing || 1));
      ctx.globalAlpha = 1 - k;
      drawXe(ctx, t.xe, { x: 0, y: 30, facing: t.facing, team: t.team, t: this.time, gender: t.gender });
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }
    if (!t.alive && t.deathT !== undefined && this.time - t.deathT < 1.5) {
      const k = (this.time - t.deathT - 1.1) / 0.4;
      ctx.save(); ctx.translate(0, -(1 - Math.min(1, k)) * 120);
    } else ctx.save();
    if (!t.alive) {
      ctx.save();
      ctx.translate(t.dx, t.dy);
      ctx.fillStyle = '#8a90a0';
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-9, -16); ctx.arc(0, -16, 9, Math.PI, 0); ctx.lineTo(9, 0); ctx.fill();
      ctx.fillStyle = '#5a6070'; ctx.fillRect(-1.5, -22, 3, 14); ctx.fillRect(-5, -18, 10, 3);
      ctx.restore();
      ctx.restore();
      return;
    }
    ctx.restore();
    // Score respawn: the xe falls in from the sky
    const sp = t.spawnT !== undefined ? (this.time - t.spawnT) / 0.8 : 1;
    if (sp < 1) { ctx.save(); ctx.translate(0, -((1 - sp) ** 2) * 420); }
    const hit = this.time - t.hitT;
    const jig = hit < 0.35 ? Math.sin(hit * 80) * 3 : 0;
    const pose = this.tankPose(t, i, hit);
    drawXe(ctx, t.xe, { x: t.dx + jig, y: t.dy, facing: t.facing, angle: t.angle, team: t.team, t: this.time + i * 0.7, colors: XE[t.xe].colors, hair: t.hair, tilt: (t.tilt || 0) + (t.walking ? Math.sin(t.walkPhase) * 0.07 : 0), gender: t.gender, walk: t.walking ? t.walkPhase : null, pose, fx: t.alive, fireAge: this.time - (t.fireT ?? -9) });
    // heavy hit: stars circle the head for a moment
    if (hit < 1.4 && (t.hitAmt || 0) >= 220) {
      for (let k = 0; k < 3; k++) {
        const a = this.time * 5 + (k * Math.PI * 2) / 3;
        const sx = t.dx + Math.cos(a) * 22, sy = t.dy - 78 + Math.sin(a) * 6;
        ctx.fillStyle = '#ffe14a'; ctx.strokeStyle = '#0b1633'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let j = 0; j < 10; j++) { const r = j % 2 ? 2.6 : 6, b = (j * Math.PI) / 5 - Math.PI / 2; ctx.lineTo(sx + Math.cos(b) * r, sy + Math.sin(b) * r); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    if (hit < 0.15) {
      ctx.globalAlpha = 0.6 * (1 - hit / 0.15);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(t.dx, t.dy - 32, 42, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Giáp ảo bubble: faint while full, flashes when hit or refilled
    if (t.shield > 0) {
      const flash = Math.max(0, 1 - (this.time - (t.shieldHitT ?? -9)) / 0.4, 1 - (this.time - (t.shieldUpT ?? -9)) / 0.8);
      const a = 0.14 + 0.1 * (t.shield / (t.maxShield || 1)) + 0.5 * flash;
      ctx.save();
      ctx.strokeStyle = `rgba(140,230,255,${a + 0.15})`; ctx.fillStyle = `rgba(120,220,255,${a * 0.35})`; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let j = 0; j < 6; j++) { const b = (j * Math.PI) / 3 + this.time * 0.4; ctx.lineTo(t.dx + Math.cos(b) * 50, t.dy - 34 + Math.sin(b) * 44); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (t.armorBuff) {
      ctx.strokeStyle = `rgba(255,215,80,${0.5 + 0.3 * Math.sin(this.time * 5)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(t.dx, t.dy - 32, 46, 0, Math.PI * 2); ctx.stroke();
    }
    // Băng Phong: encased in a block of ice until its lost turn passes
    if (t.frozen && t.alive) {
      ctx.save();
      const ig = ctx.createLinearGradient(t.dx - 40, t.dy - 78, t.dx + 40, t.dy + 2);
      ig.addColorStop(0, 'rgba(225,248,255,0.7)'); ig.addColorStop(0.5, 'rgba(120,200,255,0.4)'); ig.addColorStop(1, 'rgba(60,150,230,0.6)');
      ctx.fillStyle = ig; ctx.strokeStyle = '#eaf9ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(t.dx - 40, t.dy - 78, 80, 80, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.moveTo(t.dx - 36, t.dy - 74); ctx.lineTo(t.dx - 6, t.dy - 74); ctx.lineTo(t.dx - 36, t.dy - 40); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.time * 5); ctx.beginPath(); ctx.arc(t.dx + 30, t.dy - 68, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(t.dx - 28, t.dy - 64); ctx.lineTo(t.dx - 12, t.dy - 70); ctx.moveTo(t.dx + 20, t.dy - 30); ctx.lineTo(t.dx + 30, t.dy - 44); ctx.stroke();
      ctx.restore();
    }
    if (sp < 1) ctx.restore();
  }

  // Thỏ Ngọc: moon zones where shells float, drawn as a pale crescent-moon bubble
  drawMoon(ctx) {
    for (const z of this.moonZones || []) {
      const k = Math.min(1, (this.time - (z.bornT ?? -9)) / 0.5);
      ctx.save();
      ctx.globalAlpha = 0.55 * k;
      const g = ctx.createRadialGradient(z.x, z.y, z.r * 0.2, z.x, z.y, z.r);
      g.addColorStop(0, 'rgba(255,245,200,0.6)'); g.addColorStop(1, 'rgba(200,190,255,0.15)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(z.x, z.y, z.r * k, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9 * k; ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -this.time * 20;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r * k, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      // a crescent moon floats in the middle so the zone reads as "moon gravity" at a glance
      const cy = z.y + Math.sin(this.time * 1.5) * 6;
      ctx.globalAlpha = 0.85 * k; ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(z.x, cy, 22, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(z.x + 10, cy - 6, 19, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 6; i++) { const a = this.time * 0.6 + (i * Math.PI) / 3, rr = z.r * (0.55 + 0.3 * ((i % 2))); ctx.globalAlpha = (0.5 + 0.5 * Math.sin(this.time * 3 + i)) * k; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr, 2.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
  }

  // Firing: every animal does its own thing at its own body part (the dragon breathes fire, the mammoth's
  // volcano erupts, the scorpion flicks venom), on top of the barrel flash.
  signatureFire(t, shot) {
    const f = t.facing || 1, at = part => partWorld(t.xe, t.gender, part, t.dx, t.dy, f);
    const burst = (x, y, n, cols, sp, spread, life, r, g = 0, dir = 0) => {
      for (let i = 0; i < n; i++) {
        const a = dir + (Math.random() - 0.5) * spread, v = sp * (0.5 + Math.random());
        this.fx.add({ x, y, vx: Math.cos(a) * v * f, vy: Math.sin(a) * v, g, drag: 0.93, life: life + Math.random() * 10, max: life + 10, r: r * (0.6 + Math.random() * 0.8), color: cols[i % cols.length] });
      }
    };
    switch (t.xe) {
      case 'rong': { const [x, y] = at('mouth'); burst(x, y, 26, ['#fff3a0', '#ffc23a', '#ff7a1a', '#e0401a'], 4.5, 0.55, 22, 6, -0.02, -0.15); break; }
      case 'kylan': { const [x, y] = at('horn'); this.fx.add({ x, y, ring: true, life: 18, max: 18, r: 6, grow: 3, color: '#ffffff' }); burst(x, y, 12, ['#ffffff', '#d8c8ff', '#ffe0f0'], 2.5, 6.3, 20, 2.5); break; }
      case 'kimquy': { const [x, y] = at('shell'); this.fx.add({ x, y, ring: true, life: 20, max: 20, r: 20, grow: 2.5, color: '#ffe16a' }); break; }
      case 'phuong': { const [x, y] = at('wingL'), [x2, y2] = at('wingR'); burst(x, y, 10, ['#fff3a0', '#ffb030'], 2.5, 2, 26, 3, 0.03, -1.6); burst(x2, y2, 10, ['#fff3a0', '#ffb030'], 2.5, 2, 26, 3, 0.03, -1.6); break; }
      case 'voi': { const [x, y] = at(shot === 's1' ? 'tower' : 'trunk'); if (shot === 's1') burst(x, y, 26, ['#fff0a0', '#ff9a2a', '#ff5a10', '#5a5258'], 5, 0.9, 24, 3.5, 0.2, -1.25); else burst(x, y, 18, ['#ffe07a', '#ff8a2a', '#ff5a10'], 4, 0.6, 18, 3, 0.18, -0.3); break; }
      case 'bachtuoc': { const [x, y] = at('bell'); burst(x, y, 12, ['#3a1450', '#8e44ad', '#b765d8'], 3.5, 1.2, 24, 5, 0.1, -0.4); break; }
      case 'bocap': { const [x, y] = at('sting'); burst(x, y, 14, ['#b6ffcf', '#39e07a', '#1d6b3a'], 4, 0.6, 20, 3, 0.12, 0.1); break; }
      case 'cu': { const [x, y] = at('eyeL'); burst(x, y + 20, 8, ['#c8a070', '#8a5a30', '#fff4d0'], 1.8, 3, 40, 3.5, 0.04, -1.2); break; }
      case 'camap': { const [x, y] = at('drill'); burst(x, y, 16, ['#fff4c0', '#ffc24a', '#d8b878'], 4, 0.9, 16, 2); break; }
      case 'gau': { const [x, y] = at('nozzle'); burst(x, y, 20, ['#ffffff', '#d8f2ff', '#8fd4ff'], 3.5, 0.8, 26, 4, 0.02, -0.2); break; }
      case 'canhcut': { const [x, y] = at('gun'); burst(x, y, 12, ['#bff4ff', '#6fd0ff', '#ffffff'], 3, 0.8, 22, 3, 0.05, 0); this.fx.add({ x, y, ring: true, life: 14, max: 14, r: 6, grow: 2.5, color: '#bff4ff' }); break; }
      case 'tho': { const [x, y] = at('gun'); burst(x, y, 16, ['#fff3a0', '#ffe14a', '#ffffff'], 2.6, 3, 30, 2.5, -0.01, 0); this.fx.add({ x, y, ring: true, life: 20, max: 20, r: 10, grow: 3, color: '#ffe14a' }); break; }
      case 'tethien': { const [x, y] = at('cloud'); this.fx.add({ x, y: y - 20, ring: true, life: 22, max: 22, r: 16, grow: 3, color: '#ffe14a' }); burst(x, y, 10, ['#ffffff', '#fff4c0'], 2, 3, 26, 5, -0.02, 3.14); break; }
    }
  }

  // Procedural life for the one-image xe sprites (Gunbound mobiles are never still):
  // breathing, a hop when their turn starts, a crouch and tremble while charging, recoil on firing,
  // a wobble after a heavy hit, a tremble with smoke when nearly dead, and a victory bounce.
  tankPose(t, i, hit) {
    // no generic hops or bouncing (the user disliked them); each animal's own idle effect is drawn in art.js drawXeFx
    const T = this.time;
    const p = { sx: 1, sy: 1, dx: 0, dy: 0, rot: 0 };
    // charging: crouch and tremble harder as the power rises (only my own xe knows the power)
    if (this.charging && t === this.me) {
      const pw = this.power / 100;
      p.sy -= 0.07 * pw; p.sx += 0.05 * pw;
      p.dx += (Math.random() - 0.5) * 2.4 * pw; p.dy += (Math.random() - 0.5) * 1.2 * pw;
    }
    // firing: kicked back, squashed, then springs forward
    const fr = T - (t.fireT ?? -9);
    if (fr < 0.45) {
      const k = fr / 0.45, e = (1 - k) ** 2;
      p.dx -= t.facing * 9 * e; p.rot -= t.facing * 0.14 * e * Math.cos(k * 6);
      p.sx += 0.12 * e; p.sy -= 0.12 * e;
    }
    // heavy hit: knocked back and wobbling, scaled by the damage
    if (hit < 0.6) {
      const m = Math.min(1, (t.hitAmt || 0) / 250), e = 1 - hit / 0.6;
      p.rot += Math.sin(hit * 34) * 0.16 * m * e;
      p.sy -= 0.1 * m * e * Math.max(0, Math.cos(hit * 20));
    }
    // nearly dead: trembles and puffs smoke
    if (t.alive && t.hp < t.maxHp * 0.25) {
      p.dx += Math.sin(T * 40 + i) * 0.7;
      if (Math.random() < 0.05) this.fx.add({ x: t.dx + (Math.random() - 0.5) * 20, y: t.dy - 60, vx: (Math.random() - 0.5) * 0.4, vy: -0.8, g: -0.005, drag: 0.98, life: 50, max: 50, r: 5 + Math.random() * 4, color: 'rgba(70,70,80,0.55)' });
    }
    return p;
  }

  // Mắt Cú (Cú passive): while aiming, the owl sees the first part of its shot's path
  drawForesight(ctx) {
    const me = this.me;
    if (!me || me.xe !== 'cu' || !me.alive || !this.isMyTurn() || this.anim) return;
    const shot = XE[me.xe].shots[this.selShot];
    const power = this.charging ? this.power : this.powerMark ?? this.lastPower ?? 50;
    const launch = worldAngle(this.mask, me, this.angle), a = (launch * Math.PI) / 180;
    const tip = barrelTip({ x: me.dx, y: me.dy, facing: me.facing }, launch);
    const v0 = VMAX * Math.max(0.04, power / 100), wv = windVec(this.wind), wm = (shot.windMul ?? 1) * XE[me.xe].windMul;
    let x = tip.x, y = tip.y, vx = Math.cos(a) * me.facing * v0, vy = -Math.sin(a) * v0;
    ctx.save();
    ctx.fillStyle = 'rgba(255,225,74,0.85)';
    for (let f = 0; f < 42; f++) {
      vx += wv.x * WIND_K * wm; vy += GRAV + wv.y * WIND_K * wm; x += vx; y += vy;
      if (f % 3 === 0) { ctx.globalAlpha = 1 - f / 46; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
      if (y > 0 && y < H && x > 0 && x < W && this.mask[Math.round(y) * W + Math.round(x)]) break;
    }
    ctx.restore();
  }

  // Hover tooltips for the shot buttons, item buttons and the passive (read-only info)
  bindTips() {
    if (this.tipsBound) return;
    this.tipsBound = true;
    const tip = $('hud-tip');
    const show = (el, html) => {
      tip.innerHTML = html; tip.classList.add('show');
      const r = el.getBoundingClientRect();
      tip.style.left = Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
      tip.style.top = Math.max(8, r.top - tip.offsetHeight - 10) + 'px';
    };
    const hide = () => tip.classList.remove('show');
    // disabled buttons swallow mouse events, so track the pointer over the whole control strip instead
    let cur = null;
    const describe = b => {
      const me = this.me; if (!me) return null;
      if (b.dataset.shot) {
        const k = b.dataset.shot, s = XE[me.xe].shots[k];
        const lock = k === 'ss' && !me.ssReady ? `<div class="ht-warn">🔒 ${me.ssCd > 0 ? `Khoá thêm ${me.ssCd} lượt của bạn` : 'Đột tử kiểu này khoá SS'}</div>` : '';
        return `<div class="ht-k">${k === 'ss' ? 'SPECIAL SHOT' : 'SHOT ' + k[1]} · phím ${k === 'ss' ? '3' : k[1]}</div><div class="ht-n">${s.name}</div><div class="ht-d">${s.desc}</div><div class="ht-m">${shotDmgText(s)} · Delay ${s.delay}${s.windMul ? ` · Gió ×${s.windMul}` : ''}</div>${lock}`;
      }
      const it = ITEMS[b.dataset.item];
      return `<div class="ht-k">VẬT PHẨM · phím ${it.key}</div><div class="ht-n">${it.name}</div><div class="ht-d">${it.desc}</div><div class="ht-m">Giá ${it.cost} G · Delay +${it.delay}${this.suddenOn ? ' · Đột tử: đang khoá' : ''}</div>`;
    };
    const strip = $('shots');
    strip.addEventListener('mousemove', e => {
      const b = [...strip.querySelectorAll('[data-shot], [data-item]')].find(el => { const r = el.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
      if (b === cur) return;
      cur = b;
      const html = b && describe(b);
      if (html) show(b, html); else hide();
    });
    strip.addEventListener('mouseleave', () => { cur = null; hide(); });
    const pv = $('me-passive');
    pv.addEventListener('mouseenter', () => { const x = this.me && XE[this.me.xe]; if (x?.passive) show(pv, `<div class="ht-k">NỘI TẠI · luôn có tác dụng</div><div class="ht-n">${x.passiveName}</div><div class="ht-d">${x.passiveDesc}</div>`); });
    pv.addEventListener('mouseleave', hide);
  }

  // server list after the replay: keep each baby's landing time so its animation doesn't restart
  syncMinions(list) {
    const old = this.minions || [];
    this.minions = list.map(m => { const o = old.find(q => Math.abs(q.x - m.x) < 3 && Math.abs(q.y - m.y) < 3); return { ...m, landT: o?.landT ?? -9, seed: o?.seed ?? m.x % 7 }; });
  }

  syncPillars(list) {
    const old = this.pillars || [];
    this.pillars = list.map(q => ({ ...q, bornT: old.find(o => o.x === q.x && o.y === q.y)?.bornT ?? -9 }));
  }

  // Gậy Như Ý pillars: a red staff with gold caps standing where it landed (grows up when it appears)
  // Gậy Như Ý grown into a pillar: red-lacquer staff with a gold spiral inlay and ornate gold caps, a soft
  // golden aura, sparkles climbing it, and cloud puffs at its foot. It springs up with a little overshoot.
  drawPillars(ctx) {
    const T = this.time;
    for (const q of this.pillars || []) {
      const e = Math.max(0, T - (q.bornT ?? -9)), k = e >= 0.5 ? 1 : 1 - Math.cos(e / 0.5 * Math.PI * 2.5) * Math.exp(-e * 7);
      const h = Math.max(8, q.h * Math.min(1.08, k)), w = q.w + 6, x0 = q.x - w / 2, top = q.y - h, cap = 16;
      ctx.save();
      // aura
      ctx.globalAlpha = 0.5 + 0.15 * Math.sin(T * 3 + q.x);
      const ag = ctx.createLinearGradient(q.x - 26, 0, q.x + 26, 0);
      ag.addColorStop(0, 'rgba(255,210,60,0)'); ag.addColorStop(0.5, 'rgba(255,225,110,0.75)'); ag.addColorStop(1, 'rgba(255,210,60,0)');
      ctx.fillStyle = ag; ctx.fillRect(q.x - 26, top - 10, 52, h + 10);
      ctx.globalAlpha = 1;
      // lacquered body
      const bg = ctx.createLinearGradient(x0, 0, x0 + w, 0);
      bg.addColorStop(0, '#5a0a0a'); bg.addColorStop(0.28, '#d8282a'); bg.addColorStop(0.42, '#ff7a6a'); bg.addColorStop(0.6, '#c21c1e'); bg.addColorStop(1, '#4a0606');
      ctx.fillStyle = bg; ctx.strokeStyle = '#1a0b10'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.rect(x0, top + cap, w, h - cap * 2); ctx.fill(); ctx.stroke();
      // gold spiral inlay, clipped to the body
      ctx.save(); ctx.beginPath(); ctx.rect(x0, top + cap, w, h - cap * 2); ctx.clip();
      ctx.strokeStyle = 'rgba(255,214,90,0.9)'; ctx.lineWidth = 2;
      for (let y = top + cap - 20 + ((T * 18) % 20); y < q.y; y += 20) { ctx.beginPath(); ctx.moveTo(x0, y + 8); ctx.lineTo(x0 + w, y); ctx.stroke(); }
      ctx.restore();
      // gold caps: a band, a bell and a knob at each end
      const capAt = (y, dir) => {
        const cg = ctx.createLinearGradient(x0 - 4, 0, x0 + w + 4, 0);
        cg.addColorStop(0, '#8a5a08'); cg.addColorStop(0.35, '#ffe27a'); cg.addColorStop(0.55, '#fff6c8'); cg.addColorStop(1, '#9a6a10');
        ctx.fillStyle = cg; ctx.strokeStyle = '#1a0b10'; ctx.lineWidth = 2.5;
        const y0 = dir < 0 ? y : y - cap;
        ctx.beginPath(); ctx.roundRect(x0 - 4, y0, w + 8, cap, 4); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(120,70,0,0.8)'; ctx.lineWidth = 1.5;
        for (const f of [0.33, 0.66]) { ctx.beginPath(); ctx.moveTo(x0 - 3, y0 + cap * f); ctx.lineTo(x0 + w + 3, y0 + cap * f); ctx.stroke(); }
        if (dir < 0) { ctx.fillStyle = cg; ctx.strokeStyle = '#1a0b10'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(q.x, y0, w / 2 + 1, 6, 0, Math.PI, 0); ctx.fill(); ctx.stroke(); }
      };
      capAt(top, -1); capAt(q.y, 1);
      // sparkles running up the staff
      for (let i = 0; i < 4; i++) {
        const f = (T * 0.45 + i / 4) % 1, sy = q.y - f * h, sx = q.x + Math.sin(f * 12 + i) * (w / 2 + 6);
        ctx.globalAlpha = Math.sin(f * Math.PI); ctx.fillStyle = '#fff3a0';
        ctx.beginPath(); ctx.moveTo(sx, sy - 5); ctx.lineTo(sx + 1.6, sy - 1.6); ctx.lineTo(sx + 5, sy); ctx.lineTo(sx + 1.6, sy + 1.6); ctx.lineTo(sx, sy + 5); ctx.lineTo(sx - 1.6, sy + 1.6); ctx.lineTo(sx - 5, sy); ctx.lineTo(sx - 1.6, sy - 1.6); ctx.fill();
      }
      // cloud puffs at the foot
      ctx.globalAlpha = 0.9;
      for (let i = -2; i <= 2; i++) {
        const r = 9 - Math.abs(i) * 1.5 + Math.sin(T * 2 + i) * 1.2;
        ctx.fillStyle = '#fff8e0'; ctx.strokeStyle = 'rgba(200,150,40,0.8)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(q.x + i * 10, q.y - 2 + Math.abs(i) * 2, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Ổ Bọ Con: baby scorpions waiting on the ground (both teams see them, with a pulsing trap ring),
  // then walking the server's ground path to their victim, stinging, and bursting into venom
  drawMinions(ctx) {
    const T = this.time;
    for (const m of this.minions || []) {
      const since = T - (m.landT ?? -9), bounce = since < 0.35 ? Math.abs(Math.sin((since / 0.35) * Math.PI * 1.5)) * 10 * (1 - since / 0.35) : 0;
      // trap ring on the ground
      const pulse = 0.5 + 0.5 * Math.sin(T * 4 + m.x);
      ctx.save();
      ctx.fillStyle = `rgba(93,255,154,${0.12 + 0.12 * pulse})`;
      ctx.beginPath(); ctx.ellipse(m.x, m.y + 1, 22 + pulse * 4, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(93,255,154,${0.55 + 0.35 * pulse})`; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.ellipse(m.x, m.y + 1, 22 + pulse * 4, 6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      drawBabyScorpion(ctx, m.x, m.y - bounce, { state: 'idle', t: T, seed: m.seed || 0, size: 34, facing: (m.x % 2) ? 1 : -1 });
    }
    this.scuttles = (this.scuttles || []).filter(c => T - c.t0 < 1.9);
    for (const c of this.scuttles) {
      const walkT = 1.2, e = T - c.t0, n = c.path.length - 1;
      const [ex, ey] = c.path[n], face = ex < c.path[0][0] ? -1 : 1;
      if (e < walkT) {
        const f = (e / walkT) * n, i = Math.min(n - 1, Math.floor(f)), u = f - i;
        const [ax, ay] = c.path[Math.max(0, i)], [bx, by] = c.path[Math.min(n, i + 1)];
        drawBabyScorpion(ctx, ax + (bx - ax) * u, ay + (by - ay) * u, { state: 'walk', t: T, size: 34, facing: face });
      } else {
        const k = Math.min(1, (e - walkT) / 0.35);
        if (k < 1) drawBabyScorpion(ctx, ex - face * 14, ey, { state: 'sting', k, t: T, size: 34, facing: face });
        if (k >= 0.5 && !c.stung) {
          c.stung = true;
          this.fx.text(ex, ey - 90, 'CHÍCH ĐỘC!', '#7dff9a', 20);
          for (let j = 0; j < 12; j++) { const a = Math.random() * Math.PI * 2; this.fx.add({ x: ex, y: ey - 26, vx: Math.cos(a) * 2.5, vy: Math.sin(a) * 2.5 - 1, g: 0.1, drag: 0.95, life: 26, max: 26, r: 2.5 + Math.random() * 2, color: j % 2 ? '#7dff9a' : '#b6ffcf' }); }
        }
      }
    }
  }

  // Score mode: where each dead player chose to fall back in, with the turns left
  drawDrops(ctx) {
    for (const t of this.tanks) {
      if (t.alive || !t.respawnAt) continue;
      const x = this.drops[t.id];
      if (x === undefined) continue;
      const y = Math.min(this.groundBelow(Math.round(x)), this.waterY) - 8, bob = Math.sin(this.time * 4) * 5;
      ctx.save();
      ctx.fillStyle = t.team === 'A' ? '#ff5a4a' : '#4aa0ff'; ctx.strokeStyle = '#0b1633'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x, y + bob); ctx.lineTo(x - 14, y - 22 + bob); ctx.lineTo(x - 6, y - 22 + bob); ctx.lineTo(x - 6, y - 40 + bob);
      ctx.lineTo(x + 6, y - 40 + bob); ctx.lineTo(x + 6, y - 22 + bob); ctx.lineTo(x + 14, y - 22 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
      const left = Math.max(0, t.respawnAt - (this.turnNo || 0));
      ctx.font = '800 15px Baloo 2, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#0b1633'; ctx.fillStyle = '#fff';
      const label = `${t.name} · ${left} lượt`;
      ctx.strokeText(label, x, y - 50 + bob); ctx.fillText(label, x, y - 50 + bob);
      ctx.restore();
    }
  }

  drawShotSprite(ctx, p) {
    const key = p.xe + '-' + p.shot;
    let size = SHOT_SIZE[key] || (p.ss ? 58 : 40);
    // Hỏa Cầu / Thiên Long grow with airtime (same thresholds as shared/xe.js grow/transform)
    if (p.xe === 'rong' && p.shot !== 's2') size *= 0.55 + 0.6 * Math.min(1, Math.max(0, ((p.age || 0) - 50) / 70));
    if (p.kind === 'hop') size = 30;
    const img = p.sprite;
    const k = size / Math.max(img.width, img.height);
    const w = img.width * k, h = img.height * k;
    // soft coloured glow behind the sprite
    const L = LOOKS[p.look] || LOOKS.fire;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 1.15);
    g.addColorStop(0, (L.g || '#ffffff') + 'aa'); g.addColorStop(1, (L.g || '#ffffff') + '00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, size * 1.15, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y);
    if (SPIN.has(key)) ctx.rotate(this.time * 16);
    else if (NO_ROTATE.has(key)) { if (p.vx < 0) ctx.scale(-1, 1); }
    else {
      ctx.rotate(Math.atan2(p.vy, p.vx) + (ROT_OFF[key] || 0));
      if (p.vx < 0 && UPRIGHT.has(key)) ctx.scale(1, -1); // keep faces and creatures right side up
      if (MIRROR.has(key)) ctx.scale(-1, 1);
    }
    drawSmooth(ctx, img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // SS impact: every SS gets its own finishing effect on top of the normal blast.
  ssImpact(xe, x, y, r) {
    const fx = this.fx;
    const burst = (n, color, speed, life, size, g = 0) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = Math.random() * speed;
        fx.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g, drag: 0.95, life, max: life, r: size * (0.5 + Math.random()), color, glow: true });
      }
    };
    const column = (color, h, n) => {
      for (let i = 0; i < n; i++) fx.add({ x: x + (Math.random() - 0.5) * r, y: y - Math.random() * 20, vx: (Math.random() - 0.5) * 0.6, vy: -2 - Math.random() * h, g: 0, drag: 0.98, life: 50, max: 50, r: 6 + Math.random() * 8, color, glow: true });
    };
    switch (xe) {
      case 'rong': column('#ff7a1a', 7, 60); column('#ffd23a', 5, 40); this.flash = { color: '#ff5a10', life: 18, max: 18 }; break;
      case 'kylan': this.beams.push({ x, y, life: 70, max: 70, wide: 90 }); fx.sparkle(x, y - 20, '#fff6c4'); fx.sparkle(x, y - 40, '#b9f4ff'); burst(40, '#fff3a0', 5, 60, 4, -0.03); break;
      case 'kimquy': for (let i = 0; i < 3; i++) fx.add({ x, y, ring: true, life: 30 + i * 8, max: 30 + i * 8, r: 10 + i * 12, grow: 3 + i, color: '#ffcf3a' }); burst(30, '#ffe16a', 7, 40, 3); break;
      case 'phuong': for (let i = 0; i < 40; i++) fx.flame(x + (Math.random() - 0.5) * r * 2, y); burst(50, '#ff7a1a', 8, 45, 5, 0.05); this.flash = { color: '#ff7a1a', life: 14, max: 14 }; break;
      case 'voi': {
        // painted fissure and slab only: the old code-drawn crack lines spread into thin air on bridges and ledges
        this.shake = 22; this.flash = { color: '#ff5a10', life: 12, max: 12 };
        const L = ASSETS.fx.lava;
        if (L) {
          this.erupts.push({ img: L[5], x, y: y + 6, w: 150, life: 90, max: 90, flat: true });
          this.erupts.push({ img: L[8], x, y: y - 30, w: 160, life: 80, max: 80, puff: true, vy: -0.5 });
          this.erupts.push({ img: L[1], x: x - 8, y: y + 4, w: 120, life: 60, max: 60 });
          this.erupts.push({ img: L[3], x: x + 12, y: y + 6, w: 120, life: 70, max: 70 });
        }
        column('#ffd23a', 4, 24);
        break;
      }
      case 'bachtuoc': this.rising.push({ key: 'bachtuoc', x, y, life: 55, max: 55, size: r * 2.4 }); burst(30, '#b765d8', 6, 50, 5); break;
      case 'bocap':
        for (let i = 0; i < 40; i++) fx.add({ x: x + (Math.random() - 0.5) * r * 1.5, y: y - Math.random() * r, vx: (Math.random() - 0.5) * 0.8, vy: -0.4 - Math.random() * 0.6, g: 0, drag: 0.99, life: 90, max: 90, r: 10 + Math.random() * 14, color: 'rgba(80,230,110,0.35)', smoke: true });
        fx.text(x, y - r - 20, '☠', '#7dff9a', 54); break;
      case 'cu': burst(26, '#c9a277', 6, 50, 4, 0.08); break;
      case 'camap': this.rising.push({ key: 'camap', x, y, life: 50, max: 50, size: r * 2.2 }); this.shake = 16; break;
      case 'tethien': burst(40, '#ffd700', 7, 50, 4); fx.sparkle(x, y - 20, '#ffd700'); this.flash = { color: '#ffd700', life: 12, max: 12 }; break;
    }
  }

  // One pulse of Tượng Tinh's quake: a lava fissure opens, basalt spikes or a lava geyser shoot up, dust rolls out.
  quakePulse(e) {
    const L = ASSETS.fx.lava, n = (this.quakeN = (this.quakeN || 0) + 1), { x, y } = e;
    this.erupts.push({ img: L[6], x, y: y + 3, w: 84, life: 75, max: 75, flat: true });
    this.erupts.push({ img: L[7], x, y: y + 4, w: 96, life: 28, max: 28, puff: true });
    if (n % 2) this.erupts.push({ img: L[n % 4 === 1 ? 3 : 4], x, y: y + 5, w: n % 4 === 1 ? 80 : 60, life: 46, max: 46 });
    else this.erupts.push({ img: L[[0, 2, 1][(n / 2) % 3]], x, y: y + 4, w: 56, life: 40, max: 40 });
    for (let i = 0; i < 8; i++) this.fx.add({ x: x + (Math.random() - 0.5) * 16, y, vx: (Math.random() - 0.5) * 2.4, vy: -2.5 - Math.random() * 3.5, g: 0.22, drag: 0.98, life: 34, max: 34, r: 1.6 + Math.random() * 2.2, color: i % 3 ? '#ff8a2a' : '#ffe07a', glow: true });
    this.shake = Math.max(this.shake, 6);
    this.sfx.boom(e.r * 0.7);
    this.focus = { x, y };
  }

  // painted effect anchored at its bottom centre: pops up with a little overshoot, then sinks back into the ground
  // (flat = fissures and slabs that stretch open; puff = dust/smoke that swells and fades)
  drawErupt(ctx, e) {
    const p = 1 - e.life / e.max, img = e.img, k = e.w / img.width, w = e.w, h = img.height * k;
    let sx = 1, sy = 1, a = 1;
    if (e.puff) { sx = sy = 0.6 + p * 0.7; a = p < 0.15 ? p / 0.15 : (1 - p) / 0.85; }
    else if (e.flat) { sx = Math.min(1, 0.25 + p * 6); sy = Math.min(1, p * 8); a = p > 0.7 ? (1 - p) / 0.3 : 1; }
    else {
      const up = Math.min(1, p / 0.18), down = p > 0.72 ? (p - 0.72) / 0.28 : 0;
      sy = up < 1 ? up * 1.15 : 1 + 0.15 * Math.max(0, 1 - (p - 0.18) / 0.1); sy *= 1 - down;
      sx = 1 - 0.12 * (1 - up);
      a = down ? 1 - down * 0.6 : 1;
    }
    if (sy <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.translate(e.x, e.y);
    ctx.scale(sx, sy);
    drawSmooth(ctx, img, -w / 2, -h, w, h);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Big SS sprite (tentacle, shark jaw) bursting up out of the ground at the blast.
  drawRising(ctx, e) {
    const img = ASSETS.proj[e.key]?.ss;
    if (!img) return;
    const p = 1 - e.life / e.max;
    const rise = Math.min(1, p * 3.5);
    const k = e.size / Math.max(img.width, img.height);
    const w = img.width * k, h = img.height * k;
    ctx.save();
    ctx.globalAlpha = p > 0.75 ? (1 - p) * 4 : 1;
    ctx.translate(e.x, e.y + h * 0.6 * (1 - rise));
    ctx.rotate(-Math.PI / 2 * (e.key === 'camap' ? 1 : 0.6));
    drawSmooth(ctx, img, -w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Giant shark jaw that bursts up from the ground and snaps shut.
  drawJaw(ctx, j) {
    const p = 1 - j.life / j.max;
    const rise = Math.min(1, p * 4);
    const open = p < 0.3 ? 1 : Math.max(0, 1 - (p - 0.3) * 5);
    const r = j.r * 1.1;
    ctx.save();
    ctx.globalAlpha = p > 0.75 ? (1 - p) * 4 : 1;
    ctx.translate(j.x, j.y + r * (1 - rise));
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * open * 0.5);
      ctx.fillStyle = '#5b6f82';
      ctx.beginPath(); ctx.ellipse(side * r * 0.55, 0, r * 0.6, r * 0.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      for (let i = -3; i <= 3; i++) {
        const ty = i * r * 0.22;
        ctx.beginPath(); ctx.moveTo(side * r * 0.08, ty - r * 0.09); ctx.lineTo(-side * r * 0.18, ty); ctx.lineTo(side * r * 0.08, ty + r * 0.09); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawLabel(ctx, t) {
    if (!t.alive || this.hiddenFromMe(t)) return;
    const x = t.dx, y = t.dy + 8;
    const w = 58, k = Math.max(0, t.hp / t.maxHp);
    // HP bar under the feet, then a name plate with a team-coloured badge
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x - w / 2 - 1.5, y - 1.5, w + 3, 8);
    ctx.fillStyle = k > 0.5 ? '#3fe05a' : k > 0.25 ? '#ffcf3a' : '#ff3a3a';
    ctx.fillRect(x - w / 2, y, w * k, 5);
    // Giáp ảo: a cyan strip over the HP bar
    if (t.maxShield) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x - w / 2 - 1.5, y - 6, w + 3, 5);
      ctx.fillStyle = '#6fe0ff'; ctx.fillRect(x - w / 2, y - 4.5, w * Math.max(0, (t.shield || 0) / t.maxShield), 2.5);
    }
    ctx.font = "700 14px 'Baloo 2', sans-serif";
    const tw = ctx.measureText(t.name).width;
    const bx = x - (tw + 22) / 2, by = y + 9;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, tw + 22, 18);
    ctx.fillStyle = TEAM_COLORS[t.team]; ctx.fillRect(bx + 2, by + 2, 14, 14);
    ctx.strokeStyle = '#ffe16a'; ctx.lineWidth = 1.5; ctx.strokeRect(bx + 2, by + 2, 14, 14);
    ctx.fillStyle = '#fff'; ctx.font = "800 10px 'Baloo 2', sans-serif"; ctx.textAlign = 'center';
    ctx.fillText(t.team, bx + 9, by + 13);
    ctx.font = "700 14px 'Baloo 2', sans-serif"; ctx.textAlign = 'left';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(t.name, bx + 19, by + 14);
    ctx.fillStyle = t === this.me ? '#ffe16a' : '#ffffff';
    ctx.fillText(t.name, bx + 19, by + 14);
    ctx.textAlign = 'center';
    const icons = [t.poison && '☠', t.blind && '👁', t.mark && '🎯', t.armorBuff && '🛡'].filter(Boolean).join(' ');
    if (icons) { ctx.font = '14px sans-serif'; ctx.fillText(icons, x, t.dy - 118); }
    if (t.id === this.activeId && !this.anim) {
      const ay = t.dy - 142 + Math.sin(this.time * 6) * 4;
      ctx.fillStyle = '#ff8a1a'; ctx.strokeStyle = '#3a1a00'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x - 24, ay - 11, 48, 20, 4); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 6, ay + 9); ctx.lineTo(x, ay + 17); ctx.lineTo(x + 6, ay + 9); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = "900 12px 'Baloo 2', sans-serif"; ctx.textAlign = 'center';
      ctx.fillText('LƯỢT', x, ay + 4);
    }
  }

  // Faint smoke wisp behind the shell. It starts a little behind the head and stays thin and see-through,
  // so the projectile sprite is always the thing you see.
  drawRibbon(ctx, r) {
    const pts = r.pts, head = Math.floor(r.head) - RIBBON_GAP, len = Math.min(head, RIBBON_LEN);
    if (len < 2) return;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.6;
    for (let j = head - len; j < head; j++) {
      const age = head - j;
      const k = (1 - age / len) * (1 - r.fade);
      if (k <= 0.03) continue;
      const x0 = pts[j * 2], y0 = pts[j * 2 + 1], x1 = pts[j * 2 + 2], y1 = pts[j * 2 + 3];
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
      const w0 = Math.sin(j * 0.22 + this.time * 2.5) * Math.min(5, age * 0.08), w1 = Math.sin((j + 1) * 0.22 + this.time * 2.5) * Math.min(5, (age - 1) * 0.08);
      ctx.strokeStyle = `rgba(255,255,255,${0.28 * k})`;
      ctx.beginPath();
      ctx.moveTo(x0 - (dy / l) * w0, y0 + (dx / l) * w0);
      ctx.lineTo(x1 - (dy / l) * w1, y1 + (dx / l) * w1);
      ctx.stroke();
    }
  }

  // Gunbound's aim gauge: a translucent disc around the active xe, its angle range, and the barrel line.
  drawGauge(ctx, t) {
    const [lo, hi] = XE[t.xe].angle;
    const px = t.dx, py = t.dy - PIVOT, R0 = 70;
    const mine = t === this.me && this.isMyTurn();
    // the gauge turns with the body: arc, ticks and needle are body angles leaned by the slope (Gunbound)
    const ang = mine ? this.angle : t.angle;
    const lean = ang - worldAngle(this.mask, t, ang);
    const toWorld = a => (t.facing === 1 ? -(a - lean) : -(180 - (a - lean))) * (Math.PI / 180);
    ctx.save();
    ctx.fillStyle = 'rgba(10,20,40,0.28)';
    ctx.beginPath(); ctx.arc(px, py, R0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.moveTo(px, py);
    if (t.facing === 1) ctx.arc(px, py, R0, toWorld(hi), toWorld(lo)); else ctx.arc(px, py, R0, toWorld(lo), toWorld(hi));
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    for (let a = 0; a <= 90; a += 10) {
      const w = toWorld(a);
      ctx.beginPath(); ctx.moveTo(px + Math.cos(w) * (R0 - 6), py + Math.sin(w) * (R0 - 6)); ctx.lineTo(px + Math.cos(w) * R0, py + Math.sin(w) * R0); ctx.stroke();
    }
    if (this.lastAngle !== undefined && mine) {
      const w = toWorld(this.lastAngle);
      ctx.strokeStyle = 'rgba(111,224,255,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px + Math.cos(w) * (R0 - 14), py + Math.sin(w) * (R0 - 14)); ctx.lineTo(px + Math.cos(w) * (R0 + 4), py + Math.sin(w) * (R0 + 4)); ctx.stroke();
    }
    const w = toWorld(ang);
    ctx.strokeStyle = mine ? '#ffe14a' : '#ff4a4a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(px + Math.cos(w) * 18, py + Math.sin(w) * 18); ctx.lineTo(px + Math.cos(w) * (R0 + 8), py + Math.sin(w) * (R0 + 8)); ctx.stroke();
    // angle badge over the xe
    const bx = px, by = t.dy - 100;
    ctx.fillStyle = '#1d5cc4'; ctx.strokeStyle = '#d8ecff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(bx - 17, by - 12, 34, 22, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = "900 13px Orbitron, sans-serif"; ctx.textAlign = 'center';
    // Gunbound shows the real launch angle (it can go negative on a downhill slope)
    ctx.fillText(String(Math.round(ang - lean)), bx, by + 4);
    ctx.restore();
  }

  bubble(pid, text) {
    const t = this.tanks?.find(x => x.pid === pid);
    if (t) t.bubble = { text: text.slice(0, 60), until: this.time + 4.5 };
  }

  drawBubble(ctx, t) {
    if (!t.bubble || this.time > t.bubble.until || !t.alive) return;
    ctx.font = "700 14px 'Baloo 2', sans-serif";
    const words = t.bubble.text.split(' '), lines = [''];
    for (const w of words) { const l = lines[lines.length - 1]; if (ctx.measureText(l + ' ' + w).width > 170 && l) lines.push(w); else lines[lines.length - 1] = l ? l + ' ' + w : w; }
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 18, h = lines.length * 18 + 10;
    const x = t.dx - w / 2, y = t.dy - 130 - h;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(t.dx - 6, y + h); ctx.lineTo(t.dx, y + h + 9); ctx.lineTo(t.dx + 6, y + h); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center';
    lines.forEach((l, i) => ctx.fillText(l, t.dx, y + 19 + i * 18));
  }

  drawAimGuide(ctx) {
    const t = this.me;
    const [lo, hi] = XE[t.xe].angle;
    const px = t.dx, py = t.dy - PIVOT;
    const toWorld = a => (t.facing === 1 ? -a : -(180 - a)) * (Math.PI / 180);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px, py);
    if (t.facing === 1) ctx.arc(px, py, 72, toWorld(hi), toWorld(lo));
    else ctx.arc(px, py, 72, toWorld(lo), toWorld(hi));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    const a = toWorld(this.angle);
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = '#ffe16a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * 104, py + Math.sin(a) * 104); ctx.stroke();
    ctx.setLineDash([]);
  }

  drawMinimap() {
    const m = this.mctx, mw = 240, mh = 110;
    m.clearRect(0, 0, mw, mh);
    const th = THEMES[this.map];
    m.fillStyle = th.sky[1] + '66'; m.fillRect(0, 0, mw, mh);
    m.drawImage(this.terrain, 0, this.terrain.pad || 0, W, H, 0, 0, mw, mh);
    const sx = mw / W, sy = mh / H;
    m.fillStyle = th.water[0]; m.fillRect(0, this.waterY * sy, mw, mh);
    for (const t of this.tanks) {
      if (!t.alive || this.hiddenFromMe(t)) continue;
      m.fillStyle = TEAM_COLORS[t.team];
      m.beginPath(); m.arc(t.dx * sx, (t.dy - 10) * sy, t === this.me ? 4 : 3, 0, Math.PI * 2); m.fill();
      if (t.id === this.activeId) { m.strokeStyle = '#ffcf3a'; m.lineWidth = 2; m.stroke(); }
    }
    const wa = this.weather?.active;
    if (wa && wa.type !== 'clear') { m.fillStyle = wa.type === 'tornado' ? 'rgba(220,230,245,0.55)' : 'rgba(170,150,255,0.55)'; m.fillRect(wa.x * sx - 5, 0, 10, mh); }
    m.fillStyle = '#fff';
    for (const p of this.projs || []) { m.fillRect(p.x * sx - 1.5, p.y * sy - 1.5, 3, 3); }
    m.strokeStyle = 'rgba(255,255,255,0.7)'; m.lineWidth = 1;
    m.strokeRect(this.cam.x * sx, this.cam.y * sy, this.viewW() * sx, this.viewH() * sy);
  }

  // ---------- HUD ----------

  set(key, el, prop, val) {
    if (this.hudCache[key] === val) return;
    this.hudCache[key] = val;
    if (prop === 'text') el.textContent = val;
    else if (prop === 'width') el.style.width = val;
    else if (prop === 'left') el.style.left = val;
  }

  setupHud() {
    this.hudCache = {};
    const me = this.me;
    const portrait = $('me-portrait');
    if (me) {
      drawPortrait(portrait, me.xe, me.team, 40, me.hair, me.gender);
      $('me-name').textContent = `${me.name} · ${XE[me.xe].name}`;
      const btns = $('shots').querySelectorAll('[data-shot]');
      btns.forEach(b => { b.querySelector('span').textContent = XE[me.xe].shots[b.dataset.shot].name; });
      // the xe's passive, read-only, with its description on hover
      const x = XE[me.xe];
      $('me-passive').textContent = x.passive ? `✦ ${x.passiveName}` : '';
      this.bindTips();
    } else {
      portrait.getContext('2d').clearRect(0, 0, portrait.width, portrait.height);
      $('me-name').textContent = 'Khán giả';
    }
    $('shots').style.visibility = me ? 'visible' : 'hidden';
    const goldEl = $('me-gold').parentElement;
    goldEl.querySelector('img.ico')?.remove();
    if (iconUrl('gold')) goldEl.insertAdjacentHTML('afterbegin', `<img class="ico" src="${iconUrl('gold')}" alt=""> `);
    $('items').innerHTML = ITEM_IDS.map(id => `<button data-item="${id}"><span class="k">${ITEMS[id].key}</span>${iconUrl(id) ? `<img src="${iconUrl(id)}" alt="">` : ITEMS[id].icon}<span class="c">${ITEMS[id].cost}</span></button>`).join('');
    for (const b of $('items').querySelectorAll('[data-item]')) b.onclick = () => this.useItem(b.dataset.item);
    this.refreshItems();
    this.renderTurnOrder();
    this.refreshShots();
    this.drawDial();
  }

  refreshShots() {
    const me = this.me;
    for (const b of $('shots').querySelectorAll('[data-shot]')) {
      b.classList.toggle('sel', b.dataset.shot === this.selShot);
      b.disabled = b.dataset.shot === 'ss' && !this.ssOk();
      // SS: ready, or 🔒 with the number of own turns until it unlocks (Gunbound cooldown)
      if (b.dataset.shot === 'ss') {
        b.querySelector('b').textContent = me && !me.ssReady ? (me.ssCd > 0 ? `🔒${me.ssCd}` : '🔒') : 'SS';
      }
    }
  }

  renderTurnOrder() {
    const el = $('turn-order');
    const list = [...this.tanks].sort((a, b) => (a.alive !== b.alive ? (a.alive ? -1 : 1) : a.delay - b.delay || a.order - b.order));
    el.innerHTML = '<div class="to-title">THỨ TỰ LƯỢT</div>' + list.map((t, i) =>
      `<div class="to-row ${t.id === this.activeId ? 'active' : ''} ${t.alive ? '' : 'dead'}"><div class="idx">${i}</div><div class="dot ${t.team}"></div><div class="tn">${esc(t.name)} · ${XE[t.xe].name}</div><div class="td">${t.delay}</div></div>`
    ).join('');
  }

  drawDial() {
    const c = $('angle-dial'), m = c.getContext('2d');
    m.clearRect(0, 0, c.width, c.height);
    const t = this.me;
    const cx = 55, cy = 72, r = 58;
    m.fillStyle = 'rgba(0,0,0,0.4)';
    m.beginPath(); m.arc(cx, cy, r, Math.PI, 0); m.fill();
    if (!t) return;
    const [lo, hi] = XE[t.xe].angle;
    const f = t.facing;
    const wa = a => (f === 1 ? -a : -(180 - a)) * (Math.PI / 180);
    m.fillStyle = 'rgba(255, 207, 58, 0.3)';
    m.beginPath(); m.moveTo(cx, cy);
    if (f === 1) m.arc(cx, cy, r - 4, wa(hi), wa(lo)); else m.arc(cx, cy, r - 4, wa(lo), wa(hi));
    m.closePath(); m.fill();
    m.strokeStyle = '#ffcf3a'; m.lineWidth = 3;
    const a = wa(this.isMyTurn() ? this.angle : t.angle);
    m.beginPath(); m.moveTo(cx, cy); m.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2)); m.stroke();
  }

  updateHud() {
    const me = this.me;
    const now = performance.now();
    const secs = this.activeId ? Math.max(0, Math.ceil((this.turnEndsAt - now) / 1000)) : 0;
    this.set('timer', $('timer'), 'text', String(secs));
    const showBig = !!this.activeId && !this.anim;
    this.set('bigt', $('big-timer'), 'text', showBig ? String(secs) : '');
    $('big-timer').classList.toggle('low', showBig && secs <= 5);
    $('timer').classList.toggle('low', secs <= 5 && !!this.activeId && !this.anim);
    if (this.isMyTurn() && secs <= 5 && secs !== this.lastTickSec) { this.lastTickSec = secs; this.sfx.tick(); }
    const at = this.tank(this.activeId);
    this.set('turn', $('turn-name'), 'text', at ? (at === me ? 'Lượt của bạn' : `Lượt của ${at.name}`) : '');

    const hideWind = !!(me && me.blind && this.activeId === me.id);
    const wkey = hideWind ? 'hidden' : JSON.stringify(this.wind);
    if (this.hudCache.wind !== wkey) { this.hudCache.wind = wkey; this.drawWind(hideWind); }
    // Score mode shows team lives (❤), otherwise how many xe are still standing
    for (const team of ['A', 'B']) this.set('life' + team, $('life-' + team), 'text', this.lives ? `❤${this.lives[team]}` : String(this.tanks.filter(t => t.team === team && t.alive).length));
    if (me) this.set('shotname', $('shot-name'), 'text', XE[me.xe].shots[this.selShot].name);

    if (me) {
      this.set('hp', $('me-hp'), 'width', (Math.max(0, me.hp) / me.maxHp) * 100 + '%');
      this.set('hpt', $('me-hp-txt'), 'text', `${Math.max(0, me.hp)} / ${me.maxHp}${me.maxShield ? ` · 🛡${me.shield || 0}` : ''}`);
      // SS bar: full when ready, refilling one step per own turn while it is locked
      const ssPct = me.ssReady ? 100 : me.ssCd > 0 ? (1 - me.ssCd / (SS_COOLDOWN + 1)) * 100 : 0;
      this.set('rage', $('me-rage'), 'width', ssPct + '%');
      $('me-rage').parentElement.classList.toggle('full', !!me.ssReady);
      const ssKey = `${me.ssReady}|${me.ssCd}`;
      if (this.hudCache.ssKey !== ssKey) { this.hudCache.ssKey = ssKey; this.refreshShots(); }
      this.set('ang', $('angle-val'), 'text', String(Math.round(worldAngle(this.mask, me, this.isMyTurn() ? this.angle : me.angle))));
      this.set('lastang', $('last-angle'), 'text', this.lastAngle === undefined ? '--' : String(this.lastAngle));
      this.set('gold', $('me-gold'), 'text', String(me.gold || 0));
    }
    this.set('pow', $('power-fill'), 'width', this.power + '%');
    this.set('powv', $('power-val'), 'text', String(Math.round(this.power)));
    const lp = this.lastPower, pm = this.powerMark;
    this.set('powl', $('power-last'), 'left', lp === undefined ? '-10px' : `calc(${lp}% - 1px)`);
    this.set('powm', $('power-mark'), 'left', pm === undefined ? '-20px' : `calc(${pm}% - 6px)`);
    const budget = me ? XE[me.xe].rating.coDong * 24 : 1;
    this.set('move', $('move-fill'), 'width', (me && this.activeId === me.id ? (this.moveLeft / budget) * 100 : 100) + '%');
    $('hud-bottom').classList.toggle('waiting', !this.isMyTurn());
  }

  // Gunbound-style round wind gauge: arrow points where the wind blows, number is its strength.
  drawWind(hidden) {
    const c = $('wind-dial'), m = c.getContext('2d');
    const cx = 46, cy = 46;
    m.clearRect(0, 0, 92, 92);
    const g = m.createRadialGradient(cx, cy - 10, 5, cx, cy, 44);
    g.addColorStop(0, '#4a90f0'); g.addColorStop(1, '#0e347e');
    m.fillStyle = g; m.beginPath(); m.arc(cx, cy, 43, 0, Math.PI * 2); m.fill();
    m.lineWidth = 4; m.strokeStyle = '#9cd0ff'; m.stroke();
    m.lineWidth = 2; m.strokeStyle = '#061a44'; m.beginPath(); m.arc(cx, cy, 45, 0, Math.PI * 2); m.stroke();
    m.strokeStyle = 'rgba(255,255,255,0.5)'; m.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; m.beginPath(); m.moveTo(cx + Math.cos(a) * 34, cy + Math.sin(a) * 34); m.lineTo(cx + Math.cos(a) * 39, cy + Math.sin(a) * 39); m.stroke(); }
    m.textAlign = 'center';
    if (hidden) {
      m.fillStyle = '#b765d8'; m.font = "900 30px Orbitron, sans-serif"; m.fillText('?', cx, cy + 11);
      return;
    }
    const w = typeof this.wind === 'number' ? { s: Math.abs(this.wind), a: this.wind < 0 ? 180 : 0 } : this.wind || { s: 0, a: 0 };
    if (w.s) {
      // arrow points the way the wind blows, any direction
      m.save(); m.translate(cx, cy); m.rotate((-w.a * Math.PI) / 180);
      m.fillStyle = '#ff3a2a'; m.strokeStyle = '#3a0000'; m.lineWidth = 2;
      m.beginPath(); m.moveTo(41, 0); m.lineTo(24, -10); m.lineTo(28, 0); m.lineTo(24, 10); m.closePath(); m.fill(); m.stroke();
      m.fillStyle = 'rgba(255,200,180,0.35)';
      m.beginPath(); m.moveTo(24, -6); m.lineTo(-30, -2); m.lineTo(-30, 2); m.lineTo(24, 6); m.closePath(); m.fill();
      m.restore();
    }
    m.fillStyle = '#ffe14a'; m.font = "900 30px Orbitron, sans-serif";
    m.lineWidth = 4; m.strokeStyle = '#3a2000';
    m.strokeText(String(w.s), cx, cy + 11); m.fillText(String(w.s), cx, cy + 11);
    m.fillStyle = '#d8ecff'; m.font = "800 10px 'Baloo 2', sans-serif"; m.fillText('GIÓ', cx, cy - 20);
  }

  banner(text, ss = false) {
    const b = $('banner');
    b.textContent = text;
    b.className = 'banner' + (ss ? ' ss' : '');
    void b.offsetWidth;
    b.classList.add('show');
  }

  showResult(res) {
    const myTeam = this.me?.team;
    const title = $('result-title');
    if (!res.winner) { title.textContent = 'HÒA!'; title.className = 'result-title win'; }
    else if (!myTeam) { title.textContent = `${TEAM_NAME[res.winner].toUpperCase()} THẮNG!`; title.className = 'result-title win'; }
    else if (res.winner === myTeam) { title.textContent = 'CHIẾN THẮNG!'; title.className = 'result-title win'; }
    else { title.textContent = 'THẤT BẠI'; title.className = 'result-title lose'; }
    $('result-sub').textContent = res.winner ? `${TEAM_NAME[res.winner]} chiến thắng${res.forfeit ? ' (đối thủ bỏ cuộc)' : ''}` : 'Cả hai đội đều bị hạ';
    // a match that doesn't count for GP says why (practice, bots only, too short, forfeit…)
    $('result-note').textContent = res.unranked ? `⚠ ${res.unranked}` : '';
    $('result-note').style.display = res.unranked ? '' : 'none';
    const me = res.players.find(p => this.me && p.id === this.me.id);
    if (!res.unranked && me && me.gpGain == null) { $('result-note').textContent = '⚠ Bạn không được tính điểm trận này (rời trận hoặc chưa bắn phát nào)'; $('result-note').style.display = ''; }
    const rows = [...res.players].sort((a, b) => a.team.localeCompare(b.team) || b.dealt - a.dealt);
    $('result-body').innerHTML = rows.map(p =>
      `<tr class="${p.team} ${p.id === res.mvp ? 'mvp' : ''}"><td>${p.rankId ? `<img class="ico" src="${rankIcon(p.rankId)}" alt="" title="${p.rankName}"> ` : ''}${esc(p.name)}</td><td>${XE[p.xe].name}</td><td>${p.dealt}</td><td>${p.kills}</td><td>${p.deaths || 0}</td><td>${p.gold || 0} G</td><td>${p.gpGain != null ? `+${p.gpGain}` : '—'}</td><td>${p.alive ? 'Còn sống' : 'Bị hạ'}</td></tr>`
    ).join('');
    // Lên hạng! (my own rank-up gets the big badge; everyone else's is a chat line)
    const ups = res.players.filter(p => p.rankUp);
    const mine = ups.find(p => this.me && p.id === this.me.id);
    $('rank-up').innerHTML = mine ? `<img src="${rankIcon(mine.rankUp.id)}" alt=""><span>LÊN HẠNG: ${mine.rankUp.to}!</span>` : '';
    for (const p of ups) this.onSys(`🏅 ${p.name} lên hạng ${p.rankUp.to}!`);
    const mvp = res.players.find(p => p.id === res.mvp);
    const card = $('mvp-card');
    card.style.display = mvp ? '' : 'none';
    if (mvp) {
      const t = this.tank(mvp.id);
      drawPortrait(card.querySelector('canvas'), mvp.xe, mvp.team, 40, undefined, t?.gender);
      card.querySelector('.mv-name').textContent = mvp.name;
      card.querySelector('.mv-stats').textContent = `${XE[mvp.xe].name} · ${mvp.dealt} sát thương · ${mvp.kills} hạ gục · ${mvp.gold || 0} G`;
    }
    $('result').classList.add('show');
    if (res.winner && res.winner === myTeam) this.sfx.ss();
  }
}

// Damage line for shot cards and tooltips, in the words of each mechanic (not a bare number that can be 0)
export function shotDmgText(s) {
  if (s.minions) return `Bọ con ${(s.fan?.n || 1) * s.minions.n} × ${s.minions.dmg} + độc ${s.minions.poison.dmg} × ${s.minions.poison.turns}`;
  if (s.fan) return `Sát thương ${s.fan.n} × ${s.dmg} (xuyên xe)`;
  if (s.reborn) return `Sát thương ${s.dmg} + ${s.reborn.hops.map(h => h.dmg).join(' + ')}`;
  if (s.grow) return `Sát thương ${s.grow.dmg[0]}–${s.grow.dmg[1]} (theo thời gian bay)`;
  if (s.transform) return `Sát thương ${s.transform.short.dmg} / hoá rồng ${s.transform.full.dmg}`;
  if (s.drops) return `Sát thương ${s.dmg} + tới ${s.drops.max} giọt × ${s.drops.dmg}`;
  if (s.heal && s.dmg) return `Địch ${s.dmg} · Hồi đồng đội ${s.heal}`;
  if (s.ricochet) return `Sát thương ${s.dmg} · +${Math.round(s.ricochet.grow * 100)}% mỗi lần nảy (tối đa ${s.ricochet.max})`;
  if (s.slide) return `Sát thương ${s.dmg} · +${Math.round(s.slide.grow * 100)}% mỗi lần dội vách`;
  if (s.blizzard) return `Sát thương ${s.dmg} · Chậm lượt +${s.blizzard.chill} trong ${s.blizzard.r}px`;
  if (s.chill) return `Sát thương ${s.dmg} · Chậm lượt +${s.chill}`;
  if (s.freeze) return `Sát thương ${s.dmg} · Đóng băng 1 lượt`;
  if (s.heavy) return `Sát thương ${s.dmg} · Đạn địch nặng ×${s.heavy}`;
  if (s.moonZone) return `Sát thương ${s.dmg} · Vùng trăng ${s.moonZone.r}px`;
  if (s.moonNight) return `Sát thương ${s.dmg} · Đêm trăng 1 vòng`;
  if (s.beam?.heal) return `Sát thương ${s.dmg} · Hồi đồng đội ${s.beam.heal}`;
  return `Sát thương ${s.dmg}${s.count ? ' ×' + s.count : ''}${s.split ? ' ×' + s.split.n : ''}${s.poison ? ` + độc ${s.poison.dmg} × ${s.poison.turns}` : ''}`;
}

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
