import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePartners } from '@/hooks/use-partners'
import { initials } from '@/lib/format'
import type { Partner } from '@/lib/types'
import { cn } from '@/lib/utils'

interface PersonSubnodesProps {
  company: string
  fund: string
  person?: Partner
  onSelectPerson: (person: Partner) => void
  onOpenDetails?: () => void
}

const TICK =
  "relative before:absolute before:-left-3 before:top-5 before:h-px before:w-3 before:bg-border before:content-['']"

export function PersonSubnodes({
  company,
  fund,
  person,
  onSelectPerson,
  onOpenDetails,
}: PersonSubnodesProps) {
  const { state, retry } = usePartners(company, fund)

  return (
    <div className="ml-4 flex flex-col gap-1.5 border-l border-border pl-3">
      <p className={cn('text-xs text-muted-foreground', TICK)}>People linked to the investment in {company}</p>
      {state.status === 'loading' && (
        <div className="flex flex-col gap-1.5">
          <p className={cn('text-xs text-muted-foreground', TICK)}>Searching Cala for people…</p>
          <Skeleton className={cn('h-9 w-full', TICK)} />
          <Skeleton className={cn('h-9 w-full', TICK)} />
        </div>
      )}
      {state.status === 'error' && (
        <div className={cn('flex flex-wrap items-center gap-2', TICK)}>
          <p className="text-xs text-muted-foreground">{state.message}</p>
          <Button variant="outline" size="sm" onClick={retry}>
            Try again
          </Button>
        </div>
      )}
      {state.status === 'done' && !state.data.partners.length && (
        <p className={cn('text-xs text-muted-foreground', TICK)}>
          No people found with a source.
        </p>
      )}
      {state.status === 'done' &&
        state.data.partners.map((item) => {
          const active = person?.name === item.name
          return (
            <button
              key={item.name}
              type="button"
              aria-pressed={active}
              onClick={() => onSelectPerson(item)}
              className={cn(
                TICK,
                'flex items-center gap-2 rounded-lg border bg-card p-2 text-left transition',
                active
                  ? 'border-brand ring-1 ring-brand/40'
                  : 'border-border hover:border-foreground/30',
              )}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
                {initials(item.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{item.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.role || 'Person linked to the investment'}
                </span>
              </span>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          )
        })}
      {onOpenDetails && (
        <Button
          variant="ghost"
          size="sm"
          className={cn('self-start text-xs', TICK)}
          onClick={onOpenDetails}
        >
          Fund details
        </Button>
      )}
    </div>
  )
}
