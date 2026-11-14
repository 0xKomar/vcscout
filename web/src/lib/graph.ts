import {
  clean,
  dateParts,
  fundKey,
  fundPortfolioPaths,
  leadNames,
  sameFund,
  sourceRounds,
  type PathGraph,
} from '@/lib/paths'
import type {
  CompanyRounds,
  Founder,
  IdeaQuery,
  LinkedinKind,
  Partner,
  PersonInvestment,
  Round,
  SimilarMatch,
} from '@/lib/types'

export type GraphNodeKind = 'idea' | 'startup' | 'fund' | 'person'

export interface GraphNode {
  id: string
  kind: GraphNodeKind
  label: string
  sublabel?: string
  similar?: boolean
  explored?: boolean
  route?: 1 | 2
  flagged?: boolean
  founder?: boolean
  person?: Partner
  personFund?: string
  personCompany?: string
}

export type GraphEdgeKind = 'similar' | 'round' | 'person-fund' | 'person-startup' | 'founder'

export interface GraphEdge {
  id: string
  source: string
  target: string
  kind: GraphEdgeKind
  label: string
  route?: boolean
}

export interface ExplorerGraphInput {
  query: IdeaQuery
  matches: SimilarMatch[]
  roundsByCompany: Record<string, CompanyRounds>
  base: PathGraph
  riskFunds: Set<string>
  partners: { company: string; fund: string; data: { partners: Partner[] } }[]
  portfolios: { fund: string; companies: CompanyRounds[]; startLevel: number }[]
  personInvestments: { person: Partner; fund: string; investments: PersonInvestment[] }[]
  explored: CompanyRounds[]
  founders?: { company: string; founders: Founder[] }[]
}

export interface ExplorerGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// The organization a person node is looked up under: the startup for a
// founder, the fund for an investor.
export function personAffiliation(
  node: GraphNode,
): { organization: string; kind: LinkedinKind } | null {
  const organization = node.founder ? node.personCompany : node.personFund
  return organization ? { organization, kind: node.founder ? 'startup' : 'fund' } : null
}

const startupId = (name: string) => `s:${name.toLowerCase()}`
const personId = (name: string) => `p:${name.toLowerCase()}`

const sameRound = (a: Round, b: Round): boolean =>
  clean(a.round_type) === clean(b.round_type) &&
  clean(a.announcement_date) === clean(b.announcement_date)

const roundYear = (round: Round): number | null => dateParts(round.announcement_date)?.year ?? null

const roundLabel = (round: Round): string => {
  const type = clean(round.round_type)
  const year = roundYear(round)
  return year ? `${type} · ${year}` : type
}

export function buildExplorerGraph(input: ExplorerGraphInput): ExplorerGraph {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const nodeById = new Map<string, GraphNode>()
  const edgeKeys = new Set<string>()
  const fundRegistry: { id: string; name: string }[] = []

  const addNode = (node: GraphNode): GraphNode => {
    const existing = nodeById.get(node.id)
    if (existing) {
      if (node.route && (!existing.route || node.route < existing.route)) {
        existing.route = node.route
      }
      if (node.similar) existing.similar = true
      if (node.flagged) existing.flagged = true
      return existing
    }
    nodeById.set(node.id, node)
    nodes.push(node)
    return node
  }

  const addEdge = (edge: Omit<GraphEdge, 'id'>): void => {
    const key = `${edge.source}|${edge.target}|${edge.kind}|${edge.label}`
    if (edgeKeys.has(key)) {
      if (edge.route) {
        const existing = edges.find(
          (e) => `${e.source}|${e.target}|${e.kind}|${e.label}` === key,
        )
        if (existing) existing.route = true
      }
      return
    }
    edgeKeys.add(key)
    edges.push({ ...edge, id: `e${edges.length}` })
  }

  const ensureFund = (name: string, explored = false): GraphNode => {
    const known = fundRegistry.find((entry) => sameFund(entry.name, name))
    if (known) return nodeById.get(known.id) as GraphNode
    const node = addNode({ id: `f:${fundKey(name)}`, kind: 'fund', label: name, explored })
    fundRegistry.push({ id: node.id, name })
    return node
  }

  const ensureStartup = (name: string, flags: Partial<GraphNode> = {}): GraphNode =>
    addNode({ id: startupId(name), kind: 'startup', label: name, ...flags })

  const ensurePerson = (person: Partner, fund: string, company: string): GraphNode =>
    addNode({
      id: personId(person.name),
      kind: 'person',
      label: person.name,
      sublabel: person.role || undefined,
      person,
      personFund: fund,
      personCompany: company,
    })

  addNode({ id: 'idea', kind: 'idea', label: input.query.startupName || 'Your idea' })

  const earlyEvidence: { fund: string; company: string; round: Round }[] = []
  for (const node of input.base.early) {
    for (const ev of node.evidence) earlyEvidence.push({ fund: node.name, ...ev })
  }
  const laterEvidence: { fund: string; company: string; round: Round }[] = []
  for (const node of input.base.later) {
    for (const ev of node.evidence) laterEvidence.push({ fund: node.name, ...ev })
  }
  const routeCompanies = new Set(earlyEvidence.map((ev) => ev.company.toLowerCase()))

  const isRouteEarly = (fundName: string, company: string, round: Round) =>
    earlyEvidence.some(
      (ev) =>
        sameFund(ev.fund, fundName) &&
        ev.company.toLowerCase() === company.toLowerCase() &&
        sameRound(ev.round, round),
    )
  const isRouteLater = (fundName: string, company: string, round: Round) =>
    laterEvidence.some(
      (ev) =>
        sameFund(ev.fund, fundName) &&
        ev.company.toLowerCase() === company.toLowerCase() &&
        sameRound(ev.round, round),
    )

  const markRoute = (node: GraphNode) => {
    if (input.base.early.some((n) => sameFund(n.name, node.label))) node.route = 1
    else if (!node.route && input.base.later.some((n) => sameFund(n.name, node.label)))
      node.route = 2
    if (input.riskFunds.has(fundKey(node.label))) node.flagged = true
  }

  const addRoundEdges = (company: string, rounds: Round[]) => {
    for (const round of rounds) {
      if (!round.round_type || !round.announcement_date) continue
      for (const lead of leadNames(round.lead_investors)) {
        const fundNode = ensureFund(lead)
        markRoute(fundNode)
        const route = isRouteEarly(lead, company, round) || isRouteLater(lead, company, round)
        addEdge({
          source: fundNode.id,
          target: startupId(company),
          kind: 'round',
          label: roundLabel(round),
          route: route || undefined,
        })
      }
    }
  }

  for (const match of input.matches) {
    ensureStartup(match.company, { similar: true })
    addEdge({
      source: 'idea',
      target: startupId(match.company),
      kind: 'similar',
      label: 'similar',
      route: routeCompanies.has(match.company.toLowerCase()) || undefined,
    })
    const rounds = input.roundsByCompany[match.company.toLowerCase()]
    if (rounds) addRoundEdges(rounds.company, sourceRounds(rounds))
  }

  for (const entry of input.founders ?? []) {
    const startup = nodeById.get(startupId(entry.company))
    if (!startup) continue
    for (const founder of entry.founders) {
      const role = founder.role || 'Founder'
      const node = addNode({
        id: personId(founder.name),
        kind: 'person',
        label: founder.name,
        sublabel: role,
        founder: true,
        person: {
          name: founder.name,
          role,
          connection: `Founder of ${startup.label}`,
          source_url: founder.source_url,
        },
        personCompany: startup.label,
      })
      addEdge({ source: node.id, target: startup.id, kind: 'founder', label: role })
    }
  }

  for (const entry of input.partners) {
    const fundNode = ensureFund(entry.fund)
    markRoute(fundNode)
    for (const person of entry.data.partners) {
      const personNode = ensurePerson(person, fundNode.label, entry.company)
      addEdge({
        source: personNode.id,
        target: fundNode.id,
        kind: 'person-fund',
        label: person.role || 'fund member',
      })
      if (!nodeById.has(startupId(entry.company))) {
        ensureStartup(entry.company, { explored: true })
      }
      addEdge({
        source: personNode.id,
        target: startupId(entry.company),
        kind: 'person-startup',
        label: 'linked to investment',
      })
    }
  }

  for (const portfolio of input.portfolios) {
    const fundNode = ensureFund(portfolio.fund)
    markRoute(fundNode)
    for (const path of fundPortfolioPaths(portfolio.fund, portfolio.companies, portfolio.startLevel)) {
      ensureStartup(path.company, { explored: true })
      addEdge({
        source: fundNode.id,
        target: startupId(path.company),
        kind: 'round',
        label: roundLabel(path.start),
      })
      if (!path.next) continue
      for (const lead of leadNames(path.next.lead_investors)) {
        if (sameFund(lead, portfolio.fund)) continue
        const nextFund = ensureFund(lead, true)
        markRoute(nextFund)
        addEdge({
          source: nextFund.id,
          target: startupId(path.company),
          kind: 'round',
          label: roundLabel(path.next),
        })
      }
    }
  }

  for (const entry of input.personInvestments) {
    const personNode = ensurePerson(entry.person, entry.fund, '')
    const fundNode = ensureFund(entry.fund)
    markRoute(fundNode)
    for (const inv of entry.investments) {
      ensureStartup(inv.company, { explored: true })
      addEdge({
        source: personNode.id,
        target: startupId(inv.company),
        kind: 'person-startup',
        label: inv.person_role || inv.round_type || 'investment',
      })
      const year = inv.announcement_date ? (dateParts(inv.announcement_date)?.year ?? null) : null
      const label = inv.round_type
        ? year
          ? `${inv.round_type} · ${year}`
          : inv.round_type
        : 'investment'
      addEdge({
        source: fundNode.id,
        target: startupId(inv.company),
        kind: 'round',
        label,
      })
    }
  }

  for (const company of input.explored) {
    ensureStartup(company.company, { explored: true })
    addRoundEdges(company.company, sourceRounds(company))
  }

  return { nodes, edges }
}
