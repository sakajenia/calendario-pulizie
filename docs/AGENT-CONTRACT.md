# Contratto di implementazione — pagine ProProManager

Stack: React 18 + TypeScript strict + Vite + Tailwind 3 + zustand. Alias `@/` → `src/`.
Lingua UI: **italiano**. Nessuna libreria nuova: usa solo quelle già in `package.json`
(`lucide-react`, `date-fns`, `recharts`, `react-router-dom`, `zustand`, `clsx`, `tailwind-merge`).

## Regole non negoziabili
1. **Design token only.** Mai colori hard-coded. Usa le classi semantiche:
   `bg-background text-foreground bg-card border-border text-muted-foreground
   bg-primary text-primary-foreground bg-muted bg-secondary text-destructive`
   e per gli stati `bg-status-pending|accepted|progress|verify|done|cancelled`.
   Il brand è bordeaux `hsl(346 72% 31%)`; arriva da `--primary`, non scriverlo mai a mano.
2. **Dark mode**: funziona già via token. Non aggiungere varianti `dark:` con colori fissi.
3. TypeScript strict: niente `any`, niente variabili non usate (`noUnusedLocals` è attivo).
4. Ogni pagina esporta **default** un componente React senza props.
5. Responsive: la tabella densa sta in un contenitore `overflow-x-auto`; il body non scrolla mai in orizzontale.
6. Commenti in italiano, solo dove spiegano un *perché* non ovvio. Niente commenti didascalici.

## Primitive disponibili — `@/components/ui`
```ts
Button        // props: variant 'default'|'secondary'|'outline'|'ghost'|'destructive'|'link'
              //        size 'sm'|'md'|'lg'|'icon'|'pill', loading
Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
Input, Textarea, Label
Field         // { label, hint?, error?, children }
Select        // { options: {value,label}[], ...selectProps }
Badge
Checkbox      // { checked, indeterminate?, onChange(v), label?, disabled? }
Switch        // { checked, onChange(v), label? }
Dialog        // { open, onClose, title?, description?, children, footer?, size?: 'sm'|'md'|'lg'|'xl' }
Dropdown      // { trigger, children, align? }
DropdownItem  // { danger?, ...buttonProps }
DropdownSeparator
Table, Th, Td
Tabs          // { value, onChange, items: {value,label,count?}[] }
EmptyState    // { icon?, title, description?, action? }
Skeleton, Tooltip
```

## Altri componenti
```ts
import { PageHeader } from '@/components/layout/AppShell'   // { title, subtitle?, actions? }
import { StatusChip, StatusDot } from '@/components/StatusChip'
import { RequestDetail, RequestCard, totalBedExtras } from '@/components/requests/RequestDetail'
import { RequestForm } from '@/components/requests/RequestForm'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { cn } from '@/lib/utils'
```

`RequestDetail`: `{ request, open, onClose, onEdit? }` — dialog di dettaglio.
`RequestCard`: `{ request, onClick?, active? }` — card compatta.
`RequestForm`: `{ open, onClose, initial?, defaultDate? }` — crea/modifica.

## Formattazione — `@/lib/format`
```ts
fmtDateTime(v)  // 31-08-2026 10:00      fmtDate(v)   // 31-08-2026
fmtTime(v)      // 10:00                 fmtDayLong(v)// lunedì 31 agosto 2026
fmtMonthYear(v) // agosto 2026           fmtRelative(v)
sameDay(a,b), fmtEur(n), fmtNum(n), plural(n,'richiesta','richieste')
norm(s)         // lowercase senza accenti, per le ricerche
toCsv(rows, headers?), downloadFile(name, content, mime?)
asDate(v)       // string|Date -> Date
```

## Store — `@/data/store`
```ts
import { useStore, useCurrentUser, useIsAdmin, scopeApartments, scopeRequests, emptyFilters } from '@/data/store'

// stato
useStore(s => s.users | s.apartments | s.requests | s.taskCatalog | s.workSheets
             | s.extraCatalog | s.warehouses | s.notifications | s.filters)

// azioni
setFilters(partial), resetFilters()
upsertRequest(r), setRequestStatus(ids[], status), deleteRequests(ids[])
upsertApartment(a), deleteApartment(id)
upsertUser(u), deleteUser(id), setUsersActive(ids[], active)
upsertTask(t), deleteTask(id)
upsertWorkSheet(w), deleteWorkSheet(id)
upsertExtra(e), deleteExtra(id)
upsertWarehouse(w), deleteWarehouse(id)
markNotification(id, read), markAllNotificationsRead()
resetData(), logout(), switchUser(id)
```
**Scoping ruoli**: usa sempre `scopeRequests(requests, user)` e `scopeApartments(apartments, user)`
prima di mostrare i dati — un host vede solo i propri.

Seleziona un campo alla volta (`useStore(s => s.requests)`), mai un oggetto nuovo:
lo store non usa shallow-compare e ricreare un oggetto causa loop di render.

## Tipi — `@/types`
`User`(role: 'admin'|'host'|'operator'), `Apartment`, `Bed`, `CleaningRequest`, `RequestBed`,
`ExtraLine`, `TaskCatalogItem`, `WorkSheet`, `ExtraCatalogItem`(scope 'apartment'|'bed'|'person'),
`Warehouse`, `AppNotification`, `RequestStatus`, `REQUEST_STATUSES`, `STATUS_META`.

`STATUS_META[status]` → `{ label, dot, chip }` con le classi Tailwind già pronte.

## Riferimento visivo dell'originale (ComfyHost)
- Tabelle dense, righe ~48px, header maiuscolo piccolo, footer con conteggi
  tipo `Pagina 1 di 1 — (Richieste totali: 23 | Selezionate: 0)`.
- Selezione multipla con checkbox in prima colonna + azioni bulk.
- Menu `⋮` a inizio riga con azioni (Visualizza, Modifica, Cambia stato, Elimina).
- Pannello filtri laterale con sezioni: *Filtri per campo*, *Filtro per stato*, *Filtri per data*
  (tipo filtro + Da + A), pulsanti `Applica` / `Cancella filtri`.
