import { PeopleSection } from '@/components/people-section'
import { SourceLink } from '@/components/source-link'
import { clean, sourceUrls } from '@/lib/paths'
import type { Partner, Round } from '@/lib/types'

interface LeadDetailProps {
  fund: string
  round: Round
  company: string
  onSelectPerson: (person: Partner, fund: string, company: string) => void
}

export function LeadDetail({ fund, round, company, onSelectPerson }: LeadDetailProps) {
  const urls = sourceUrls(round.source_urls)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-sm font-semibold text-secondary-foreground">
          {fund.slice(0, 2).toUpperCase()}
        </span>
        <p className="min-w-0 text-sm font-semibold">{fund}</p>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Listed as a lead investor in {company}&apos;s {clean(round.round_type)} round. This is a
        historical round, not a promise of future investment.
      </p>
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {urls.map((url) => (
            <SourceLink key={url} url={url} />
          ))}
        </div>
      )}
      <PeopleSection
        company={company}
        fund={fund}
        onSelectPerson={(person) => onSelectPerson(person, fund, company)}
      />
    </div>
  )
}
