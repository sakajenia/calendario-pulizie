# Recon ComfyHost → ProProManager

Fonte: https://comfy-host-app.web.app/ (Flutter Web CanvasKit, v1.6.5, Firebase Auth +
Firestore + Cloud Functions `europe-west3`). Ricognizione via Playwright con albero
semantico Flutter attivato + estrazione stringhe da `main.dart.js`.

## Dominio

Gestionale di **richieste di pulizia** per property manager di affitti brevi.
Integrazioni PMS rilevate: **Guesty**, **Hostaway**.

## Ruoli

| Ruolo | Sezioni |
|---|---|
| Host (osservato live) | Calendario, Richieste, Appartamenti |
| Admin (dedotto dal bundle) | + Dashboard, Utenti, Fogli di Lavoro, Catalogo Task, Extra, Magazzini, Notifiche, Export Excel, Migrazione dati |

## Stati richiesta

`In Attesa` (arancio) · `Accettata` (verde) · `In Corso` · `Da Verificare` ·
`Completata` (azzurro) · `Cancellata` · `CancellataGuesty`

## Schermate

### Login
Sfondo gradiente azzurro, card navy centrata, titolo "Benvenuto", campi Email/Password
con icona, CTA ambra "Accedi", footer "Versione 1.6.5".

### Calendario (split view)
- Sinistra: calendario mensile, dot colorati per stato, navigazione `‹ › mese anno`,
  "In data odierna", date picker.
- Destra: filtro "Filtra per nome o indirizzo" + lista card richiesta
  (chip stato, indirizzo, "Da rifare: N", Check-out, Check-in, ospiti, Note).
- FAB gialli: refresh + nuova richiesta.

### Richieste (tabella)
Colonne: `⋮` · Indirizzo · Cap/Quartiere · Città · Creazione · Stato · Check-out ·
Check-in · Ospiti in arrivo (sortable) · Letti da preparare · Note.
Header: "Filtri" + range date attivo. Footer: "Pagina 1 di 1 — (Richieste totali: 23 | Selezionate: 0)".

Pannello **Filtri**: Filtri per campo (Indirizzo) · Filtro per stato (Stato) ·
Filtri per data (Tipo filtro data = Check-out/Check-in/Creazione, Da, A) ·
`Applica` / `Cancella filtri`.

### Appartamenti (tabella)
Colonne: Nome · Indirizzo · Cap/Quartiere · Città · Letti.
Filtri: "Filtra per proprietario", "Filtra per nome o indirizzo".
Footer: "(Appartamenti filtrati: 6 | Selezionati: 0)".

### Dettaglio richiesta (dialog)
Titolo ambra "Dettaglio richiesta". Sezioni azzurre:
- Ora creazione · Stato richiesta (chip) · Note
- **Check-out, Check-in e ospiti**: Check-out, Check-in, Ospiti in arrivo
- **Letti da preparare**: elenco numerato (es. 1: Letto Matrimoniale)
- **Dati appartamento**: Nome, Indirizzo, Località, Note
- **Extra**: extra per persona (Asciugamano Viso/Bidet), extra per tipologia letto
  (Doccia/Shampoo, Federe, Saponetta, Lenzuola), **Totale extra dei letti**

## Entità

- **Apartment**: nome, indirizzo, cap/quartiere, città, letti[], note, prezzi
  (base, min, max, special, per numero ospiti), owner/host, official|temporary|spot,
  listing Guesty/Hostaway
- **CleaningRequest**: apartment, stato, creazione, checkIn/checkOut (data+ora),
  checkInPeople/checkOutPeople, letti da rifare[], extra, note, ricorrenza
- **User**: email, tipo, stato attivo, telefono, host di riferimento
- **WorkSheet / Task**: catalogo schede di lavoro + catalogo task
- **Extra**: di appartamento · dei letti · per persona
- **Warehouse (Magazzino)**, **Notification**

## Note tecniche recon
- Flutter CanvasKit: DOM leggibile solo attivando `flt-semantics-placeholder`.
- Chromium dietro il proxy dell'ambiente richiede `--ssl-version-max=tls1.2`
  (il MITM del proxy rifiuta il ClientHello TLS 1.3 post-quantum di Chrome).
