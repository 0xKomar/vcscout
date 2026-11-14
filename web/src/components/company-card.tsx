import { Badge } from '@/components/ui/badge'
import { SourceLink } from '@/components/source-link'
import type { MatchEntry } from '@/hooks/use-discovery'
import { plural } from '@/lib/format'
import { cn } from '@/lib/utils'

interface CompanyCardProps {
  entry: MatchEntry
  selected: boolean
  onSelect: () => void
}

export function CompanyCard({ entry, selected, onSelect }: CompanyCardProps) {
  const { match } = entry
  const roundCount = entry.data?.rounds.length ?? 0
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4 shadow-xs transition',
        selected && 'border-brand ring-1 ring-brand/40',
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-sm font-semibold">{match.company}</span>
        {entry.status === 'loading' && (
          <Badge variant="secondary">Loading rounds…</Badge>
        )}
        {entry.status === 'done' && (
          <Badge variant="secondary">{roundCount} {plural(roundCount, 'round', 'rounds')}</Badge>
        )}
        {entry.status === 'empty' && <Badge variant="secondary">No funding data</Badge>}
        {entry.status === 'error' && <Badge variant="destructive">Error</Badge>}
      </button>
      {match.description && (
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          {match.description}
        </p>
      )}
      {match.similarity_reason && (
        <p className="mt-2 text-xs leading-relaxed">
          <span className="font-medium">Why similar:</span>{' '}
          <span className="text-muted-foreground">{match.similarity_reason}</span>
        </p>
      )}
      {match.source_url && (
        <div className="mt-2.5">
          <SourceLink url={match.source_url} label="Source" />
        </div>
      )}
    </div>
  )
}
