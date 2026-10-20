// Supabase veritabanı erişimi (REST / PostgREST). Gizli anahtar yalnızca sunucuda kullanılır.
const BASE = () => String(process.env.SUPABASE_URL || '').replace(/\/+$/, '') + '/rest/v1';
const KEY = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function rest(path, { method = 'GET', body, prefer } = {}) {
  const key = KEY();
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  // Eski "service_role" anahtarı bir JWT'dir ve Authorization başlığında da gönderilir.
  // Yeni "sb_secret_..." anahtarları yalnızca apikey başlığında gönderilir.
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(BASE() + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!r.ok) { const err = new Error('db ' + r.status + ' ' + text.slice(0, 300)); err.status = r.status; err.body = data; throw err; }
  return data;
}
const q = v => encodeURIComponent(v);

async function getAccount(u) {
  const rows = await rest(`/accounts?username=eq.${q(u)}&select=*`);
  return rows[0] || null;
}
async function createAccount(row) {
  try { await rest('/accounts', { method: 'POST', body: row, prefer: 'return=minimal' }); return true; }
  catch (e) { if (e.status === 409) return false; throw e; }
}
async function updateAccount(u, patch) {
  await rest(`/accounts?username=eq.${q(u)}`, { method: 'PATCH', body: patch, prefer: 'return=minimal' });
}
async function accountsInDistrict(key) {
  return rest(`/accounts?district_key=eq.${q(key)}&select=username,role,district_key`);
}
async function getData(u) {
  const rows = await rest(`/app_data?username=eq.${q(u)}&select=data,version`);
  return rows[0] || null;
}
async function getDataMany(us) {
  if (!us.length) return [];
  const list = us.map(u => '"' + u.replace(/"/g, '') + '"').join(',');
  return rest(`/app_data?username=in.(${q(list)})&select=username,data,version`);
}
// İyimser kilit: yalnızca okuduğumuz sürüm hâlâ geçerliyse yazar. Değilse false döner.
async function writeData(u, data, version) {
  if (version == null) {
    try { await rest('/app_data', { method: 'POST', body: { username: u, data, version: 1, updated_at: new Date().toISOString() }, prefer: 'return=minimal' }); return true; }
    catch (e) { if (e.status === 409) return false; throw e; }
  }
  const rows = await rest(`/app_data?username=eq.${q(u)}&version=eq.${version}`, {
    method: 'PATCH', body: { data, version: version + 1, updated_at: new Date().toISOString() }, prefer: 'return=representation'
  });
  return Array.isArray(rows) && rows.length === 1;
}
// Oku → değiştir → yaz; araya başka bir yazma girerse baştan dener.
async function updateData(u, fn) {
  for (let i = 0; i < 5; i++) {
    const row = await getData(u);
    const next = await fn(row ? row.data : null);
    if (next === undefined) return row ? row.data : null;
    if (await writeData(u, next, row ? row.version : null)) return next;
  }
  const e = new Error('conflict'); e.status = 409; throw e;
}

async function insertPhoto(row) {
  await rest('/photos', { method: 'POST', body: row, prefer: 'return=minimal' });
}
async function getPhoto(id) {
  const rows = await rest(`/photos?id=eq.${q(id)}&select=id,username,type,data`);
  return rows[0] || null;
}

module.exports = { insertPhoto, getPhoto, getAccount, createAccount, updateAccount, accountsInDistrict, getData, getDataMany, updateData };
