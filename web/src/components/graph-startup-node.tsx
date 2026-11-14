import type { CSSProperties } from 'react'
import type { Node, NodeProps } from '@xyflow/react'
import { Building2, Loader2 } from 'lucide-react'
import { GraphHandles } from '@/components/graph-handles'
import type { GraphNodeData } from '@/components/graph-node-data'
import { familyColor } from '@/lib/graph-colors'
import { cn } from '@/lib/utils'

export function GraphStartupNode({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  const { node, dimmed, explore, families = [] } = data
  const family = families[0]
  return (
    <div className={cn('flex flex-col items-center transition-opacity', dimmed && 'opacity-45')}>
      <div
        title={
          node.similar ? 'Similar startup' : node.explored ? 'Explored startup' : undefined
        }
        style={
          family === undefined ? undefined : ({ '--family': familyColor(family) } as CSSProperties)
        }
        className={cn(
          'relative flex max-w-40 items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 shadow-xs',
          family !== undefined
            ? 'border-(--family)/50 bg-[color-mix(in_oklab,var(--family)_10%,var(--card))]'
            : node.explored
              ? 'border-dashed border-border'
              : 'border-border',
          selected &&
            (family !== undefined
              ? 'border-(--family) ring-2 ring-(--family)/30'
              : 'border-brand ring-2 ring-brand/30'),
        )}
      >
        <GraphHandles />
        <Building2
          className={cn(
            'size-3 shrink-0',
            family !== undefined ? 'text-(--family)' : 'text-muted-foreground',
          )}
          aria-hidden
        />
        <span className="min-w-0 truncate text-xs font-medium">{node.label}</span>
      </div>
      {selected && explore && explore.status !== 'done' && (
        <button
          type="button"
          title="Cala query · about a minute"
          onClick={(event) => {
            event.stopPropagation()
            explore.onLoad()
          }}
          className="nodrag mt-1 flex h-6 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-medium hover:border-foreground/40"
        >
          {explore.status === 'loading' && (
            <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />
          )}
          {explore.status === 'loading'
            ? 'Searching…'
            : explore.status === 'error'
              ? 'Try again'
              : 'See more'}
        </button>
      )}
    </div>
  )
}
