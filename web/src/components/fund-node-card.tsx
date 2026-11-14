import { forwardRef } from 'react'
import { AlertTriangle, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { defaultEvidenceCompany, type FundNode } from '@/lib/paths'
import { plural } from '@/lib/format'
import { cn } from '@/lib/utils'

interface FundNodeCardProps {
  node: FundNode
  flagged: boolean
  selected: boolean
  highlighted: boolean
  dimmed: boolean
  subline?: string
  peopleCounts?: Record<string, number>
  onSelect: () => void
  onHover: (hovering: boolean) => void
}

export const FundNodeCard = forwardRef<HTMLButtonElement, FundNodeCardProps>(function FundNodeCard(
  { node, flagged, selected, highlighted, dimmed, subline, peopleCounts, onSelect, onHover },
  ref,
) {
  const companies = [...new Set(node.evidence.map((e) => e.company))]
  const portfolio = [...new Set((node.portfolio ?? []).map((e) => e.company))]
  const portfolioOnly = companies.length === 0 && portfolio.length > 0
  const pairKey = `${defaultEvidenceCompany(node).toLowerCase()}|${node.name.toLowerCase()}`
  const peopleCount = peopleCounts?.[pairKey] ?? 0
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className={cn(
        'w-full rounded-lg border border-border bg-card p-3 text-left shadow-xs transition',
        'hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'border-brand ring-1 ring-brand/40',
        highlighted && !selected && 'border-brand/60',
        flagged && 'border-warning/60',
        portfolioOnly && 'border-dashed',
        dimmed && 'opacity-40',
      )}
    >
      <span className="block text-sm font-medium leading-snug">{node.name}</span>
      {flagged && (
        <Badge
          variant="outline"
          className="mt-1.5 border-warning/50 bg-warning-soft text-warning-foreground"
        >
          <AlertTriangle className="size-3" aria-hidden />
          Check conflict
        </Badge>
      )}
      {portfolioOnly && (
        <Badge variant="secondary" className="mt-1.5">
          From portfolio
        </Badge>
      )}
      <span className="mt-1.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0">
          {portfolioOnly ? `Startups: ${portfolio.join(', ')}` : `Invested in: ${companies.join(', ')}`}
        </span>
        <span className="shrink-0 font-mono">
          {portfolioOnly
            ? `${portfolio.length} ${plural(portfolio.length, 'startup', 'startups')}`
            : `${companies.length} ${plural(companies.length, 'example', 'examples')}`}
        </span>
      </span>
      {!portfolioOnly && portfolio.length > 0 && (
        <span className="mt-0.5 block text-xs text-muted-foreground">
          +{portfolio.length} from portfolio
        </span>
      )}
      {peopleCount > 0 && (
        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="size-3" aria-hidden />
          {peopleCount} {plural(peopleCount, 'person', 'people')}
        </span>
      )}
      {subline && <span className="mt-1 block text-xs text-muted-foreground">{subline}</span>}
    </button>
  )
})
