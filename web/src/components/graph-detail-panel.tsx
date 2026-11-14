import { useState } from 'react'
import { Asterisk, Building2, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FundDetail } from '@/components/fund-detail'
import { FundingTimeline } from '@/components/funding-timeline'
import { GraphFundDetail, GraphLinkList } from '@/components/graph-fund-detail'
import { PersonView } from '@/components/person-view'
import { SourceLink } from '@/components/source-link'
import type { RisksState } from '@/hooks/use-discovery'
import type { ExploredState } from '@/hooks/use-explored-startups'
import type { PortfolioRequestItem, PortfolioState } from '@/hooks/use-fund-portfolios'
import { personKey, type PersonInvestmentsState } from '@/hooks/use-person-investments'
import { STAGE_LABEL } from '@/lib/format'
import type { ExplorerGraph, GraphNode } from '@/lib/graph'
import { defaultEvidenceCompany, sameFund, type PathGraph, type PortfolioPath } from '@/lib/paths'
import type { CompanyRounds, Partner, Round, SimilarMatch, Stage } from '@/lib/types'

interface GraphDetailPanelProps {
  node: GraphNode | null
  model: ExplorerGraph
  idea: string
  stage: Stage
  target: string
  matches: Record<string, SimilarMatch>
  roundsByCompany: Record<string, CompanyRounds>
  exploredStates: Record<string, ExploredState>
  base: PathGraph
  risks: RisksState
  portfolioStates: Record<string, PortfolioState>
  portfolioPaths: Record<string, PortfolioPath[]>
  personStates: Record<string, PersonInvestmentsState>
  personOverride: { person: Partner; fund: string; company: string } | null
  onSelectNode: (id: string) => void
  onExplore: (node: GraphNode) => void
  onPersonClick: (person: Partner, fund: string, company: string) => void
  onPersonBack: () => void
  onLoadPortfolios?: (items: PortfolioRequestItem[]) => void
}

export function GraphDetailPanel(props: GraphDetailPanelProps) {
  const { node, personOverride, idea, onPersonBack } = props
  if (personOverride) {
    return (
      <PersonView
        person={personOverride.person}
        fund={personOverride.fund}
        company={personOverride.company}
        idea={idea}
        onBack={onPersonBack}
      />
    )
  }
  if (!node) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        Select a graph node to see its details.
      </p>
    )
  }
  return <GraphNodeDetail key={node.id} {...props} node={node} />
}

function GraphNodeDetail(props: GraphDetailPanelProps & { node: GraphNode }) {
  const { node, model, idea, stage, target, matches, roundsByCompany, exploredStates, base } = props
  const { personStates, onSelectNode, onExplore } = props
  const labelById = Object.fromEntries(model.nodes.map((item) => [item.id, item.label]))

  if (node.kind === 'idea') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-sm font-semibold">
            <Asterisk className="size-4 text-brand" aria-hidden />
          </span>
          <p className="text-sm font-semibold">{node.label}</p>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{idea}</p>
        <p className="text-xs text-muted-foreground">
          Stage: {STAGE_LABEL[stage]}
          {target ? ` · Target: ${target}` : ''}
        </p>
      </div>
    )
  }

  if (node.kind === 'startup') {
    const key = node.label.toLowerCase()
    const match = matches[key]
    const known = roundsByCompany[key]
    const explored = exploredStates[key]
    const rounds = known?.rounds ?? (explored?.status === 'done' ? explored.data.rounds : [])
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-sm font-semibold text-secondary-foreground">
            <Building2 className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{node.label}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {node.similar && <Badge variant="secondary">Similar</Badge>}
              {node.explored && <Badge variant="outline">Explored</Badge>}
            </div>
          </div>
        </div>
        {match && (
          <div>
            <p className="text-xs text-muted-foreground">{match.description}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Why similar: {match.similarity_reason}
            </p>
          </div>
        )}
        {rounds.length > 0 ? (
          <section className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Funding history
            </p>
            <FundingTimeline
              company={node.label}
              rounds={rounds as Round[]}
              onLeadSelect={(fund) => {
                const fundNode = model.nodes.find(
                  (item) => item.kind === 'fund' && sameFund(item.label, fund),
                )
                if (fundNode) onSelectNode(fundNode.id)
              }}
            />
          </section>
        ) : (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <Button variant="outline" size="sm" onClick={() => onExplore(node)}>
              Get funding history from Cala
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              A new query takes about a minute and uses Cala credits.
            </p>
          </div>
        )}
        <GraphLinkList
          node={node}
          edges={model.edges}
          labelById={labelById}
          onSelectNode={onSelectNode}
        />
      </div>
    )
  }

  if (node.kind === 'fund') {
    const early = base.early.find((item) => sameFund(item.name, node.label))
    const later = base.later.find((item) => sameFund(item.name, node.label))
    const baseNode = early ?? later
    if (!baseNode) {
      return (
        <GraphFundDetail
          node={node}
          edges={model.edges}
          labelById={labelById}
          portfolioState={props.portfolioStates[node.id.replace(/^f:/, '')]}
          onLoadPortfolio={() => onExplore(node)}
          onSelectNode={onSelectNode}
        />
      )
    }
    return <BaseFundDetail {...props} node={node} baseNode={baseNode} kind={early ? 'early' : 'later'} />
  }

  // person
  const person = node.person as Partner
  if (node.founder) {
    return (
      <PersonView
        person={person}
        fund=""
        company={node.personCompany ?? ''}
        idea={idea}
        founder
        onBack={() => onSelectNode('idea')}
      />
    )
  }
  const state = personStates[personKey(person.name, node.personFund ?? '')]
  return (
    <div className="flex flex-col gap-4">
      <PersonView
        person={person}
        fund={node.personFund ?? ''}
        company={node.personCompany ?? ''}
        idea={idea}
        onBack={() => onSelectNode('idea')}
      />
      <section className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Other investments
        </p>
        <p className="text-xs text-muted-foreground">
          Other startups where {person.name} is publicly linked to an investment by {node.personFund}.
        </p>
        {!state && (
          <div>
            <Button variant="outline" size="sm" onClick={() => onExplore(node)}>
              See more
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              A new query takes about a minute and uses Cala credits.
            </p>
          </div>
        )}
        {state?.status === 'loading' && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
            Searching for investments: {person.name}…
          </p>
        )}
        {state?.status === 'error' && (
          <div>
            <p className="text-xs text-muted-foreground">{state.message}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => onExplore(node)}>
              Try again
            </Button>
          </div>
        )}
        {state?.status === 'done' && (
          <>
            {!state.investments.length ? (
              <p className="text-xs text-muted-foreground">
                Cala found no other documented investments.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {state.investments.map((inv) => (
                  <div key={inv.company} className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <button
                      type="button"
                      onClick={() => onSelectNode(`s:${inv.company.toLowerCase()}`)}
                      className="text-left text-xs font-semibold underline-offset-4 hover:underline"
                    >
                      {inv.company}
                    </button>
                    {(inv.round_type || inv.announcement_date) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {inv.round_type}
                        {inv.round_type && inv.announcement_date ? ' · ' : ''}
                        {inv.announcement_date}
                      </p>
                    )}
                    {inv.person_role && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{inv.person_role}</p>
                    )}
                    <div className="mt-1">
                      <SourceLink url={inv.source_url} label="Source" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              These Cala examples are not a complete list. Check the sources and current role.
            </p>
          </>
        )}
      </section>
    </div>
  )
}

function BaseFundDetail(
  props: GraphDetailPanelProps & { node: GraphNode; baseNode: PathGraph['early'][number]; kind: 'early' | 'later' },
) {
  const { baseNode, kind, base, risks, stage, portfolioStates, portfolioPaths } = props
  const [company, setCompany] = useState(defaultEvidenceCompany(baseNode))
  const risk =
    risks.status === 'done'
      ? risks.risks.find((item) => sameFund(item.fund, baseNode.name))
      : undefined
  return (
    <FundDetail
      node={baseNode}
      kind={kind}
      edges={base.edges}
      risk={risk}
      stage={stage}
      company={company}
      portfolioState={kind === 'early' ? portfolioStates[baseNode.key] : undefined}
      portfolioPaths={kind === 'early' ? portfolioPaths[baseNode.key] : undefined}
      onLoadPortfolios={props.onLoadPortfolios}
      onCompanyChange={setCompany}
      onSelectPerson={(person) => props.onPersonClick(person, baseNode.name, company)}
      onCompanySelect={(name) => props.onSelectNode(`s:${name.toLowerCase()}`)}
    />
  )
}
