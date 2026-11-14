import type { Node, NodeProps } from '@xyflow/react'
import { Building2, GraduationCap, HandCoins, Loader2, Users } from 'lucide-react'
import { GraphHandles } from '@/components/graph-handles'
import type { NetNodeData } from '@/components/network-node-data'
import { cn } from '@/lib/utils'

const ICONS = {
  company: Building2,
  fund: HandCoins,
  school: GraduationCap,
  event: Users,
} as const

export function GraphOrgNode({ data, selected }: NodeProps<Node<NetNodeData>>) {
  const { node, dimmed, expand } = data
  const Icon = ICONS[node.orgType ?? 'company']
  return (
    <div className={cn('flex w-[210px] flex-col transition-opacity', dimmed && 'opacity-45')}>
      <div
        title={node.sublabel}
        className={cn(
          'relative flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 shadow-xs',
          'border-brand/50',
          selected && 'ring-2 ring-foreground/15',
        )}
      >
        <GraphHandles />
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{node.label}</p>
          {node.sublabel && (
            <p className="truncate text-[10px] text-muted-foreground">{node.sublabel}</p>
          )}
        </div>
        {expand?.status === 'loading' && (
          <Loader2
            className="ml-auto size-3 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
            aria-hidden
          />
        )}
      </div>
      {selected && expand && expand.status !== 'done' && (
        <button
          type="button"
          title="Cala query · about a minute"
          onClick={(event) => {
            event.stopPropagation()
            expand.onLoad()
          }}
          className="nodrag mt-1 flex h-6 items-center gap-1 self-center rounded-md border border-border bg-card px-2 text-[11px] font-medium hover:border-foreground/40"
        >
          {expand.status === 'loading' && (
            <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />
          )}
          {expand.status === 'loading'
            ? 'Searching…'
            : expand.status === 'error'
              ? 'Try again'
              : 'Search connections'}
        </button>
      )}
    </div>
  )
}
