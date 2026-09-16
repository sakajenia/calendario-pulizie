# Archivio condiviso — cosa fare una volta sola

L'app adesso può tenere i dati in un archivio condiviso: quello che scrive il
manager arriva agli operatori in pochi secondi, sul loro telefono, senza
passaggi a mano.

Finché l'archivio non è collegato l'app continua a funzionare esattamente come
prima, con i dati sul singolo dispositivo. Non si rompe niente: si limita a
dire, in Impostazioni, che l'archivio non è collegato.

## I tre passaggi

Servono una volta sola, dal computer, nella cartella del progetto.

**1. Creare il database**

```
npx wrangler d1 create propromanager
```

Cloudflare risponde con un identificativo lungo (`database_id`). Va incollato
in `wrangler.toml`, al posto di `DA_COMPILARE`.

In alternativa si crea dal pannello: **Workers & Pages → D1 → Create
database**, nome `propromanager`, e l'identificativo si legge nella scheda del
database.

**2. Creare le tabelle**

```
npx wrangler d1 execute propromanager --remote --file=worker/schema.sql
```

Questo crea le due tabelle e i tre accessi (ProProManager, Angela, Comfy) con
le password già in uso nell'app.

**3. Impostare la firma degli accessi**

```
npx wrangler secret put SYNC_SECRET
```

Chiede una frase a piacere: serve a firmare i gettoni di accesso, e non va
condivisa con nessuno. Saltandola l'app funziona lo stesso, con una firma
predefinita che però è nota a chiunque legga questo codice.

Poi si pubblica come sempre (`npm run deploy`, o il push su `main` se la build
automatica è attiva).

## Come capire se sta funzionando

In **Impostazioni → Dati** c'è la riga **Archivio condiviso**:

- *collegato* più l'ora dell'ultimo scambio: tutto a posto;
- *non collegato*: i dati restano su questo dispositivo (manca uno dei tre
  passaggi qui sopra);
- un messaggio di errore: l'archivio c'è ma qualcosa non va, ed è scritto cosa.

## Come si comporta

- Ogni dispositivo manda quello che ha cambiato e chiede cos'è cambiato dopo
  l'ultima volta che si è fatto vivo. Il giro si ripete ogni pochi secondi.
- Si scambiano righe, non l'archivio intero: due persone che lavorano insieme
  non si sovrascrivono a vicenda, ognuno riscrive solo quello che ha toccato.
- Chi tocca per ultimo una stessa riga vince. Con poche persone che lavorano su
  case diverse è il caso raro.
- Senza collegamento l'app continua a funzionare sul dispositivo; quando la
  rete torna, il giro riprende da dove era rimasto.
