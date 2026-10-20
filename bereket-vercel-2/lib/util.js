// Ortak yardımcılar: JSON yanıt, oturum jetonu, şifre özeti.
const crypto = require('crypto');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
const fail = (res, status, error, extra) => send(res, status, { error, ...(extra || {}) });

// Vercel gövdeyi genelde ayrıştırır; ayrıştırmazsa biz okuruz.
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { return {}; }
}

const norm = s => String(s || '').trim().toLocaleLowerCase('tr');
// Hesap adı: harf, rakam ve . _ @ - (Türkçe harfler dahil), 3–60 karakter.
const USER_RE = /^[a-z0-9çğıöşü._@-]{3,60}$/;

function hashPassword(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return { salt, hash };
}
function checkPassword(pw, salt, hash) {
  const h = crypto.scryptSync(String(pw), salt, 64);
  const want = Buffer.from(hash, 'hex');
  return want.length === h.length && crypto.timingSafeEqual(h, want);
}

const secret = () => process.env.SESSION_SECRET || '';
const b64u = b => Buffer.from(b).toString('base64url');
function signToken(u, r) {
  const payload = b64u(JSON.stringify({ u, r, exp: Date.now() + 30 * 24 * 3600 * 1000 }));
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return payload + '.' + sig;
}
function readToken(req) {
  const h = req.headers['authorization'] || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [payload, sig] = tok.split('.');
  if (!payload || !sig || !secret()) return null;
  const want = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return p.exp > Date.now() ? p : null;
  } catch (e) { return null; }
}

function configured() {
  const missing = [];
  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SECRET_KEY');
  if (!process.env.SESSION_SECRET) missing.push('SESSION_SECRET');
  return missing;
}

// Uygulama verisi en fazla ~3 MB olabilir.
function validData(role, d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
  if (!d.profile || typeof d.profile !== 'object') return false;
  if (role === 'restoran' && (!Array.isArray(d.entries) || !Array.isArray(d.pickups))) return false;
  return JSON.stringify(d).length < 3_000_000;
}

module.exports = { send, fail, readBody, norm, USER_RE, hashPassword, checkPassword, signToken, readToken, configured, validData };
