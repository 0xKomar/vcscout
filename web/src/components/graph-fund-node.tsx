import type { CSSProperties } from 'react'
import type { Node, NodeProps } from '@xyflow/react'
import { AlertTriangle, Landmark, Loader2 } from 'lucide-react'
import { GraphHandles } from '@/components/graph-handles'
import type { GraphNodeData } from '@/components/graph-node-data'
import { familyColor } from '@/lib/graph-colors'
import { stageLabel } from '@/lib/graph-layout'
import { cn } from '@/lib/utils'

export function GraphFundNode({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  const { node, dimmed, explore, stages = [], families = [] } = data
  const family = families.length === 1 ? families[0] : undefined
  const stageText = stages.length ? stages.map(stageLabel).join(' · ') : 'Stage unknown'
  return (
    <div className={cn('flex flex-col items-center transition-opacity', dimmed && 'opacity-45')}>
      <div
        title={
          node.route === 1 ? 'Your stage' : node.route === 2 ? 'Next round' : undefined
        }
        style={family === undefined ? undefined : ({ '--family': familyColor(family) } as CSSProperties)}
        className={cn(
          'relative flex max-w-[170px] items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 shadow-xs',
          family === undefined ? 'border-border' : 'border-(--family)/50',
          selected &&
            (family === undefined
              ? 'border-foreground/60 ring-2 ring-foreground/15'
              : 'border-(--family) ring-2 ring-(--family)/30'),
        )}
      >
        <GraphHandles />
        <Landmark className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 truncate text-xs font-medium">{node.label}</span>
        {node.route && (
          <span className="grid size-4 shrink-0 place-items-center rounded-full bg-brand text-[9px] font-bold text-brand-foreground">
            {node.route}
          </span>
        )}
        {node.flagged && (
          <AlertTriangle className="size-3 shrink-0 text-warning-foreground" aria-hidden />
        )}
      </div>
      <span className="mt-0.5 flex max-w-[180px] items-center gap-1">
        {families.map((item) => (
          <span
            key={item}
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: familyColor(item) }}
            aria-hidden
          />
        ))}
        <span
          title={stageText}
          className="min-w-0 truncate text-center text-[10px] leading-tight text-muted-foreground"
        >
          {stageText}
        </span>
      </span>
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
