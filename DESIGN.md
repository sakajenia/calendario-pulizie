# Design system ProProManager

Registro **product**: il design serve il prodotto. Chi lo usa è un property
manager che alle otto di mattina deve sapere quali appartamenti girano oggi,
quanti letti si rifanno e chi ci va. La schermata si scorre, non si legge.

Fonte dei token: sito ufficiale del brand (affittibreviaroma.com).

## 1. Atmosfera

Densità 6 su 10, da applicativo di lavoro: tabelle fitte ma non compresse.
Varianza contenuta: è uno strumento, non una campagna. Movimento sobrio, solo
dove chiarisce una causa e un effetto.

## 2. Colore

Strategia **restrained**: neutri più un accento.

| Ruolo | Light | Dark |
|---|---|---|
| `--primary` (riempimento) | `346 72% 31%` (#881631) | `346 56% 49%` |
| `--brand-text` (testo) | `346 72% 31%` | `346 76% 70%` |
| `--background` | `345 30% 98.5%` | `345 24% 6.5%` |
| `--card` | `346 60% 99.6%` | `345 22% 9%` |
| `--foreground` | `345 28% 9%` | `345 14% 95%` |
| `--muted-foreground` | `345 9% 42%` | `345 10% 63%` |
| `--border` | `345 16% 90%` | `345 14% 17%` |

Nessun neutro è grigio puro: hanno tutti una punta di 346. Bianco e nero
assoluti sono esclusi. Un grigio neutro legge come non scelto; un grigio tinto
tiene insieme l'interfaccia col bordeaux invece di farlo stonare su una base
bluastra.

Il bordeaux ha **due ruoli separati**: `--primary` è un riempimento e porta il
bianco sopra, quindi resta scuro; `--brand-text` è il colore del testo su una
superficie e in tema scuro deve schiarire fino a `70%` per reggere il 4.5:1.
Confonderli è ciò che rendeva illeggibili le etichette in tema scuro.

Gli stati (`--status-*`) variano per luminosità oltre che per tinta, quindi
restano distinguibili anche in scala di grigi, e sono sempre accompagnati da
un'etichetta testuale.

Il contrasto è verificato, non stimato: `npm run check:contrast` percorre sei
pagine in entrambi i temi, compone gli sfondi traslucidi su ciò che sta sotto
ed esce con errore sotto la soglia AA.

## 3. Tipografia

| Ruolo | Famiglia |
|---|---|
| Display | Archivo 700–900, `tracking-tight` |
| Corpo | Geist 400–600 |
| Dati | Geist Mono, `tabular-nums` su ogni tabella |
| Marchio | Spectral, **solo** nel lockup del logo |

Il serif non entra nell'interfaccia: vive nel marchio e basta. Il testo lungo
si ferma a 65 caratteri.

## 4. Componenti

- **Bottoni** — riempimento pieno per l'azione primaria, ghost per il resto.
  Una sola azione primaria per schermata. Nessun alone luminoso.
- **Card** — solo quando l'elevazione dice qualcosa. Le griglie di riquadri
  identici sono sostituite da elenchi divisi da filetti, che scalano oltre i
  tre elementi e si leggono più in fretta.
- **Metriche** — banda separata da filetti sul fondo pagina, non riquadri con
  icona in un quadratino colorato. La cifra principale domina per scala.
- **Tabelle** — header maiuscolo piccolo, `aria-sort` sulla colonna attiva,
  cifre tabulari, sfumatura sul bordo quando c'è altro da scorrere.
- **Menu** — resi in portal con posizione calcolata: dentro un contenitore
  scrollabile un menu in linea viene ritagliato proprio sulle ultime righe.
- **Ombre** — tinte sulla base calda. Un'ombra neutra su un fondo caldo legge
  come sporco.

## 5. Adattamento

Sotto `md` **tutte** le tabelle dense cedono il posto ai record impilati
(`MobileRecord`): su un telefono la tabella richieste mostrava solo
l'indirizzo, e stato, date e ospiti restavano fuori schermo dietro uno
scorrimento orizzontale che nessuno fa. Le azioni secondarie in testata
restano a sola icona sotto `sm`, e le primarie tengono il verbo e nascondono
il complemento. I filtri di stato scorrono su una riga sola invece di occuparne
quattro, e le azioni secondarie restano icona sola. Il body non scorre mai in
orizzontale: lo scorrimento vive dentro il contenitore della tabella.

Il calendario si dimensiona sul proprio contenuto sotto `lg` invece di
contendersi un'altezza che non c'è. Tre trappole CSS lo rendevano illeggibile
su telefono, tutte invisibili su schermo largo: `auto-rows-fr` fa collassare le
righe sotto la loro altezza minima; `overflow: hidden` azzera l'altezza minima
automatica di un contenitore flex, così il grid gli assegna meno spazio del
contenuto; e senza `min-w-0` la larghezza minima del contenuto allarga
l'elemento oltre lo schermo.

## 6. Comprensibilità e operabilità

Ogni azione che cambia i dati produce un riscontro: senza, un'azione riuscita e
una fallita sono indistinguibili. Le azioni distruttive e di massa portano
l'annullamento nella notifica stessa, tenendo da parte lo stato precedente.

Il vocabolario di questo mestiere — foglio di lavoro, extra, letti da rifare —
non si riscrive con parole generiche, che lo renderebbero impreciso: resta
com'è e porta con sé la spiegazione, dietro un punto interrogativo che si apre
col mouse e col focus da tastiera. Una guida di primo avvio spiega i tre
concetti che reggono tutto il resto, si chiude e non torna.

`Ctrl/Cmd+K` apre la palette comandi: navigazione, azioni rapide e cambio
profilo, filtrabili scrivendo. In testata c'è anche l'innesco visibile, perché
una scorciatoia che non si vede non esiste.

## 7. Tastiera

Il primo `Tab` di ogni pagina è "Salta al contenuto": senza, si attraversa
tutta la navigazione a ogni cambio di pagina. Nei dialog il focus entra,
resta confinato finché sono aperti e torna al pulsante che li ha aperti alla
chiusura. Ogni elemento raggiungibile ha un anello di focus visibile,
verificato su tutti gli stop delle pagine più fitte.

## 8. Movimento

Curve di uscita esponenziali (`cubic-bezier(0.16, 1, 0.3, 1)`), 140–280 ms,
solo `transform` e `opacity`. Nessun rimbalzo, nessun elastico.
`prefers-reduced-motion` azzera tutto. Gli elenchi entrano in cascata con 35 ms
di scarto per elemento, azzerato dopo i primi sette: in fondo a una lista lunga
aspettare non ha senso.

## 9. Vietato

Bianco e nero puri. Grigi neutri non tinti. Emoji al posto delle icone.
Testo in gradiente. Vetro smerigliato decorativo. Il modulo "numerone più
etichetta più statistica" da SaaS. Griglie di card identiche. Stecche colorate
laterali come accento. Em dash dentro le frasi. `h-screen` (salta su iOS
Safari). Colori scritti a mano fuori dai token, verificato da
`npm run check:tokens`.
