// Google Sign-In for @everfit.io accounts: verifies the ID token from Google Identity Services (signature,
// audience, verified email, Workspace domain). Same rules as the Roadmap dashboard project, with the game's own OAuth client ("Thú Chiến").
import { OAuth2Client } from 'google-auth-library';

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '447903417219-s7v9b18lmq6ppj2fmfo3m24rm53ipv9u.apps.googleusercontent.com';
export const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || 'everfit.io';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// → { sub, email, given } or throws with a Vietnamese message
export async function verifyGoogle(credential) {
  if (!credential || typeof credential !== 'string') throw new Error('Thiếu thông tin đăng nhập Google');
  // offline test stand-in only (tools/dev-vercel.mjs): "fake:<email>:<sub>"
  if (process.env.FAKE_GOOGLE === '1' && credential.startsWith('fake:')) {
    const [, email, sub] = credential.split(':');
    if (!email.toLowerCase().endsWith('@' + ALLOWED_DOMAIN)) throw new Error(`Chỉ tài khoản @${ALLOWED_DOMAIN} mới vào được`);
    return { sub, email, given: email.split('@')[0] };
  }
  let p;
  try { p = (await client.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID })).getPayload(); }
  catch { throw new Error('Đăng nhập Google không hợp lệ hoặc đã hết hạn, hãy thử lại'); }
  const email = (p?.email || '').toLowerCase();
  if (!p?.email_verified || !email.endsWith('@' + ALLOWED_DOMAIN)) throw new Error(`Chỉ tài khoản @${ALLOWED_DOMAIN} mới vào được`);
  return { sub: p.sub, email, given: p.given_name || p.name || email.split('@')[0] };
}
