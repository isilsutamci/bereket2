// POST /api/demo  { v, accounts: [{ u, role, data }], district? }
// Sunum için örnek hesapları (şifre: bereket) oluşturur ve verilerini her gün tazeler.
// Yalnızca aşağıdaki sabit örnek hesaplara yazabilir.
const db = require('../lib/db');
const { send, fail, readBody, norm, hashPassword, configured, validData } = require('../lib/util');

const DEMO = { ornek: 'restoran', kampus: 'restoran', sifa: 'restoran', keyif: 'restoran', kagithane: 'belediye' };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed');
  const missing = configured();
  if (missing.length) return fail(res, 503, 'not_configured', { missing });
  try {
    const b = await readBody(req);
    const v = String(b.v || '').slice(0, 40);
    const district = typeof b.district === 'string' ? b.district.trim().slice(0, 60) : '';
    for (const a of (Array.isArray(b.accounts) ? b.accounts : [])) {
      const u = String(a.u || ''), role = DEMO[u];
      if (!role || a.role !== role || !validData(role, a.data)) continue;
      const data = a.data;
      if (district && role === 'restoran') data.profile.district = district;
      let acc = await db.getAccount(u);
      if (!acc) {
        const { salt, hash } = hashPassword('bereket');
        await db.createAccount({ username: u, role, district_key: norm(data.profile.district), salt, hash });
        acc = await db.getAccount(u);
      }
      const stale = acc.demo_v !== v;
      const moved = district && role === 'restoran' && norm(district) !== acc.district_key;
      const existing = await db.getData(u);
      // Belediyenin ayarları korunur; restoranların örnek verisi her gün yeniden üretilir.
      if (!existing || (role === 'restoran' && (stale || moved))) {
        await db.updateData(u, () => data);
      }
      await db.updateAccount(u, { demo_v: v, ...(role === 'restoran' ? { district_key: norm(data.profile.district) } : {}) });
    }
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return fail(res, 500, 'server_error');
  }
};
