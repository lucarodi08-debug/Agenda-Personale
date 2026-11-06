# Server di notifiche push (facoltativo)

Serve per ricevere le notifiche **anche con l'app chiusa e il telefono bloccato**. Gira gratis su Cloudflare (Workers + D1) e non ha dipendenze. L'app gli invia soltanto l'iscrizione del dispositivo e, per ogni impegno dei prossimi 90 giorni, **titolo, data/ora e luogo** (non email né PDF). Ogni minuto il server spedisce i promemoria in scadenza.

Cosa serve: un account Cloudflare gratuito e Node.js 18+ sul computer.

1. **Prepara la cartella**: apri un terminale in `push-server/` ed esegui `npm install`.
2. **Accedi**: `npx wrangler login`.
3. **Crea il database**: `npx wrangler d1 create agenda-push`. Copia l'`database_id` che stampa dentro `wrangler.toml`.
4. **Crea le tabelle**: `npx wrangler d1 execute agenda-push --remote --file=schema.sql`.
5. **Genera le chiavi VAPID**: `node scripts/generate-vapid.mjs`.
   - La chiave **pubblica** va in `wrangler.toml` (`VAPID_PUBLIC_KEY`) e in `config.js` dell'app (`vapidPublicKey`).
   - La chiave **privata** si registra solo così, senza scriverla in nessun file: `npx wrangler secret put VAPID_PRIVATE_KEY`.
6. **Imposta** in `wrangler.toml`: `ALLOWED_ORIGIN` (l'indirizzo del tuo sito, es. `https://tuonome.github.io`, senza `/` finale) e `VAPID_SUBJECT` (`mailto:la-tua-email`).
7. **Pubblica**: `npx wrangler deploy`. Cloudflare stampa l'indirizzo, tipo `https://agenda-push.TUOACCOUNT.workers.dev`.
8. **Collega l'app**: in `config.js` scrivi `pushUrl` (quell'indirizzo, senza `/` finale) e `vapidPublicKey`, e ricarica `config.js` su GitHub.
9. **Attiva**: nell'app, *Impostazioni → Notifiche → «Ricevi le notifiche anche con l'app chiusa»*, accetta il permesso e premi «Prova notifica».

Note
- **iPhone**: funziona solo con l'app installata dalla schermata Home (iOS 16.4 o successivo).
- I promemoria vengono rinviati al server a ogni modifica e all'apertura dell'app. Gli impegni oltre i 90 giorni entrano quando riapri l'app più vicino alla data.
- L'indirizzo `workers.dev` è già ammesso dalle regole di sicurezza dell'app. Se usi un dominio tuo, aggiungilo a `connect-src` nel meta CSP di `index.html` e in `_headers`.
- Il piano gratuito di Cloudflare basta per un uso scolastico. Il server cancella da solo i dati vecchi (promemoria inviati dopo 2 giorni, dispositivi inattivi dopo 90 giorni).
- Per fermare tutto: disattiva l'opzione nell'app (cancella i dati dal server) oppure `npx wrangler delete`.
- Aggiorna l'informativa sulla privacy: `privacy.html` già descrive questo uso facoltativo.
