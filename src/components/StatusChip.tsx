import { STATUS_META, type CleaningRequest, type RequestStatus } from '@/types'
import { useConCheckIn } from '@/data/store'
import { Badge } from '@/components/ui'
import { cn } from '@/lib/utils'

export function StatusChip({ status, className, size = 'md' }: {
  status: RequestStatus; className?: string; size?: 'sm' | 'md'
}) {
  const m = STATUS_META[status]
  return (
    <Badge className={cn(m.chip, size === 'sm' && 'px-2 py-0.5 text-xs', className)}>
      <span className={cn('size-1.5 rounded-full', m.dot)} />
      {m.label}
    </Badge>
  )
}

/** Il pallino della pulizia: blu quando la ditta fa anche il check-in. */
export function StatusDot({ status, className, checkIn }: {
  status: RequestStatus; className?: string; checkIn?: boolean
}) {
  return (
    <span
      className={cn('inline-block size-1.5 rounded-full', checkIn ? 'bg-checkin' : STATUS_META[status].dot, className)}
      aria-label={checkIn ? 'Con check-in' : undefined}
    />
  )
}

/** Etichetta "Check-in" sulle schede e nel dettaglio, solo se la pulizia lo comprende. */
export function CheckInBadge({ request, className }: { request: CleaningRequest; className?: string }) {
  const conCheckIn = useConCheckIn()
  if (!conCheckIn(request)) return null
  return (
    <Badge className={cn('bg-checkin/12 text-checkin ring-1 ring-inset ring-checkin/25 px-2 py-0.5 text-xs', className)}>
      <span className="size-1.5 rounded-full bg-checkin" />
      {request.senzaPulizia ? 'Solo check-in' : 'Check-in'}
    </Badge>
  )
}
