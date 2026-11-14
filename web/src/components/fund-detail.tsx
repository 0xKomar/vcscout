import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PeopleSection } from '@/components/people-section'
import { SourceLink } from '@/components/source-link'
import type { PortfolioRequestItem, PortfolioState } from '@/hooks/use-fund-portfolios'
import { STAGE_LABEL } from '@/lib/format'
import {
  clean,
  leadNames,
  sameFund,
  sourceUrls,
  type FundNode,
  type PathEdge,
  type PortfolioPath,
} from '@/lib/paths'
import type { Partner, Risk, Stage } from '@/lib/types'

const PORTFOLIO_NOTE =
  'These Cala examples are not a complete portfolio or a measure of how often paths occur. These startups may not be similar to your idea. Check the sources.'

interface FundDetailProps {
  node: FundNode
  kind: 'early' | 'later'
  edges: PathEdge[]
  risk?: Risk
  stage?: Stage
  company?: string
  portfolioState?: PortfolioState
  portfolioPaths?: PortfolioPath[]
  onLoadPortfolios?: (items: PortfolioRequestItem[]) => void
  onCompanyChange?: (company: string) => void
  onSelectPerson: (person: Partner) => void
  onCompanySelect: (company: string) => void
}

function PortfolioItem({ path }: { path: PortfolioPath }) {
  const nextLeads = path.next ? leadNames(path.next.lead_investors) : []
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs font-semibold">{path.company}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {clean(path.start.round_type)} ({clean(path.start.announcement_date)})
        {path.next &&
          ` → ${clean(path.next.round_type)} (${clean(path.next.announcement_date)})`}
      </p>
      {path.next && nextLeads.length > 0 && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          Next round leads: {nextLeads.join(', ')}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        <SourceLink
          url={sourceUrls(path.start.source_urls)[0] ?? ''}
          label="Round source"
        />
        {path.next && (
          <SourceLink
            url={sourceUrls(path.next.source_urls)[0] ?? ''}
            label="Next round source"
          />
        )}
      </div>
    </div>
  )
}

export function FundDetail({
  node,
  kind,
  edges,
  risk,
  stage,
  company,
  portfolioState,
  portfolioPaths,
  onLoadPortfolios,
  onCompanyChange,
  onSelectPerson,
  onCompanySelect,
}: FundDetailProps) {
  const companies = [...new Set(node.evidence.map((e) => e.company))]
  const portfolio = node.portfolio ?? []
  const portfolioCompanies = [...new Set(portfolio.map((e) => e.company))]
  const portfolioOnly = kind === 'later' && companies.length === 0 && portfolio.length > 0
  const peopleCompanies = companies.length ? companies : portfolioCompanies
  const evidenceCompany = company || peopleCompanies[0] || ''
  const setEvidenceCompany = onCompanyChange ?? (() => {})
  const related = edges.filter((edge) => (kind === 'early' ? edge.from : edge.to) === node.key)

  const portfolioFunds = [...new Set(portfolio.map((e) => e.fund))]

  const samePaths: { path: PortfolioPath; edgeCompanies: string[] }[] = []
  const altGroups = new Map<string, PortfolioPath[]>()
  const noNext: PortfolioPath[] = []
  for (const path of portfolioPaths ?? []) {
    if (!path.next) {
      noNext.push(path)
      continue
    }
    const leads = leadNames(path.next.lead_investors).filter(
      (lead) => !sameFund(lead, node.name),
    )
    const target = edges
      .filter((edge) => edge.from === node.key && edge.evidence.length > 0)
      .find((edge) => leads.some((lead) => sameFund(lead, edge.toName)))
    if (target) {
      samePaths.push({
        path,
        edgeCompanies: [...new Set(target.evidence.map((e) => e.company))],
      })
    } else {
      const key = leads[0] ?? node.name
      altGroups.set(key, [...(altGroups.get(key) ?? []), path])
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-sm font-semibold text-secondary-foreground">
          {node.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{node.name}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {risk ? (
              <Badge variant="outline" className="border-warning/50 bg-warning-soft text-warning-foreground">
                <AlertTriangle className="size-3" aria-hidden />
                Check conflict
              </Badge>
            ) : portfolioOnly ? (
              <Badge variant="secondary">From portfolio</Badge>
            ) : (
              <Badge variant="secondary">{kind === 'early' ? 'Your stage' : 'Next round'}</Badge>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {portfolioOnly
          ? `This fund led a later round for startups in the portfolio of ${portfolioFunds.join(', ')}. These startups may not be similar to your idea. Check the fund's thesis and recent activity before reaching out.`
          : kind === 'early'
            ? "An example investor from a similar company's round at the selected stage. Check the fund's thesis and recent activity before reaching out."
            : "An example investor from a later round of a similar company. Check the fund's thesis and recent activity before reaching out."}
      </p>

      {risk && (
        <div className="rounded-lg border border-warning/40 bg-warning-soft p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-warning-foreground">
            <AlertTriangle className="size-3.5" aria-hidden />
            Potential conflict
          </p>
          <p className="mt-1 text-xs text-warning-foreground">
            Linked to {risk.competitor}. Requires verification.
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{risk.reason}</p>
          <div className="mt-2">
            <SourceLink url={risk.source_url} label="Check source" />
          </div>
        </div>
      )}

      {node.evidence.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Supporting evidence
          </p>
          <div className="flex flex-col gap-2">
            {node.evidence.map((evidence) => (
              <div key={evidence.company} className="rounded-lg border border-border bg-muted/30 p-3">
                <button
                  type="button"
                  onClick={() => onCompanySelect(evidence.company)}
                  className="text-left text-xs font-semibold underline-offset-4 hover:underline"
                >
                  {evidence.company}
                </button>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {clean(evidence.round.round_type)} · {clean(evidence.round.announcement_date)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {sourceUrls(evidence.round.source_urls)
                    .slice(0, 2)
                    .map((url) => (
                      <SourceLink key={url} url={url} label="Round source" />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Historical paths between funds
          </p>
          <div className="flex flex-col gap-2">
            {related.map((edge) =>
              edge.evidence.map((proof, index) => (
                <div
                  key={`${edge.from}-${edge.to}-${proof.company}-${index}`}
                  className="rounded-lg border border-border bg-muted/30 p-3"
                >
                  <p className="text-xs font-semibold">
                    {edge.fromName} → {edge.toName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {proof.company}: {clean(proof.early.round_type)} (
                    {clean(proof.early.announcement_date)}) → {clean(proof.later.round_type)} (
                    {clean(proof.later.announcement_date)})
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    <SourceLink
                      url={sourceUrls(proof.early.source_urls)[0] ?? ''}
                      label="Earlier round source"
                    />
                    <SourceLink
                      url={sourceUrls(proof.later.source_urls)[0] ?? ''}
                      label="Next round source"
                    />
                  </div>
                </div>
              )),
            )}
          </div>
        </section>
      )}

      {kind === 'later' && portfolio.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            From fund portfolios
          </p>
          <div className="flex flex-col gap-2">
            {portfolio.map((evidence, index) => (
              <div
                key={`${evidence.company}-${evidence.fund}-${index}`}
                className="rounded-lg border border-dashed border-border bg-muted/30 p-3"
              >
                <p className="text-xs font-semibold">{evidence.company}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {evidence.company}: {evidence.fund} — {clean(evidence.early.round_type)} (
                  {clean(evidence.early.announcement_date)}) → {clean(evidence.later.round_type)} (
                  {clean(evidence.later.announcement_date)})
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  <SourceLink
                    url={sourceUrls(evidence.early.source_urls)[0] ?? ''}
                    label="Earlier round source"
                  />
                  <SourceLink
                    url={sourceUrls(evidence.later.source_urls)[0] ?? ''}
                    label="Next round source"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {kind === 'early' && onLoadPortfolios && (
        <section className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Other portfolio startups
          </p>
          {!portfolioState && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                Where did other startups go after {node.name} led their{' '}
                {stage ? STAGE_LABEL[stage] : 'selected-stage'} round?
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => onLoadPortfolios([{ fund: node.name, stage: stage ?? 'seed' }])}
              >
                Search Cala
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                A new query takes about a minute and uses Cala credits.
              </p>
            </div>
          )}
          {portfolioState?.status === 'loading' && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <Skeleton className="h-14 w-full" />
              <p className="mt-2 text-xs text-muted-foreground">
                Searching for startups in {node.name}&apos;s portfolio…
              </p>
            </div>
          )}
          {portfolioState?.status === 'error' && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">{portfolioState.message}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => onLoadPortfolios([{ fund: node.name, stage: stage ?? 'seed' }])}
              >
                Try again
              </Button>
            </div>
          )}
          {portfolioState?.status === 'done' && (
            <div className="flex flex-col gap-2">
              {(portfolioPaths ?? []).length === 0 ? (
                <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Cala found no other documented examples. This is not the fund&apos;s complete portfolio.
                </p>
              ) : (
                <>
                  {samePaths.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium text-foreground">Same path</p>
                      {samePaths.map(({ path, edgeCompanies }) => (
                        <div key={path.company} className="flex flex-col gap-1">
                          {edgeCompanies.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Like {edgeCompanies.join(', ')}:
                            </p>
                          )}
                          <PortfolioItem path={path} />
                        </div>
                      ))}
                    </div>
                  )}
                  {altGroups.size > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium text-foreground">Other paths</p>
                      {[...altGroups.entries()].map(([target, paths]) => (
                        <div key={target} className="flex flex-col gap-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {node.name} → {target}
                          </p>
                          {paths.map((path) => (
                            <PortfolioItem key={path.company} path={path} />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  {noNext.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium text-foreground">
                        No documented later round
                      </p>
                      {noNext.map((path) => (
                        <PortfolioItem key={path.company} path={path} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">{PORTFOLIO_NOTE}</p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        {peopleCompanies.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Company:</span>
            {peopleCompanies.map((company) => (
              <button
                key={company}
                type="button"
                aria-pressed={evidenceCompany === company}
                onClick={() => setEvidenceCompany(company)}
                className={
                  evidenceCompany === company
                    ? 'rounded-md border border-brand bg-brand-soft px-2 py-0.5 text-xs font-medium'
                    : 'rounded-md border border-border bg-background px-2 py-0.5 text-xs hover:border-foreground/30'
                }
              >
                {company}
              </button>
            ))}
          </div>
        )}
        {evidenceCompany && (
          <PeopleSection
            company={evidenceCompany}
            fund={node.name}
            onSelectPerson={onSelectPerson}
          />
        )}
      </section>
    </div>
  )
}
