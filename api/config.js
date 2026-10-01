// Tells the client to use Ably + these functions instead of the Node server's Socket.IO.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ mode: 'ably', fakeAbly: process.env.FAKE_ABLY === '1', ok: !!process.env.ABLY_API_KEY && !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) });
}
