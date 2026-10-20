// GET  /api/ai → { configured }
// POST /api/ai  { prompt, images: [{ type, data(base64) }] } → { text }
// Fotoğraf analizini ve eylem planını Claude API ile yapar. API anahtarı yalnızca burada, sunucuda kullanılır.
const { send, fail, readBody, readToken } = require('../lib/util');

const MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

module.exports = async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (req.method === 'GET') return send(res, 200, { configured: !!key });
  if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed');
  if (!key) return fail(res, 503, 'not_configured');
  if (!readToken(req)) return fail(res, 401, 'session_expired');

  const b = await readBody(req);
  const prompt = String(b.prompt || '');
  if (!prompt || prompt.length > 15000) return fail(res, 400, 'prompt_too_large');
  const images = Array.isArray(b.images) ? b.images.slice(0, 3) : [];
  for (const im of images) {
    if (!TYPES.includes(im?.type) || typeof im.data !== 'string' || im.data.length > 5_000_000) return fail(res, 400, 'image_rejected');
  }

  const content = [
    ...images.map(im => ({ type: 'image', source: { type: 'base64', media_type: im.type, data: im.data } })),
    { type: 'text', text: prompt }
  ];
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 55_000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL(),
        max_tokens: 2000,
        system: 'Sen Bereket uygulamasının gıda atığı analiz asistanısın. Yalnızca istenen biçimde, Türkçe yanıt ver.',
        messages: [{ role: 'user', content }]
      })
    });
    const out = await r.json().catch(() => ({}));
    if (r.status === 429 || r.status === 529) return fail(res, 429, 'rate_limited');
    if (r.status === 400 && /image/i.test(JSON.stringify(out))) return fail(res, 400, 'image_rejected');
    if (!r.ok) { console.error('anthropic', r.status, JSON.stringify(out).slice(0, 400)); return fail(res, 502, 'upstream_error'); }
    const text = (out.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    if (!text) return fail(res, 502, 'empty_completion');
    return send(res, 200, { text });
  } catch (e) {
    console.error(e);
    return fail(res, 504, e.name === 'AbortError' ? 'timeout' : 'upstream_error');
  } finally { clearTimeout(timer); }
};
