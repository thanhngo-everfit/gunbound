// Tells the client to use Ably + these functions instead of the Node server's Socket.IO, and which Google
// OAuth client to sign in with.
import { GOOGLE_CLIENT_ID, ALLOWED_DOMAIN } from './_lib/google.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ mode: 'ably', googleClientId: GOOGLE_CLIENT_ID, domain: ALLOWED_DOMAIN, fakeGoogle: process.env.FAKE_GOOGLE === '1', fakeAbly: process.env.FAKE_ABLY === '1', ok: !!process.env.ABLY_API_KEY && !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) });
}
