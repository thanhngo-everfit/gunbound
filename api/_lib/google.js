// Google Sign-In: verifies the ID token from Google Identity Services (signature, audience, verified email).
// Any Google account may play (user, 2026-10-01: "tài khoản google nào cũng đc"); set ALLOWED_DOMAIN to limit it again. Same rules as the Roadmap dashboard project, with the game's own OAuth client ("Thú Chiến").
import { OAuth2Client } from 'google-auth-library';

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '447903417219-s7v9b18lmq6ppj2fmfo3m24rm53ipv9u.apps.googleusercontent.com';
export const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || '';
const domainOk = email => !ALLOWED_DOMAIN || email.toLowerCase().endsWith('@' + ALLOWED_DOMAIN);
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// → { sub, email, given } or throws with a Vietnamese message
export async function verifyGoogle(credential) {
  if (!credential || typeof credential !== 'string') throw new Error('Thiếu thông tin đăng nhập Google');
  // offline test stand-in only (tools/dev-vercel.mjs): "fake:<email>:<sub>"
  if (process.env.FAKE_GOOGLE === '1' && credential.startsWith('fake:')) {
    const [, email, sub] = credential.split(':');
    if (!domainOk(email)) throw new Error(`Chỉ tài khoản @${ALLOWED_DOMAIN} mới vào được`);
    return { sub, email, given: email.split('@')[0] };
  }
  let p;
  try { p = (await client.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID })).getPayload(); }
  catch { throw new Error('Đăng nhập Google không hợp lệ hoặc đã hết hạn, hãy thử lại'); }
  const email = (p?.email || '').toLowerCase();
  if (!p?.email_verified) throw new Error('Tài khoản Google này chưa xác minh email');
  if (!domainOk(email)) throw new Error(`Chỉ tài khoản @${ALLOWED_DOMAIN} mới vào được`);
  return { sub: p.sub, email, given: p.given_name || p.name || email.split('@')[0] };
}
