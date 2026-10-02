import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, Checkbox, Dialog, Field, Input, Select, Switch, Textarea } from '@/components/ui'
import { useCurrentUser, useStore, scopeApartments } from '@/data/store'
import { richiedeCheckIn } from '@/lib/checkin'
import { REQUEST_STATUSES, STATUS_META, type CleaningRequest, type ExtraLine, type RequestBed, type RequestStatus } from '@/types'
import { TODAY } from '@/data/seed'

/** Una riga della scheda di lavoro: tutta la riga si tocca, comodo da telefono. */
function Opzione({ attiva, onChange, nome, children }: {
  attiva: boolean; onChange: (v: boolean) => void; nome: string; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={attiva}
      aria-label={nome}
      onClick={() => onChange(!attiva)}
      className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left transition-colors hover:bg-muted/60 focus-ring"
    >
      <span
        className={cn(
          'grid size-4 shrink-0 place-items-center rounded border transition-colors',
          attiva ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background',
        )}
      >
        {attiva && <Check className="size-3" strokeWidth={3} />}
      </span>
      {children}
    </button>
  )
}

const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * Un campo data svuotato o incompleto arriva come stringa vuota: `new Date('')`
 * e' una data non valida e `toISOString` lancia. Si tiene l'ultimo valore buono.
 */
const parseLocalInput = (value: string): string | null => {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function blank(apartmentId: string, hostId: string, date = TODAY): CleaningRequest {
  const co = new Date(date); co.setHours(10, 0, 0, 0)
  const ci = new Date(date); ci.setHours(15, 0, 0, 0)
  return {
    /* L'orario nell'identificativo dice che la pulizia e' stata creata qui
       dentro: l'allineamento dei dati di riferimento non deve toccarla. */
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    apartmentId, hostId, status: 'in_attesa',
    createdAt: new Date().toISOString(),
    checkOutAt: co.toISOString(), checkInAt: ci.toISOString(),
    checkInPeople: 2, beds: [], perPersonExtras: [], apartmentExtras: [], notes: '',
  }
}

export function RequestForm({
  open, onClose, initial, defaultDate,
}: { open: boolean; onClose: () => void; initial?: CleaningRequest | null; defaultDate?: Date }) {
  const user = useCurrentUser()
  const allApartments = useStore((s) => s.apartments)
  const extraCatalog = useStore((s) => s.extraCatalog)
  const workSheets = useStore((s) => s.workSheets)
  const users = useStore((s) => s.users)
  const upsertRequest = useStore((s) => s.upsertRequest)

  const apartments = React.useMemo(() => scopeApartments(allApartments, user), [allApartments, user])
  const [draft, setDraft] = React.useState<CleaningRequest>(
    () => initial ?? blank(apartments[0]?.id ?? '', user?.id ?? '', defaultDate),
  )
  const [error, setError] = React.useState<string>()
  const [checkInAcceso, setCheckInAcceso] = React.useState(false)
  const [conPulizia, setConPulizia] = React.useState(!initial?.senzaPulizia)

  React.useEffect(() => {
    if (!open) return
    setError(undefined)
    const iniziale = initial ?? blank(apartments[0]?.id ?? '', user?.id ?? '', defaultDate)
    setCheckInAcceso(richiedeCheckIn(iniziale, allApartments))
    setConPulizia(!iniziale.senzaPulizia)
    setDraft(initial ?? blank(apartments[0]?.id ?? '', user?.id ?? '', defaultDate))
  }, [open, initial, defaultDate, apartments, user?.id])

  const apartment = apartments.find((a) => a.id === draft.apartmentId)

  /* Su una richiesta nuova, cambiando casa l'interruttore riparte da come e'
     impostata quella casa. */
  const checkInDiSerie = Boolean(apartment?.checkIn?.attivo)
  React.useEffect(() => {
    if (open && !initial) setCheckInAcceso(checkInDiSerie)
  }, [open, initial, draft.apartmentId, checkInDiSerie])
  const set = <K extends keyof CleaningRequest>(k: K, v: CleaningRequest[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))

  /** Gli extra dei letti seguono la tipologia del letto selezionato. */
  const bedExtrasFor = React.useCallback(
    (type: RequestBed['type']): ExtraLine[] =>
      extraCatalog
        .filter((e) => e.scope === 'bed' && (e.bedTypes?.includes(type) ?? false))
        .map((e) => ({ name: e.name, qty: e.name.toLowerCase().includes('doccia') ? 4 : e.name === 'Federe' ? 2 : e.name.startsWith('Lenzuola') ? 2 : 1 })),
    [extraCatalog],
  )

  const toggleBed = (bedId: string) => {
    const bed = apartment?.beds.find((b) => b.id === bedId)
    if (!bed) return
    setDraft((d) => {
      const has = d.beds.some((b) => b.bedId === bedId)
      return {
        ...d,
        beds: has
          ? d.beds.filter((b) => b.bedId !== bedId)
          : [...d.beds, { bedId, type: bed.type, extras: bedExtrasFor(bed.type) }],
      }
    })
  }

  const recalcPerPerson = (guests: number) =>
    extraCatalog.filter((e) => e.scope === 'person').map((e) => ({ name: e.name, qty: guests }))

  const submit = () => {
    if (!draft.apartmentId) return setError('Scegli appartamento')
    if (draft.checkInPeople <= 0) return setError('Inserire un numero di ospiti in ingresso superiore a 0')
    if (!conPulizia && !checkInAcceso) return setError('Scegli cosa c’è da fare: pulizia, check-in o tutti e due')
    if (conPulizia && !draft.beds.length) return setError('Selezionare almeno un letto da rifare')
    if (draft.recurrence?.enabled && draft.recurrence.everyDays < 1)
      return setError('La frequenza della pulizia ricorrente deve essere di almeno 1 giorno')
    if (conPulizia && new Date(draft.checkInAt) < new Date(draft.checkOutAt))
      return setError('La data di check-in non può essere precedente alla data di check-out')

    /* Si salva la scelta solo se diversa da quella di serie della casa: cosi'
       accendere l'opzione sulla casa vale anche per questa pulizia. */
    const diSerie = Boolean(apartment?.checkIn?.attivo)
    upsertRequest({
      ...draft,
      checkIn: checkInAcceso === diSerie ? undefined : checkInAcceso,
      senzaPulizia: conPulizia ? undefined : true,
      /* Solo check-in: in calendario sta nel giorno dell'arrivo. */
      ...(conPulizia ? {} : { checkOutAt: draft.checkInAt, workSheetId: undefined }),
      hostId: apartment?.ownerId ?? draft.hostId,
      perPersonExtras: draft.perPersonExtras.length ? draft.perPersonExtras : recalcPerPerson(draft.checkInPeople),
      apartmentExtras: draft.apartmentExtras.length
        ? draft.apartmentExtras
        : extraCatalog.filter((e) => e.scope === 'apartment').slice(0, 2).map((e) => ({ name: e.name, qty: 2 })),
    })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Modifica richiesta' : 'Nuova richiesta di pulizia'}
      description="Check-out, check-in, ospiti in arrivo e letti da preparare."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={submit}>{initial ? 'Salva modifiche' : 'Crea richiesta'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Appartamento">
            <Select
              value={draft.apartmentId}
              options={apartments.map((a) => ({ value: a.id, label: `${a.name} · ${a.district}` }))}
              onChange={(e) => setDraft((d) => ({ ...d, apartmentId: e.target.value, beds: [] }))}
            />
          </Field>
          <Field label="Stato richiesta">
            <Select
              value={draft.status}
              options={REQUEST_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
              onChange={(e) => set('status', e.target.value as RequestStatus)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {conPulizia && (
            <Field label="Data e ora di uscita (Check-out)">
              <Input
                type="datetime-local"
                value={toLocalInput(draft.checkOutAt)}
                onChange={(e) => { const v = parseLocalInput(e.target.value); if (v) set('checkOutAt', v) }}
              />
            </Field>
          )}
          <Field label="Data e ora di arrivo (Check-in)">
            <Input
              type="datetime-local"
              value={toLocalInput(draft.checkInAt)}
              onChange={(e) => { const v = parseLocalInput(e.target.value); if (v) set('checkInAt', v) }}
            />
          </Field>
          <Field label="Ospiti in arrivo">
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              /* Svuotando il campo per riscrivere il numero non deve comparire uno 0. */
              value={draft.checkInPeople || ''}
              onChange={(e) => {
                const n = Math.max(0, Math.floor(Number(e.target.value)))
                setDraft((d) => ({ ...d, checkInPeople: n, perPersonExtras: recalcPerPerson(n) }))
              }}
            />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Scelta letti da rifare</p>
          <div className="space-y-1.5 rounded-lg border border-border p-3">
            {apartment?.beds.length ? (
              apartment.beds.map((b, i) => (
                <label key={b.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
                  <Checkbox
                    checked={draft.beds.some((x) => x.bedId === b.id)}
                    onChange={() => toggleBed(b.id)}
                    label={b.type}
                  />
                  <span className="text-sm">{i + 1}. {b.type}</span>
                </label>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nessun letto configurato per questo appartamento.</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Scheda di lavoro: cosa c'e' da fare. Pulizia, check-in o tutti e
              due; il solo check-in serve quando la casa e' gia' pulita e la
              ditta deve solo accogliere gli ospiti. */}
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium">Scheda di lavoro</legend>
            <div className="divide-y divide-border rounded-lg border border-border">
              <div className="space-y-2 p-1">
                <Opzione attiva={conPulizia} onChange={setConPulizia} nome="Pulizia">
                  <span className="text-sm font-medium">Pulizia</span>
                </Opzione>
                {conPulizia && (
                  <div className="px-2 pb-2"><Select
                    aria-label="Tipo di pulizia"
                    value={draft.workSheetId ?? ''}
                    options={[{ value: '', label: 'Pulizia (senza scheda)' }, ...workSheets.map((w) => ({ value: w.id, label: w.name }))]}
                    onChange={(e) => set('workSheetId', e.target.value || undefined)}
                  /></div>
                )}
              </div>
              <div className="p-1">
              <Opzione attiva={checkInAcceso} onChange={setCheckInAcceso} nome="Check-in">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="inline-block size-2 rounded-full bg-checkin" />
                  Check-in
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {apartment?.checkIn?.attivo ? 'di serie per questa casa' : 'lo fa la ditta'}
                </span>
              </Opzione>
              </div>
            </div>
          </fieldset>
          <Field label="Assegnata a">
            <Select
              value={draft.assigneeId ?? ''}
              options={[
                { value: '', label: 'Non assegnata' },
                ...users.filter((u) => u.role === 'operator' && u.active).map((u) => ({ value: u.id, label: u.name })),
              ]}
              onChange={(e) => set('assigneeId', e.target.value || undefined)}
            />
          </Field>
        </div>

        <Field label="Note">
          <Textarea
            rows={4}
            placeholder="Istruzioni per l'operatore: keybox, refill, impianti…"
            value={draft.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Rendi pulizia ricorrente</p>
            <p className="text-xs text-muted-foreground">Ripete la richiesta a intervalli regolari.</p>
          </div>
          <Switch
            checked={draft.recurrence?.enabled ?? false}
            onChange={(v) => set('recurrence', { enabled: v, everyDays: draft.recurrence?.everyDays ?? 7, until: draft.recurrence?.until })}
            label="Rendi pulizia ricorrente"
          />
        </div>

        {draft.recurrence?.enabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Frequenza pulizia (giorni)">
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={draft.recurrence.everyDays || ''}
                onChange={(e) => set('recurrence', { ...draft.recurrence!, everyDays: Math.max(0, Math.floor(Number(e.target.value))) })}
              />
            </Field>
            <Field label="Data fine ricorrenza">
              <Input
                type="date"
                value={draft.recurrence.until?.slice(0, 10) ?? ''}
                onChange={(e) => set('recurrence', { ...draft.recurrence!, until: parseLocalInput(e.target.value) ?? undefined })}
              />
            </Field>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-status-cancelled">{error}</p>
        )}
      </div>
    </Dialog>
  )
}
