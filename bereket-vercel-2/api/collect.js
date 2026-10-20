// POST /api/collect  { targets: [kullanıcı adları], date: 'YYYY-MM-DD', time: 'HH:MM' }
// Yalnızca belediye, kendi ilçesindeki restoranların bekleyen atığını "toplandı" olarak işaretler.
const crypto = require('crypto');
const db = require('../lib/db');
const { send, fail, readBody, readToken, configured } = require('../lib/util');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, TIME_RE = /^\d{2}:\d{2}$/;
const r1 = n => Math.round(n * 10) / 10;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed');
  const missing = configured();
  if (missing.length) return fail(res, 503, 'not_configured', { missing });
  const me = readToken(req);
  if (!me) return fail(res, 401, 'session_expired');
  try {
    const muni = await db.getAccount(me.u);
    if (!muni || muni.role !== 'belediye') return fail(res, 403, 'forbidden');
    const b = await readBody(req);
    const date = DATE_RE.test(b.date) ? b.date : new Date().toISOString().slice(0, 10);
    const time = TIME_RE.test(b.time) ? b.time : '16:00';
    const targets = (Array.isArray(b.targets) ? b.targets : []).slice(0, 50).map(String);
    const muniData = (await db.getData(muni.username))?.data;
    const by = muniData?.profile?.name || 'Belediye';
    const result = {};
    for (const u of targets) {
      const acc = await db.getAccount(u);
      if (!acc || acc.role !== 'restoran' || acc.district_key !== muni.district_key) { result[u] = 0; continue; }
      let total = 0;
      await db.updateData(u, data => {
        if (!data) return undefined;
        total = 0;
        const groups = {};
        (data.entries || []).forEach(e => (e.items || []).forEach(it => { if (!it.picked) (groups[it.route] ||= []).push(it); }));
        if (!Object.keys(groups).length) return undefined;
        data.pickups ||= [];
        Object.entries(groups).forEach(([route, items]) => {
          const id = crypto.randomBytes(4).toString('hex'), kg = r1(items.reduce((t, i) => t + (Number(i.kg) || 0), 0));
          items.forEach(i => { i.picked = id; });
          data.pickups.push({ id, date, route, kg, created: date + 'T' + time, by });
          total += kg;
        });
        data.ready = null;
        return data;
      });
      result[u] = r1(total);
    }
    return send(res, 200, { collected: result });
  } catch (e) {
    console.error(e);
    return fail(res, 500, 'server_error');
  }
};
