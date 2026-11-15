import { useMemo, useState } from 'react'
import { AlertTriangle, Compass, FileSearch, Link2, Loader2, UserRound, UserRoundPlus } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { DetailPanel } from '@/components/detail-panel'
import { ExplorerGraphView, type GraphExplore } from '@/components/explorer-graph'
import { GraphDetailPanel } from '@/components/graph-detail-panel'
import { IntroEmptyState } from '@/components/intro-empty-state'
import { NetworkDetail } from '@/components/network-detail'
import { NetworkGraphView } from '@/components/network-graph-view'
import { InvestorMap } from '@/components/investor-map'
import { MeProfileForm } from '@/components/me-profile-form'
import { ManualPersonForm } from '@/components/manual-person-form'
import { ProgressSteps } from '@/components/progress-steps'
import { QuerySummary } from '@/components/query-summary'
import { ResultsTutorial } from '@/components/results-tutorial'
import { RiskList } from '@/components/risk-list'
import { SimilarCompanies } from '@/components/similar-companies'
import { WarmestIntros } from '@/components/warmest-intros'
import type { DiscoveryState } from '@/hooks/use-discovery'
import { useExploredStartups } from '@/hooks/use-explored-startups'
import { useFounders } from '@/hooks/use-founders'
import { useFundPortfolios } from '@/hooks/use-fund-portfolios'
import { useMe } from '@/hooks/use-me'
import { useNetwork } from '@/hooks/use-network'
import { useMediaQuery } from '@/hooks/use-media-query'
import { usePeoplePrefetch } from '@/hooks/use-people-prefetch'
import { personKey, usePersonInvestments } from '@/hooks/use-person-investments'
import { useResolvedPartners } from '@/hooks/use-partners'
import { introKey } from '@/lib/intro'
import { linkedinProfileKey } from '@/lib/linkedin-csv'
import { bestPathIds, manualLinkedinNodeId, mapSeed, personIdentity, type NetNode } from '@/lib/network'
import { TUTORIAL_PREVIEW, TUTORIAL_STEPS } from '@/lib/tutorial'
import { cn } from '@/lib/utils'
import {
  defaultEvidenceCompany,
  extendGraph,
  fundKey,
  fundPortfolioPaths,
  peoplePairs,
  preparePaths,
  roundLevel,
  sameFund,
  stageLevel,
  type PortfolioPath,
} from '@/lib/paths'
import { buildExplorerGraph, type ExplorerGraph, type GraphNode } from '@/lib/graph'
import { layoutGraph, type XY } from '@/lib/graph-layout'
import type {
  CompanyRounds,
  FundStage,
  IdeaQuery,
  ManualPerson,
  MeProfile,
  Partner,
  Round,
  Selection,
} from '@/lib/types'

interface IdeaResultsProps {
  state: DiscoveryState
  initialWalkthrough?: boolean
  onSubmitIdea: (query: IdeaQuery) => void
  retrySimilar: () => void
  retryCompany: (company: string) => void
}

type TabValue = 'map' | 'companies' | 'risks'

type MapView = 'graph' | 'paths' | 'intros'

const EMPTY_PROFILE: MeProfile = {
  name: '',
  linkedin_url: '',
  employers: [],
  schools: [],
  contacts: [],
  facts: [],
  hidden: [],
}

export function IdeaResults({
  state,
  initialWalkthrough = true,
  onSubmitIdea,
  retrySimilar,
  retryCompany,
}: IdeaResultsProps) {
  const isXl = useMediaQuery('(min-width: 1280px)')
  const isLg = useMediaQuery('(min-width: 1024px)')
  const reduceMotion = useReducedMotion()
  const [tab, setTab] = useState<TabValue>('map')
  const [view, setView] = useState<MapView>('intros')
  const [tutorialOpen, setTutorialOpen] = useState(initialWalkthrough)
  const [tutorialLocked, setTutorialLocked] = useState(initialWalkthrough)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [maxVisitedStep, setMaxVisitedStep] = useState(0)
  const [previewSelection, setPreviewSelection] = useState<string | null>(TUTORIAL_PREVIEW.targetId)
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
  const [meFormOpen, setMeFormOpen] = useState(false)
  const [manualForm, setManualForm] = useState<'new' | string | null>(null)
  const [manualSelectionKey, setManualSelectionKey] = useState<string | null>(null)
  const [introSelection, setIntroSelection] = useState<string | null>(null)
  const [introTarget, setIntroTarget] = useState<{
    name: string
    org: string
    id?: string
  } | null>(null)
  const [introMode, setIntroMode] = useState<'list' | 'graph'>('list')

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

  const fullGraph = useMemo(() => extendGraph(graph, portfolioInputs), [graph, portfolioInputs])
  const scopedPartners = useMemo(() => {
    const funds = [...fullGraph.early, ...fullGraph.later]
    return resolvedPartners.filter((entry) =>
      funds.some((node) => sameFund(node.name, entry.fund)),
    )
  }, [resolvedPartners, fullGraph])
  const meStore = useMe()
  const networkSeed = useMemo(
    () =>
      mapSeed({
        matches: similarMatches,
        companies: companies
          .filter((entry) => entry.status === 'done' && entry.data)
          .map((entry) => entry.data as CompanyRounds),
        founders: founders.list,
        partners: scopedPartners,
      }),
    [similarMatches, companies, founders.list, scopedPartners],
  )
  const intros = useNetwork(networkSeed, scopedPartners, introTarget)

  const introProfile = intros.me.profile
  const introTotal = intros.ranked.length
  const manualPeople = introProfile?.manual_people ?? []
  const hasManualPeople = intros.network.nodes.some((node) => node.manual)
  const pathIds = useMemo(() => {
    const picked = introTarget?.id
      ? intros.ranked.filter((entry) => entry.node.id === introTarget.id)
      : []
    const ids = bestPathIds(picked.length ? picked : introTarget || hasManualPeople ? [] : intros.ranked)
    if (introTarget?.id) ids.nodes.add(introTarget.id)
    const manualIds = new Set(intros.network.nodes.filter((node) => node.manual).map((node) => node.id))
    for (const id of manualIds) ids.nodes.add(id)
    for (const edge of intros.network.edges) {
      if ((manualIds.has(edge.source) || manualIds.has(edge.target)) &&
        ids.nodes.has(edge.source) && ids.nodes.has(edge.target)) ids.edges.add(edge.id)
    }
    return ids
  }, [intros.ranked, intros.network, introTarget, hasManualPeople])
  const inFlight = Object.values(intros.expandStates).filter(
    (state) => state.status === 'loading',
  ).length
  const selectedNode = manualSelectionKey
    ? intros.network.nodes.find((node) =>
        node.manual && linkedinProfileKey(node.profileUrl) === manualSelectionKey) ?? null
    : intros.network.nodes.find((node) => node.id === introSelection) ?? null
  const selectedId = selectedNode?.id ?? null
  const selectedPath = (selectedId && intros.paths.get(selectedId)) || null
  const selectedIsContact =
    !!selectedNode &&
    selectedNode.known === 'contact'
  const editingManual = manualForm && manualForm !== 'new'
    ? manualPeople.find((person) => linkedinProfileKey(person.profile_url) === manualForm)
    : undefined

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

  const onIntroSelect = (id: string | null) => {
    setManualSelectionKey(null)
    if (id === null) {
      setIntroSelection(null)
      return
    }
    if (id === 'me') {
      setMeFormOpen(true)
      return
    }
    const picked = intros.network.nodes.find((node) => node.id === id)
    if (picked?.target) {
      setIntroTarget({
        name: picked.label,
        org: picked.fund ?? picked.company ?? '',
        id: picked.id,
      })
    }
    setIntroSelection(id)
    if (!isXl) setSheetOpen(true)
  }

  const currentTutorialStep = TUTORIAL_STEPS[tutorialStep] ?? TUTORIAL_STEPS[0]
  const tutorialPreviewActive = tutorialOpen && !!currentTutorialStep.previewIntro && !introTarget

  const applyTutorialStep = (nextIndex: number, scroll = true) => {
    const step = TUTORIAL_STEPS[nextIndex]
    if (!step) return
    setTutorialStep(nextIndex)
    setMaxVisitedStep((prev) => Math.max(prev, nextIndex))
    setPreviewSelection(TUTORIAL_PREVIEW.targetId)
    setTab(step.tab)
    setView(step.view)
    if (step.id === 'intros-graph') setIntroMode('graph')
    setSelection(null)
    setGraphSelection(null)
    setGraphPerson(null)
    setIntroSelection(null)
    setManualSelectionKey(null)
    if (step.view !== 'intros') setIntroTarget(null)
    setSheetOpen(false)
    if (scroll) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const isSingleColumn = window.innerWidth < 1280
          if (isSingleColumn && nextIndex > 0) {
            const anchor =
              step.id === 'drafts'
                ? document.querySelector<HTMLElement>('[data-tutorial="message-drafts"]')
                : document.querySelector<HTMLElement>('[data-testid="results-tutorial"]')
            if (!anchor) return
            const top = anchor.getBoundingClientRect().top + window.scrollY - 88
            window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'instant' : 'smooth' })
            return
          }
          const selector = step.targets.map((key) => `[data-tutorial="${key}"]`).join(', ')
          const targetEl = document.querySelector<HTMLElement>(selector)
          if (!targetEl) return
          targetEl.scrollIntoView({
            block: 'center',
            behavior: reduceMotion ? 'instant' : 'smooth',
          })
        })
      })
    }
  }

  const finishTutorial = () => {
    setTutorialLocked(false)
    setTutorialOpen(false)
    setTab('map')
    setView('intros')
    setIntroMode('list')
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' })
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

  const saveManualPerson = (person: ManualPerson): string | null => {
    const key = linkedinProfileKey(person.profile_url)
    if (key === linkedinProfileKey(introProfile?.linkedin_url))
      return 'That is your own LinkedIn profile. Add a different person.'
    const alreadyAdded = manualPeople.some((entry) => linkedinProfileKey(entry.profile_url) === key)
    if (alreadyAdded && manualForm !== key) return 'This profile is already added to your map.'
    if (!alreadyAdded && manualPeople.length >= 40) return 'You can add up to 40 people to this profile.'
    const oldNode = intros.network.nodes.find((node) =>
      node.manual && linkedinProfileKey(node.profileUrl) === key)
    if (editingManual && oldNode &&
      (editingManual.name !== person.name || !!editingManual.target !== !!person.target)) {
      intros.invalidateExpansion(oldNode.id)
      if (introTarget?.id === oldNode.id) setIntroTarget(null)
    }
    meStore.setManualPeople([
      ...manualPeople.filter((entry) => linkedinProfileKey(entry.profile_url) !== key),
      person,
    ])
    setIntroSelection(null)
    setManualSelectionKey(key)
    setIntroMode('graph')
    return null
  }

  const removeManualPerson = (person: ManualPerson) => {
    const key = linkedinProfileKey(person.profile_url)
    const node = intros.network.nodes.find((entry) =>
      entry.manual && linkedinProfileKey(entry.profileUrl) === key)
    if (node) {
      intros.invalidateExpansion(node.id)
      if (introTarget?.id === node.id) setIntroTarget(null)
      if (node.id === manualLinkedinNodeId(person.profile_url) && node.known === 'contact')
        meStore.removeContact(node.label, node.contactRefId ?? node.id)
    }
    meStore.setManualPeople(manualPeople.filter((entry) => linkedinProfileKey(entry.profile_url) !== key))
    setIntroSelection(null)
    setManualSelectionKey(null)
  }

  const editManualPerson = (node: NetNode) => {
    const key = linkedinProfileKey(node.profileUrl)
    if (!key) return
    setSheetOpen(false)
    setManualForm(key)
  }

  const researchNode = (id: string) => {
    const node = intros.network.nodes.find((entry) => entry.id === id)
    if (node?.manual) intros.deepExpand(id)
    else intros.expand(id)
  }

  const introList = (
    <div className="flex flex-col gap-2">
      <WarmestIntros
        ranked={intros.ranked}
        network={intros.network}
        selected={selectedId}
        linkedinReview={intros.linkedinReview}
        onReviewMore={intros.reviewMoreLinkedin}
        onReviewContact={intros.reviewLinkedin}
        onSelect={(id) => {
          setManualSelectionKey(null)
          const picked = id ? intros.network.nodes.find((node) => node.id === id) : null
          if (picked?.target) {
            setIntroTarget({
              name: picked.label,
              org: picked.fund ?? picked.company ?? '',
              id: picked.id,
            })
          }
          setIntroSelection(id)
          if (!isXl) setSheetOpen(true)
        }}
      />
    </div>
  )

  const previewNode =
    TUTORIAL_PREVIEW.network.nodes.find((node) => node.id === previewSelection) ??
    TUTORIAL_PREVIEW.targetNode
  const previewPath =
    TUTORIAL_PREVIEW.paths.get(previewNode.id) ?? TUTORIAL_PREVIEW.targetPath

  const introGraphView = tutorialPreviewActive ? (
    <div data-tutorial="intros-graph" className="flex flex-col gap-2">
      <p className="inline-flex self-start rounded-full border border-brand/25 bg-brand-soft px-3 py-1 font-mono text-[10px] uppercase tracking-[0.11em] text-brand">
        Walkthrough example · Illustrative connection path (not a real link)
      </p>
      <NetworkGraphView
        network={TUTORIAL_PREVIEW.network}
        paths={TUTORIAL_PREVIEW.paths}
        pathIds={TUTORIAL_PREVIEW.pathIds}
        selection={previewNode.id}
        focusKey=""
        onSelect={(id) => setPreviewSelection(id ?? TUTORIAL_PREVIEW.targetId)}
        expandStates={{}}
        onExpand={() => {}}
        running={false}
        inFlight={0}
        canSearchDeeper={false}
        maxDepth={3}
        onSearchDeeper={() => {}}
        onStop={() => {}}
        researchEnabled={false}
      />
    </div>
  ) : !introTarget && !hasManualPeople ? (
    <div data-tutorial="intros-graph" className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-brand/25 bg-brand-soft/50 p-8 text-center">
      <div className="flex items-center" aria-hidden>
        <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground"><UserRound className="size-4" /></span>
        <span className="w-10 border-t border-dashed border-brand/40" />
        <span className="grid size-9 place-items-center rounded-full border border-brand/20 bg-card text-brand"><Link2 className="size-4" /></span>
        <span className="w-10 border-t border-dashed border-brand/40" />
        <span className="grid size-10 place-items-center rounded-full border border-connection/25 bg-connection-soft font-serif text-lg text-connection">?</span>
      </div>
      <p className="mt-4 font-serif text-lg">Your path starts with a person.</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
        Choose someone above and we&apos;ll search for shared ground. Warm-intro research starts after you select a target.
      </p>
    </div>
  ) : (
    <div data-tutorial="intros-graph">
      {!introTarget && (
        <p className="mb-2 text-xs leading-5 text-muted-foreground">
          Your added people are shown below. Choose a target to begin researching connections.
        </p>
      )}
      <NetworkGraphView
        network={intros.network}
        paths={intros.paths}
        pathIds={pathIds}
        selection={selectedId}
        focusKey={introTarget?.id ?? 'manual-people'}
        onSelect={onIntroSelect}
        expandStates={intros.expandStates}
        onExpand={researchNode}
        running={intros.running}
        inFlight={inFlight}
        canSearchDeeper={intros.canSearchDeeper}
        maxDepth={intros.maxDepth}
        onSearchDeeper={intros.searchDeeper}
        onStop={intros.stop}
        researchEnabled={!!introTarget}
      />
    </div>
  )

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
    ) : view === 'intros' ? (
      tutorialPreviewActive && !selectedNode ? (
        <div className="flex flex-col gap-3">
          <p className="inline-flex self-start rounded-full border border-brand/25 bg-brand-soft px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.11em] text-brand">
            Walkthrough example
          </p>
          <NetworkDetail
            node={TUTORIAL_PREVIEW.targetNode}
            network={TUTORIAL_PREVIEW.network}
            path={
              currentTutorialStep.id === 'intros-graph'
                ? previewPath
                : TUTORIAL_PREVIEW.targetPath
            }
            me={introProfile?.name ? introProfile : TUTORIAL_PREVIEW.me}
            idea={state.query.idea}
            onExpand={() => {}}
            onSelectNode={(id) => setPreviewSelection(id ?? TUTORIAL_PREVIEW.targetId)}
            isContact={false}
            onToggleContact={() => {}}
            onLoadDossier={() => {}}
            researchEnabled={false}
            onEditManual={() => {}}
          />
        </div>
      ) : (
        <NetworkDetail
          node={selectedNode}
          network={intros.network}
          path={selectedPath}
          me={introProfile ?? EMPTY_PROFILE}
          idea={state.query.idea}
          expandState={selectedNode ? intros.expandStates[selectedNode.id] : undefined}
          onExpand={researchNode}
          onSelectNode={onIntroSelect}
          isContact={selectedIsContact}
          onToggleContact={(node, organization) => {
            if (selectedIsContact) meStore.removeContact(node.label, node.contactRefId ?? node.id)
            else {
              const profileKey = linkedinProfileKey(node.profileUrl)
              meStore.addContact(node.label, organization, {
                id: node.id,
                identity: personIdentity(node),
                profile_key: profileKey || undefined,
              })
              if (!node.manualNeedsName) intros.deepExpand(node.id)
            }
          }}
          dossier={
            selectedNode?.target === 'partner' && selectedNode.fund
              ? intros.dossiers[introKey(selectedNode.label, selectedNode.fund)]
              : undefined
          }
          onLoadDossier={() => {
            if (selectedNode?.fund)
              intros.loadDossier(introKey(selectedNode.label, selectedNode.fund))
          }}
          researchEnabled={!!introTarget}
          onEditManual={editManualPerson}
        />
      )
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

  const sheetVisible =
    sheetOpen &&
    (view === 'graph'
      ? !!(graphSelection || graphPerson)
      : view === 'intros'
        ? !!selectedId
        : !!selection)

  return (
    <main
      className={cn(
        'mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6',
        tutorialOpen && 'xl:pb-72',
      )}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand">Your connection atlas</p>
            <h1 className="mt-2 font-serif text-3xl tracking-[-0.035em] sm:text-4xl">Find your way to the right people.</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="max-w-[290px] text-xs leading-5 text-muted-foreground">
              Choose connected funding paths over dead ends, then trace the shared ground between you.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={tutorialOpen && tutorialLocked}
              className="shrink-0 rounded-full"
              onClick={() => {
                if (tutorialOpen) setTutorialOpen(false)
                else {
                  setTutorialOpen(true)
                  applyTutorialStep(0, true)
                }
              }}
            >
              <Compass className="size-3.5 text-brand" aria-hidden />
              {tutorialOpen ? 'Walkthrough active' : 'Walkthrough'}
            </Button>
          </div>
        </div>
        <div data-tutorial="query-and-progress" className="flex flex-col gap-5">
          <QuerySummary
            idea={state.query}
            open={editing}
            onOpenChange={setEditing}
            onSubmitIdea={onSubmitIdea}
            meName={introProfile?.name}
            onAddYourself={() => setMeFormOpen(true)}
          />
          <ProgressSteps
            state={state}
            people={peoplePrefetch}
            founders={founders}
            intros={intros.progress}
          />
        </div>
        {!isXl && tutorialPreviewActive && currentTutorialStep.id === 'drafts' && (
          <div className="rounded-xl border border-border bg-card p-4">{detail}</div>
        )}
        <ResultsTutorial
          open={tutorialOpen}
          locked={tutorialLocked}
          paused={meFormOpen || !!manualForm || sheetVisible}
          stepIndex={tutorialStep}
          maxVisitedStep={maxVisitedStep}
          onStepChange={(index) => applyTutorialStep(index, true)}
          onFinish={finishTutorial}
          onClose={() => setTutorialOpen(false)}
        />
        {!isXl && tutorialPreviewActive && currentTutorialStep.id === 'evidence' && (
          <div className="rounded-xl border border-border bg-card p-4">{detail}</div>
        )}

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

        {(searching || matchCount > 0 || !!introProfile || tutorialPreviewActive) && (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
            <div className="min-w-0" data-tutorial="workspace-tabs">
              <Tabs
                value={tab}
                onValueChange={(value) => {
                  setTab(value as TabValue)
                  setSelection(null)
                  setGraphSelection(null)
                  setGraphPerson(null)
                  setIntroSelection(null)
                  setManualSelectionKey(null)
                  setIntroTarget(null)
                  setSheetOpen(false)
                }}
              >
                <TabsList className="max-w-full justify-start overflow-x-auto">
                  <TabsTrigger value="map">
                    People &amp; paths ({introTotal})
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
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <ToggleGroup
                      type="single"
                      value={view}
                      onValueChange={(value) => {
                        if (!value) return
                        setView(value as MapView)
                        setSelection(null)
                        setGraphSelection(null)
                        setGraphPerson(null)
                        setIntroSelection(null)
                        setManualSelectionKey(null)
                        if (value !== 'intros') setIntroTarget(null)
                        setSheetOpen(false)
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <ToggleGroupItem value="intros">Warm intros</ToggleGroupItem>
                      <ToggleGroupItem value="graph">Relationship graph</ToggleGroupItem>
                      <ToggleGroupItem value="paths">Paths</ToggleGroupItem>
                    </ToggleGroup>
                    {view === 'intros' && introProfile && (
                      <Button variant="outline" size="sm" onClick={() => setManualForm('new')}>
                        <UserRoundPlus className="size-3.5" aria-hidden />
                        Add person
                      </Button>
                    )}
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
                  ) : view === 'intros' ? (
                    tutorialPreviewActive ? (
                      introGraphView
                    ) : !introProfile ? (
                      <IntroEmptyState onAddYourself={() => setMeFormOpen(true)} />
                    ) : introTotal === 0 ? (
                      <div className="flex flex-col gap-4">
                        <p className="text-sm text-muted-foreground">
                          {peoplePrefetch.status === 'pending' ||
                          peoplePrefetch.status === 'loading' ||
                          searching
                            ? 'Finding people at the funds on your map… the network appears as they are found.'
                            : 'No founders or partners were found on this map yet.'}
                        </p>
                        {isLg ? (
                          <>
                            {introList}
                            {introGraphView}
                          </>
                        ) : (
                          <>
                            <ToggleGroup
                              type="single"
                              value={introMode}
                              onValueChange={(value) =>
                                value && setIntroMode(value as 'list' | 'graph')
                              }
                              variant="outline"
                              size="sm"
                              className="self-start"
                            >
                              <ToggleGroupItem value="list">List</ToggleGroupItem>
                              <ToggleGroupItem value="graph">Graph</ToggleGroupItem>
                            </ToggleGroup>
                            {introMode === 'list' ? introList : introGraphView}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {isLg ? (
                          <>
                            {introList}
                            {introGraphView}
                          </>
                        ) : (
                          <>
                            <ToggleGroup
                              type="single"
                              value={introMode}
                              onValueChange={(value) =>
                                value && setIntroMode(value as 'list' | 'graph')
                              }
                              variant="outline"
                              size="sm"
                              className="self-start"
                            >
                              <ToggleGroupItem value="list">List</ToggleGroupItem>
                              <ToggleGroupItem value="graph">Graph</ToggleGroupItem>
                            </ToggleGroup>
                            {introMode === 'list' ? introList : introGraphView}
                          </>
                        )}
                      </div>
                    )
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
                    meName={introProfile?.name}
                    onAddYourself={() => setMeFormOpen(true)}
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
              <aside
                data-tutorial="detail-aside"
                className="sticky top-20 rounded-xl border border-border bg-card p-4"
              >
                {detail}
              </aside>
            )}
          </div>
        )}
      </div>

      {!isXl && (
        <Sheet
          open={sheetVisible}
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
      <MeProfileForm open={meFormOpen} onOpenChange={setMeFormOpen} />
      {manualForm && (
        <ManualPersonForm
          key={manualForm}
          initial={editingManual}
          onClose={() => setManualForm(null)}
          onSave={saveManualPerson}
          onRemove={editingManual ? () => removeManualPerson(editingManual) : undefined}
        />
      )}
    </main>
  )
}
