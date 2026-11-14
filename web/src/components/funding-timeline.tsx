import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { SourceLink } from '@/components/source-link'
import { formatAmount } from '@/lib/format'
import { clean, leadNames, sourceUrls } from '@/lib/paths'
import type { Round } from '@/lib/types'

interface FundingTimelineProps {
  company: string
  rounds: Round[]
  onLeadSelect?: (fund: string, round: Round) => void
  activeLeadFund?: string
}

export function FundingTimeline({ company, rounds, onLeadSelect, activeLeadFund }: FundingTimelineProps) {
  const shown = rounds.filter((round) => round.announcement_date && round.round_type)
  return (
    <ol className="flex flex-col gap-3">
      {shown.map((round, index) => {
        const leads = leadNames(round.lead_investors)
        const investors = clean(round.investors)
        const urls = sourceUrls(round.source_urls)
        const amount = formatAmount(round)
        return (
          <li key={`${company}-${index}`} className="flex gap-3">
            <span className="w-7 shrink-0 pt-3 text-right font-mono text-xs text-muted-foreground">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1 rounded-lg border border-border bg-card p-4 shadow-xs">
              <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-2">
                <p className="text-sm font-semibold">{clean(round.round_type)}</p>
                <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-xs text-muted-foreground">
                  <span>{clean(round.announcement_date)}</span>
                  {amount ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{amount}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Lead investors
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {leads.length ? (
                    leads.map((lead) => (
                      <button
                        key={lead}
                        type="button"
                        onClick={() => onLeadSelect?.(lead, round)}
                        aria-pressed={activeLeadFund === lead}
                        className={
                          activeLeadFund === lead
                            ? 'rounded-md border border-brand bg-brand-soft px-2 py-1 text-xs font-medium text-foreground'
                            : 'rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:border-foreground/30'
                        }
                      >
                        {lead}
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No data</span>
                  )}
                </div>
              </div>
              {investors && (
                <Collapsible className="mt-3 border-t border-border pt-2">
                  <CollapsibleTrigger className="group flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                    All participants
                    <ChevronDown
                      className="size-3 transition-transform group-data-[state=open]:rotate-180"
                      aria-hidden
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <p className="pt-1.5 text-xs leading-relaxed text-muted-foreground">{investors}</p>
                  </CollapsibleContent>
                </Collapsible>
              )}
              {urls.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2.5">
                  {urls.map((url) => (
                    <SourceLink key={url} url={url} />
                  ))}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
