import { AlertTriangle, Landmark, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { PortfolioState } from '@/hooks/use-fund-portfolios'
import type { GraphEdge, GraphNode } from '@/lib/graph'
import { plural } from '@/lib/format'

interface GraphFundDetailProps {
  node: GraphNode
  edges: GraphEdge[]
  labelById: Record<string, string>
  portfolioState?: PortfolioState
  onLoadPortfolio: () => void
  onSelectNode: (id: string) => void
}

export function GraphFundDetail({
  node,
  edges,
  labelById,
  portfolioState,
  onLoadPortfolio,
  onSelectNode,
}: GraphFundDetailProps) {
  const connected = edges.filter(
    (edge) =>
      edge.kind === 'round' && (edge.source === node.id || edge.target === node.id),
  )
  const people = edges.filter((edge) => edge.kind === 'person-fund' && edge.target === node.id)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-sm font-semibold text-secondary-foreground">
          <Landmark className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{node.label}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {node.route === 1 && <Badge variant="secondary">Your stage</Badge>}
            {node.route === 2 && <Badge variant="secondary">Next round</Badge>}
            {node.flagged && (
              <Badge
                variant="outline"
                className="border-warning/50 bg-warning-soft text-warning-foreground"
              >
                <AlertTriangle className="size-3" aria-hidden />
                Check conflict
              </Badge>
            )}
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Graph connections
        </p>
        {!connected.length && !people.length && (
          <p className="text-xs text-muted-foreground">No connections in the graph.</p>
        )}
        <div className="flex flex-col gap-1.5">
          {connected.map((edge) => (
            <button
              key={edge.id}
              type="button"
              onClick={() => onSelectNode(edge.source === node.id ? edge.target : edge.source)}
              className="rounded-lg border border-border bg-muted/30 p-2.5 text-left text-xs hover:border-foreground/30"
            >
              <span className="font-semibold">
                {labelById[edge.source === node.id ? edge.target : edge.source]}
              </span>
              <span className="mt-0.5 block text-muted-foreground">{edge.label}</span>
            </button>
          ))}
          {people.map((edge) => (
            <button
              key={edge.id}
              type="button"
              onClick={() => onSelectNode(edge.source)}
              className="rounded-lg border border-border bg-muted/30 p-2.5 text-left text-xs hover:border-foreground/30"
            >
              <span className="font-semibold">{labelById[edge.source]}</span>
              <span className="mt-0.5 block text-muted-foreground">{edge.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Other startups in {node.label}&apos;s portfolio
        </p>
        {!portfolioState && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <Button variant="outline" size="sm" onClick={onLoadPortfolio}>
              See more
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              A new query takes about a minute and uses Cala credits.
            </p>
          </div>
        )}
        {portfolioState?.status === 'loading' && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
            Searching for startups in {node.label}&apos;s portfolio…
          </p>
        )}
        {portfolioState?.status === 'error' && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">{portfolioState.message}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={onLoadPortfolio}>
              Try again
            </Button>
          </div>
        )}
        {portfolioState?.status === 'done' && (
          <p className="text-xs text-muted-foreground">
            Added to the graph: {portfolioState.companies.length}{' '}
            {plural(portfolioState.companies.length, 'startup', 'startups')}
          </p>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          These Cala examples are not a complete portfolio or a measure of how often paths occur.
          These startups may not be similar to your idea. Check the sources.
        </p>
      </section>
    </div>
  )
}

export function GraphLinkList({
  node,
  edges,
  labelById,
}: {
  node: GraphNode
  edges: GraphEdge[]
  labelById: Record<string, string>
  onSelectNode?: (id: string) => void
}) {
  const connected = edges.filter((edge) => edge.source === node.id || edge.target === node.id)
  if (!connected.length) return null
  return (
    <section className="flex flex-col gap-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Graph connections
      </p>
      <div className="flex flex-col gap-1">
        {connected.map((edge) => (
          <p key={edge.id} className="text-xs text-muted-foreground">
            {labelById[edge.source]} → {labelById[edge.target]}
            {edge.label ? ` (${edge.label})` : ''}
          </p>
        ))}
      </div>
    </section>
  )
}
