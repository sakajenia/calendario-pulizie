import * as React from 'react'
import { BedDouble, Home, MapPin, StickyNote, Users } from 'lucide-react'
import { Dialog, Button, Select } from '@/components/ui'
import { StatusChip } from '@/components/StatusChip'
import { useStore } from '@/data/store'
import { fmtDateTime } from '@/lib/format'
import { REQUEST_STATUSES, STATUS_META, type CleaningRequest, type ExtraLine, type RequestStatus } from '@/types'
import { cn } from '@/lib/utils'

/** Riga etichetta/valore con separatore, come nel dettaglio originale. */
function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-6 border-b border-border/60 py-2 last:border-0', className)}>
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-sm font-medium">{children}</span>
    </div>
  )
}

function Section({ title, icon: Icon, children }: {
  title: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode
}) {
  return (
    <section className="pt-5 first:pt-0">
      <h3 className="mb-1.5 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-primary">
        {Icon && <Icon className="size-4" />}
        {title}
      </h3>
      {children}
    </section>
  )
}

function ExtraTable({ lines }: { lines: ExtraLine[] }) {
  if (!lines.length) return <p className="py-2 text-sm text-muted-foreground">Nessun extra.</p>
  return (
    <div>
      {lines.map((l) => (
        <Row key={l.name} label={l.name}>{l.qty}</Row>
      ))}
    </div>
  )
}

/** Somma gli extra dei letti per nome — replica "Totale extra dei letti". */
export function totalBedExtras(req: CleaningRequest): ExtraLine[] {
  const acc = new Map<string, number>()
  for (const b of req.beds) for (const e of b.extras) acc.set(e.name, (acc.get(e.name) ?? 0) + e.qty)
  return [...acc.entries()].map(([name, qty]) => ({ name, qty }))
}

export function RequestDetail({
  request, open, onClose, onEdit,
}: { request: CleaningRequest | null; open: boolean; onClose: () => void; onEdit?: (r: CleaningRequest) => void }) {
  const apartments = useStore((s) => s.apartments)
  const users = useStore((s) => s.users)
  const workSheets = useStore((s) => s.workSheets)
  const setRequestStatus = useStore((s) => s.setRequestStatus)

  if (!request) return null
  const ap = apartments.find((a) => a.id === request.apartmentId)
  const assignee = users.find((u) => u.id === request.assigneeId)
  const sheet = workSheets.find((w) => w.id === request.workSheetId)
  const bedTotals = totalBedExtras(request)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Dettaglio richiesta"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Chiudi</Button>
          {onEdit && <Button onClick={() => onEdit(request)}>Modifica</Button>}
        </>
      }
    >
      <div className="divide-y divide-border">
        <div className="pb-4">
          <Row label="Ora creazione">{fmtDateTime(request.createdAt)}</Row>
          <Row label="Stato richiesta">
            <Select
              className="h-8 w-auto text-xs"
              value={request.status}
              options={REQUEST_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
              onChange={(e) => setRequestStatus([request.id], e.target.value as RequestStatus)}
            />
          </Row>
          <Row label="Assegnata a">{assignee?.name ?? <span className="text-muted-foreground">Non assegnata</span>}</Row>
          <Row label="Scheda di lavoro">{sheet?.name ?? <span className="text-muted-foreground">Nessuna scheda di lavoro assegnata</span>}</Row>
          <Row label="Note">
            {request.notes ? (
              <span className="block whitespace-pre-line text-left font-normal">{request.notes}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </Row>
        </div>

        <Section title="Check-out, Check-in e ospiti" icon={Users}>
          <Row label="Check-out">{fmtDateTime(request.checkOutAt)}</Row>
          <Row label="Check-in">{fmtDateTime(request.checkInAt)}</Row>
          <Row label="Ospiti in arrivo">{request.checkInPeople}</Row>
        </Section>

        <Section title="Letti da preparare" icon={BedDouble}>
          {request.beds.length ? (
            request.beds.map((b, i) => <Row key={b.bedId} label={`${i + 1}:`}>{b.type}</Row>)
          ) : (
            <p className="py-2 text-sm text-muted-foreground">Nessun letto da rifare.</p>
          )}
        </Section>

        <Section title="Dati appartamento" icon={Home}>
          <Row label="Nome">{ap?.name ?? request.spotApartmentName ?? '—'}</Row>
          <Row label="Indirizzo">{ap?.address ?? '—'}</Row>
          <Row label="Località">{ap ? `${ap.district} - ${ap.city}` : '—'}</Row>
          <Row label="Note">
            {ap?.notes ? (
              <span className="block whitespace-pre-line text-left font-normal">{ap.notes}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </Row>
        </Section>

        <Section title="Extra">
          <h4 className="pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Extra per persona ({request.checkInPeople} ospiti)
          </h4>
          <ExtraTable lines={request.perPersonExtras} />

          <h4 className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Extra di appartamento
          </h4>
          <ExtraTable lines={request.apartmentExtras} />

          {request.beds.map((b, i) => (
            <React.Fragment key={b.bedId}>
              <h4 className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {i + 1}. {b.type}
              </h4>
              <ExtraTable lines={b.extras} />
            </React.Fragment>
          ))}

          {bedTotals.length > 0 && (
            <>
              <h4 className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-primary">
                Totale extra dei letti
              </h4>
              <ExtraTable lines={bedTotals} />
            </>
          )}
        </Section>
      </div>
    </Dialog>
  )
}

/** Card compatta usata nella colonna destra del Calendario. */
export function RequestCard({
  request, onClick, active,
}: { request: CleaningRequest; onClick?: () => void; active?: boolean }) {
  const apartments = useStore((s) => s.apartments)
  const ap = apartments.find((a) => a.id === request.apartmentId)

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border bg-card p-4 text-left shadow-card transition-all hover:shadow-raised focus-ring',
        active ? 'border-primary ring-1 ring-primary' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <StatusChip status={request.status} />
        <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(request.createdAt)}</span>
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="size-4 shrink-0 text-primary" />
          <span className="truncate">{ap ? `${ap.address}, ${ap.district} - ${ap.city}` : request.spotApartmentName}</span>
        </p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <BedDouble className="size-4 shrink-0" />
          Da rifare: {request.beds.length}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-sm">
        <dt className="font-medium text-primary">Check-out</dt>
        <dd className="text-right tabular-nums">{fmtDateTime(request.checkOutAt)}</dd>
        <dt className="font-medium text-primary">Check-in</dt>
        <dd className="text-right tabular-nums">{fmtDateTime(request.checkInAt)}</dd>
        <dt className="flex items-center gap-1.5 text-muted-foreground"><Users className="size-3.5" /> Ospiti</dt>
        <dd className="text-right tabular-nums">{request.checkInPeople}</dd>
      </dl>

      {request.notes && (
        <p className="mt-3 flex gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <StickyNote className="size-3.5 shrink-0" />
          <span className="line-clamp-2 whitespace-pre-line">{request.notes}</span>
        </p>
      )}
    </button>
  )
}
