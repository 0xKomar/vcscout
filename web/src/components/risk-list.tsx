import { AlertTriangle, MapPinned } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SourceLink } from '@/components/source-link'
import type { RisksState } from '@/hooks/use-discovery'

interface RiskListProps {
  risks: RisksState
  onShowOnMap: (fund: string) => void
}

export function RiskList({ risks, onShowOnMap }: RiskListProps) {
  if (risks.status === 'idle' || risks.status === 'loading') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Checking for potential conflicts…</p>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (risks.status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" aria-hidden />
        <AlertTitle>Conflict check failed</AlertTitle>
        <AlertDescription>
          Could not check for conflicts. This does not mean there are none.
        </AlertDescription>
      </Alert>
    )
  }

  if (risks.status === 'skipped') {
    return (
      <p className="text-sm text-muted-foreground">
        No investors at the selected stage to check.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Checked up to 6 early-stage investors: {risks.funds.join(', ')}. No results do not mean
        there are no conflicts.
      </p>
      {risks.risks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Cala found no warning signs for the funds checked. This is not a complete portfolio review.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {risks.risks.map((risk) => (
            <div
              key={`${risk.fund}-${risk.competitor}`}
              className="rounded-lg border border-warning/40 bg-warning-soft p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{risk.fund}</p>
                <Badge variant="outline" className="border-warning/50 text-warning-foreground">
                  <AlertTriangle className="size-3" aria-hidden />
                  Potential conflict
                </Badge>
              </div>
              <p className="mt-1.5 text-xs font-medium text-warning-foreground">
                Linked to {risk.competitor}. Requires verification.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{risk.reason}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Cala identified a link to {risk.competitor}. Check the source and the fund&apos;s
                conflict policy before making a decision.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <SourceLink url={risk.source_url} label="Check source" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onShowOnMap(risk.fund)}
                  className="ml-auto"
                >
                  <MapPinned className="size-3.5" aria-hidden />
                  Show on map
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
