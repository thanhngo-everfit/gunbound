import { redis } from './redis.js';

// wrap a handler: JSON errors instead of crashes
export const handle = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (e) { console.error(e); res.status(500).json({ error: String(e.message || e) }); }
};
export const body = req => (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {});
// display name behind a session token (30-day sessions made by /api/login)
export async function sessionName(token) {
  if (!token || typeof token !== 'string') return null;
  return redis('GET', `sess:${token}`);
}
