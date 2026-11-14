import { useMemo, useState } from 'react'
import { AlertTriangle, FileSearch, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { DetailPanel } from '@/components/detail-panel'
import { ExplorerGraphView, type GraphExplore } from '@/components/explorer-graph'
import { GraphDetailPanel } from '@/components/graph-detail-panel'
import { InvestorMap } from '@/components/investor-map'
import { ProgressSteps } from '@/components/progress-steps'
import { QuerySummary } from '@/components/query-summary'
import { RiskList } from '@/components/risk-list'
import { SimilarCompanies } from '@/components/similar-companies'
import type { DiscoveryState } from '@/hooks/use-discovery'
import { useExploredStartups } from '@/hooks/use-explored-startups'
import { useFounders } from '@/hooks/use-founders'
import { useFundPortfolios } from '@/hooks/use-fund-portfolios'
import { useMediaQuery } from '@/hooks/use-media-query'
import { usePeoplePrefetch } from '@/hooks/use-people-prefetch'
import { personKey, usePersonInvestments } from '@/hooks/use-person-investments'
import { useResolvedPartners } from '@/hooks/use-partners'
import {
  defaultEvidenceCompany,
  extendGraph,
  fundKey,
  fundPortfolioPaths,
  peoplePairs,
  preparePaths,
  roundLevel,
  stageLevel,
  type PortfolioPath,
} from '@/lib/paths'
import { buildExplorerGraph, type ExplorerGraph, type GraphNode } from '@/lib/graph'
import { layoutGraph, type XY } from '@/lib/graph-layout'
import type {
  CompanyRounds,
  FundStage,
  IdeaQuery,
  Partner,
  Round,
  Selection,
} from '@/lib/types'

interface IdeaResultsProps {
  state: DiscoveryState
  onSubmitIdea: (query: IdeaQuery) => void
  onSubmitName: (name: string) => void
  retrySimilar: () => void
  retryCompany: (company: string) => void
}

type TabValue = 'map' | 'companies' | 'risks'

export function IdeaResults({
  state,
  onSubmitIdea,
  onSubmitName,
  retrySimilar,
  retryCompany,
}: IdeaResultsProps) {
  const isXl = useMediaQuery('(min-width: 1280px)')
  const [tab, setTab] = useState<TabValue>('map')
  const [view, setView] = useState<'graph' | 'paths'>('graph')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [graphSelection, setGraphSelection] = useState<string | null>(null)
  const [graphPerson, setGraphPerson] = useState<{
    person: Partner
    fund: string
    company: string
  } | null>(null)
  const [graphLayout, setGraphLayout] = useState<{
    model: ExplorerGraph
    positions: Record<string, XY>
    moved: Set<string>
  } | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [showPortfolios, setShowPortfolios] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)

  const exclude =
    state.similar.status === 'done' ? state.similar.matches.map((match) => match.company) : []
  const portfolios = useFundPortfolios(exclude)
  const personInvestments = usePersonInvestments()
  const exploredStartups = useExploredStartups()
  const resolvedPartners = useResolvedPartners()
  const similarMatches = useMemo(
    () => (state.similar.status === 'done' ? state.similar.matches : []),
    [state.similar],
  )
  const founders = useFounders(similarMatches)

  const companies = state.companies
  const completed = companies.filter((entry) => entry.status !== 'loading').length
  const failed = companies.filter((entry) => entry.status === 'empty' || entry.status === 'error').length

  const graph = useMemo(() => {
    const done = companies
      .filter((entry) => entry.status === 'done' && entry.data)
      .map((entry) => entry.data as CompanyRounds)
    return preparePaths(done, stageLevel(state.query.stage))
  }, [companies, state.query.stage])

  const riskFunds = useMemo(
    () =>
      new Set(
        state.risks.status === 'done' ? state.risks.risks.map((risk) => fundKey(risk.fund)) : [],
      ),
    [state.risks],
  )

  const portfolioInputs = useMemo(
    () =>
      graph.early
        .filter((node) => portfolios.portfolios[node.key]?.status === 'done')
        .map((node) => ({
          fund: node.name,
          paths: fundPortfolioPaths(
            node.name,
            (portfolios.portfolios[node.key] as { companies: CompanyRounds[] }).companies,
            stageLevel(state.query.stage),
          ),
        })),
    [graph, portfolios.portfolios, state.query.stage],
  )

  const portfolioPathsByKey = useMemo(() => {
    const map: Record<string, PortfolioPath[]> = {}
    for (const input of portfolioInputs) map[fundKey(input.fund)] = input.paths
    return map
  }, [portfolioInputs])

  const overlayVisible = showPortfolios && portfolioInputs.length > 0

  const displayGraph = useMemo(
    () => (overlayVisible ? extendGraph(graph, portfolioInputs) : graph),
    [graph, overlayVisible, portfolioInputs],
  )

  const prefetchPairs = useMemo(() => peoplePairs(graph), [graph])
  const peoplePrefetch = usePeoplePrefetch(
    prefetchPairs,
    companies.length > 0 && completed === companies.length,
  )

  const matchesByCompany = useMemo(
    () =>
      Object.fromEntries(
        (state.similar.status === 'done' ? state.similar.matches : []).map((match) => [
          match.company.toLowerCase(),
          match,
        ]),
      ),
    [state.similar],
  )

  const roundsByCompany = useMemo(() => {
    const map: Record<string, CompanyRounds> = {}
    for (const entry of companies) {
      if (entry.status === 'done' && entry.data) {
        const data = entry.data as CompanyRounds
        map[data.company.toLowerCase()] = data
      }
    }
    return map
  }, [companies])

  const graphModel = useMemo(() => {
    const portfolioDone = Object.values(portfolios.portfolios).filter(
      (item): item is Extract<typeof item, { status: 'done' }> => item.status === 'done',
    )
    const personDone = Object.values(personInvestments.states).filter(
      (item): item is Extract<typeof item, { status: 'done' }> => item.status === 'done',
    )
    const exploredDone = Object.values(exploredStartups.states).filter(
      (item): item is Extract<typeof item, { status: 'done' }> => item.status === 'done',
    )
    return buildExplorerGraph({
      query: state.query,
      matches: state.similar.status === 'done' ? state.similar.matches : [],
      roundsByCompany,
      base: graph,
      riskFunds,
      partners: resolvedPartners,
      portfolios: portfolioDone.map((item) => ({
        fund: item.fund,
        companies: item.companies,
        startLevel: item.stage === 'series-b' ? 2 : item.stage === 'series-a' ? 1 : 0,
      })),
      personInvestments: personDone,
      explored: exploredDone.map((item) => item.data),
      founders: founders.list,
    })
  }, [
    state.query,
    state.similar,
    roundsByCompany,
    graph,
    riskFunds,
    resolvedPartners,
    portfolios.portfolios,
    personInvestments.states,
    exploredStartups.states,
    founders.list,
  ])

  if (graphLayout?.model !== graphModel) {
    const moved = graphLayout?.moved ?? new Set<string>()
    const pinned: Record<string, XY> = {}
    for (const id of moved) {
      const position = graphLayout?.positions[id]
      if (position) pinned[id] = position
    }
    setGraphLayout({
      model: graphModel,
      positions: layoutGraph(graphModel.nodes, graphModel.edges, pinned),
      moved,
    })
  }
  const laidPositions = graphLayout?.positions ?? {}

  const fundExploreStage = (node: GraphNode): FundStage => {
    let lowest = Infinity
    for (const edge of graphModel.edges) {
      if (edge.kind !== 'round' || edge.source !== node.id) continue
      const level = roundLevel(edge.label)
      if (level !== null && level < lowest) lowest = level
    }
    if (lowest === Infinity || lowest <= 0) return 'seed'
    return lowest === 1 ? 'series-a' : 'series-b'
  }

  const exploreFor = (node: GraphNode): GraphExplore | undefined => {
    if (node.kind === 'person' && node.person && node.personFund) {
      const person = node.person
      const fund = node.personFund
      const state = personInvestments.states[personKey(person.name, fund)]
      return {
        status: state ? state.status : 'idle',
        onLoad: () => personInvestments.load(person, fund),
      }
    }
    if (node.kind === 'fund') {
      const stage = fundExploreStage(node)
      const state = portfolios.portfolios[fundKey(node.label)]
      return {
        status: state ? state.status : 'idle',
        onLoad: () => portfolios.load([{ fund: node.label, stage }]),
      }
    }
    if (node.kind === 'startup' && node.explored && !node.similar) {
      const key = node.label.toLowerCase()
      if (roundsByCompany[key]) return undefined
      const state = exploredStartups.states[key]
      return {
        status: state ? state.status : 'idle',
        onLoad: () => exploredStartups.load(node.label),
      }
    }
    return undefined
  }

  const onGraphSelect = (id: string | null) => {
    setGraphSelection(id)
    setGraphPerson(null)
    if (id && !isXl) setSheetOpen(true)
  }

  const onGraphPersonClick = (person: Partner, fund: string, company: string) => {
    const id = `p:${person.name.toLowerCase()}`
    if (graphModel.nodes.some((node) => node.id === id)) {
      setGraphSelection(id)
      setGraphPerson(null)
    } else {
      setGraphPerson({ person, fund, company })
    }
  }

  const searching = state.similar.status === 'loading'
  const matchCount = state.similar.status === 'done' ? state.similar.matches.length : 0
  const similarLabel = searching ? '…' : String(matchCount)

  const graphStatus = searching
    ? 'Finding similar startups…'
    : completed < companies.length
      ? `Loading funding histories · ${completed}/${companies.length}`
      : peoplePrefetch.status === 'loading'
        ? `Finding people at funds · ${peoplePrefetch.settled}/${peoplePrefetch.total}`
        : founders.settled < founders.total
          ? `Finding founders · ${founders.settled}/${founders.total}`
          : undefined

  const searchingNotice = (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        Searching Cala for similar startups. This can take about a minute…
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  )

  const risksLabel =
    state.risks.status === 'idle' || state.risks.status === 'loading'
      ? '…'
      : state.risks.status === 'error' || state.risks.status === 'skipped'
        ? '—'
        : String(state.risks.risks.length)

  const placeholder =
    tab === 'companies'
      ? 'Select a lead investor to see associated people and sources.'
      : 'Select an investor on the map to see evidence, people, and a message draft.'

  const showOnMap = (fund: string) => {
    const key = fundKey(fund)
    const node =
      displayGraph.early.find((item) => item.key === key) ??
      displayGraph.later.find((item) => item.key === key)
    setTab('map')
    setView('paths')
    if (node) {
      setSelection({
        type: 'fund',
        kind: displayGraph.early.some((item) => item.key === key) ? 'early' : 'later',
        key,
        company: defaultEvidenceCompany(node),
      })
    } else {
      setSelection(null)
    }
  }

  const openCompany = (company: string) => {
    setTab('companies')
    setSelectedCompany(company)
    setSelection(null)
    setSheetOpen(false)
  }

  const selectLead = (fund: string, round: Round, company: string) => {
    setSelection({ type: 'lead', fund, round, company })
    setSheetOpen(true)
  }

  const selectPerson = (person: Partner) => {
    setSelection((current) =>
      current?.type === 'fund' ? { ...current, person } : current,
    )
    setSheetOpen(true)
  }

  const detail =
    view === 'graph' ? (
      <GraphDetailPanel
        node={graphModel.nodes.find((node) => node.id === graphSelection) ?? null}
        model={graphModel}
        idea={state.query.idea}
        stage={state.query.stage}
        target={state.query.target}
        matches={matchesByCompany}
        roundsByCompany={roundsByCompany}
        exploredStates={exploredStartups.states}
        base={graph}
        risks={state.risks}
        portfolioStates={portfolios.portfolios}
        portfolioPaths={portfolioPathsByKey}
        personStates={personInvestments.states}
        personOverride={graphPerson}
        onSelectNode={onGraphSelect}
        onExplore={(node) => exploreFor(node)?.onLoad()}
        onPersonClick={onGraphPersonClick}
        onPersonBack={() => setGraphPerson(null)}
        onLoadPortfolios={portfolios.load}
      />
    ) : (
      <DetailPanel
        selection={selection}
        graph={displayGraph}
        risks={state.risks}
        idea={state.query.idea}
        placeholder={placeholder}
        stage={state.query.stage}
        portfolioStates={portfolios.portfolios}
        portfolioPaths={portfolioPathsByKey}
        onLoadPortfolios={portfolios.load}
        onSelectionChange={setSelection}
        onCompanySelect={openCompany}
      />
    )

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-5">
        <QuerySummary
          mode="idea"
          idea={state.query}
          open={editing}
          onOpenChange={setEditing}
          onSubmitIdea={onSubmitIdea}
          onSubmitName={onSubmitName}
        />
        <ProgressSteps state={state} people={peoplePrefetch} founders={founders} />

        {state.similar.status === 'error' && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" aria-hidden />
            <AlertTitle>Could not find similar startups</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{state.similar.message}</span>
              <Button variant="outline" size="sm" onClick={retrySimilar}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {state.similar.status === 'done' && state.similar.matches.length === 0 && (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6">
            <FileSearch className="size-5 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              No similar startups found. Try a more specific description of your product and customers.
            </p>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit description
            </Button>
          </div>
        )}

        {(searching || matchCount > 0) && (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
            <div className="min-w-0">
              <Tabs
                value={tab}
                onValueChange={(value) => {
                  setTab(value as TabValue)
                  setSelection(null)
                  setGraphSelection(null)
                  setGraphPerson(null)
                  setSheetOpen(false)
                }}
              >
                <TabsList className="max-w-full justify-start overflow-x-auto">
                  <TabsTrigger value="map">
                    <span className="sm:hidden">
                      Map ({displayGraph.early.length + displayGraph.later.length})
                    </span>
                    <span className="hidden sm:inline">
                      Investor map ({displayGraph.early.length + displayGraph.later.length})
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="companies">
                    <span className="sm:hidden">Similar ({similarLabel})</span>
                    <span className="hidden sm:inline">Similar startups ({similarLabel})</span>
                  </TabsTrigger>
                  <TabsTrigger value="risks">
                    <span className="sm:hidden">Conflicts ({risksLabel})</span>
                    <span className="hidden sm:inline">Potential conflicts ({risksLabel})</span>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="map" className="mt-5">
                  <div className="mb-3 flex items-center gap-2">
                    <ToggleGroup
                      type="single"
                      value={view}
                      onValueChange={(value) => {
                        if (!value) return
                        setView(value as 'graph' | 'paths')
                        setSelection(null)
                        setGraphSelection(null)
                        setGraphPerson(null)
                        setSheetOpen(false)
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <ToggleGroupItem value="graph">Relationship graph</ToggleGroupItem>
                      <ToggleGroupItem value="paths">Paths</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  {view === 'graph' ? (
                    <ExplorerGraphView
                      model={graphModel}
                      positions={laidPositions}
                      selection={graphSelection}
                      onSelect={onGraphSelect}
                      onNodeMove={(id, position) =>
                        setGraphLayout((current) =>
                          current
                            ? { ...current, positions: { ...current.positions, [id]: position } }
                            : current,
                        )
                      }
                      onNodeDragEnd={(id) =>
                        setGraphLayout((current) =>
                          current ? { ...current, moved: new Set(current.moved).add(id) } : current,
                        )
                      }
                      exploreFor={exploreFor}
                      status={graphStatus}
                    />
                  ) : searching ? (
                    searchingNotice
                  ) : (
                    <InvestorMap
                    graph={displayGraph}
                    query={state.query}
                    completed={completed}
                    total={companies.length}
                    failed={failed}
                    riskFunds={riskFunds}
                    selection={selection}
                    onSelect={setSelection}
                    onSelectPerson={selectPerson}
                    onOpenDetails={isXl ? undefined : () => setSheetOpen(true)}
                    portfolios={portfolios.portfolios}
                    loadableFunds={graph.early.slice(0, 6).map((node) => node.name)}
                    showPortfolios={showPortfolios}
                    overlayVisible={overlayVisible}
                    onLoadPortfolios={portfolios.load}
                    onTogglePortfolios={setShowPortfolios}
                    peopleCounts={peoplePrefetch.byKey}
                  />
                  )}
                </TabsContent>
                <TabsContent value="companies" className="mt-5">
                  {searching ? (
                    searchingNotice
                  ) : (
                    <SimilarCompanies
                      companies={companies}
                      selectedCompany={selectedCompany}
                      onSelectCompany={setSelectedCompany}
                      onLeadSelect={selectLead}
                      activeLeadFund={selection?.type === 'lead' ? selection.fund : undefined}
                      onRetryCompany={retryCompany}
                    />
                  )}
                </TabsContent>
                <TabsContent value="risks" className="mt-5">
                  <RiskList risks={state.risks} onShowOnMap={showOnMap} />
                </TabsContent>
              </Tabs>
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
          open={
            sheetOpen &&
            (view === 'graph' ? !!(graphSelection || graphPerson) : !!selection)
          }
          onOpenChange={(open) => {
            if (!open) {
              setSheetOpen(false)
              setSelection((current) =>
                current ? { ...current, person: undefined } : current,
              )
            }
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
