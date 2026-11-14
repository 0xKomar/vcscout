import type { CSSProperties } from 'react'
import { Asterisk, Building2, Landmark, Search } from 'lucide-react'
import { initials } from '@/lib/format'
import { familyColor } from '@/lib/graph-colors'
import { cn } from '@/lib/utils'

const WIDTH = 1000
const HEIGHT = 440

type PreviewKind = 'idea' | 'startup' | 'fund' | 'person'

interface PreviewNode {
  id: string
  kind: PreviewKind
  label: string
  sublabel?: string
  x: number
  y: number
  family?: number
  route?: boolean
}

const NODES: PreviewNode[] = [
  { id: 'idea', kind: 'idea', label: 'Your idea', x: 90, y: 220 },
  { id: 'lovable', kind: 'startup', label: 'Lovable', x: 300, y: 64, family: 0 },
  { id: 'attio', kind: 'startup', label: 'Attio', x: 300, y: 168, family: 1 },
  { id: 'metaview', kind: 'startup', label: 'Metaview', x: 300, y: 272, family: 2 },
  { id: 'qdrant', kind: 'startup', label: 'Qdrant', x: 300, y: 376, family: 3 },
  { id: 'byfounders', kind: 'fund', label: 'byFounders', x: 545, y: 64, family: 0, route: true },
  { id: 'point-nine', kind: 'fund', label: 'Point Nine', x: 545, y: 142, family: 1 },
  { id: 'plural', kind: 'fund', label: 'Plural', x: 545, y: 220, family: 2 },
  { id: 'vertex', kind: 'fund', label: 'Vertex Ventures US', x: 545, y: 298, family: 2 },
  { id: 'spark', kind: 'fund', label: 'Spark Capital', x: 545, y: 376, family: 3 },
  { id: 'hambleton', kind: 'person', label: 'Magnus Hambleton', sublabel: 'Partner', x: 790, y: 64, family: 0 },
  { id: 'amram', kind: 'person', label: 'Ricardo Sequerra Amram', sublabel: 'Partner', x: 790, y: 142, family: 1 },
  { id: 'helioui', kind: 'person', label: 'Khaled Helioui', sublabel: 'Partner', x: 790, y: 220, family: 2 },
  { id: 'heiliger', kind: 'person', label: 'Jonathan Heiliger', sublabel: 'Investor', x: 790, y: 298, family: 2 },
  { id: 'razavi', kind: 'person', label: 'Yasmin Razavi', sublabel: 'General Partner', x: 790, y: 376, family: 3 },
]

const EDGES: { from: string; to: string; route?: boolean }[] = [
  { from: 'idea', to: 'lovable', route: true },
  { from: 'idea', to: 'attio' },
  { from: 'idea', to: 'metaview' },
  { from: 'idea', to: 'qdrant' },
  { from: 'lovable', to: 'byfounders', route: true },
  { from: 'attio', to: 'point-nine' },
  { from: 'metaview', to: 'plural' },
  { from: 'metaview', to: 'vertex' },
  { from: 'qdrant', to: 'spark' },
  { from: 'byfounders', to: 'hambleton' },
  { from: 'point-nine', to: 'amram' },
  { from: 'plural', to: 'helioui' },
  { from: 'vertex', to: 'heiliger' },
  { from: 'spark', to: 'razavi' },
]

const NODE_BY_ID = Object.fromEntries(NODES.map((node) => [node.id, node]))

const NODE_DELAY: Record<PreviewKind, number> = { idea: 1, startup: 1.35, fund: 1.75, person: 2.15 }

const FAMILIES = NODES.filter((node) => node.kind === 'startup')

function PreviewPill({ node }: { node: PreviewNode }) {
  const family = { '--family': familyColor(node.family ?? 0) } as CSSProperties
  if (node.kind === 'person') {
    return (
      <span className="flex items-center gap-2">
        <span
          style={family}
          className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-(--family) bg-secondary text-[10px] font-semibold shadow-xs"
        >
          {initials(node.label)}
        </span>
        <span className="flex flex-col text-left leading-tight">
          <span className="text-[11px] font-medium whitespace-nowrap">{node.label}</span>
          <span className="text-[10px] text-muted-foreground">{node.sublabel}</span>
        </span>
      </span>
    )
  }
  const Icon = node.kind === 'idea' ? Asterisk : node.kind === 'startup' ? Building2 : Landmark
  return (
    <span
      style={family}
      className={cn(
        'flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium whitespace-nowrap shadow-xs',
        node.kind === 'idea' && 'border-2 border-brand bg-brand-soft px-3 py-1.5 font-semibold',
        node.kind === 'startup' &&
          'border-(--family)/50 bg-[color-mix(in_oklab,var(--family)_10%,var(--card))]',
        node.kind === 'fund' && 'border-(--family)/50',
      )}
    >
      <Icon
        className={cn(
          'shrink-0',
          node.kind === 'idea' && 'size-4 text-brand',
          node.kind === 'startup' && 'size-3 text-(--family)',
          node.kind === 'fund' && 'size-3 text-muted-foreground',
        )}
      />
      {node.label}
      {node.route && (
        <span className="grid size-4 place-items-center rounded-full bg-brand text-[9px] font-bold text-brand-foreground">
          1
        </span>
      )}
    </span>
  )
}

export function HeroGraphPreview() {
  return (
    <div
      role="img"
      aria-label="Example relationship graph: your idea linked to the similar startups Lovable, Attio, Metaview and Qdrant, the funds that backed them, and people at those funds."
      className="w-full rounded-[18px] border border-white/60 bg-white/45 p-1.5 shadow-[0_1px_2px_rgba(23,23,23,0.06),0_16px_48px_-16px_rgba(23,23,23,0.22)] md:rounded-[24px] md:p-2"
    >
      <div
        aria-hidden
        className="overflow-hidden rounded-[12px] border border-foreground/[0.06] bg-card text-left md:rounded-[16px]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-44 items-center gap-2 rounded-lg border border-input px-2.5 text-xs text-muted-foreground">
              <Search className="size-3.5" />
              Search the graph…
            </span>
            <span className="hidden h-8 items-center rounded-lg border border-border px-2.5 text-xs font-medium sm:flex">
              Fit graph
            </span>
          </div>
          <ul className="hidden items-center gap-4 text-xs text-muted-foreground md:flex">
            {FAMILIES.map((node) => (
              <li key={node.id} className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: familyColor(node.family ?? 0) }}
                />
                {node.label}
              </li>
            ))}
          </ul>
        </div>
        <div
          className="relative min-w-[720px] bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px]"
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        >
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
          >
            {EDGES.map((edge) => {
              const from = NODE_BY_ID[edge.from]
              const to = NODE_BY_ID[edge.to]
              const middle = (from.x + to.x) / 2
              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={`M ${from.x} ${from.y} C ${middle} ${from.y} ${middle} ${to.y} ${to.x} ${to.y}`}
                  fill="none"
                  pathLength={1}
                  vectorEffect="non-scaling-stroke"
                  className="preview-edge"
                  stroke={familyColor(to.family ?? 0)}
                  strokeWidth={edge.route ? 2.25 : 1.25}
                  strokeOpacity={edge.route ? 1 : 0.6}
                  style={{ animationDelay: `${NODE_DELAY[from.kind] + 0.1}s` }}
                />
              )
            })}
          </svg>
          {NODES.map((node) => (
            <div
              key={node.id}
              className={cn(
                'entrance-fade absolute -translate-y-1/2',
                node.kind === 'person' ? '-ml-4' : '-translate-x-1/2',
              )}
              style={
                {
                  left: `${(node.x / WIDTH) * 100}%`,
                  top: `${(node.y / HEIGHT) * 100}%`,
                  animationDelay: `${NODE_DELAY[node.kind]}s`,
                  '--entrance-y': '8px',
                } as CSSProperties
              }
            >
              <PreviewPill node={node} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
