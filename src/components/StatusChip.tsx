import { STATUS_META, type RequestStatus } from '@/types'
import { Badge } from '@/components/ui'
import { cn } from '@/lib/utils'

export function StatusChip({ status, className, size = 'md' }: {
  status: RequestStatus; className?: string; size?: 'sm' | 'md'
}) {
  const m = STATUS_META[status]
  return (
    <Badge className={cn(m.chip, size === 'sm' && 'px-2 py-0.5 text-[11px]', className)}>
      <span className={cn('size-1.5 rounded-full', m.dot)} />
      {m.label}
    </Badge>
  )
}

export function StatusDot({ status, className }: { status: RequestStatus; className?: string }) {
  return <span className={cn('inline-block size-1.5 rounded-full', STATUS_META[status].dot, className)} />
}
