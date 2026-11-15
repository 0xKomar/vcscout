import { useRef, useState } from 'react'
import { Building2, ChevronDown, Copy, GraduationCap, HandCoins, Link2, Loader2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PersonAvatar } from '@/components/person-avatar'
import { SourceLink } from '@/components/source-link'
import type { DossierState } from '@/hooks/use-dossiers'
import type { ExpandState } from '@/hooks/use-network'
import { useLinkedinPhotos, linkedinKey } from '@/hooks/use-linkedin'
import {
  buildDraft,
  buildFounderDraft,
  buildForwardableBlurb,
  buildIntroAskDraft,
  buildPersonDraft,
} from '@/lib/format'
import { evidenceText, factYears, fallbackReason, overlapYears, SELF_REPORTED, yearsOverlap } from '@/lib/intro'
import {
  introAskFact,
  LINKEDIN_EXPORT,
  pathLinks,
  type NetNode,
  type NetPath,
  type Network,
  type PathLink,
} from '@/lib/network'
import { cn } from '@/lib/utils'
import type { Fact, MeProfile } from '@/lib/types'

const DOSSIER_GROUPS: [Fact['kind'], string][] = [
  ['role', 'Career'],
  ['education', 'Education'],
  ['board', 'Board seats'],
  ['advisor', 'Advisory roles'],
  ['angel', 'Angel investments'],
  ['program', 'Programs'],
  ['coinvestor', 'Co-investors'],
]

const KIND_BADGE: Record<PathLink['kind'], string> = {
  self: 'You said so',
  documented: 'Documented',
  inferred: 'Inferred',
}

const ORG_ICONS = {
  company: Building2,
  fund: HandCoins,
  school: GraduationCap,
  event: Users,
} as const

function EdgeSource({ url }: { url: string }) {
  if (url === SELF_REPORTED) return <span className="text-muted-foreground">self-reported</span>
  if (url === LINKEDIN_EXPORT)
    return <span className="text-muted-foreground">your LinkedIn export</span>
  return <SourceLink url={url} />
}

function Placeholder() {
  return (
    <div className="flex h-full min-h-60 flex-col items-center justify-center rounded-xl bg-brand-soft/60 p-6 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-card text-brand"><Link2 className="size-4" aria-hidden /></span>
      <p className="mt-4 font-serif text-lg">Every connection has a story.</p>
      <p className="mt-2 max-w-52 text-xs leading-relaxed text-muted-foreground">
        Select a person or organization to explore shared ground, sources, and a thoughtful first message.
      </p>
    </div>
  )
}

function Draft({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const [edited, setEdited] = useState(text)
  const [generated, setGenerated] = useState(text)
  if (generated !== text) {
    setGenerated(text)
    setEdited(text)
  }
  const timer = useRef<ReturnType<typeof setTimeout>>(null)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium">{title}</Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => {
            void navigator.clipboard?.writeText(edited)
            setCopied(true)
            if (timer.current) clearTimeout(timer.current)
            timer.current = setTimeout(() => setCopied(false), 1500)
          }}
        >
          <Copy className="size-3" aria-hidden />
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <Textarea
        value={edited}
        onChange={(event) => setEdited(event.target.value)}
        className="min-h-28 resize-none text-xs"
      />
    </div>
  )
}

function LinkBlock({ link }: { link: PathLink }) {
  const years =
    link.edges.length === 2
      ? yearsOverlap(
          { start: link.edges[0].start ?? null, end: link.edges[0].end ?? null },
          { start: link.edges[1].start ?? null, end: link.edges[1].end ?? null },
          new Date().getFullYear(),
        )
      : { status: 'unknown' as const }
  return (
    <div className="rounded-xl border border-border bg-secondary/30 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-xs font-medium">
          {link.from.label} → {link.via.map((node) => node.label).join(' → ')}
          {link.via.length ? ' → ' : ''}
          {link.to.label}
        </p>
        <Badge
          variant="outline"
          className={cn(
            'shrink-0',
            link.kind === 'inferred'
              ? 'border-warning/50 bg-warning-soft text-warning-foreground'
              : 'border-brand/40 bg-brand-soft',
          )}
        >
          {KIND_BADGE[link.kind]}
        </Badge>
      </div>
      <ul className="mt-1.5 flex flex-col gap-1">
        {link.edges.map((edge) => (
          <li key={edge.id} className="text-xs text-muted-foreground">
            {edge.label}
            {edge.start || edge.end
              ? ` · ${factYears({ start: edge.start ?? null, end: edge.end ?? null })}`
              : ''}{' '}
            {edge.certainty === 'inferred' && (
              <span className="text-warning-foreground">(inferred) </span>
            )}
            {edge.sources?.length ? edge.sources.map((source, index) => (
              <span key={`${source.origin}-${source.url}`}>
                {index > 0 ? ' · ' : ''}
                {source.origin === 'openai' ? 'AI web — verify' :
                  source.origin === 'cala-graph' ? 'Cala graph' : 'Cala'}{' '}
                <EdgeSource url={source.url} />
              </span>
            )) : (
              <>
                {edge.origin === 'openai' && <span className="text-warning-foreground">AI web — verify · </span>}
                {edge.origin === 'cala-graph' && <span>Cala graph · </span>}
                {edge.origin === 'cala' && <span>Cala · </span>}
                <EdgeSource url={edge.source_url} />
              </>
            )}
            {edge.context && (
              <span className="block text-[11px] text-muted-foreground/80">{edge.context}</span>
            )}
          </li>
        ))}
      </ul>
      {link.edges.some((edge) => edge.relation === 'possible-org-match') ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Similar names are not proof these organizations are the same — verify the match.
        </p>
      ) : link.edges.some((edge) => edge.relation === 'same-city') ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Shared geography only — this does not establish that these people know each other.
        </p>
      ) : link.via.length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Both linked to {link.via.map((node) => node.label).join(' and ')} — they may know each
          other.
        </p>
      )}
      {years.status === 'overlap' && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Overlapping years: {overlapYears(years)}
        </p>
      )}
      {years.status === 'none' && (
        <p className="mt-1 text-[11px] text-muted-foreground">Different years — verify.</p>
      )}
    </div>
  )
}

interface NetworkDetailProps {
  node: NetNode | null
  network: Network
  path: NetPath | null
  me: MeProfile
  idea: string
  expandState?: ExpandState
  onExpand: (id: string) => void
  onSelectNode: (id: string | null) => void
  isContact: boolean
  onToggleContact: (node: NetNode, organization: string) => void
  dossier?: DossierState
  onLoadDossier: () => void
  researchEnabled: boolean
  onEditManual: (node: NetNode) => void
}

export function NetworkDetail({
  node,
  network,
  path,
  me,
  idea,
  expandState,
  onExpand,
  onSelectNode,
  isContact,
  onToggleContact,
  dossier,
  onLoadDossier,
  researchEnabled,
  onEditManual,
}: NetworkDetailProps) {
  const photos = useLinkedinPhotos()
  const [dossierOpen, setDossierOpen] = useState(false)
  const orgInputRef = useRef<HTMLInputElement>(null)
  if (!node) return <Placeholder />

  const isPerson = node.kind === 'person'
  const target = node.target
  const firstName = node.label.split(' ')[0]
  const links = path ? pathLinks(network, path) : []
  const bridge = links.find(
    (link) => link.to.kind === 'person' && link.to.id !== node.id,
  )?.to
  const canExpand = node.kind !== 'me'
  const expandable = expandState?.status !== 'done'

  const byId = new Map(network.nodes.map((entry) => [entry.id, entry]))
  const neighbours: { other: NetNode; edge: (typeof network.edges)[number] }[] = []
  const seenNeighbour = new Set<string>()
  for (const edge of network.edges) {
    if (edge.source !== node.id && edge.target !== node.id) continue
    const other = byId.get(edge.source === node.id ? edge.target : edge.source)
    if (!other || seenNeighbour.has(other.id)) continue
    seenNeighbour.add(other.id)
    if (neighbours.length < 20) neighbours.push({ other, edge })
  }
  const dealCompany = network.edges
    .filter(
      (edge) =>
        edge.relation === 'deal' && (edge.source === node.id || edge.target === node.id),
    )
    .map((edge) => byId.get(edge.source === node.id ? edge.target : edge.source))
    .find((entry) => entry?.kind === 'org')?.label
  const reason =
    target === 'partner'
      ? dealCompany
        ? `${node.fund} invested in ${dealCompany}`
        : fallbackReason(node.fund ?? 'this fund')
      : target === 'founder'
        ? `I've been following ${node.company} and I'm raising in a similar space`
        : "I'd love to learn more about your work"
  const drafts: { title: string; text: string }[] = []
  if (target && path) {
    if (bridge) {
      drafts.push({
        title: `Ask ${bridge.label.split(' ')[0]} for an intro`,
        text: buildIntroAskDraft({
          bridge: bridge.label,
          partner: node.label,
          fund: node.fund ?? node.company ?? '',
          commonFact: introAskFact(links, node),
          idea,
        }),
      })
    } else {
      drafts.push({
        title: `Message ${firstName} directly`,
        text:
          target === 'partner'
            ? buildDraft({
                personName: node.label,
                idea,
                fund: node.fund ?? '',
                company: dealCompany ?? '',
              })
            : target === 'founder'
              ? buildFounderDraft({ personName: node.label, idea, company: node.company ?? '' })
              : buildPersonDraft({ personName: node.label, idea }),
      })
    }
    drafts.push({
      title: 'Forwardable blurb',
      text: buildForwardableBlurb({
        me: me.name,
        idea,
        partner: node.label,
        fund: node.fund ?? '',
        reason,
        kind: target,
      }),
    })
  }

  const dossierFacts = dossier?.status === 'done' ? dossier.dossier.facts : []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {node.kind === 'org' ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-brand/50 bg-card">
            {(() => {
              const Icon = ORG_ICONS[node.orgType ?? 'company']
              return <Icon className="size-4 text-muted-foreground" aria-hidden />
            })()}
          </div>
        ) : (
          <PersonAvatar
            name={node.label}
            photo={photos[linkedinKey(node.label, node.fund ?? node.company ?? '')]}
            size="lg"
            className="text-sm"
          />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">{node.label}</p>
          {node.sublabel && <p className="text-xs text-muted-foreground">{node.sublabel}</p>}
          <div className="mt-1 flex flex-wrap gap-1">
            {target === 'founder' && (
              <Badge variant="outline" className="border-brand/40 bg-brand-soft">
                Founder{node.company ? ` · ${node.company}` : ''}
              </Badge>
            )}
            {target === 'partner' && (
              <Badge variant="outline" className="border-brand/40 bg-brand-soft">
                Partner{node.fund ? ` · ${node.fund}` : ''}
              </Badge>
            )}
            {target === 'person' && (
              <Badge variant="outline" className="border-brand/40 bg-brand-soft">
                Person to meet
              </Badge>
            )}
            {node.manual && (
              <Badge variant="outline">
                Added by you
              </Badge>
            )}
            {node.known === 'contact' && (
              <Badge variant="outline" className="border-brand/40 bg-brand-soft">
                Known contact
              </Badge>
            )}
            {node.known === 'linkedin' && (
              <Badge variant="outline" className="border-brand/40 bg-brand-soft">
                {node.identityUncertain ? 'Possible LinkedIn match — verify' : 'LinkedIn connection'}
              </Badge>
            )}
            {node.identityUncertain && node.known !== 'linkedin' && (
              <Badge variant="outline" className="border-warning/50 bg-warning-soft text-warning-foreground">
                Possible identity match — verify
              </Badge>
            )}
            {node.profileUrl && (
              <a
                href={node.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                LinkedIn profile
              </a>
            )}
            {node.manual && (
              <button
                type="button"
                onClick={() => onEditManual(node)}
                className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Edit or remove
              </button>
            )}
          </div>
        </div>
      </div>

      <section data-tutorial="connection-evidence" className="flex flex-col gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          How you connect
        </p>
        {path ? (
          <>
            <p className="text-2xl font-semibold">
              {path.score}
              <span className="text-sm font-normal text-muted-foreground"> / 100</span>
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              A ranking signal, not a probability that an introduction will happen.
            </p>
            <div className="h-1.5 rounded-full bg-secondary">
              <div
                className="h-1.5 rounded-full bg-brand"
                style={{ width: `${Math.min(100, path.score)}%` }}
              />
            </div>
            <div className="mt-1 flex flex-col gap-2">
              {links.map((link, index) => (
                <LinkBlock key={index} link={link} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            No connection found yet. Add people you know, or search deeper.
          </p>
        )}
        {canExpand && expandState?.status === 'done' && (
          <p className="mt-1 text-xs text-muted-foreground">
            Searched · {expandState.found} found
          </p>
        )}
        {canExpand && node.manualNeedsName && (
          <div>
            <p className="text-xs text-muted-foreground">Add their name to research this profile.</p>
            <Button variant="outline" size="sm" className="mt-1" onClick={() => onEditManual(node)}>
              Add name
            </Button>
          </div>
        )}
        {canExpand && !node.manualNeedsName && !researchEnabled && (
          <p className="text-xs text-muted-foreground">Choose a target to start researching connections.</p>
        )}
        {canExpand && !node.manualNeedsName && researchEnabled && expandable && (
          <div>
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              title="Cala query · about a minute"
              disabled={expandState?.status === 'loading'}
              onClick={() => onExpand(node.id)}
            >
              {expandState?.status === 'loading' && (
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
              )}
              {expandState?.status === 'loading'
                ? 'Searching…'
                : expandState?.status === 'error'
                  ? 'Try again'
                  : 'Search connections'}
            </Button>
            {expandState?.status === 'error' && (
              <p className="mt-1 text-xs text-muted-foreground">{expandState.message}</p>
            )}
          </div>
        )}
        {isPerson && (
          <div className="flex items-center gap-2">
            <Button
              variant={isContact ? 'outline' : 'secondary'}
              size="sm"
              onClick={() =>
                onToggleContact(node, orgInputRef.current?.value.trim() || '')
              }
            >
              {isContact ? 'Remove from people I know' : 'I know this person'}
            </Button>
            {!isContact && (
              <Input
                key={node.id}
                ref={orgInputRef}
                placeholder="Confirmed employer (optional)"
                className="h-8 w-44 text-xs"
              />
            )}
          </div>
        )}
      </section>

      {target && (
        <section data-tutorial="message-drafts" className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Message drafts
          </p>
          {drafts.map((draft) => (
            <Draft key={`${node.id}-${draft.title}`} title={draft.title} text={draft.text} />
          ))}
          <p className="text-[11px] text-muted-foreground">
            Drafts stay in your browser. Nothing is sent.
          </p>
        </section>
      )}

      {neighbours.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Connections ({seenNeighbour.size})
          </p>
          <ul className="flex flex-col gap-1">
            {neighbours.map(({ other, edge }) => (
              <li key={other.id}>
                <button
                  type="button"
                  onClick={() => onSelectNode(other.id)}
                  className="w-full rounded-md px-1 py-0.5 text-left text-xs text-muted-foreground hover:bg-muted/60"
                >
                  <span className="font-medium text-foreground">{other.label}</span> —{' '}
                  {edge.label} <EdgeSource url={edge.source_url} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {target === 'partner' && dossier && (
        <Collapsible open={dossierOpen} onOpenChange={setDossierOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted/60">
            Full dossier
            <ChevronDown
              className={cn('size-3.5 transition-transform', dossierOpen && 'rotate-180')}
              aria-hidden
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 flex flex-col gap-2">
            {dossier.status === 'loading' && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                Building the dossier from Cala… this can take about a minute.
              </p>
            )}
            {dossier.status === 'error' && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">{dossier.message}</p>
                <Button variant="outline" size="sm" className="self-start" onClick={onLoadDossier}>
                  Try again
                </Button>
              </div>
            )}
            {dossier.status === 'done' &&
              DOSSIER_GROUPS.map(([kind, label]) => {
                const facts = dossierFacts.filter((fact) => fact.kind === kind)
                if (!facts.length) return null
                return (
                  <div key={kind}>
                    <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                    <ul className="mt-0.5 flex flex-col gap-1">
                      {facts.map((fact, index) => (
                        <li key={index} className="text-xs text-muted-foreground">
                          {evidenceText(fact)}
                          {factYears(fact) ? ` · ${factYears(fact)}` : ''}{' '}
                          <SourceLink url={fact.source_url} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
