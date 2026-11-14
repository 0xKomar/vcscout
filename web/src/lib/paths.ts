import type { CompanyRounds, Round, Stage } from './types'

export function clean(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

export function sourceUrls(value: unknown): string[] {
  return clean(value).match(/https?:\/\/[^\s,;]+/g) || []
}

export function leadNames(value: unknown): string[] {
  return clean(value)
    .split(/\s*[,;]\s*/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s &&
        !/^(unknown|not disclosed|undisclosed|not specified|n\/?a|null|brak danych|angel investors?|individual investors?)$/i.test(
          s,
        ),
    )
}

export function roundLevel(value: unknown): number | null {
  const text = clean(value).toLowerCase().replace(/[-_]/g, ' ')
  if (/pre\s*seed|\bseed\b/.test(text)) return 0
  const match = text.match(/series\s*([a-z])/)
  return match ? match[1].charCodeAt(0) - 96 : null
}

export function dateParts(value: unknown): { year: number; month: number | null } | null {
  const s = clean(value).toLowerCase()
  const year = s.match(/\b(19\d{2}|20\d{2})\b/)
  if (!year) return null
  const iso = s.match(/\b(?:19\d{2}|20\d{2})-(\d{2})/)
  const names = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ]
  const idx = names.findIndex((name) => s.includes(name))
  const month = iso ? +iso[1] : idx >= 0 ? idx + 1 : null
  return { year: +year[1], month }
}

export function strictlyLater(first: unknown, second: unknown): boolean {
  const a = dateParts(first)
  const b = dateParts(second)
  return !!(
    a &&
    b &&
    (b.year > a.year || (b.year === a.year && a.month && b.month && b.month > a.month))
  )
}

export function sourceRounds(example: CompanyRounds): Round[] {
  return (example.rounds || []).filter(
    (r) =>
      r &&
      r.announcement_date &&
      r.round_type &&
      leadNames(r.lead_investors).length &&
      sourceUrls(r.source_urls).length,
  )
}

export function stageLevel(stage: Stage): number {
  return stage === 'series-a' ? 1 : 0
}

export function fundKey(name: string): string {
  return name.toLocaleLowerCase()
}

export function sameFund(a: string, b: string): boolean {
  const x = fundKey(a)
  const y = fundKey(b)
  return x === y || x.startsWith(y + ' ') || y.startsWith(x + ' ')
}

export interface FundEvidence {
  company: string
  round: Round
}

export interface PortfolioEvidence {
  company: string
  fund: string
  early: Round
  later: Round
}

export interface FundNode {
  key: string
  name: string
  evidence: FundEvidence[]
  portfolio?: PortfolioEvidence[]
}

export function defaultEvidenceCompany(node: FundNode): string {
  return node.evidence[0]?.company ?? node.portfolio?.[0]?.company ?? ''
}

export function peoplePairs(graph: PathGraph, limit = 16): { fund: string; company: string }[] {
  const seen = new Set<string>()
  const pairs: { fund: string; company: string }[] = []
  for (const node of [...graph.early, ...graph.later]) {
    const company = defaultEvidenceCompany(node)
    if (!company) continue
    const key = `${company.toLowerCase()}|${node.name.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    pairs.push({ fund: node.name, company })
    if (pairs.length === limit) break
  }
  return pairs
}

export interface PathEdge {
  from: string
  fromName: string
  to: string
  toName: string
  evidence: { company: string; early: Round; later: Round }[]
  portfolio?: PortfolioEvidence[]
}

export interface PathGraph {
  early: FundNode[]
  later: FundNode[]
  edges: PathEdge[]
}

export function preparePaths(examples: CompanyRounds[], startLevel: number): PathGraph {
  const early = new Map<string, FundNode>()
  const later = new Map<string, FundNode>()
  const edges = new Map<string, PathEdge>()

  for (const example of examples) {
    const rounds = sourceRounds(example)
    const starts = rounds.filter((r) => roundLevel(r.round_type) === startLevel)
    for (const start of starts) {
      const next = rounds
        .filter((r) => {
          const level = roundLevel(r.round_type)
          return (
            level !== null &&
            level > startLevel &&
            strictlyLater(start.announcement_date, r.announcement_date)
          )
        })
        .sort((a, b) => {
          const x = dateParts(a.announcement_date)
          const y = dateParts(b.announcement_date)
          return (x?.year ?? 0) - (y?.year ?? 0) || (x?.month ?? 0) - (y?.month ?? 0)
        })[0]
      for (const firstFund of leadNames(start.lead_investors)) {
        const firstKey = fundKey(firstFund)
        if (!early.has(firstKey)) early.set(firstKey, { key: firstKey, name: firstFund, evidence: [] })
        const first = early.get(firstKey) as FundNode
        if (!first.evidence.some((e) => e.company === example.company)) {
          first.evidence.push({ company: example.company, round: start })
        }
        if (!next) continue
        for (const nextFund of leadNames(next.lead_investors)) {
          const nextKey = fundKey(nextFund)
          if (firstKey === nextKey) continue
          if (!later.has(nextKey)) later.set(nextKey, { key: nextKey, name: nextFund, evidence: [] })
          const target = later.get(nextKey) as FundNode
          if (!target.evidence.some((e) => e.company === example.company)) {
            target.evidence.push({ company: example.company, round: next })
          }
          const edgeKey = `${firstKey}→${nextKey}`
          if (!edges.has(edgeKey)) {
            edges.set(edgeKey, { from: firstKey, fromName: firstFund, to: nextKey, toName: nextFund, evidence: [] })
          }
          const edge = edges.get(edgeKey) as PathEdge
          edge.evidence.push({ company: example.company, early: start, later: next })
        }
      }
    }
  }

  return {
    early: [...early.values()].sort((a, b) => b.evidence.length - a.evidence.length),
    later: [...later.values()].sort((a, b) => b.evidence.length - a.evidence.length),
    edges: [...edges.values()],
  }
}

export interface PortfolioPath {
  company: string
  start: Round
  next: Round | null
}

const byDate = (a: Round, b: Round) => {
  const x = dateParts(a.announcement_date)
  const y = dateParts(b.announcement_date)
  return (x?.year ?? 0) - (y?.year ?? 0) || (x?.month ?? 0) - (y?.month ?? 0)
}

export function fundPortfolioPaths(
  fund: string,
  examples: CompanyRounds[],
  startLevel: number,
): PortfolioPath[] {
  const paths: PortfolioPath[] = []
  for (const example of examples) {
    const rounds = sourceRounds(example)
    const start = rounds
      .filter(
        (r) =>
          roundLevel(r.round_type) === startLevel &&
          leadNames(r.lead_investors).some((name) => sameFund(name, fund)),
      )
      .sort(byDate)[0]
    if (!start) continue
    const next =
      rounds
        .filter((r) => {
          const level = roundLevel(r.round_type)
          return (
            level !== null &&
            level > startLevel &&
            strictlyLater(start.announcement_date, r.announcement_date)
          )
        })
        .sort(byDate)[0] ?? null
    paths.push({ company: example.company, start, next })
  }
  return paths
}

export function extendGraph(
  base: PathGraph,
  portfolios: { fund: string; paths: PortfolioPath[] }[],
): PathGraph {
  const early = [...base.early]
  const later = [...base.later]
  const edges = [...base.edges]
  const laterCopies = new Map<FundNode, FundNode>()
  const edgeCopies = new Map<PathEdge, PathEdge>()

  const copyLater = (node: FundNode): FundNode => {
    let copy = laterCopies.get(node)
    if (!copy) {
      copy = { ...node, portfolio: [...(node.portfolio ?? [])] }
      laterCopies.set(node, copy)
      later[later.indexOf(node)] = copy
    }
    return copy
  }
  const copyEdge = (edge: PathEdge): PathEdge => {
    let copy = edgeCopies.get(edge)
    if (!copy) {
      copy = { ...edge, portfolio: [...(edge.portfolio ?? [])] }
      edgeCopies.set(edge, copy)
      edges[edges.indexOf(edge)] = copy
    }
    return copy
  }

  for (const { fund, paths } of portfolios) {
    const earlyNode = base.early.find((node) => sameFund(node.name, fund))
    if (!earlyNode) continue
    for (const path of paths) {
      if (!path.next) continue
      for (const lead of leadNames(path.next.lead_investors)) {
        if (sameFund(lead, earlyNode.name)) continue
        const evidence: PortfolioEvidence = {
          company: path.company,
          fund: earlyNode.name,
          early: path.start,
          later: path.next,
        }
        const existing = later.find((node) => sameFund(node.name, lead))
        let target: FundNode
        if (existing) {
          target = existing
          if (!(target.portfolio ?? []).some((e) => e.company === path.company)) {
            target = copyLater(target)
            ;(target.portfolio as PortfolioEvidence[]).push(evidence)
          }
        } else {
          target = { key: fundKey(lead), name: lead, evidence: [], portfolio: [evidence] }
          later.push(target)
        }
        const existingEdge = edges.find(
          (edge) => edge.from === earlyNode.key && edge.to === (target as FundNode).key,
        )
        if (existingEdge) {
          if (!(existingEdge.portfolio ?? []).some((e) => e.company === path.company)) {
            const copy = copyEdge(existingEdge)
            ;(copy.portfolio as PortfolioEvidence[]).push(evidence)
          }
        } else {
          edges.push({
            from: earlyNode.key,
            fromName: earlyNode.name,
            to: (target as FundNode).key,
            toName: (target as FundNode).name,
            evidence: [],
            portfolio: [evidence],
          })
        }
      }
    }
  }

  return { early, later, edges }
}
