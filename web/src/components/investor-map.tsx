import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FounderCard } from '@/components/founder-card'
import { FundNodeCard } from '@/components/fund-node-card'
import { PersonSubnodes } from '@/components/person-subnodes'
import { STAGE_LABEL } from '@/lib/format'
import { defaultEvidenceCompany, fundKey, type FundNode, type PathGraph } from '@/lib/paths'
import type { IdeaQuery, Partner, Selection } from '@/lib/types'
import type { PortfolioRequestItem, PortfolioState } from '@/hooks/use-fund-portfolios'
import { useMediaQuery } from '@/hooks/use-media-query'

const MAP_NOTICE =
  'Suggestions are based on historical investments in similar companies. A link does not guarantee investment or an introduction; your round target is not compared with fund investment sizes. A fund can be a historical match and still require a conflict check. Check the sources.'

interface MapLine {
  id: string
  a: string
  b: string
  d: string
  dashed: boolean
}

interface InvestorMapProps {
  graph: PathGraph
  query: IdeaQuery
  completed: number
  total: number
  failed: number
  riskFunds: Set<string>
  selection: Selection | null
  onSelect: (selection: Selection | null) => void
  onSelectPerson: (person: Partner) => void
  onOpenDetails?: () => void
  portfolios: Record<string, PortfolioState>
  loadableFunds: string[]
  showPortfolios: boolean
  overlayVisible: boolean
  onLoadPortfolios: (items: PortfolioRequestItem[]) => void
  onTogglePortfolios: (show: boolean) => void
  peopleCounts?: Record<string, number>
}

export function InvestorMap({
  graph,
  query,
  completed,
  total,
  failed,
  riskFunds,
  selection,
  onSelect,
  onSelectPerson,
  onOpenDetails,
  portfolios,
  loadableFunds,
  showPortfolios,
  overlayVisible,
  onLoadPortfolios,
  onTogglePortfolios,
  peopleCounts,
}: InvestorMapProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [filter, setFilter] = useState<'all' | 'paths'>('all')
  const [hover, setHover] = useState<string | null>(null)
  const [lines, setLines] = useState<MapLine[]>([])

  const containerRef = useRef<HTMLDivElement>(null)
  const founderRef = useRef<HTMLDivElement>(null)
  const founderColRef = useRef<HTMLDivElement>(null)
  const earlyColRef = useRef<HTMLDivElement>(null)
  const laterColRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef(new Map<string, HTMLButtonElement | null>())

  const loading = completed < total
  const edgeFromKeys = useMemo(() => new Set(graph.edges.map((e) => e.from)), [graph])
  const visibleEarly =
    filter === 'paths' ? graph.early.filter((node) => edgeFromKeys.has(node.key)) : graph.early

  const measure = useCallback(() => {
    const container = containerRef.current
    const founder = founderRef.current
    if (!container || !founder) {
      setLines([])
      return
    }
    const rect = container.getBoundingClientRect()
    const round = (value: number) => Math.round(value * 10) / 10
    const point = (el: HTMLElement, side: 'left' | 'right') => {
      const r = el.getBoundingClientRect()
      return {
        x: (side === 'left' ? r.left : r.right) - rect.left,
        y: r.top + r.height / 2 - rect.top,
      }
    }
    const path = (from: HTMLElement, to: HTMLElement) => {
      const p = point(from, 'right')
      const q = point(to, 'left')
      const mid = (p.x + q.x) / 2
      return `M ${round(p.x)} ${round(p.y)} C ${round(mid)} ${round(p.y)}, ${round(mid)} ${round(q.y)}, ${round(q.x)} ${round(q.y)}`
    }
    const early =
      filter === 'paths'
        ? graph.early.filter((node) => graph.edges.some((edge) => edge.from === node.key))
        : graph.early
    const next: MapLine[] = []
    for (const node of early) {
      const el = nodeRefs.current.get(`early:${node.key}`)
      if (el) next.push({ id: `f→${node.key}`, a: 'founder', b: `early:${node.key}`, d: path(founder, el), dashed: false })
    }
    for (const edge of graph.edges) {
      const fromEl = nodeRefs.current.get(`early:${edge.from}`)
      const toEl = nodeRefs.current.get(`later:${edge.to}`)
      if (fromEl && toEl) {
        next.push({ id: `${edge.from}→${edge.to}`, a: `early:${edge.from}`, b: `later:${edge.to}`, d: path(fromEl, toEl), dashed: edge.evidence.length === 0 })
      }
    }
    setLines(next)
  }, [filter, graph])

  useLayoutEffect(() => {
    measure()
  }, [measure, isDesktop, riskFunds, selection])

  useEffect(() => {
    if (!isDesktop) return
    const elements = [
      containerRef.current,
      founderColRef.current,
      earlyColRef.current,
      laterColRef.current,
    ]
    const observer = new ResizeObserver(() => measure())
    for (const el of elements) {
      if (el) observer.observe(el)
    }
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure, isDesktop])

  useEffect(() => {
    if (selection?.type !== 'fund') return
    const el = nodeRefs.current.get(`${selection.kind}:${selection.key}`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selection])

  const activeNode =
    hover ?? (selection?.type === 'fund' ? `${selection.kind}:${selection.key}` : null)

  const connectedNodes = useMemo(() => {
    if (!activeNode) return null
    const set = new Set<string>([activeNode])
    for (const line of lines) {
      if (line.a === activeNode) set.add(line.b)
      if (line.b === activeNode) set.add(line.a)
    }
    return set
  }, [activeNode, lines])

  const nodeState = (id: string) => ({
    highlighted: !!connectedNodes?.has(id),
    dimmed: !!connectedNodes && !connectedNodes.has(id),
  })

  const nextNames = (key: string) =>
    graph.edges.filter((edge) => edge.from === key && edge.evidence.length > 0).map((edge) => edge.toName)
  const prevNames = (key: string) =>
    graph.edges.filter((edge) => edge.to === key && edge.evidence.length > 0).map((edge) => edge.fromName)
  const portfolioNextNames = (key: string) =>
    graph.edges.filter((edge) => edge.from === key && edge.evidence.length === 0).map((edge) => edge.toName)
  const portfolioPrevNames = (key: string) =>
    graph.edges.filter((edge) => edge.to === key && edge.evidence.length === 0).map((edge) => edge.fromName)

  const renderNode = (node: FundNode, kind: 'early' | 'later') => {
    const id = `${kind}:${node.key}`
    const state = isDesktop ? nodeState(id) : { highlighted: false, dimmed: false }
    const parts: string[] = []
    if (!isDesktop) {
      if (kind === 'early') {
        if (nextNames(node.key).length) parts.push(`Next: ${nextNames(node.key).join(', ')}`)
        if (portfolioNextNames(node.key).length)
          parts.push(`From portfolio → ${portfolioNextNames(node.key).join(', ')}`)
      } else {
        if (prevNames(node.key).length) parts.push(`Previously: ${prevNames(node.key).join(', ')}`)
        if (portfolioPrevNames(node.key).length)
          parts.push(`Previously (portfolio): ${portfolioPrevNames(node.key).join(', ')}`)
      }
    }
    const subline = parts.join(' · ') || undefined
    const isSelected =
      selection?.type === 'fund' && selection.kind === kind && selection.key === node.key
    return (
      <div key={id} className="flex flex-col gap-2">
        <FundNodeCard
          ref={(el) => {
            nodeRefs.current.set(id, el)
          }}
          node={node}
          flagged={riskFunds.has(node.key)}
          selected={isSelected}
          highlighted={state.highlighted}
          dimmed={state.dimmed}
          subline={subline}
          peopleCounts={peopleCounts}
          onSelect={() =>
            isSelected
              ? onSelect(null)
              : onSelect({
                  type: 'fund',
                  kind,
                  key: node.key,
                  company: defaultEvidenceCompany(node),
                })
          }
          onHover={(hovering) => {
            if (isDesktop) setHover(hovering ? id : null)
          }}
        />
        {isSelected && selection?.type === 'fund' && (
          <PersonSubnodes
            company={selection.company}
            fund={node.name}
            person={selection.person}
            onSelectPerson={onSelectPerson}
            onOpenDetails={onOpenDetails}
          />
        )}
      </div>
    )
  }

  const earlyEmpty = loading ? 'Analyzing more companies…' : 'No documented rounds at the selected stage.'
  const laterEmpty = loading ? 'Analyzing more rounds…' : 'No confirmed later investors.'

  const meta = `Companies analyzed: ${completed}/${total}${failed ? ` · no funding data: ${failed}` : ''} · links between rounds: ${graph.edges.length}`

  const portfolioStates = Object.values(portfolios)
  const portfoliosDone = portfolioStates.filter((state) => state.status === 'done').length
  const portfoliosLoading = portfolioStates.filter((state) => state.status === 'loading').length
  const portfoliosErrors = portfolioStates.filter((state) => state.status === 'error').length
  const allTopDone = loadableFunds.every((fund) => portfolios[fundKey(fund)]?.status === 'done')
  const searchReady = completed >= total && total > 0

  return (
    <div className="flex flex-col gap-4">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-xs font-medium text-muted-foreground"
          >
            How to read the map
            <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p className="rounded-b-lg border border-t-0 border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {MAP_NOTICE}
          </p>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{meta}</p>
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(value) => value && setFilter(value as 'all' | 'paths')}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="all">
            All investors ({graph.early.length + graph.later.length})
          </ToggleGroupItem>
          <ToggleGroupItem value="paths">Paths only ({graph.edges.length})</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {!allTopDone && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!searchReady}
              onClick={() =>
                onLoadPortfolios(loadableFunds.map((fund) => ({ fund, stage: query.stage })))
              }
            >
              Find other startups from these funds
            </Button>
            <span className="text-xs text-muted-foreground">
              {searchReady
                ? 'Up to 6 Cala queries · about a minute each'
                : 'Available after similar companies are analyzed'}
            </span>
          </div>
        )}
        {portfoliosLoading > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
            Fund portfolios: {portfoliosDone}/{portfolioStates.length}
            {portfoliosErrors > 0 ? ` · errors: ${portfoliosErrors}` : ''}
          </span>
        )}
        {portfoliosLoading === 0 && portfoliosErrors > 0 && (
          <span className="text-xs text-muted-foreground">errors: {portfoliosErrors}</span>
        )}
        {portfoliosDone > 0 && (
          <Toggle pressed={showPortfolios} onPressedChange={onTogglePortfolios} size="sm">
            Show on map
          </Toggle>
        )}
      </div>

      {isDesktop ? (
        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <div
              ref={containerRef}
              className="relative grid min-w-[820px] grid-cols-[230px_minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-14 gap-y-4 p-6"
            >
              <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
                {lines.map((line) => {
                  const active = !!activeNode && (line.a === activeNode || line.b === activeNode)
                  return (
                    <path
                      key={line.id}
                      d={line.d}
                      fill="none"
                      stroke={active ? 'var(--brand)' : 'var(--muted-foreground)'}
                      strokeWidth={active ? 2.5 : 1.5}
                      strokeOpacity={active ? 1 : activeNode ? 0.1 : 0.35}
                      strokeDasharray={line.dashed ? '4 4' : undefined}
                      className="transition-opacity"
                    />
                  )
                })}
              </svg>
              <div ref={founderColRef} className="relative row-span-2">
                <FounderCard ref={founderRef} query={query} />
              </div>
              <div className="relative">
                <h3 className="text-sm font-semibold">{STAGE_LABEL[query.stage]} investors</h3>
                <p className="text-xs text-muted-foreground">
                  Led rounds for similar companies at this stage
                </p>
              </div>
              <div className="relative">
                <h3 className="text-sm font-semibold">Later investors</h3>
                <p className="text-xs text-muted-foreground">
                  Led later rounds for the same companies
                </p>
              </div>
              <div ref={earlyColRef} className="relative col-start-2 flex flex-col gap-3">
                {!visibleEarly.length ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">{earlyEmpty}</p>
                    {loading && <Skeleton className="h-16 w-full" />}
                  </div>
                ) : (
                  visibleEarly.map((node) => renderNode(node, 'early'))
                )}
              </div>
              <div ref={laterColRef} className="relative col-start-3 flex flex-col gap-3">
                {!graph.later.length ? (
                  <p className="text-xs text-muted-foreground">{laterEmpty}</p>
                ) : (
                  graph.later.map((node) => renderNode(node, 'later'))
                )}
              </div>
            </div>
          </div>
          <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            {overlayVisible
              ? "Solid lines show the chronology of similar companies' rounds. Dashed lines show other portfolio startups, which may not resemble your idea. Neither line confirms a relationship or introduction."
              : 'Lines show the observed chronology of rounds for the same company, not a confirmed relationship or introduction.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <FounderCard query={query} />
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold">{STAGE_LABEL[query.stage]} investors</h3>
              <p className="text-xs text-muted-foreground">
                Led rounds for similar companies at this stage
              </p>
            </div>
            {!visibleEarly.length ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">{earlyEmpty}</p>
                {loading && <Skeleton className="h-16 w-full" />}
              </div>
            ) : (
              visibleEarly.map((node) => renderNode(node, 'early'))
            )}
          </section>
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold">Later investors</h3>
              <p className="text-xs text-muted-foreground">
                Led later rounds for the same companies
              </p>
            </div>
            {!graph.later.length ? (
              <p className="text-xs text-muted-foreground">{laterEmpty}</p>
            ) : (
              graph.later.map((node) => renderNode(node, 'later'))
            )}
          </section>
          <p className="text-xs text-muted-foreground">
            {overlayVisible
              ? '"Next" and "Previously" show the observed chronology of rounds for the same company; "from portfolio" refers to other startups that may not resemble your idea. These do not confirm a relationship or introduction.'
              : '"Next" and "Previously" show the observed chronology of rounds for the same company, not a confirmed relationship or introduction.'}
          </p>
        </div>
      )}
    </div>
  )
}
