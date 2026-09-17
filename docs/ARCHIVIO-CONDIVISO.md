# Archivio condiviso — cosa fare una volta sola

L'app adesso può tenere i dati in un archivio condiviso: quello che scrive il
manager arriva agli operatori in pochi secondi, sul loro telefono, senza
passaggi a mano.

Finché l'archivio non è collegato l'app continua a funzionare esattamente come
prima, con i dati sul singolo dispositivo. Non si rompe niente: si limita a
dire, in Impostazioni, che l'archivio non è collegato.

## Accenderlo

Dal computer, nella cartella del progetto:

```
npm run archivio:accendi
```

Crea il database su Cloudflare, scrive da solo il suo identificativo in
`wrangler.toml` e prepara le tabelle con i tre accessi (ProProManager, Angela,
Comfy) e le password già in uso. Si può rilanciare quante volte si vuole: se il
database c'è già non lo rifà.

Se risponde che non sei collegato a Cloudflare, prima:

```
npx wrangler login
```

Poi restano due comandi:

```
npx wrangler secret put SYNC_SECRET
npm run deploy
```

Il primo chiede una frase a piacere: firma i gettoni di accesso e non va
condivisa con nessuno. Saltandolo l'app funziona lo stesso, ma con una firma
predefinita, nota a chiunque legga questo codice.

### A mano, se si preferisce

```
npx wrangler d1 create propromanager
```

L'identificativo che risponde (`database_id`) va incollato in `wrangler.toml`.
Le tabelle e gli accessi si creano da soli alla prima apertura: non serve
eseguire lo schema a mano. (Il file `worker/schema.sql` resta come riferimento
di com'e' fatto l'archivio.)

## Come capire se sta funzionando

Se l'archivio non è collegato, in cima a ogni pagina compare un avviso giallo:
*"Archivio condiviso non collegato — quello che scrivi resta su questo
dispositivo"*. Finché si vede quell'avviso, il team non riceve niente.

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
