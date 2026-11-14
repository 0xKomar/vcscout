import type { Node, NodeProps } from '@xyflow/react'
import { UserRound } from 'lucide-react'
import { GraphHandles } from '@/components/graph-handles'
import type { NetNodeData } from '@/components/network-node-data'
import { cn } from '@/lib/utils'

export function GraphMeNode({ data, selected }: NodeProps<Node<NetNodeData>>) {
  const { node, dimmed } = data
  return (
    <div
      className={cn(
        'relative flex w-44 items-center gap-2 rounded-xl border-2 border-brand bg-brand-soft px-3 py-2 shadow-xs transition-opacity',
        selected && 'ring-2 ring-brand/40',
        dimmed && 'opacity-45',
      )}
    >
      <GraphHandles />
      <UserRound className="size-4 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold">{node.label}</p>
        <p className="text-[10px] text-muted-foreground">You</p>
      </div>
    </div>
  )
}
