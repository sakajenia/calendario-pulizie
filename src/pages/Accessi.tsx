/*
 * Accessi: come si entra in ogni casa e dove si trova il materiale.
 *
 * E' la pagina che si apre sul posto, quindi la vedono anche gli addetti alle
 * pulizie; modificarla resta agli account manager. Ogni casa porta i propri
 * codici piu' due schede collegate: le foto di come lasciare la casa e la
 * scheda con composizione, accessi e materiali.
 */
import * as React from 'react'
import {
  Camera, Check, Copy, ExternalLink, FileText, KeyRound, Link2, MapPin, Pencil,
  Plus, Search, SearchX, X,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import {
  Badge, Button, Card, Dialog, EmptyState, Field, Input, Textarea,
} from '@/components/ui'
import { scopeApartments, useCurrentUser, useStore } from '@/data/store'
import { linkDellaCasa } from '@/data/linkAccessi'
import { isManager } from '@/lib/permissions'
import { useToast } from '@/components/feedback/Toast'
import { norm, plural } from '@/lib/format'
import {
  COMPANY_META,
  type AccessEntry, type Apartment, type ApartmentAccess, type CleaningCompanyId,
} from '@/types'
import { cn } from '@/lib/utils'

const emptyAccess = (): ApartmentAccess => ({ entries: [] })

function CompanyBadge({ companyId }: { companyId: CleaningCompanyId }) {
  const meta = COMPANY_META[companyId]
  return (
    <Badge className={cn(meta.chip, 'px-2 py-0.5 text-[11px]')}>
      <span className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  )
}

/** Copia il codice negli appunti: sul posto si legge dal telefono e si incolla. */
function CodeValue({ entry }: { entry: AccessEntry }) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<number>()

  React.useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(entry.value)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* Senza permesso negli appunti il codice resta comunque leggibile. */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copia ${entry.label}: ${entry.value}`}
      className="group inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-sm font-semibold transition-colors hover:bg-muted focus-ring"
    >
      <span className="truncate">{entry.value}</span>
      {copied
        ? <Check className="size-3.5 shrink-0 text-status-done" aria-hidden />
        : <Copy className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />}
    </button>
  )
}

/** Bottone verso una scheda esterna; se il link manca lo dice invece di fingere. */
function SheetLink({
  url, label, icon: Icon, onAdd,
}: {
  url?: string
  label: string
  icon: typeof Camera
  onAdd?: () => void
}) {
  /* Un link vero, non un bottone che naviga: si apre in scheda nuova e si puo'
     copiare o aprire a parte come qualunque collegamento. */
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-9 w-full select-none items-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium transition-all hover:bg-muted focus-ring [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4"
      >
        <Icon />
        <span className="truncate">{label}</span>
        <ExternalLink className="ml-auto size-3.5 shrink-0 opacity-60" />
      </a>
    )
  }
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 w-full justify-start border-dashed text-muted-foreground"
      onClick={onAdd}
      disabled={!onAdd}
      title={onAdd ? `Collega ${label.toLowerCase()}` : 'Link non ancora impostato'}
    >
      <Icon />
      <span className="truncate">{label}</span>
      {onAdd && <Link2 className="ml-auto size-3.5 shrink-0 opacity-60" />}
    </Button>
  )
}

/* ------------------------------------------------------- scheda della casa */

function AccessCard({
  apartment, mayEdit, onEdit,
}: {
  apartment: Apartment
  mayEdit: boolean
  onEdit: (a: Apartment) => void
}) {
  const access = apartment.access ?? emptyAccess()
  const link = linkDellaCasa(apartment)
  const zone = [apartment.district, apartment.city].filter(Boolean).join(' · ')

  return (
    <Card className="flex min-w-0 flex-col overflow-hidden">
      {/* Il nome va a capo invece di troncarsi: "Stazione Centrale Roma" e
          "Green House in Vaticano" non stanno su una riga in tre colonne. */}
      <div className="flex items-start gap-3 border-b border-border p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-brand">
          <KeyRound className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-sm font-bold leading-snug">{apartment.name}</h2>
          <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0">
              {apartment.address}
              {zone && ` · ${zone}`}
            </span>
          </p>
          <p className="mt-1.5">
            <CompanyBadge companyId={apartment.companyId} />
          </p>
        </div>
        {mayEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={`Modifica gli accessi di ${apartment.name}`}
            onClick={() => onEdit(apartment)}
          >
            <Pencil className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 p-4">
        {access.entries.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            Codici di accesso non ancora inseriti.
            {mayEdit && ' Apri la modifica per aggiungerli.'}
          </p>
        ) : (
          <dl className="space-y-1">
            {access.entries.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border/60 py-1.5 last:border-0"
              >
                <dt className="min-w-0 text-xs text-muted-foreground">{e.label}</dt>
                <dd className="min-w-0"><CodeValue entry={e} /></dd>
              </div>
            ))}
          </dl>
        )}

        {access.notes && (
          <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{access.notes}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border bg-muted/30 p-3">
        <SheetLink
          url={link.comeLasciare}
          label="Come lasciare la casa"
          icon={Camera}
          onAdd={mayEdit ? () => onEdit(apartment) : undefined}
        />
        <SheetLink
          url={link.infoAccessi}
          label="Info accessi e materiali"
          icon={FileText}
          onAdd={mayEdit ? () => onEdit(apartment) : undefined}
        />
      </div>
    </Card>
  )
}

/* --------------------------------------------------------- modulo modifica */

const uid = () => `ac-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

function AccessForm({
  open, onClose, apartment,
}: {
  open: boolean
  onClose: () => void
  apartment: Apartment | null
}) {
  const upsertApartment = useStore((s) => s.upsertApartment)
  const toast = useToast()
  const [draft, setDraft] = React.useState<ApartmentAccess>(emptyAccess)
  const link = apartment ? linkDellaCasa(apartment) : null

  React.useEffect(() => {
    if (!open || !apartment) return
    const a = apartment.access
    setDraft({
      entries: a ? a.entries.map((e) => ({ ...e })) : [],
      notes: a?.notes ?? '',
      leaveGuideUrl: a?.leaveGuideUrl ?? '',
      infoSheetUrl: a?.infoSheetUrl ?? '',
    })
  }, [open, apartment])

  const setEntry = (id: string, patch: Partial<AccessEntry>) =>
    setDraft((d) => ({ ...d, entries: d.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))

  const addEntry = () =>
    setDraft((d) => ({ ...d, entries: [...d.entries, { id: uid(), label: '', value: '' }] }))

  const removeEntry = (id: string) =>
    setDraft((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!apartment) return
    /* Le righe lasciate vuote non si salvano: una riga a meta' non aiuta nessuno. */
    const entries = draft.entries
      .map((x) => ({ ...x, label: x.label.trim(), value: x.value.trim() }))
      .filter((x) => x.label || x.value)
    const trim = (v?: string) => (v && v.trim() ? v.trim() : undefined)

    upsertApartment({
      ...apartment,
      access: {
        entries,
        notes: trim(draft.notes),
        leaveGuideUrl: trim(draft.leaveGuideUrl),
        infoSheetUrl: trim(draft.infoSheetUrl),
      },
    })
    onClose()
    toast({ title: `Accessi di ${apartment.name} aggiornati` })
  }

  return (
    <Dialog
      open={open && apartment !== null}
      onClose={onClose}
      title={apartment ? `Accessi · ${apartment.name}` : 'Accessi'}
      description={apartment?.address}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button form="form-accessi" type="submit">Salva</Button>
        </>
      }
    >
      <form id="form-accessi" onSubmit={submit} className="space-y-5" noValidate>
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Codici di accesso
            </h3>
            <Button type="button" variant="outline" size="sm" onClick={addEntry}>
              <Plus /> Aggiungi
            </Button>
          </div>

          {draft.entries.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              Nessun codice. Aggiungi una riga per ogni punto di accesso: cancello, portone,
              cassette, armadi.
            </p>
          ) : (
            <div className="space-y-2">
              {draft.entries.map((e, i) => (
                <div key={e.id} className="flex flex-wrap items-center gap-2">
                  <Input
                    className="min-w-[10rem] flex-1"
                    value={e.label}
                    placeholder="Es. Cassetta inferiore (pulizie)"
                    aria-label={`Punto di accesso ${i + 1}`}
                    onChange={(ev) => setEntry(e.id, { label: ev.target.value })}
                  />
                  <Input
                    className="w-32 shrink-0 font-mono"
                    value={e.value}
                    placeholder="1405"
                    aria-label={`Codice ${i + 1}`}
                    onChange={(ev) => setEntry(e.id, { value: ev.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0"
                    aria-label={`Togli la riga ${i + 1}`}
                    onClick={() => removeEntry(e.id)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <Field label="Note" htmlFor="accessi-note" hint="Dove si trovano le cassette, accorgimenti sul posto.">
          <Textarea
            id="accessi-note"
            rows={2}
            value={draft.notes ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          />
        </Field>

        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Schede collegate
          </h3>
          <Field
            label="Come lasciare la casa"
            htmlFor="accessi-foto"
            hint={link?.comeLasciareFisso
              ? 'Link fisso: uguale su tutti i dispositivi, non si cambia da qui.'
              : 'Link all’album con le foto di come va lasciata la casa.'}
          >
            <Input
              id="accessi-foto"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={(link?.comeLasciareFisso ? link.comeLasciare : draft.leaveGuideUrl) ?? ''}
              disabled={link?.comeLasciareFisso}
              onChange={(e) => setDraft((d) => ({ ...d, leaveGuideUrl: e.target.value }))}
            />
          </Field>
          <Field
            label="Info accessi e materiali"
            htmlFor="accessi-scheda"
            hint={link?.infoAccessiFisso
              ? 'Link fisso: uguale su tutti i dispositivi, non si cambia da qui.'
              : 'Link alla scheda con composizione della casa, accessi e materiali.'}
          >
            <Input
              id="accessi-scheda"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={(link?.infoAccessiFisso ? link.infoAccessi : draft.infoSheetUrl) ?? ''}
              disabled={link?.infoAccessiFisso}
              onChange={(e) => setDraft((d) => ({ ...d, infoSheetUrl: e.target.value }))}
            />
          </Field>
        </section>
      </form>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ pagina */

export default function Accessi() {
  const user = useCurrentUser()
  const allApartments = useStore((s) => s.apartments)
  const mayEdit = isManager(user)

  const [text, setText] = React.useState('')
  const [editing, setEditing] = React.useState<Apartment | null>(null)

  const apartments = React.useMemo(
    () => scopeApartments(allApartments, user), [allApartments, user],
  )

  const filtered = React.useMemo(() => {
    const q = norm(text.trim())
    if (!q) return apartments
    return apartments.filter((a) => {
      const hay = norm([
        a.name, a.address, a.district, a.city,
        COMPANY_META[a.companyId].label,
        ...(a.access?.entries.flatMap((e) => [e.label, e.value]) ?? []),
      ].join(' '))
      return hay.includes(q)
    })
  }, [apartments, text])

  const missing = apartments.filter((a) => (a.access?.entries.length ?? 0) === 0).length
  const closeForm = React.useCallback(() => setEditing(null), [])

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Accessi"
        subtitle={
          <span>
            {plural(apartments.length, 'appartamento', 'appartamenti')}
            {missing > 0 && ` · ${missing} senza codici`}
          </span>
        }
      />

      {/* Vale per tutte le case con Vikey, non per una sola: sta in testa alla
          pagina, in rosso, prima ancora della ricerca. */}
      <div className="border-b border-border bg-card px-5 pt-4">
        <p className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm leading-snug text-status-cancelled">
          <span aria-hidden className="text-base leading-none">🔒</span>
          <span>
            <strong className="font-semibold">N.B.</strong> Tutti gli accessi con Vikey: quando sulla
            porta di casa c’è la serratura automatica, oltre all’app si entra col codice sorgente{' '}
            <strong className="font-mono font-semibold">23071405</strong> Lucchetto.
          </span>
        </p>
      </div>

      <div className="border-b border-border bg-card px-5 py-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Filtra per casa, indirizzo o codice"
            className="pl-9 pr-9"
            aria-label="Filtra per casa, indirizzo o codice"
          />
          {text && (
            <button
              type="button"
              onClick={() => setText('')}
              aria-label="Azzera la ricerca"
              className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={SearchX}
              title="Nessuna casa trovata"
              description="Nessun risultato per questa ricerca."
              action={<Button variant="outline" onClick={() => setText('')}>Cancella filtro</Button>}
            />
          </Card>
        ) : (
          <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((a) => (
              <AccessCard key={a.id} apartment={a} mayEdit={mayEdit} onEdit={setEditing} />
            ))}
          </div>
        )}
      </div>

      <AccessForm open={editing !== null} onClose={closeForm} apartment={editing} />
    </div>
  )
}
