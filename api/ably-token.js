// Ably token for a logged-in player: clientId = their display name, so the room host knows who sent each command.
import Ably from 'ably';
import { handle, sessionName } from './_lib/http.js';

export default handle(async (req, res) => {
  const name = await sessionName(req.query.s);
  if (!name) return res.status(401).json({ error: 'Phiên đăng nhập đã hết, hãy đăng nhập lại' });
  const rest = new Ably.Rest({ key: process.env.ABLY_API_KEY });
  const tokenRequest = await rest.auth.createTokenRequest({ clientId: name, capability: { 'tc:*': ['publish', 'subscribe', 'presence'] }, ttl: 3600 * 1000 });
  res.setHeader('Cache-Control', 'no-store');
  res.json(tokenRequest);
});
