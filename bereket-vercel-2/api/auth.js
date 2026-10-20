// POST /api/auth  { action: 'login' | 'signup', role, username, password, data? }
const db = require('../lib/db');
const { send, fail, readBody, norm, USER_RE, hashPassword, checkPassword, signToken, configured, validData } = require('../lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed');
  const missing = configured();
  if (missing.length) return fail(res, 503, 'not_configured', { missing });
  try {
    const b = await readBody(req);
    const u = norm(b.username), pw = String(b.password || ''), role = b.role === 'belediye' ? 'belediye' : 'restoran';

    if (b.action === 'signup') {
      if (!USER_RE.test(u)) return fail(res, 400, 'invalid_username');
      if (pw.length < 6) return fail(res, 400, 'weak_password');
      if (!validData(role, b.data)) return fail(res, 400, 'invalid_data');
      const data = b.data;
      const { salt, hash } = hashPassword(pw);
      const ok = await db.createAccount({ username: u, role, district_key: norm(data.profile.district), salt, hash });
      if (!ok) return fail(res, 409, 'exists');
      await db.updateData(u, () => data);
      return send(res, 200, { token: signToken(u, role), user: { u, role } });
    }

    if (b.action === 'login') {
      const a = await db.getAccount(u);
      if (!a || !checkPassword(pw, a.salt, a.hash)) return fail(res, 401, 'bad_credentials');
      if (a.role !== role) return fail(res, 403, 'role_mismatch', { role: a.role });
      return send(res, 200, { token: signToken(u, a.role), user: { u, role: a.role } });
    }

    return fail(res, 400, 'unknown_action');
  } catch (e) {
    console.error(e);
    return fail(res, 500, 'server_error');
  }
};
