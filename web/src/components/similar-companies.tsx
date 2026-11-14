import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CompanyCard } from '@/components/company-card'
import { FundingTimeline } from '@/components/funding-timeline'
import type { MatchEntry } from '@/hooks/use-discovery'
import type { Round } from '@/lib/types'

interface SimilarCompaniesProps {
  companies: MatchEntry[]
  selectedCompany: string | null
  onSelectCompany: (company: string) => void
  onLeadSelect: (fund: string, round: Round, company: string) => void
  activeLeadFund?: string
  onRetryCompany: (company: string) => void
}

export function SimilarCompanies({
  companies,
  selectedCompany,
  onSelectCompany,
  onLeadSelect,
  activeLeadFund,
  onRetryCompany,
}: SimilarCompaniesProps) {
  const selected = companies.find((entry) => entry.match.company === selectedCompany) ?? companies[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {companies.map((entry) => (
          <CompanyCard
            key={entry.match.company}
            entry={entry}
            selected={selected?.match.company === entry.match.company}
            onSelect={() => onSelectCompany(entry.match.company)}
          />
        ))}
      </div>

      {selected && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{selected.match.company}</h3>
            <Badge variant="secondary">Similar to your idea</Badge>
            {selected.status === 'done' && (
              <span className="text-xs text-muted-foreground">
                {selected.data?.cached ? 'saved results from November 14, 2026' : 'Cala result'}
              </span>
            )}
          </div>
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            These are historical rounds for a similar company — research leads, not a guarantee of
            investment or an introduction. Check the sources.
          </p>
          {selected.status === 'loading' && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}
          {selected.status === 'done' && (
            <FundingTimeline
              company={selected.match.company}
              rounds={selected.data?.rounds ?? []}
              onLeadSelect={(fund, round) => onLeadSelect(fund, round, selected.match.company)}
              activeLeadFund={activeLeadFund}
            />
          )}
          {selected.status === 'empty' && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                No funding round data for this company.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRetryCompany(selected.match.company)}
              >
                Try again
              </Button>
            </div>
          )}
          {selected.status === 'error' && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" aria-hidden />
              <AlertTitle>Could not retrieve funding rounds</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span>{selected.message}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRetryCompany(selected.match.company)}
                >
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </section>
      )}
    </div>
  )
}
