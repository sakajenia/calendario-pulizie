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
| `--primary` | `346 72% 31%` (#881631) | `346 56% 49%` |
| `--background` | `345 30% 98.5%` | `345 24% 6.5%` |
| `--card` | `346 60% 99.6%` | `345 22% 9%` |
| `--foreground` | `345 28% 9%` | `345 14% 95%` |
| `--muted-foreground` | `345 9% 42%` | `345 10% 63%` |
| `--border` | `345 16% 90%` | `345 14% 17%` |

Nessun neutro è grigio puro: hanno tutti una punta di 346. Bianco e nero
assoluti sono esclusi. Un grigio neutro legge come non scelto; un grigio tinto
tiene insieme l'interfaccia col bordeaux invece di farlo stonare su una base
bluastra.

Gli stati (`--status-*`) variano per luminosità oltre che per tinta, quindi
restano distinguibili anche in scala di grigi, e sono sempre accompagnati da
un'etichetta testuale.

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

## 5. Movimento

Curve di uscita esponenziali (`cubic-bezier(0.16, 1, 0.3, 1)`), 140–280 ms,
solo `transform` e `opacity`. Nessun rimbalzo, nessun elastico.
`prefers-reduced-motion` azzera tutto.

## 6. Vietato

Bianco e nero puri. Grigi neutri non tinti. Emoji al posto delle icone.
Testo in gradiente. Vetro smerigliato decorativo. Il modulo "numerone più
etichetta più statistica" da SaaS. Griglie di card identiche. Stecche colorate
laterali come accento. Em dash dentro le frasi. `h-screen` (salta su iOS
Safari). Colori scritti a mano fuori dai token, verificato da
`npm run check:tokens`.
