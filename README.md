<div align="center">

# ProProManager

**Gestionale operativo per pulizie e turnover negli affitti brevi.**

Ricostruzione completa di ComfyHost sotto il brand ProProManager®.

</div>

---

## Cos'è

Un gestionale per property manager che coordina le **richieste di pulizia** fra un
check-out e il check-in successivo: quali letti rifare, quanti ospiti in arrivo,
quali extra portare, chi ci va e a che ora.

L'app originale ([ComfyHost](https://comfy-host-app.web.app/), Flutter Web + Firebase)
è stata analizzata schermata per schermata e ricostruita qui in React con il design
system reale di ProProManager, estratto dal sito ufficiale del brand.

## Funzionalità

| Area | Contenuto |
|---|---|
| **Calendario** | Vista mese/settimana con indicatori di stato per giorno, pannello richieste affiancato, creazione rapida |
| **Richieste** | Tabella densa ordinabile, filtri per campo/stato/data, selezione multipla, cambio stato bulk, export CSV, paginazione |
| **Appartamenti** | Anagrafica, letti per tipologia, prezzi (base/min/max e per numero ospiti), note operative, provider Guesty/Hostaway |
| **Dashboard** | KPI di periodo, richieste per stato, andamento, top appartamenti, top utenti, pianificazione e budget extra |
| **Utenti** | Ruoli admin/host/operatore, attivazione, azioni bulk, migrazione dati fra host |
| **Fogli di Lavoro** | Modelli di schede di lavoro componibili dal catalogo task |
| **Catalogo Task** | Task atomici con stima in minuti e tracciamento dell'uso |
| **Extra** | Catalogo a tre scope — appartamento, letto, persona — con costi e consumo stimato |
| **Magazzini** | Depositi, codici di accesso, articoli e valore impegnato |
| **Notifiche** | Feed eventi con collegamento diretto alla richiesta |
| **Impostazioni** | Profilo, tema chiaro/scuro, statistiche personali, export ed eventuale ripristino dati |

Tre ruoli, con visibilità differenziata: l'**admin** vede tutto, l'**host** solo i propri
appartamenti e richieste, l'**operatore** solo gli interventi che gli sono assegnati.

## Design system

I token sono quelli reali del brand, presi dal sito ufficiale — non un'interpretazione.

```
primary   hsl(346 72% 31%)   #881631   bordeaux ProProManager
radius    0.5rem
```

Tutto passa da CSS custom properties semantiche (`--background`, `--foreground`,
`--primary`, `--muted`, `--border`, `--status-*`), quindi il tema chiaro/scuro e un
eventuale rebrand si fanno in un file solo: `src/index.css`.

Dettagli in [`docs/BRAND-PROPROMANAGER.md`](docs/BRAND-PROPROMANAGER.md).

## Stack

React 18 · TypeScript strict · Vite · Tailwind CSS · zustand · date-fns · Recharts · lucide-react

Nessun backend: i dati vivono in uno store persistito su `localStorage`, seminato con
un dataset ricostruito dai dati reali osservati nell'app originale (6 appartamenti di
Roma con le loro note operative, circa 90 richieste distribuite su 45 giorni).
Lo store è isolato dietro un'interfaccia, quindi sostituirlo con Firestore significa
riscrivere `src/data/store.ts` e nient'altro.

## Avvio

```bash
npm install
npm run dev          # http://localhost:5173
```

Login demo: una qualsiasi email del team (es. `aurea.consulting.marketing@gmail.com`)
con una password di almeno 6 caratteri. Il selettore in alto a destra permette di
passare da un profilo all'altro per vedere l'app con occhi diversi.

```bash
npm run build        # build di produzione
npm run typecheck    # controllo tipi
```

## Struttura

```
src/
├── components/
│   ├── brand/        logo ProProManager in SVG
│   ├── layout/       shell, sidebar, header di pagina
│   ├── requests/     dettaglio, card e form richiesta
│   └── ui/           primitive del design system
├── data/             seed e store
├── lib/              formattazione date/valuta, CSV, utility
├── pages/            una per sezione
└── types/            modello di dominio
docs/
├── RECON-COMFYHOST.md        cosa fa l'originale e come è stato analizzato
├── BRAND-PROPROMANAGER.md    design system del brand
└── AGENT-CONTRACT.md         convenzioni di implementazione
```
