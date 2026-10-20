// GET /api/data  → kendi verin + ilçendeki hesaplar
// PUT /api/data  { data } → kendi verini kaydet
const db = require('../lib/db');
const { send, fail, readBody, norm, readToken, configured, validData } = require('../lib/util');

// Bir restoran başka restoranların yalnızca bugünkü taşıma bilgisini görür (rota ve harita için).
function forOtherRestaurant(d) {
  const t = new Date().toISOString().slice(0, 10);
  return {
    profile: { name: d.profile?.name || '', type: d.profile?.type || '', district: d.profile?.district || '' },
    entries: (d.entries || []).map(e => ({ id: e.id, date: e.date, items: (e.items || []).filter(i => !i.picked).map(i => ({ kg: i.kg, route: i.route, main: i.main, type: i.type, name: '' })) })).filter(e => e.items.length),
    pickups: (d.pickups || []).filter(p => p.date >= t.slice(0, 8) + '01').slice(-40),
    ready: d.ready || null
  };
}
// Belediye restoranın kayıtlarını görür, ama ciro, alım ve menü fiyatlarını görmez.
function forMunicipality(d) {
  const p = { ...(d.profile || {}) };
  delete p.monthly; delete p.menu;
  return { ...d, profile: p };
}
const muniProfile = d => {
  const p = d.profile || {};
  return { profile: { name: p.name, district: p.district, collectTime: p.collectTime, onlyReady: !!p.onlyReady, co2Landfill: p.co2Landfill, mealKg: p.mealKg } };
};

// Belediyenin yazdığı toplamaları (pickups) restoranın eski kopyası silmesin diye birleştirir.
function mergePickups(server, client) {
  if (!server) return client;
  const have = new Set((client.pickups || []).map(p => p.id));
  const extra = (server.pickups || []).filter(p => !have.has(p.id));
  if (!extra.length) return client;
  const extraIds = new Set(extra.map(p => p.id));
  const byId = new Map((server.entries || []).map(e => [e.id, e]));
  (client.entries || []).forEach(e => {
    const s = byId.get(e.id); if (!s) return;
    (e.items || []).forEach((it, i) => { const si = s.items && s.items[i]; if (!it.picked && si && extraIds.has(si.picked)) it.picked = si.picked; });
  });
  client.pickups = [...(client.pickups || []), ...extra];
  if (server.ready == null) client.ready = null;
  return client;
}

module.exports = async (req, res) => {
  const missing = configured();
  if (missing.length) return fail(res, 503, 'not_configured', { missing });
  const me = readToken(req);
  if (!me) return fail(res, 401, 'session_expired');
  try {
    const acc = await db.getAccount(me.u);
    if (!acc) return fail(res, 401, 'session_expired');

    if (req.method === 'GET') {
      const others = (await db.accountsInDistrict(acc.district_key)).filter(a => a.username !== acc.username);
      const rows = await db.getDataMany([acc.username, ...others.map(a => a.username)]);
      const dataOf = Object.fromEntries(rows.map(r => [r.username, r.data]));
      const district = others.filter(a => dataOf[a.username]).map(a => {
        const d = dataOf[a.username];
        let shown = d;
        if (a.role === 'belediye') shown = muniProfile(d);
        else if (acc.role === 'restoran') shown = forOtherRestaurant(d);
        else shown = forMunicipality(d);
        return { u: a.username, role: a.role, data: shown };
      });
      return send(res, 200, { me: { u: acc.username, role: acc.role, data: dataOf[acc.username] || null }, district });
    }

    if (req.method === 'PUT') {
      const b = await readBody(req);
      if (!validData(acc.role, b.data)) return fail(res, 400, 'invalid_data');
      const saved = await db.updateData(acc.username, server => acc.role === 'restoran' ? mergePickups(server, JSON.parse(JSON.stringify(b.data))) : b.data);
      const key = norm(saved.profile.district);
      if (key && key !== acc.district_key) await db.updateAccount(acc.username, { district_key: key });
      return send(res, 200, { data: saved });
    }

    return fail(res, 405, 'method_not_allowed');
  } catch (e) {
    console.error(e);
    return fail(res, e.status === 409 ? 409 : 500, e.status === 409 ? 'conflict' : 'server_error');
  }
};
