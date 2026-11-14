import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { DetailPanel } from '@/components/detail-panel'
import { FundingTimeline } from '@/components/funding-timeline'
import { SearchForm } from '@/components/search-form'
import type { CompanyState } from '@/hooks/use-company'
import { useMediaQuery } from '@/hooks/use-media-query'
import { plural } from '@/lib/format'
import type { IdeaQuery, Round, Selection } from '@/lib/types'

interface NameResultsProps {
  state: CompanyState
  onSubmitIdea: (query: IdeaQuery) => void
  onRetry: () => void
}

const EMPTY_GRAPH = { early: [], later: [], edges: [] }

export function NameResults({ state, onSubmitIdea, onRetry }: NameResultsProps) {
  const isXl = useMediaQuery('(min-width: 1280px)')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [editing, setEditing] = useState(false)

  const done = state.status === 'done' ? state.data : null
  const rounds = done?.rounds ?? []

  const detail = (
    <DetailPanel
      selection={selection}
      graph={EMPTY_GRAPH}
      risks={{ status: 'skipped' }}
      placeholder="Select a lead investor to see associated people and sources."
      onSelectionChange={setSelection}
      onCompanySelect={() => {}}
    />
  )

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-5">
        {editing && (
          <div className="rounded-xl border border-border bg-card p-4">
            <SearchForm
              onSubmitIdea={(query) => {
                setEditing(false)
                onSubmitIdea(query)
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        )}

        {state.status === 'loading' && (
          <div className="flex flex-col gap-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              Searching for {state.name}&apos;s rounds… A new query can take about a minute.
            </p>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        )}

        {state.status === 'error' && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" aria-hidden />
            <AlertTitle>Could not retrieve funding rounds</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{state.message}</span>
              <Button variant="outline" size="sm" onClick={onRetry}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {done && (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand">Explore the landscape</p>
                  <h1 className="mt-2 font-serif text-3xl tracking-[-0.035em]">{done.company}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {rounds.length} {plural(rounds.length, 'round', 'rounds')} ·{' '}
                    {done.cached ? 'saved results from November 14, 2026' : 'Cala result'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setEditing(true)
                    requestAnimationFrame(() => {
                      const input = document.getElementById('idea-input')
                      input?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                      input?.focus({ preventScroll: true })
                    })
                  }}
                >
                  Find people for your startup
                </Button>
              </div>
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                These historical rounds are research leads, not a guarantee of investment or an
                introduction. Check the sources.
              </p>
              {rounds.filter((round) => round.announcement_date && round.round_type).length ? (
                <FundingTimeline
                  company={done.company}
                  rounds={rounds}
                  onLeadSelect={(fund, round: Round) =>
                    setSelection({ type: 'lead', fund, round, company: done.company })
                  }
                  activeLeadFund={selection?.type === 'lead' ? selection.fund : undefined}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No rounds found for this name. Try another name or check the spelling.
                </p>
              )}
            </div>
            {isXl && (
              <aside className="sticky top-20 rounded-xl border border-border bg-card p-4">
                {detail}
              </aside>
            )}
          </div>
        )}
      </div>

      {!isXl && (
        <Sheet
          open={!!selection}
          onOpenChange={(open) => {
            if (!open) setSelection(null)
          }}
        >
          <SheetContent
            side="right"
            className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md"
          >
            <SheetHeader>
              <SheetTitle className="text-sm font-semibold">Details</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">{detail}</div>
          </SheetContent>
        </Sheet>
      )}
    </main>
  )
}
