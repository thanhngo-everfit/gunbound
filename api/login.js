// Name + 4-digit PIN login. The first login claims a name; later logins must match its PIN.
// A live session token (kept by the browser tab) skips the PIN on reload.
import { createHash, randomUUID } from 'node:crypto';
import { redis } from './_lib/redis.js';
import { handle, body } from './_lib/http.js';
import { pidOf, cleanName, cleanGender } from '../shared/ids.js';

const SESSION_SECS = 30 * 24 * 3600;
const pinHash = (name, pin) => createHash('sha256').update(`thu-chien:${name.toLowerCase()}:${pin}`).digest('hex');

export default handle(async (req, res) => {
  const { name: rawName, pin, token, gender } = body(req);
  const name = cleanName(rawName);
  if (!name) return res.json({ error: 'Vui lòng nhập tên' });
  if (token) {
    const owner = await redis('GET', `sess:${token}`);
    if (owner && owner.toLowerCase() === name.toLowerCase()) {
      await redis('EXPIRE', `sess:${token}`, SESSION_SECS);
      return res.json({ token, pid: pidOf(owner), name: owner, gender: cleanGender(gender), roomId: null });
    }
  }
  if (!/^\d{4}$/.test(String(pin || ''))) return res.json({ error: 'Mã PIN gồm 4 chữ số' });
  const key = `acct:${name.toLowerCase()}`, hash = pinHash(name, pin);
  const created = await redis('SET', key, hash, 'NX');
  if (!created && (await redis('GET', key)) !== hash) return res.json({ error: 'Tên này đã có người dùng, sai mã PIN' });
  const t = randomUUID();
  await redis('SET', `sess:${t}`, name, 'EX', SESSION_SECS);
  res.json({ token: t, pid: pidOf(name), name, gender: cleanGender(gender), roomId: null });
});
