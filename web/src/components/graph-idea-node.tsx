import type { Node, NodeProps } from '@xyflow/react'
import { Asterisk } from 'lucide-react'
import { GraphHandles } from '@/components/graph-handles'
import type { GraphNodeData } from '@/components/graph-node-data'
import { cn } from '@/lib/utils'

export function GraphIdeaNode({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  const { node, dimmed } = data
  return (
    <div
      className={cn(
        'relative flex max-w-44 items-center gap-1.5 rounded-full border-2 border-brand bg-brand-soft px-3 py-1.5 shadow-xs transition-opacity',
        selected && 'ring-2 ring-brand/40',
        dimmed && 'opacity-45',
      )}
    >
      <GraphHandles />
      <Asterisk className="size-4 shrink-0 text-brand" aria-hidden />
      <span className="min-w-0 truncate text-xs font-semibold">{node.label}</span>
    </div>
  )
}
