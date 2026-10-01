// Google login (@everfit.io only). One Google account = one game account (name + pilot).
// POST { token }                     → resume a session (no Google round trip)
// POST { credential }                → { needName, suggest } for a new Google account, else a session
// POST { credential, name, gender }  → create the account with that (unique) name
// POST { token, gender }             → remember a new pilot choice
import { randomUUID } from 'node:crypto';
import { redis } from './_lib/redis.js';
import { handle, body } from './_lib/http.js';
import { verifyGoogle } from './_lib/google.js';
import { pidOf, cleanName, cleanGender } from '../shared/ids.js';

const SESSION_SECS = 60 * 24 * 3600;

async function session(user) {
  const t = randomUUID();
  // the session's value is the display name (what every other function needs)
  await redis('SET', `sess:${t}`, user.name, 'EX', SESSION_SECS);
  return { token: t, pid: pidOf(user.name), name: user.name, gender: cleanGender(user.gender), roomId: null };
}
const userOf = async name => {
  const sub = name && (await redis('GET', `gname:${name.toLowerCase()}`));
  const raw = sub && (await redis('GET', `guser:${sub}`));
  return raw ? { sub, ...JSON.parse(raw) } : null;
};

export default handle(async (req, res) => {
  const { token, credential, name: rawName, gender } = body(req);
  if (token && !credential) {
    const name = await redis('GET', `sess:${token}`);
    const user = await userOf(name);
    if (!user) return res.json({ error: 'Phiên đăng nhập đã hết, hãy đăng nhập lại', expired: true });
    if (gender) { user.gender = cleanGender(gender); await redis('SET', `guser:${user.sub}`, JSON.stringify({ name: user.name, gender: user.gender, email: user.email })); }
    await redis('EXPIRE', `sess:${token}`, SESSION_SECS);
    return res.json({ token, pid: pidOf(user.name), name: user.name, gender: cleanGender(user.gender), roomId: null });
  }
  let g;
  try { g = await verifyGoogle(credential); } catch (e) { return res.json({ error: e.message }); }
  const raw = await redis('GET', `guser:${g.sub}`);
  if (raw) return res.json(await session(JSON.parse(raw)));
  const name = cleanName(rawName);
  if (!name) return res.json({ needName: true, suggest: cleanName(g.given), email: g.email });
  const owner = await redis('SET', `gname:${name.toLowerCase()}`, g.sub, 'NX');
  if (!owner && (await redis('GET', `gname:${name.toLowerCase()}`)) !== g.sub) return res.json({ error: 'Tên này đã có người dùng, hãy chọn tên khác', needName: true, suggest: name });
  const user = { name, gender: cleanGender(gender), email: g.email };
  await redis('SET', `guser:${g.sub}`, JSON.stringify(user));
  res.json(await session(user));
});
