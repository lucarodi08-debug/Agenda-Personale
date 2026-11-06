// Genera la coppia di chiavi VAPID:  node scripts/generate-vapid.mjs
import { generateKeyPairSync } from 'node:crypto';
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pub = publicKey.export({ format: 'jwk' }), prv = privateKey.export({ format: 'jwk' });
const b = (s) => Buffer.from(s, 'base64url');
const publicRaw = Buffer.concat([Buffer.from([4]), b(pub.x), b(pub.y)]).toString('base64url');
console.log('VAPID_PUBLIC_KEY  (pubblica: va in config.js e in wrangler.toml):\n' + publicRaw + '\n');
console.log('VAPID_PRIVATE_KEY (SEGRETA: solo con  npx wrangler secret put VAPID_PRIVATE_KEY, mai nel repository):\n' + prv.d);
