import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePartners } from '@/hooks/use-partners'
import { initials } from '@/lib/format'
import type { Partner, PartnerOrigin } from '@/lib/types'

interface PeopleSectionProps {
  company: string
  fund: string
  onSelectPerson: (person: Partner, origin: PartnerOrigin) => void
}

export function PeopleSection({ company, fund, onSelectPerson }: PeopleSectionProps) {
  const { state, retry } = usePartners(company, fund)

  return (
    <section className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        People linked to the investment
      </p>
      {state.status === 'loading' && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Searching Cala for people…</p>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      )}
      {state.status === 'error' && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">{state.message}</p>
          <Button variant="outline" size="sm" onClick={retry}>
            Try again
          </Button>
        </div>
      )}
      {state.status === 'done' && (
        <>
          {!state.data.partners.length ? (
            <p className="text-xs text-muted-foreground">No people found with a source.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {state.data.partners.map((person) => (
                <button
                  key={person.name}
                  type="button"
                  onClick={() => onSelectPerson(person, state.data.origin)}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-2.5 text-left transition hover:border-foreground/30"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                    {initials(person.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{person.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {person.role || 'Person linked to the investment'}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              ))}
            </div>
          )}
          {state.data.origin === 'cala' && (
            <p className="text-xs text-muted-foreground">
              Cala data — check the source and current role before reaching out.
            </p>
          )}
        </>
      )}
    </section>
  )
}
