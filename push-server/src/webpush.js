// Web Push (RFC 8030 + cifratura RFC 8291 aes128gcm + VAPID RFC 8292) con la sola Web Crypto API: nessuna dipendenza.
const enc = new TextEncoder();

export const b64uToBytes = (s) => {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
export const bytesToB64u = (b) => {
  let s = ''; b = new Uint8Array(b);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const concat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };

async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

// Cifra il messaggio per l'iscrizione {keys:{p256dh, auth}}
export async function encryptPayload(sub, plaintext) {
  const uaPublic = b64uToBytes(sub.keys.p256dh), authSecret = b64uToBytes(sub.keys.auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const data = concat(enc.encode(plaintext), new Uint8Array([2])); // 0x02 = ultimo (e unico) record
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, data));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // dimensione record 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ct);
}

async function vapidKey(vapid) {
  const pub = b64uToBytes(vapid.publicKey);
  return crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: bytesToB64u(pub.slice(1, 33)), y: bytesToB64u(pub.slice(33, 65)), d: vapid.privateKey, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}
export async function vapidAuthorization(endpoint, vapid, nowSec = Math.floor(Date.now() / 1000)) {
  const head = bytesToB64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = bytesToB64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSec + 12 * 3600, sub: vapid.subject })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await vapidKey(vapid), enc.encode(head + '.' + body)));
  return 'vapid t=' + head + '.' + body + '.' + bytesToB64u(sig) + ', k=' + vapid.publicKey;
}

export async function buildPushRequest(sub, payloadObj, vapid, opts = {}) {
  const body = await encryptPayload(sub, JSON.stringify(payloadObj));
  return {
    url: sub.endpoint,
    init: { method: 'POST', body, headers: {
      Authorization: await vapidAuthorization(sub.endpoint, vapid), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
      TTL: String(opts.ttl || 3600), Urgency: opts.urgency || 'high' } }
  };
}
export async function sendPush(sub, payloadObj, vapid, opts) {
  const r = await buildPushRequest(sub, payloadObj, vapid, opts);
  return fetch(r.url, r.init);
}
