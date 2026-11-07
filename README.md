# Agenda Scolastica – web app

- `index.html` – l'app (un solo file). Va ospitata su un indirizzo **https** (GitHub Pages, Netlify, Firebase Hosting…): Google OAuth non funziona aprendo il file con `file://`. I dati restano nel browser (localStorage).
- `_headers` – intestazioni di sicurezza HTTP (Netlify / Cloudflare Pages): CSP con `frame-ancestors`, `Cross-Origin-Opener-Policy: same-origin-allow-popups` (richiesta dal login Google), HSTS. Su GitHub Pages non si possono impostare le intestazioni: resta valida la CSP già inclusa in `index.html`.
- `cloud-function/` – funzione facoltativa (Gemini + system prompt) per leggere circolari ed email in modo più flessibile.

## Installarla come app (PWA) e pubblicarla su GitHub Pages

Il progetto è una Progressive Web App: ha `manifest.webmanifest`, `sw.js` (funziona anche offline) e le icone in `icons/`.

1. Crea un repository su GitHub e carica **tutto il contenuto di questa cartella** nella radice (`index.html`, `config.js`, `sw.js`, `manifest.webmanifest`, `icons/`, …).
2. Repository → **Settings → Pages** → *Deploy from a branch* → branch `main`, cartella `/ (root)` → Save. L'indirizzo sarà `https://TUONOME.github.io/NOMEREPO/`.
3. Apri quell'indirizzo dal telefono: **Android/Chrome** mostra «Installa app» (o menu ⋮ → Installa app), **iPhone/Safari** → Condividi → *Aggiungi alla schermata Home*. Nell'app c'è anche il pulsante **Installa app**.
4. Quando pubblichi una nuova versione gli utenti la ricevono da soli alla riapertura (nell'`sw.js` conviene cambiare `VERSION` a ogni modifica: lo fa già lo script di build).

### Cambiare l'icona
Tutte le personalizzazioni sono in **`icon-config.json`**: colori della sfumatura, del calendario, della spunta, simbolo (`check`, `dots`, `none`), raggio degli angoli, e anche nome, colori e descrizione dell'app. Dopo averlo modificato esegui:

```bash
pip install pillow
python3 tools/make_icons.py
```

Rigenera `icons/*.png`, `icons/icon.svg` e `manifest.webmanifest`. Poi ricarica i file su GitHub (su telefono può servire disinstallare e reinstallare l'app per vedere la nuova icona).

### Accesso a Gmail per tutti gli utenti (senza Client ID)
Gli utenti aprono **Sync Gmail → Collega Gmail** e accedono col **proprio** account Google: non devono inserire nulla. Il Client ID lo scrivi tu una volta sola in `config.js` (guida più sotto). Nella Google Cloud Console devi:
- inserire l'indirizzo GitHub Pages (`https://TUONOME.github.io`, senza percorso né `/` finale) tra le **Origini JavaScript autorizzate**;
- finché l'app Google è in modalità **Test**, possono accedere **solo** gli indirizzi elencati come *Utenti di test* (massimo 100) e Google mostra «app non verificata»;
- per aprirla a **chiunque** serve **pubblicare l'app** e ottenere la **verifica di Google**: `gmail.readonly` è uno scope *riservato*, quindi richiede informativa privacy pubblica, dominio verificato e una valutazione di sicurezza (può richiedere settimane e avere costi). Senza verifica, gli utenti non in lista di test non riescono ad accedere.

## Modalità sviluppatore (Client ID, URL cloud, chiave API)

Gli utenti normali nelle Impostazioni vedono solo classi, tipo di email e opzioni di sincronizzazione. **Google OAuth Client ID, URL della funzione cloud e chiave API** compaiono solo in modalità sviluppatore:

1. Per distribuire l'app, scrivi i tuoi valori in **`config.js`** (`clientId`, `endpoint`, `apiKey`) e pubblica il file. Tutti gli utenti useranno quelli e non vedranno mai i campi.
2. Per modificarli dal browser: apri l'app aggiungendo `#dev` all'indirizzo (es. `https://tuosito.it/#dev`) e inserisci il codice sviluppatore. Per uscire riapri con `#dev`.
3. Il codice è memorizzato solo come hash (`DEV_HASH`). Per cambiarlo: `echo -n "nuovo-codice" | sha256sum` e incolla il risultato in `devHash` dentro `config.js`.

Attenzione: è un'app che gira nel browser, quindi nascondere i campi evita che gli utenti li vedano o li cambino per sbaglio, ma **non è una protezione**: chi apre il codice della pagina può leggere Client ID e chiave API. Il Client ID di Google non è un segreto (è protetto dalle origini autorizzate); per la chiave API della funzione cloud limita `ALLOWED_ORIGIN` e imposta un budget/quota.

## Impegni periodici, notifiche e schermo da telefono

- **Impegni periodici**: in *Aggiungi impegno* scegli **Ripetizione** (ogni mese, ogni settimana, ogni 2 settimane) e **per quanti mesi**. L'app crea tutti gli impegni in un colpo solo (es. ogni 14 del mese per 6 mesi = 6 impegni; se il giorno manca, come il 31, usa l'ultimo del mese). Aprendo un impegno della serie puoi eliminare solo quello, quello e i successivi, oppure tutta la serie.
- **Notifiche**: *Impostazioni → Notifiche* (permesso del browser, avviso all'ora, 15/30 minuti, 1/3 ore o 1 giorno prima; senza orario avvisa alle 8:00). Senza server funzionano mentre l'app è aperta o in background.
- **Notifiche anche con l'app chiusa**: con il server in `push-server/` (gratuito su Cloudflare, guida passo passo nel suo README) l'app attiva le notifiche push: arrivano a telefono bloccato e app chiusa. Richiede di scrivere `pushUrl` e `vapidPublicKey` in `config.js`.
- **Screenshot e foto di circolari**: in «Carica circolare» puoi scegliere anche un'immagine (PNG/JPG, anche dalla galleria dell'iPhone). Il testo viene letto nel browser con l'OCR (Tesseract.js, caricato da cdnjs/jsDelivr alla prima lettura); l'immagine non lascia il telefono. Poi l'estrazione è la stessa dei PDF. L'OCR può sbagliare qualche carattere: controlla sempre date e orari.
- **Elimina impegni estratti**: *Impostazioni → Elimina impegni estratti*: già passati, da Gmail, da circolari PDF. Le circolari e le email propongono solo impegni da oggi in avanti.
- **Numeri romani**: il lettore PDF e le email riconoscono anche classi scritte con numeri romani (Vj, IIIB, IVC-D) e le trasformano in 5J, 3B, 4C/4D.
- **iPhone**: le notifiche funzionano solo con l'app installata (Condividi → Aggiungi alla schermata Home) e iOS 16.4 o successivo.
- **Telefono**: schermo fisso senza scorrimento della pagina; le azioni (Aggiungi, PDF, Gmail, Impostazioni, Tema) sono in una barra in basso.

## Circolari PDF (qualsiasi layout)

1. **Carica Circolare (PDF)** → scegli il file. Il PDF deve contenere testo selezionabile (non una scansione).
2. Nel campo **Classi da cercare** scrivi le classi (`5J, 3D, 2L`) e premi Invio: diventano etichette. Sotto compaiono tutte le classi trovate nel PDF: tocca per aggiungerle o toglierle.
3. **Estrai impegni** → spunta quelli che vuoi → **Aggiungi al calendario**.

Dal PDF vengono estratte **solo quattro informazioni**: classe, data, ora e descrizione dell'impegno. Il lettore non dipende da una circolare in particolare e riconosce:
- tabelle (con data in una cella unita su più righe, orario su due righe «14.45 -» / «15.45», classi unite come `5C-D` o `3D-3K`);
- elenchi per giorno («Lunedì 23 novembre» seguito dalle righe con ora e classe);
- testo in paragrafi («il consiglio della classe 3B si terrà giovedì 19 novembre dalle 15:00 alle 16:00»);
- date in vari formati (`05/05/25`, `5 maggio 2025`, `5-6 maggio`, senza anno) e orari (`14:45-15:45`, `dalle 15 alle 16`, `ore 10.30`).

La descrizione è il testo della riga/cella (es. «Colloquio con le famiglie»), oppure il tipo riconosciuto (Consiglio di Classe, Scrutini, Verifica…), oppure il titolo/oggetto del documento. Se l'anno è sbagliato si usa quello della data di emissione («Rimini, 28/04/2025»). Se un PDF ha un impaginato molto particolare controlla sempre l'elenco prima di aggiungere.

## Requisiti di sicurezza OAuth 2.0 di Google (già applicati)

| Requisito | Come è applicato nell'app |
|---|---|
| Login tramite Google Identity Services, mai password nell'app | Finestra di consenso ufficiale di Google (`initTokenClient`) |
| Origini autorizzate solo https | L'app rifiuta l'accesso se non è su https o localhost; il Client ID è valido solo per le origini che registri |
| Privilegio minimo | Solo `gmail.readonly` (lettura): nessuna modifica, invio o eliminazione |
| Protezione anti-CSRF | Parametro `state` casuale a ogni accesso, controllato nella risposta |
| Verifica dei permessi concessi | `hasGrantedAllScopes` prima di usare il token |
| Token non persistente | Token solo in memoria (mai in localStorage); revoca con **Impostazioni → Scollega Gmail** |
| Validazione del Client ID | Formato `numeri-…apps.googleusercontent.com` controllato prima di salvare |
| Content Security Policy | Script inline ammessi solo con hash; script esterni solo da Google e cdnjs; connessioni solo a Gmail API, Google e funzioni cloud https |
| Limited Use dei dati Gmail | Le email restano nel browser. Vanno alla funzione cloud solo se spunti «Invia anche il testo delle email» |
| Testo email mostrato in modo sicuro | Tutto il contenuto viene sottoposto a escape prima di essere mostrato |

Nelle Impostazioni e in Sync Gmail c'è un pannello **Sicurezza OAuth 2.0 di Google** con questi controlli in tempo reale.

**Verifica di Google:** per uso personale basta lasciare l'app in modalità *Test* con il tuo Gmail tra gli *Utenti di test*. La verifica (con valutazione di sicurezza, perché `gmail.readonly` è uno scope riservato) serve solo se vuoi pubblicarla per altri utenti: in quel caso servono anche una pagina di informativa privacy e un dominio verificato.

## Collegare il tuo Gmail personale (Google OAuth)

1. Vai su [console.cloud.google.com](https://console.cloud.google.com) e crea un progetto (es. "Agenda Scolastica").
2. **API e servizi → Libreria** → cerca **Gmail API** → Abilita.
3. **Schermata di consenso OAuth** (o "Google Auth Platform"): tipo **Esterno**, nome app a piacere, la tua email come contatto. In **Utenti di test** aggiungi il tuo indirizzo Gmail personale.
4. **Credenziali → Crea credenziali → ID client OAuth** → tipo **Applicazione web**. In **Origini JavaScript autorizzate** inserisci l'indirizzo dove ospiti l'app, senza barra finale (es. `https://tuonome.github.io`). Per provare in locale aggiungi anche `http://localhost:8000` e apri l'app con `python3 -m http.server 8000`.
5. Copia il **Client ID** (finisce con `.apps.googleusercontent.com`; non è un segreto).
6. Nell'app: **Impostazioni** → incolla il Client ID → Salva. Poi **Sync Gmail → Collega Gmail e sincronizza** e accetta l'accesso in sola lettura.

Nota: finché l'app è in modalità "Test", Google mostra "app non verificata": scegli *Avanzate → Vai a … (non sicuro)*. È normale per un'app personale.

### Come funziona la sincronizzazione automatica

- Legge il **testo** delle email ricevute **da oggi in avanti** (la data «oggi» è quella evidenziata nel calendario, ricalcolata a ogni sincronizzazione), **qualunque sia l'oggetto** (restano escluse le schede Promozioni, Social, Aggiornamenti e Forum, lo Spam e il Cestino). Se nel testo trova una **data**, un **orario** o una **classe**, crea l'impegno e lo aggiunge in agenda da solo.
- Le email ricevute prima di oggi e gli impegni con una data già passata **non vengono inseriti** (in Sync Gmail compaiono come «data già passata»). **Impostazioni → Elimina impegni Gmail passati** toglie quelli già entrati.
- Se il testo non indica una data ma c'è un orario o una classe, l'impegno viene messo nel giorno di ricezione dell'email (e la nota lo segnala).
- In **Impostazioni → Quali email leggere** puoi scegliere «Solo quelle che citano le mie classi» per evitare che entrino email non scolastiche che contengono date o orari (ordini, ricevute…).
- Dal testo estrae **data**, **orario**, **classe**, **luogo** e **impegno**, anche se scritti liberamente e in qualsiasi punto dell'email (testo semplice, HTML, messaggi inoltrati, risposte: le parti citate e le intestazioni «Da/Inviato/Data» non vengono lette):
  - data: `12 novembre 2026`, `12 nov.`, `12/11/2026`, `12-11-26`, `12/11`, `2026-11-12`, `domani`, `dopodomani`, `giovedì`, `lunedì prossimo`, `tra 3 giorni`;
  - orario: `ore 15:30`, `alle 15`, `h 9.30`, `15:30`, `dalle 14 alle 16`, `15.30-16.30`, `alle 3 del pomeriggio`, `mezzogiorno`;
  - impegno: riga «Impegno: …», oppure il tipo riconosciuto (consiglio di classe, collegio, scrutini, colloqui, interrogazione, verifica, open day, gita…), oppure l'oggetto, oppure la prima frase utile del testo.
  Se manca l'orario l'impegno viene aggiunto come tutto il giorno. Se l'email non contiene né data, né orario, né classe viene scartata (nel dettaglio vedi il testo letto).
- In **Sync Gmail → Prova l'estrazione su un testo** puoi incollare oggetto e testo di una qualsiasi email e vedere subito cosa viene riconosciuto.
- Aggiunge l'impegno in agenda da solo (si può disattivare dalle impostazioni, e allora chiede conferma).
- Dopo ogni sincronizzazione manuale compare il **dettaglio delle email lette** con il motivo di ogni esito (aggiunta, già in agenda, altra classe, data non riconosciuta…). Il pulsante «Rianalizza anche le email già lette» le rilegge tutte senza creare duplicati.
- Ogni email viene elaborata una sola volta: se elimini un impegno non ricompare.
- Con "Ignora le email che citano solo altre classi" attivo, un'email che nomina solo classi diverse dalle tue viene saltata.
- Il controllo si ripete ogni 10 minuti e all'apertura della pagina, **ma solo mentre la pagina è aperta** in un browser. Il permesso Google dura circa un'ora: dopo, la sync silenziosa può chiedere di nuovo di cliccare su Sync Gmail. Una sincronizzazione davvero in background, a pagina chiusa, richiederebbe un piccolo server con refresh token.
- Il token di accesso resta solo in memoria; **Impostazioni → Scollega Gmail** lo revoca.
- Se usi la funzione cloud, l'URL deve essere `https://…cloudfunctions.net` o `…run.app` (la CSP blocca altri domini: per un dominio tuo aggiungilo in `connect-src` e rigenera con lo script, oppure scrivimi).

## Funzione cloud (opzionale)

```bash
cd cloud-function
gcloud functions deploy extractEvent \
  --gen2 --runtime=nodejs20 --region=europe-west1 --trigger-http --allow-unauthenticated \
  --entry-point=extractEvent \
  --set-env-vars GEMINI_API_KEY=LA_TUA_CHIAVE,ALLOWED_ORIGIN=https://tuonome.github.io,API_KEY=una-chiave-a-caso
```

In **Impostazioni** incolla URL e `API_KEY`. Con più classi l'app fa una richiesta per classe (la funzione restituisce un impegno per richiesta). Una chiave inserita nel browser è visibile a chi usa l'app: limita `ALLOWED_ORIGIN` e controlla i costi.

## Privacy

Senza funzione cloud, i PDF restano nel browser e le email vengono lette solo da Google verso il tuo browser. Con la funzione cloud attiva, testo delle email e PDF vengono inviati a Google (Gemini): le circolari possono contenere nomi di alunni.
