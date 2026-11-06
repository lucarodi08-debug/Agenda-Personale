// Server di notifiche push per Agenda Scolastica (Cloudflare Worker + D1 + Cron).
// L'app invia qui l'iscrizione push e l'elenco dei prossimi promemoria; ogni minuto il Worker spedisce quelli in scadenza.
import { sendPush } from './webpush.js';

const MAX_BODY = 250000, MAX_REMINDERS = 500, WINDOW = 6 * 3600e3, PER_RUN = 40;
const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const cut = (s, n) => String(s == null ? '' : s).slice(0, n);

function cors(req, env) {
  const origins = String(env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const o = req.headers.get('Origin');
  const ok = !o || origins.includes(o);
  return { ok, headers: { 'Access-Control-Allow-Origin': o && ok ? o : (origins[0] || ''), 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } };
}
const json = (obj, status, h) => new Response(JSON.stringify(obj), { status: status || 200, headers: { ...h, 'Content-Type': 'application/json' } });

function validSub(s) {
  return s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.endpoint.length <= 800 && s.keys &&
    /^[A-Za-z0-9_-]{86,88}$/.test(s.keys.p256dh || '') && /^[A-Za-z0-9_-]{20,24}$/.test(s.keys.auth || '');
}

async function handleSync(body, env, h) {
  if (!validSub(body.subscription)) return json({ error: 'iscrizione non valida' }, 400, h);
  const sub = body.subscription, id = await sha256(sub.endpoint), now = Date.now();
  const list = (Array.isArray(body.reminders) ? body.reminders : []).slice(0, MAX_REMINDERS)
    .filter((r) => r && Number.isFinite(+r.at) && +r.at > now - 3600e3 && +r.at < now + 120 * 864e5)
    .map((r) => ({ rid: cut(r.id, 40), at: Math.floor(+r.at), title: cut(r.title, 120), body: cut(r.body, 200), tag: cut(r.tag, 60) }));
  const st = [
    env.DB.prepare('INSERT INTO subs (id, endpoint, p256dh, auth, updated_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(id) DO UPDATE SET endpoint = ?2, p256dh = ?3, auth = ?4, updated_at = ?5')
      .bind(id, sub.endpoint, sub.keys.p256dh, sub.keys.auth, now),
    env.DB.prepare('DELETE FROM reminders WHERE sub_id = ?1 AND sent = 0').bind(id)
  ];
  list.forEach((r) => st.push(env.DB.prepare('INSERT OR IGNORE INTO reminders (sub_id, rid, at, title, body, tag, sent) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)').bind(id, r.rid, r.at, r.title, r.body, r.tag)));
  await env.DB.batch(st);
  return json({ ok: true, reminders: list.length }, 200, h);
}

async function handleUnsub(body, env, h) {
  if (!body.endpoint || typeof body.endpoint !== 'string') return json({ error: 'richiesta non valida' }, 400, h);
  const id = await sha256(body.endpoint);
  await env.DB.batch([env.DB.prepare('DELETE FROM reminders WHERE sub_id = ?1').bind(id), env.DB.prepare('DELETE FROM subs WHERE id = ?1').bind(id)]);
  return json({ ok: true }, 200, h);
}

export async function sendDue(env, now = Date.now()) {
  const vapid = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  const { results } = await env.DB.prepare(
    'SELECT r.sub_id, r.rid, r.at, r.title, r.body, r.tag, s.endpoint, s.p256dh, s.auth FROM reminders r JOIN subs s ON s.id = r.sub_id ' +
    'WHERE r.sent = 0 AND r.at <= ?1 AND r.at > ?2 ORDER BY r.at LIMIT ?3').bind(now, now - WINDOW, PER_RUN).all();
  const ops = [];
  for (const r of results || []) {
    try {
      const res = await sendPush({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, { title: r.title, body: r.body, tag: r.tag || 'agenda', data: { rid: r.rid } }, vapid, { ttl: 3600, urgency: 'high' });
      if (res.ok) ops.push(env.DB.prepare('UPDATE reminders SET sent = 1 WHERE sub_id = ?1 AND rid = ?2 AND at = ?3').bind(r.sub_id, r.rid, r.at));
      else if (res.status === 404 || res.status === 410) { // iscrizione scaduta o revocata dall'utente
        ops.push(env.DB.prepare('DELETE FROM reminders WHERE sub_id = ?1').bind(r.sub_id), env.DB.prepare('DELETE FROM subs WHERE id = ?1').bind(r.sub_id));
      } else if (res.status !== 429 && res.status < 500) ops.push(env.DB.prepare('UPDATE reminders SET sent = 1 WHERE sub_id = ?1 AND rid = ?2 AND at = ?3').bind(r.sub_id, r.rid, r.at)); // errore definitivo
      // 429 / 5xx: riproverà al minuto successivo finché è nella finestra
    } catch (e) { /* rete: riprova al prossimo giro */ }
  }
  ops.push(
    env.DB.prepare('DELETE FROM reminders WHERE (sent = 0 AND at <= ?1) OR (sent = 1 AND at <= ?2)').bind(now - WINDOW, now - 2 * 864e5),
    env.DB.prepare('DELETE FROM reminders WHERE sub_id IN (SELECT id FROM subs WHERE updated_at < ?1)').bind(now - 90 * 864e5),
    env.DB.prepare('DELETE FROM subs WHERE updated_at < ?1').bind(now - 90 * 864e5));
  await env.DB.batch(ops);
  return (results || []).length;
}

export default {
  async fetch(req, env) {
    const c = cors(req, env), url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: c.ok ? 204 : 403, headers: c.headers });
    if (!c.ok) return json({ error: 'origine non consentita' }, 403, c.headers);
    if (req.method === 'GET' && url.pathname === '/health') return json({ ok: true }, 200, c.headers);
    if (req.method !== 'POST' || (url.pathname !== '/sync' && url.pathname !== '/unsubscribe')) return json({ error: 'non trovato' }, 404, c.headers);
    const len = +(req.headers.get('Content-Length') || 0);
    if (len > MAX_BODY) return json({ error: 'richiesta troppo grande' }, 413, c.headers);
    let body; try { const t = await req.text(); if (t.length > MAX_BODY) return json({ error: 'richiesta troppo grande' }, 413, c.headers); body = JSON.parse(t); } catch (e) { return json({ error: 'JSON non valido' }, 400, c.headers); }
    try { return url.pathname === '/sync' ? await handleSync(body, env, c.headers) : await handleUnsub(body, env, c.headers); }
    catch (e) { return json({ error: 'errore del server' }, 500, c.headers); }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(sendDue(env)); }
};
