// GET /api/health → kurulumun hangi adımında sorun olduğunu söyler. Hiçbir anahtarı göstermez.
module.exports = async (req, res) => {
  const out = { ok: true, checks: [] };
  const add = (name, ok, note) => { out.checks.push({ name, ok, note }); if (!ok) out.ok = false; };

  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  add('SUPABASE_URL', /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url),
    url ? (url.includes('/rest/v1') ? 'Sonundaki /rest/v1 kısmını silin.' : (url.startsWith('https://') ? 'Tamam görünüyor.' : 'https:// ile başlamalı.')) : 'Eksik. Vercel ortam değişkenlerine ekleyin.');
  add('SUPABASE_SECRET_KEY', !!key && !key.startsWith('sb_publishable_'),
    !key ? 'Eksik.' : key.startsWith('sb_publishable_') ? 'Yanlış anahtar: sb_publishable_ değil, sb_secret_ ile başlayan anahtarı girin.' : 'Var.');
  add('SESSION_SECRET', (process.env.SESSION_SECRET || '').length >= 32, process.env.SESSION_SECRET ? 'Var.' : 'Eksik.');
  add('ANTHROPIC_API_KEY', !!process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_API_KEY ? 'Var.' : 'Eksik (fotoğraf analizi çalışmaz, giriş çalışır).');

  if (url && key) {
    try {
      const headers = { apikey: key };
      if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
      const r = await fetch(url + '/rest/v1/accounts?select=username&limit=1', { headers });
      const text = await r.text();
      let note;
      if (r.ok) note = 'Bağlantı ve tablolar tamam.';
      else if (r.status === 404 || /does not exist|Could not find the table|PGRST205/i.test(text)) note = 'Tablolar yok: Supabase SQL Editor\'de supabase/schema.sql dosyasını çalıştırın.';
      else if (r.status === 401 || r.status === 403) note = 'Anahtar kabul edilmedi: SUPABASE_SECRET_KEY değerini kontrol edin (sb_secret_...).';
      else note = 'Supabase hata verdi: ' + r.status + ' ' + text.slice(0, 160);
      add('Supabase bağlantısı', r.ok, note);
    } catch (e) {
      add('Supabase bağlantısı', false, 'Adrese ulaşılamadı: SUPABASE_URL yanlış olabilir.');
    }
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(out, null, 2));
};
