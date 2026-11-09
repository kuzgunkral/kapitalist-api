export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    // Auth kontrol
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return new Response(JSON.stringify({error: 'Yetkisiz'}), {status: 401, headers: {...cors, 'Content-Type': 'application/json'}});
    }
    const token = auth.replace('Bearer ', '');

    // Tabloları oluştur (ilk çalışmada)
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS oyun_kayitlari (
      kullanici_id TEXT PRIMARY KEY,
      kullanici_adi TEXT,
      veri TEXT,
      updated_at TEXT
    )`);
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS global_sohbet (
      id TEXT PRIMARY KEY,
      kullanici_adi TEXT,
      mesaj TEXT,
      zaman TEXT
    )`);

    // KAYDET
    if (path === '/save' && request.method === 'POST') {
      const body = await request.json();
      const {kullanici_id, kullanici_adi, veri} = body;
      if (!kullanici_id || !veri) return new Response(JSON.stringify({error: 'Eksik veri'}), {status: 400, headers: {...cors, 'Content-Type': 'application/json'}});
      await env.DB.prepare(`INSERT OR REPLACE INTO oyun_kayitlari (kullanici_id, kullanici_adi, veri, updated_at) VALUES (?, ?, ?, ?)`)
        .bind(kullanici_id, kullanici_adi, JSON.stringify(veri), new Date().toISOString())
        .run();
      return new Response(JSON.stringify({ok: true}), {headers: {...cors, 'Content-Type': 'application/json'}});
    }

    // YUKLE
    if (path === '/load' && request.method === 'GET') {
      const uid = url.searchParams.get('uid');
      if (!uid) return new Response(JSON.stringify({error: 'uid gerekli'}), {status: 400, headers: {...cors, 'Content-Type': 'application/json'}});
      const row = await env.DB.prepare('SELECT veri FROM oyun_kayitlari WHERE kullanici_id = ?').bind(uid).first();
      if (!row) return new Response(JSON.stringify({veri: null}), {headers: {...cors, 'Content-Type': 'application/json'}});
      return new Response(JSON.stringify({veri: JSON.parse(row.veri)}), {headers: {...cors, 'Content-Type': 'application/json'}});
    }

    // SIL
    if (path === '/delete' && request.method === 'POST') {
      const body = await request.json();
      await env.DB.prepare('DELETE FROM oyun_kayitlari WHERE kullanici_id = ?').bind(body.kullanici_id).run();
      return new Response(JSON.stringify({ok: true}), {headers: {...cors, 'Content-Type': 'application/json'}});
    }

    // SOHBET YUKLE
    if (path === '/sohbet' && request.method === 'GET') {
      const rows = await env.DB.prepare('SELECT * FROM global_sohbet ORDER BY zaman ASC LIMIT 50').all();
      return new Response(JSON.stringify({mesajlar: rows.results}), {headers: {...cors, 'Content-Type': 'application/json'}});
    }

    // SOHBET GONDER
    if (path === '/sohbet' && request.method === 'POST') {
      const body = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare('INSERT INTO global_sohbet (id, kullanici_adi, mesaj, zaman) VALUES (?, ?, ?, ?)')
        .bind(id, body.kullanici_adi, body.mesaj, new Date().toISOString())
        .run();
      // 50den fazla mesaj varsa eskiyi sil
      await env.DB.exec('DELETE FROM global_sohbet WHERE id NOT IN (SELECT id FROM global_sohbet ORDER BY zaman DESC LIMIT 50)');
      return new Response(JSON.stringify({ok: true}), {headers: {...cors, 'Content-Type': 'application/json'}});
    }

    return new Response(JSON.stringify({error: 'Bulunamadi'}), {status: 404, headers: {...cors, 'Content-Type': 'application/json'}});
  }
};
