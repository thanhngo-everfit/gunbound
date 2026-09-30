import { XE, XE_LIST, PICKABLE, LEGENDARY, LEGEND_CHANCE, LEGEND_CHANCE_ROOM } from '/shared/xe.js';
import { MAPS } from '/shared/physics.js';
import { drawPortrait, hairFor } from './art.js';
import { Sfx } from './fx.js';
import { Game, esc, shotDmgText } from './game.js';
import { loadAssets, ASSETS, xeSprite, drawSmooth, iconUrl, rankIcon } from './assets.js';
import { RANK_LIST, DRAGON_MIN_GAMES } from '/shared/ranks.js';

const $ = id => document.getElementById(id);
const socket = io();
const sfx = new Sfx();
// Name is remembered per browser; the reconnect token is per tab so two tabs are two players.
const storage = k => (k === 'tc-token' ? sessionStorage : localStorage);
const store = {
  get: k => { try { return storage(k).getItem(k); } catch { return null; } },
  set: (k, v) => { try { storage(k).setItem(k, v); } catch {} },
};

let me = null;      // { token, pid, name }
let room = null;    // latest room view
let game = null;
let viewXe = null;  // xe shown in the detail panel

// Painted sprites load in the background; redraw the room's portraits once they're ready.
loadAssets().then(assets => {
  // pilot faces on the login picker
  for (const cv of document.querySelectorAll('#login-gender canvas')) {
    const p = assets.pilot[cv.parentElement.dataset.g];
    if (!p) continue;
    const ctx = cv.getContext('2d'), k = cv.height / (p.height * 0.62);
    ctx.drawImage(p, (cv.width - p.width * k) / 2, 2, p.width * k, p.height * k);
  }
  drawPortrait($('logo-xe'), 'rong', 'A', 40, undefined, gender);
  renderMe();
  renderRooms();
  if (room) { buildXeGrid(); renderRoom(); }
});

// ---------- lobby: my card ----------
let lobbyData = { rooms: [], online: 0, leaderboard: [] };
function renderMe() {
  if (!me) return;
  $('mp-name').textContent = me.name;
  const pr = lobbyData.me || lobbyData.leaderboard.find(p => p.name === me.name);
  const rank = pr ? pr.rank : 'Gà Con', rankId = pr?.rankId || 'chick', gp = pr?.gp || 0, next = pr?.next;
  const prevGp = RANK_LIST.filter(r => r.gp != null && r.gp <= gp).at(-1)?.gp || 0;
  const pct = next ? Math.round(((gp - prevGp) / (next.gp - prevGp)) * 100) : 100;
  $('mp-rank').innerHTML = `<button class="rank-chip" id="rank-open" title="Xem bảng hạng"><img class="ico big" src="${rankIcon(rankId)}" alt=""><span>${rank}</span></button>
    <div class="gp-bar" title="${next ? `Còn ${next.gp - gp} GP để lên ${next.rank}` : 'Bậc cao nhất theo GP'}"><i style="width:${pct}%"></i><b>${gp} GP${next ? ` / ${next.gp}` : ''}</b></div>`;
  $('rank-open').onclick = openRanks;
  $('mp-games').textContent = pr ? pr.games : 0;
  $('mp-rate').textContent = (pr ? pr.winRate : 0) + '%';
  $('mp-gold').innerHTML = `${iconUrl('gold') ? `<img class="ico" src="${iconUrl('gold')}" alt="">` : ''}${pr ? pr.gold : 0}`;
  const cv = $('me-card-pilot'), ctx = cv.getContext('2d'), pilot = ASSETS.pilot[gender];
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (pilot) {
    const k = (cv.height * 0.95) / pilot.height;
    drawSmooth(ctx, pilot, (cv.width - pilot.width * k) / 2, cv.height - pilot.height * k, pilot.width * k, pilot.height * k);
  }
}

// Empty lobby: a parade of xe instead of a blank panel.
function drawParade(cv) {
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  const ids = XE_LIST.map(x => x.id);
  const step = cv.width / ids.length;
  ids.forEach((id, i) => {
    const sp = xeSprite(id, null);
    if (!sp) return;
    const k = Math.min((step * 1.25) / sp.width, (cv.height * 0.9) / sp.height);
    drawSmooth(ctx, sp, i * step + (step - sp.width * k) / 2, cv.height - sp.height * k, sp.width * k, sp.height * k);
  });
}

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === id);
}

// ---------- pilot gender ----------

const PILOTS = ['m', 'f', 'm2', 'f2'];
let gender = PILOTS.includes(store.get('tc-gender')) ? store.get('tc-gender') : 'm';
function renderGender() {
  for (const b of document.querySelectorAll('.gender-pick [data-g]')) b.classList.toggle('on', b.dataset.g === gender);
}
for (const b of document.querySelectorAll('.gender-pick [data-g]')) {
  b.onclick = () => {
    gender = b.dataset.g;
    store.set('tc-gender', gender);
    renderGender();
    drawPortrait($('logo-xe'), 'rong', 'A', 40, undefined, gender);
    renderMe();
    if (me) { socket.emit('player:gender', { gender }); buildXeGrid(); renderRoom(); }
  };
}
renderGender();

// ---------- login ----------

$('login-name').value = store.get('tc-name') || '';
$('login-pin').value = store.get('tc-pin') || '';
$('login-form').onsubmit = e => {
  e.preventDefault();
  sfx.ensure();
  hello($('login-name').value, $('login-pin').value.trim());
};

function hello(name, pin = store.get('tc-pin')) {
  socket.emit('hello', { name, pin, gender, token: store.get('tc-token') }, res => {
    if (res.error) { $('login-error').textContent = res.error; show('screen-login'); return; }
    me = res;
    store.set('tc-token', res.token);
    store.set('tc-name', res.name);
    if (pin) store.set('tc-pin', pin);
    $('lobby-me').textContent = '👤 ' + res.name;
    renderMe();
    socket.emit('lobby:get');
    if (!res.roomId) show('screen-lobby');
  });
}

socket.on('connect', () => {
  // Auto-reconnect after a network drop or page reload.
  const name = store.get('tc-name');
  if (me || (name && store.get('tc-token'))) hello(me ? me.name : name);
});

// ---------- lobby ----------

socket.on('lobby', data => {
  // broadcasts don't carry "me"; keep the last profile we were sent
  lobbyData = { leaderboard: [], ...data, me: data.me || lobbyData.me };
  renderRooms();
  renderMe();
});

function renderRooms() {
  const { rooms, online, leaderboard } = lobbyData;
  $('lobby-online').textContent = `🟢 ${online} người online`;
  $('leaderboard').innerHTML = leaderboard.length
    ? leaderboard.map((p, i) => `<div class="lb-row"><span class="n">${i + 1}</span><span><img class="ico" src="${rankIcon(p.rankId)}" alt="" title="${p.rank}"> ${esc(p.name)} <span class="r">${p.rank}</span></span><span class="r">${p.gp} GP</span><span class="w">${p.winRate}%</span></div>`).join('')
    : '<div class="empty" style="padding:8px">Chưa có trận nào được ghi nhận.</div>';
  const list = $('room-list');
  if (!rooms.length) {
    list.innerHTML = `<div class="empty-state"><canvas width="1520" height="380"></canvas><div class="es-title stroke">Chưa có phòng nào</div><div class="es-sub">Tạo phòng mới để rủ đồng nghiệp, hoặc vào Luyện tập để làm quen tay.</div>
      <div class="es-cta"><button class="btn gold big" id="es-create">TẠO PHÒNG</button><button class="btn practice-btn big" id="es-practice">🎯 LUYỆN TẬP</button></div></div>`;
    drawParade(list.querySelector('canvas'));
    $('es-create').onclick = () => $('create-form').requestSubmit();
    $('es-practice').onclick = () => $('practice-btn').click();
    return;
  }
  list.innerHTML = rooms.map(r => {
    const map = r.map === 'random' ? 'dong-co' : r.map;
    const pill = r.practice ? '<span class="pill practice">🎯 Luyện tập</span>' : r.state === 'playing' ? '<span class="pill playing">⚔ Đang chơi · xem</span>' : '<span class="pill waiting">● Đang chờ</span>';
    return `<div class="room-card" data-id="${r.id}">
      <div class="thumb" style="background-image:url('/assets/maps/bg-${map}.jpg')"></div>
      <div><div class="rname">#${r.id} ${esc(r.name)}</div>
        <div class="rmeta"><span>👑 ${esc(r.host)}</span><span>🗺 ${r.map === 'random' ? 'Ngẫu nhiên' : MAPS[r.map].name}</span><span>${r.count}/${r.max} người</span></div>
        <span class="count"><i style="width:${(r.count / r.max) * 100}%"></i></span></div>
      ${pill}
    </div>`;
  }).join('');
  for (const c of list.querySelectorAll('.room-card')) {
    c.onclick = () => socket.emit('room:join', { id: c.dataset.id }, res => { if (res.error) alert(res.error); });
  }
}

$('howto-open').onclick = () => $('howto-modal').classList.add('show');
// Bảng hạng: the whole ladder with icons, like Gunbound M's "Thông tin Level"
function openRanks() {
  const mine = lobbyData.me?.rankId || 'chick';
  const rows = [...RANK_LIST].reverse().map(r => `<div class="rk-row ${r.id === mine ? 'me' : ''}"><img src="${rankIcon(r.id)}" alt=""><b>${r.name}</b><span>${r.gp != null ? `${r.gp}+ GP` : `${r.top === 1 ? 'Hạng 1' : `Top ${r.top}`} bảng xếp hạng (≥ ${DRAGON_MIN_GAMES} trận)`}</span></div>`).join('');
  $('ranks-list').innerHTML = rows;
  $('ranks-modal').classList.add('show');
}
$('ranks-close').onclick = () => $('ranks-modal').classList.remove('show');
$('howto-close').onclick = () => $('howto-modal').classList.remove('show');

$('practice-btn').onclick = () => socket.emit('room:create', { practice: true }, res => { if (res.error) alert(res.error); });
$('create-form').onsubmit = e => {
  e.preventDefault();
  socket.emit('room:create', { name: $('create-name').value }, res => { if (res.error) alert(res.error); });
};

// ---------- room ----------

const mapSel = $('room-map');
mapSel.innerHTML = Object.entries(MAPS).map(([id, m]) => `<option value="${id}">${m.name}</option>`).join('') + '<option value="random">Ngẫu nhiên</option>';
mapSel.onchange = () => socket.emit('room:map', { map: mapSel.value });
$('room-turn').onchange = () => socket.emit('room:settings', { turnSec: $('room-turn').value });
$('room-sudden').onchange = () => socket.emit('room:settings', { sudden: $('room-sudden').value });
$('room-xemode').onchange = () => socket.emit('room:settings', { xeMode: $('room-xemode').value });
$('room-mode').onchange = () => socket.emit('room:settings', { mode: $('room-mode').value });
$('room-sudden-type').onchange = () => socket.emit('room:settings', { suddenType: $('room-sudden-type').value });

for (const b of document.querySelectorAll('button[data-team]')) b.onclick = () => socket.emit('room:team', { team: b.dataset.team });
for (const b of document.querySelectorAll('[data-bot]')) b.onclick = () => socket.emit('room:addBot', { team: b.dataset.bot });
function leaveRoom() {
  socket.emit('room:leave');
  room = null;
  endGame();
  show('screen-lobby');
  socket.emit('lobby:get');
}
$('room-leave').onclick = leaveRoom;

$('room-ready').onclick = () => {
  const mine = myMember();
  if (!mine) return;
  if (isHost()) socket.emit('room:start', null, res => { $('room-error').textContent = res?.error || ''; });
  else socket.emit('room:ready', { ready: !mine.ready });
};

const myMember = () => room?.members.find(m => m.id === me?.pid);
const isHost = () => !!myMember()?.host;

// Click a player's slot: a big animated preview of the rider on their xe, with the xe's names and passive
function openRider(pid) {
  const m = room?.members.find(x => x.id === pid);
  if (!m) return;
  const xe = room.settings?.xeMode === 'random' ? 'random' : m.xe, x = XE[xe];
  $('rider-modal').classList.add('show');
  const cv = $('rider-cv');
  drawXeOrRandom(cv, xe, m.team, hairFor(m.name), m.gender);
  animate(cv, xe, m.team, hairFor(m.name), m.gender, 0.5);
  $('rider-info').innerHTML = `<div class="rd-name ${m.team}">${esc(m.name)}${m.bot ? ' 🤖' : ''}</div>` +
    (m.profile ? `<div class="rd-rank"><img class="ico" src="${rankIcon(m.profile.rankId)}" alt=""> ${m.profile.rank} · ${m.profile.gp} GP</div>` : '') +
    (x ? `<div class="rd-xe">${x.name} <span>${x.title}</span>${x.legendary ? ' <b class="rd-lg">HUYỀN THOẠI</b>' : ''}</div><div class="rd-role">${x.role}</div>` +
      (x.passive ? `<div class="rd-passive">✦ <b>${x.passiveName}:</b> ${x.passiveDesc}</div>` : '')
      : `<div class="rd-xe">Xe Ngẫu Nhiên</div><div class="rd-role">Xe sẽ được bốc khi trận bắt đầu</div>`);
}
const closeRider = () => { $('rider-modal').classList.remove('show'); animList = animList.filter(a => a.cv.id !== 'rider-cv'); const cv = $('rider-cv'); cv.width = 560; cv.height = 420; };
$('rider-close').onclick = closeRider;
$('rider-modal').onclick = e => { if (e.target.id === 'rider-modal') closeRider(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRider(); });

let pinnedXe = null;
function buildXeGrid() {
  const grid = $('xe-grid');
  grid.innerHTML = `<div class="xe-card random" data-xe="random"><canvas width="96" height="80"></canvas><div class="xn">Ngẫu nhiên</div></div>` +
    PICKABLE().map(x => `<div class="xe-card" data-xe="${x.id}"><canvas width="96" height="80"></canvas><div class="xn">${x.name}</div></div>`).join('') +
    // legendary xe: shown so people can read them, but only the dice can hand one out
    LEGENDARY().map(x => `<div class="xe-card legend" data-xe="${x.id}" title="Huyền thoại: chỉ có khi Ngẫu nhiên"><div class="lg-tag">🎲</div><canvas width="96" height="80"></canvas><div class="xn">${x.name}</div></div>`).join('');
  grid.querySelectorAll('.xe-card').forEach((card, i) => {
    drawXeOrRandom(card.querySelector('canvas'), card.dataset.xe, 'A');
    // a legendary card can't be picked; clicking it keeps its details open to read instead
    card.onclick = () => { const lg = card.classList.contains('legend') && !room?.practice; if (!lg) socket.emit('room:xe', { xe: card.dataset.xe }); pinnedXe = lg ? card.dataset.xe : null; viewXe = card.dataset.xe; renderDetail(); };
    card.onmouseenter = () => { viewXe = card.dataset.xe; renderDetail(); };
    card.onmouseleave = () => { viewXe = pinnedXe || myMember()?.xe; renderDetail(); };
  });
}

// Room animation: only the rider-on-xe pictures in the team slots play their animal's signature effect;
// the xe cards and the detail picture stay still.
// Canvases register here on each render; the loop redraws them ~30 times a second while the room is shown.
let animList = [];
function animate(cv, xe, team, hair, gender, seed) { animList = animList.filter(a => a.cv !== cv); animList.push({ cv, xe, team, hair, gender, seed }); }
let animLast = 0;
function roomLoop(now) {
  requestAnimationFrame(roomLoop);
  if (now - animLast < 33 || !$('screen-room').classList.contains('active') || game) return;
  animLast = now;
  const t = now / 1000;
  animList = animList.filter(a => a.cv.isConnected);
  // only canvases actually on screen (a closed pop-up or hidden panel costs nothing)
  for (const a of animList) if (!a.cv.clientWidth) a.skip = true; else a.skip = false;
  for (const a of animList) {
    if (a.skip) continue;
    // no bouncing: only the animal's own signature effect plays over the static picture
    drawXeOrRandom(a.cv, a.xe, a.team, a.hair, a.gender, null, t + a.seed);
  }
}
requestAnimationFrame(roomLoop);

// the "?" mystery box stands in for a xe that will be rolled at match start
function drawXeOrRandom(cv, xe, team, hair, gender = null, pose = null, fxT = null) {
  if (xe !== 'random') return drawPortrait(cv, xe, team, 40, hair, gender, pose, fxT);
  const dpr = window.devicePixelRatio || 1;
  // hidden canvases keep their size (resizing from cv.width × dpr doubled them every frame)
  if (cv.clientWidth) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); }
  const c = cv.getContext('2d'), img = ASSETS.icons['r-random'];
  c.clearRect(0, 0, cv.width, cv.height);
  if (!img) { c.font = `bold ${cv.height * 0.7}px sans-serif`; c.textAlign = 'center'; c.fillStyle = '#ffd23a'; c.fillText('?', cv.width / 2, cv.height * 0.8); return; }
  const k = (cv.height * (pose ? 0.7 : 0.8)) / Math.max(img.width, img.height), u = cv.height / 100;
  c.save();
  c.translate(cv.width / 2, cv.height / 2 + (pose?.dy || 0) * u);
  c.rotate((pose?.rot || 0) * 3);
  c.scale(pose?.sx || 1, pose?.sy || 1);
  drawSmooth(c, img, -img.width * k / 2, -img.height * k / 2, img.width * k, img.height * k);
  c.restore();
}

function renderDetail() {
  const pick = viewXe || myMember()?.xe || 'rong';
  if (pick === 'random' || room?.settings?.xeMode === 'random') {
    const all = room?.settings?.xeMode === 'random';
    $('xe-detail').innerHTML = `<div><canvas class="xd-art" width="240" height="170"></canvas><div class="xd-name">Xe Ngẫu Nhiên</div>
      <div class="xd-role">${all ? 'Chủ phòng bật: cả phòng nhận xe ngẫu nhiên' : 'Hệ thống chọn xe khi trận bắt đầu'}</div>
      <div class="xd-desc">Không biết mình sẽ lái con gì cho tới màn hình tải trận. Hệ thống cố gắng không chia trùng xe trong cùng một trận. Liều một phen xem vận may hôm nay thế nào!</div>
      <div class="xd-legend">🎲 ${Math.round((all ? LEGEND_CHANCE_ROOM : LEGEND_CHANCE) * 100)}% cơ hội nhận xe HUYỀN THOẠI: ${LEGENDARY().map(x => x.name).join(', ')}. Mạnh hơn xe thường và không ai chọn được!</div></div>
      <div class="xd-shots"><div class="passive">🎲 <b>Mẹo:</b> Luyện tập vài xe trước để xe nào rơi vào tay cũng bắn được.</div></div>`;
    drawXeOrRandom($('xe-detail').querySelector('.xd-art'), 'random', 'A');
    return;
  }
  const x = XE[pick];
  const stat = (label, v, cls = '') => `<div class="stat ${cls}"><span>${label}</span><div class="sb"><i style="width:${v * 10}%"></i></div><b>${v}</b></div>`;
  const shot = (key, label) => {
    const s = x.shots[key];
    return `<div class="shot-card ${key === 'ss' ? 'ss' : ''}" data-shot="${key}"><canvas width="116" height="116"></canvas><div class="sk">${label}</div><div class="sn">${s.name}</div><div class="sd">${s.desc}</div><div class="sm">${shotDmgText(s)} · Delay ${s.delay}</div></div>`;
  };
  $('xe-detail').innerHTML = `
    <div>
      <canvas class="xd-art" width="240" height="170"></canvas>
      <div class="xd-name">${x.name}</div>
      <div class="xd-title">${x.title || ''}</div>
      ${x.legendary && room?.practice ? `<div class="xd-legend">🎲 HUYỀN THOẠI · phòng luyện tập nên chọn thoải mái. Trận thật chỉ có khi Ngẫu nhiên.</div>` : ''}
      ${x.legendary && !room?.practice ? `<div class="xd-legend">🎲 HUYỀN THOẠI · không chọn được. Chỉ rơi vào tay bạn khi chọn Ngẫu nhiên (${Math.round(LEGEND_CHANCE * 100)}%) hoặc khi cả phòng Ngẫu nhiên (${Math.round(LEGEND_CHANCE_ROOM * 100)}%).</div>` : ''}
      <div class="xd-role">${x.role} · Góc ${x.angle[0]}°–${x.angle[1]}°</div>
      <div class="xd-desc">${x.desc}</div>
      ${stat('Công phá', x.rating.congPha)}
      ${stat('Độ bền', x.rating.doBen, 'def')}
      ${stat('Cơ động', x.rating.coDong, 'mov')}
      <div class="xd-role" style="margin-top:6px">Máu ${x.hp}${x.shield ? ` + giáp ảo ${x.shield.max}` : ''} · Giáp ${Math.round(x.armor * 100)}% · Chịu gió ${x.windMul}×</div>
    </div>
    <div class="xd-shots">
      ${shot('s1', 'SHOT 1')}${shot('s2', 'SHOT 2')}${shot('ss', 'SPECIAL SHOT')}
      ${x.passive ? `<div class="passive">${x.passive === 'shield' ? '🛡' : '🔥'} <b>Nội tại – ${x.passiveName}:</b> ${x.passiveDesc}</div>` : ''}
    </div>`;
  drawPortrait($('xe-detail').querySelector('.xd-art'), x.id, 'A', 40, undefined, null);
  for (const card of $('xe-detail').querySelectorAll('.shot-card[data-shot]')) {
    const img = ASSETS.proj[x.id]?.[card.dataset.shot], cv = card.querySelector('canvas');
    if (!img || !cv) continue;
    const c = cv.getContext('2d'), k = (cv.width * 0.8) / Math.max(img.width, img.height);
    c.clearRect(0, 0, cv.width, cv.height);
    drawSmooth(c, img, (cv.width - img.width * k) / 2, (cv.height - img.height * k) / 2, img.width * k, img.height * k);
  }
}

function renderRoom() {
  if (!room) return;
  $('room-title').textContent = `#${room.id} ${room.name}`;
  mapSel.value = room.map;
  mapSel.disabled = !isHost();
  $('room-turn').value = String(room.settings?.turnSec || 20);
  $('room-sudden').value = String(room.settings?.sudden || 0);
  $('room-xemode').value = room.settings?.xeMode || 'pick';
  $('room-mode').value = room.settings?.mode || 'solo';
  $('room-sudden-type').value = room.settings?.suddenType || 'double';
  $('room-turn').disabled = $('room-sudden').disabled = $('room-xemode').disabled = $('room-mode').disabled = !isHost();
  // the sudden-death type only matters when sudden death is on; practice has no Score mode
  $('room-sudden-type').disabled = !isHost() || !room.settings?.sudden;
  $('room-mode').parentElement.style.display = room.practice ? 'none' : '';
  const allRandom = room.settings?.xeMode === 'random';
  $('xe-grid').classList.toggle('locked', allRandom);
  for (const team of ['A', 'B']) {
    const members = room.members.filter(m => m.team === team);
    const slots = [];
    for (let i = 0; i < 5; i++) {
      const m = members[i];
      if (!m) { slots.push('<div class="slot">Trống</div>'); continue; }
      slots.push(`<div class="slot filled ${m.id === me.pid ? 'me' : ''} ${m.online ? '' : 'offline'}" data-pid="${m.id}" data-xe="${m.xe}" data-team="${team}" data-name="${esc(m.name)}" data-g="${m.gender}">
        ${m.host ? '<span class="tag">👑</span>' : m.bot ? `<span class="tag">🤖</span>${isHost() ? `<button class="kick" data-kick="${m.id}" title="Xoá NPC">✕</button>` : ''}` : m.ready ? '<span class="ready">✔ SẴN SÀNG</span>' : ''}
        <canvas width="96" height="80"></canvas>
        <div class="sname">${esc(m.name)}</div><div class="sxe">${m.profile ? `<img class="ico" src="${rankIcon(m.profile.rankId)}" alt=""> ${m.profile.rank}` : XE[m.xe]?.name || 'Ngẫu nhiên'}</div></div>`);
    }
    $('slots-' + team).innerHTML = slots.join('');
  }
  for (const sl of document.querySelectorAll('.slot.filled')) {
    const m = room.members.find(x => x.id === sl.dataset.pid);
    if (m?.profile) sl.title = `${m.name} · ${m.profile.rank} (${m.profile.gp} GP)\n${XE[m.xe]?.name || 'Xe ngẫu nhiên'}\nSố trận: ${m.profile.games} · Thắng: ${m.profile.winRate}%\nSát thương TB: ${m.profile.avgDmg}${m.profile.fav ? `\nXe hay dùng: ${m.profile.fav}` : ''}`;
  }
  for (const k of document.querySelectorAll('[data-kick]')) k.onclick = e => { e.stopPropagation(); socket.emit('room:removeBot', { id: k.dataset.kick }); };
  for (const sl of document.querySelectorAll('.slot.filled')) sl.onclick = () => openRider(sl.dataset.pid);
  for (const b of document.querySelectorAll('.add-bot')) b.style.display = isHost() && room.state === 'waiting' && !room.practice ? '' : 'none';
  for (const b of document.querySelectorAll('button[data-team]')) b.style.display = room.practice ? 'none' : '';
  [...document.querySelectorAll('.slot.filled')].forEach((s, i) => {
    const xe = allRandom ? 'random' : s.dataset.xe;
    drawXeOrRandom(s.querySelector('canvas'), xe, s.dataset.team, hairFor(s.dataset.name), s.dataset.g);
    animate(s.querySelector('canvas'), xe, s.dataset.team, hairFor(s.dataset.name), s.dataset.g, i * 1.3 + 0.5);
  });
  const mine = myMember();
  for (const card of document.querySelectorAll('.xe-card')) card.classList.toggle('sel', card.dataset.xe === mine?.xe);
  const btn = $('room-ready');
  if (isHost()) {
    btn.textContent = room.practice ? '🎯 VÀO LUYỆN TẬP' : 'BẮT ĐẦU';
    btn.className = 'btn gold big';
  } else {
    btn.textContent = mine?.ready ? '✔ ĐÃ SẴN SÀNG' : 'SẴN SÀNG';
    btn.className = 'btn big ' + (mine?.ready ? 'on' : 'gold');
  }
  btn.disabled = !mine?.team || room.state !== 'waiting';
  renderDetail();
}

socket.on('room:state', r => {
  const first = !room;
  room = r;
  if (first) { buildXeGrid(); viewXe = null; clearChat(); }
  if (!game) show('screen-room');
  renderRoom();
});

// ---------- chat ----------

function clearChat() { for (const l of document.querySelectorAll('.chat-log')) l.innerHTML = ''; }
function addChatLine(html) {
  for (const log of document.querySelectorAll('.chat-log')) {
    const div = document.createElement('div');
    div.innerHTML = html;
    log.appendChild(div.firstChild);
    while (log.children.length > 80) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }
}
const addSys = (text, kind, who) => addChatLine(kind === 'bonus' ? `<div class="bonus">★ ${who ? esc(who) + ' ' : ''}${esc(text)}</div>` : `<div class="sys">★ ${esc(text)}</div>`);
socket.on('chat', ({ name, pid, team, text }) => {
  addChatLine(`<div class="msg ${team || ''}"><b>${esc(name)}:</b> ${esc(text)}</div>`);
  game?.bubble(pid, text);
});

for (const form of document.querySelectorAll('.chat-form')) {
  const input = form.querySelector('input');
  form.onsubmit = e => {
    e.preventDefault();
    if (input.value.trim()) socket.emit('chat', { text: input.value });
    input.value = '';
    if (form.parentElement.id === 'game-chat') { input.blur(); form.parentElement.classList.remove('typing'); }
  };
  input.onkeydown = e => {
    if (e.key === 'Escape') { input.value = ''; input.blur(); form.parentElement.classList.remove('typing'); }
    e.stopPropagation();
  };
}

// ---------- game ----------

socket.on('game:start', snap => {
  if (!me) return;
  if (!game) {
    game = new Game({ socket, myPid: me.pid, sfx, onSys: addSys, onQuit: leaveRoom, getProfile: pid => room?.members.find(m => m.id === pid)?.profile || null, onExit: () => { endGame(); show('screen-room'); renderRoom(); } });
    if (!snap.rejoin) addSys('Trận đấu bắt đầu! Chúc may mắn!');
  }
  show('screen-game');
  game.start(snap);
  window.__game = game; // handy for debugging in the console
});

socket.on('game:end', () => {
  // The Game shows the result screen; clicking the button returns to the waiting room.
});

function endGame() {
  if (game) { game.destroy(); game = null; }
}
