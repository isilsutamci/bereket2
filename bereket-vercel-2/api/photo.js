// POST /api/photo  { entryId, image: { type, data(base64) } } → { id }   (yalnızca restoran, kendi kaydı için)
// GET  /api/photo?id=...                                     → { type, data }  (fotoğrafın sahibi ya da aynı ilçenin belediyesi)
const crypto = require('crypto');
const db = require('../lib/db');
const { send, fail, readBody, readToken, configured } = require('../lib/util');

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

module.exports = async (req, res) => {
  const missing = configured();
  if (missing.length) return fail(res, 503, 'not_configured', { missing });
  const me = readToken(req);
  if (!me) return fail(res, 401, 'session_expired');
  try {
    const acc = await db.getAccount(me.u);
    if (!acc) return fail(res, 401, 'session_expired');

    if (req.method === 'POST') {
      if (acc.role !== 'restoran') return fail(res, 403, 'forbidden');
      const b = await readBody(req);
      const entryId = String(b.entryId || '').slice(0, 40);
      const im = b.image || {};
      if (!entryId || !TYPES.includes(im.type) || typeof im.data !== 'string' || im.data.length > 600_000) return fail(res, 400, 'image_rejected');
      const id = crypto.randomBytes(8).toString('hex');
      await db.insertPhoto({ id, username: acc.username, entry_id: entryId, type: im.type, data: im.data });
      return send(res, 200, { id });
    }

    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://x');
      const id = String(url.searchParams.get('id') || '');
      const ph = id ? await db.getPhoto(id) : null;
      if (!ph) return fail(res, 404, 'not_found');
      if (ph.username !== acc.username) {
        const owner = await db.getAccount(ph.username);
        if (!(acc.role === 'belediye' && owner && owner.district_key === acc.district_key)) return fail(res, 404, 'not_found');
      }
      res.setHeader('Cache-Control', 'private, max-age=86400');
      return send(res, 200, { type: ph.type, data: ph.data });
    }

    return fail(res, 405, 'method_not_allowed');
  } catch (e) {
    console.error(e);
    return fail(res, 500, 'server_error');
  }
};
