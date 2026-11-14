import { PanelRight } from 'lucide-react'
import { FundDetail } from '@/components/fund-detail'
import { LeadDetail } from '@/components/lead-detail'
import { PersonView } from '@/components/person-view'
import type { RisksState } from '@/hooks/use-discovery'
import type { PortfolioRequestItem, PortfolioState } from '@/hooks/use-fund-portfolios'
import { clean, fundKey, type PathGraph, type PortfolioPath } from '@/lib/paths'
import type { Selection, Stage } from '@/lib/types'

interface DetailPanelProps {
  selection: Selection | null
  graph: PathGraph
  risks: RisksState
  idea?: string
  placeholder: string
  stage?: Stage
  portfolioStates?: Record<string, PortfolioState>
  portfolioPaths?: Record<string, PortfolioPath[]>
  onLoadPortfolios?: (items: PortfolioRequestItem[]) => void
  onSelectionChange: (selection: Selection) => void
  onCompanySelect: (company: string) => void
}

function selectionKey(selection: Selection): string {
  if (selection.type === 'fund') return `fund:${selection.kind}:${selection.key}`
  return `lead:${selection.company}:${selection.fund}:${clean(selection.round.announcement_date)}`
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-center">
      <PanelRight className="size-5 text-muted-foreground/60" aria-hidden />
      <p className="max-w-56 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  )
}

export function DetailPanel(props: DetailPanelProps) {
  const { selection, placeholder } = props
  if (!selection) return <Placeholder text={placeholder} />
  return <DetailContent key={selectionKey(selection)} {...props} selection={selection} />
}

function DetailContent({
  selection,
  graph,
  risks,
  idea,
  placeholder,
  stage,
  portfolioStates,
  portfolioPaths,
  onLoadPortfolios,
  onSelectionChange,
  onCompanySelect,
}: DetailPanelProps & { selection: Selection }) {
  if (selection.type === 'fund') {
    const node = graph[selection.kind].find((item) => item.key === selection.key)
    if (!node) return <Placeholder text={placeholder} />
    if (selection.person) {
      return (
        <PersonView
          person={selection.person}
          fund={node.name}
          company={selection.company}
          idea={idea}
          onBack={() => onSelectionChange({ ...selection, person: undefined })}
        />
      )
    }
    const risk =
      risks.status === 'done'
        ? risks.risks.find((item) => fundKey(item.fund) === node.key)
        : undefined
    return (
      <FundDetail
        node={node}
        kind={selection.kind}
        edges={graph.edges}
        risk={risk}
        stage={stage}
        company={selection.company}
        portfolioState={
          selection.kind === 'early' ? portfolioStates?.[node.key] : undefined
        }
        portfolioPaths={
          selection.kind === 'early' ? portfolioPaths?.[node.key] : undefined
        }
        onLoadPortfolios={onLoadPortfolios}
        onCompanyChange={(company) => onSelectionChange({ ...selection, company })}
        onSelectPerson={(person) => onSelectionChange({ ...selection, person })}
        onCompanySelect={onCompanySelect}
      />
    )
  }

  if (selection.person) {
    return (
      <PersonView
        person={selection.person}
        fund={selection.fund}
        company={selection.company}
        idea={idea}
        onBack={() => onSelectionChange({ ...selection, person: undefined })}
      />
    )
  }
  return (
    <LeadDetail
      fund={selection.fund}
      round={selection.round}
      company={selection.company}
      onSelectPerson={(person) => onSelectionChange({ ...selection, person })}
    />
  )
}
