import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { PersonAvatar } from '@/components/person-avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLinkedinPhotos, linkedinKey } from '@/hooks/use-linkedin'
import type { LinkedinReview } from '@/hooks/use-network'
import { foldText } from '@/lib/intro'
import { pathLinks, type NetNode, type NetPath, type Network } from '@/lib/network'
import { cn } from '@/lib/utils'

interface WarmestIntrosProps {
  ranked: { node: NetNode; path: NetPath | null }[]
  network: Network
  selected: string | null
  linkedinReview: LinkedinReview
  onReviewMore: () => void
  onReviewContact: (key: string) => void
  onSelect: (id: string | null) => void
}

function chainText(network: Network, path: NetPath): string {
  const links = pathLinks(network, path)
  const hop = links[0]
  if (!hop) return ''
  const parts = [hop.to.label]
  for (const link of links.slice(1)) {
    for (const via of link.via) parts.push(via.label)
    parts.push(link.to.label)
  }
  return parts.join(' → ')
}

export function WarmestIntros({
  ranked, network, selected, linkedinReview, onReviewMore, onReviewContact, onSelect,
}: WarmestIntrosProps) {
  const photos = useLinkedinPhotos()
  const reduceMotion = useReducedMotion()
  const [contactQuery, setContactQuery] = useState('')
  const query = foldText(contactQuery).toLowerCase().trim()
  const contacts = linkedinReview.candidates.filter(({ contact }) =>
    !query || foldText(`${contact.name} ${contact.company} ${contact.position}`).toLowerCase().includes(query),
  ).slice(0, query ? 20 : 5)
  const queued = Math.max(
    0, linkedinReview.selected - linkedinReview.researched - linkedinReview.searching - linkedinReview.failed,
  )
  const groups: { org: string; entries: { node: NetNode; path: NetPath | null; rank: number }[] }[] = []
  const byOrg = new Map<string, { node: NetNode; path: NetPath | null; rank: number }[]>()
  ranked.forEach(({ node, path }, index) => {
    const org = node.fund ?? node.company ?? 'People'
    const list = byOrg.get(org) ?? []
    list.push({ node, path, rank: index })
    byOrg.set(org, list)
  })
  const firstPath = new Map<string, number>()
  ranked.forEach(({ node, path }, index) => {
    const org = node.fund ?? node.company ?? 'People'
    if (path && !firstPath.has(org)) firstPath.set(org, index)
  })
  groups.push(
    ...[...byOrg.entries()]
      .sort(
        (a, b) => (firstPath.get(a[0]) ?? Infinity) - (firstPath.get(b[0]) ?? Infinity),
      )
      .map(([org, entries]) => ({ org, entries })),
  )
  return (
    <Card className="gap-0 rounded-2xl py-0">
      <CardHeader className="border-b border-border px-5 py-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-brand">Your next conversation</p>
        <CardTitle className="mt-1 font-serif text-2xl tracking-[-0.025em]">
          Who would you like to meet?
        </CardTitle>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Choose a founder, investor, or someone you add. We&apos;ll explore a path from you to them.
          {ranked.length > 0 && ` ${ranked.length} people found.`}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {ranked.length === 0 && (
          <p className="px-4 py-3 text-xs text-muted-foreground">
            Founders and partners appear here as they are found on your map.
          </p>
        )}
        <ol data-testid="warmest-list" className="lg:max-h-72 lg:overflow-y-auto">
          {groups.map((group) => (
            <li key={group.org} className="border-b border-border last:border-0">
              <p className="bg-muted/40 px-5 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                {group.org}
              </p>
              <ol>
                {group.entries.map(({ node, path, rank }) => (
                  <motion.li
                    key={node.id}
                    layout={!reduceMotion}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border-t border-border/50 first:border-0"
                  >
                    <button
                      type="button"
                      aria-pressed={selected === node.id}
                      onClick={() => onSelect(node.id)}
                      className={cn(
                        'flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-brand-soft/70',
                        selected === node.id && 'bg-brand-soft',
                      )}
                    >
                      <span className="w-5 shrink-0 text-center font-mono text-xs text-muted-foreground">
                        {rank + 1}
                      </span>
                      <PersonAvatar
                        name={node.label}
                        photo={photos[linkedinKey(node.label, node.fund ?? node.company ?? '')]}
                        className="size-8 shrink-0 text-[10px]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {node.label}
                          {node.sublabel && <span className="font-normal text-muted-foreground"> · {node.sublabel}</span>}
                        </span>
                        {path ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {chainText(network, path)}
                          </span>
                        ) : (
                          <span className="block truncate text-xs italic text-muted-foreground">
                            No connection found yet
                          </span>
                        )}
                      </span>
                      {path && (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] font-semibold text-secondary-foreground">
                          {path.score}
                        </span>
                      )}
                    </button>
                  </motion.li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
        {linkedinReview.total > 0 && (
          <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            {linkedinReview.ready ? (
              <>
                <p>
                  {linkedinReview.total} LinkedIn contacts screened locally · {linkedinReview.promising} waiting with
                  relevant signals · {linkedinReview.researched} researched
                  {linkedinReview.searching ? ` · ${linkedinReview.searching} searching` : ''}
                  {queued ? ` · ${queued} queued` : ''}
                  {linkedinReview.failed ? ` · ${linkedinReview.failed} failed` : ''}
                </p>
                <p className="mt-1">
                  Signals are not proof of a connection. Research sends chosen contacts to Cala and AI web search
                  and may use credits.
                </p>
                {linkedinReview.pending > 0 && (
                  <>
                    {linkedinReview.researchable > 0 && (
                      <button
                        type="button"
                        onClick={onReviewMore}
                        className="mt-2 font-medium text-foreground underline underline-offset-2"
                      >
                        Research next {Math.min(3, linkedinReview.researchable)}{' '}
                        contact{linkedinReview.researchable === 1 ? '' : 's'}
                      </button>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer font-medium text-foreground">
                        Browse {linkedinReview.pending} waiting contact{linkedinReview.pending === 1 ? '' : 's'}
                      </summary>
                      <input
                        aria-label="Search LinkedIn contacts"
                        placeholder="Search by name, company, or role"
                        value={contactQuery}
                        onChange={(event) => setContactQuery(event.target.value)}
                        className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
                      />
                      <ul className="mt-2 flex flex-col gap-2">
                        {contacts.map(({ key, contact, reason, researchable }) => (
                          <li key={key} className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block font-medium text-foreground">
                                {contact.name}{contact.company ? ` · ${contact.company}` : ''}
                              </span>
                              <span className="block">{reason}</span>
                            </span>
                            {researchable && (
                              <button
                                type="button"
                                onClick={() => onReviewContact(key)}
                                aria-label={`Research ${contact.name}`}
                                className="shrink-0 font-medium text-foreground underline underline-offset-2"
                              >
                                Research
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                      {!contacts.length && <p className="mt-2">No waiting contacts match that search.</p>}
                    </details>
                  </>
                )}
              </>
            ) : (
              <p>Select a target to assess {linkedinReview.total} LinkedIn contacts.</p>
            )}
          </div>
        )}
        <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          Scores rank documented, self-reported and inferred links. They are not a
          probability of an introduction.
        </p>
      </CardContent>
    </Card>
  )
}
