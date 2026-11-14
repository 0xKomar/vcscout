import type { Node, NodeProps } from '@xyflow/react'
import { Loader2 } from 'lucide-react'
import { GraphHandles } from '@/components/graph-handles'
import type { GraphNodeData } from '@/components/graph-node-data'
import { PersonAvatar } from '@/components/person-avatar'
import { familyColor } from '@/lib/graph-colors'
import { cn } from '@/lib/utils'

export function GraphPersonNode({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  const { node, dimmed, explore, families = [], photo } = data
  const family = families.length === 1 ? families[0] : undefined
  return (
    <div
      className={cn(
        'flex w-[120px] flex-col items-center text-center transition-opacity',
        dimmed && 'opacity-45',
      )}
    >
      <PersonAvatar
        name={node.label}
        photo={photo}
        style={family === undefined ? undefined : { borderColor: familyColor(family) }}
        className={cn(
          'border-2 border-border text-[10px] shadow-xs after:hidden',
          selected && 'ring-2 ring-foreground/20',
          selected && family === undefined && 'border-foreground/60',
        )}
      >
        <GraphHandles />
      </PersonAvatar>
      <span className="mt-0.5 block w-full truncate text-[11px] font-medium leading-tight">
        {node.label}
      </span>
      {node.sublabel && (
        <span className="block w-full truncate text-[10px] text-muted-foreground">
          {node.sublabel}
        </span>
      )}
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
