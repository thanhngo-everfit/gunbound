// Upstash Redis over its REST API (no SDK). Env vars come from the Vercel Marketplace Upstash integration.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Every key gets this prefix, so the database can be shared with another project without clashes
// (all commands used here take their key as the first argument).
const PREFIX = process.env.REDIS_PREFIX ?? 'thuchien:';

export async function redis(...cmd) {
  if (!URL_ || !TOKEN) throw new Error('Thiếu cấu hình Redis (KV_REST_API_URL / KV_REST_API_TOKEN)');
  cmd = [cmd[0], PREFIX + cmd[1], ...cmd.slice(2)];
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

// HGETALL as an object of parsed JSON values
export async function hgetallJson(key) {
  const flat = (await redis('HGETALL', key)) || [];
  const out = {};
  for (let i = 0; i < flat.length; i += 2) { try { out[flat[i]] = JSON.parse(flat[i + 1]); } catch {} }
  return out;
}
