import type { Node, NodeProps } from '@xyflow/react'
import { Loader2 } from 'lucide-react'
import { GraphHandles } from '@/components/graph-handles'
import type { NetNodeData } from '@/components/network-node-data'
import { PersonAvatar } from '@/components/person-avatar'
import { cn } from '@/lib/utils'

export function GraphNetPersonNode({ data, selected }: NodeProps<Node<NetNodeData>>) {
  const { node, dimmed, photo, expand } = data
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
        className={cn(
          'border-2 border-border text-[10px] shadow-xs after:hidden',
          node.target && 'border-brand',
          node.known && 'border-foreground',
          selected && 'ring-2 ring-foreground/20',
        )}
      >
        <GraphHandles />
      </PersonAvatar>
      <span className="mt-0.5 flex w-full items-center justify-center gap-1">
        <span className="block min-w-0 truncate text-[11px] font-medium leading-tight">
          {node.label}
        </span>
        {expand?.status === 'loading' && (
          <Loader2
            className="size-3 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
            aria-hidden
          />
        )}
      </span>
      {node.sublabel && (
        <span className="block w-full truncate text-[10px] text-muted-foreground">
          {node.sublabel}
        </span>
      )}
      {selected && expand && expand.status !== 'done' && (
        <button
          type="button"
          title="Cala query · about a minute"
          onClick={(event) => {
            event.stopPropagation()
            expand.onLoad()
          }}
          className="nodrag mt-1 flex h-6 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-medium hover:border-foreground/40"
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
