// GET /api/feed → son yüklenen kayıtlar (canlı akış).
// Restoran: kendi kayıtları. Belediye: ilçesindeki restoranların kayıtları.
const db = require('../lib/db');
const { send, fail, readToken, configured } = require('../lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return fail(res, 405, 'method_not_allowed');
  const missing = configured();
  if (missing.length) return fail(res, 503, 'not_configured', { missing });
  const me = readToken(req);
  if (!me) return fail(res, 401, 'session_expired');
  try {
    const acc = await db.getAccount(me.u);
    if (!acc) return fail(res, 401, 'session_expired');
    let users = [acc.username];
    if (acc.role === 'belediye') users = (await db.accountsInDistrict(acc.district_key)).filter(a => a.role === 'restoran').map(a => a.username);
    const rows = await db.getDataMany(users);
    const feed = [];
    rows.forEach(r => {
      const d = r.data || {}, p = d.profile || {};
      (d.entries || []).forEach(e => {
        if (!e.at) return;
        feed.push({
          u: r.username, rname: p.name || r.username, id: e.id, date: e.date, meal: e.meal, at: e.at, dev: e.dev || null,
          source: e.source, summary: e.summary || '', tip: e.tip || '', photo: e.photo || null, prices: p.prices || {},
          items: (e.items || []).map(i => ({ name: i.name, main: i.main, type: i.type, kg: i.kg, src: i.src, route: i.route, conf: i.conf }))
        });
      });
    });
    feed.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return send(res, 200, { feed: feed.slice(0, 20) });
  } catch (e) {
    console.error(e);
    return fail(res, 500, 'server_error');
  }
};
