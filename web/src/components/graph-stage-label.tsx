import type { Node, NodeProps } from '@xyflow/react'

export function GraphStageLabel({ data }: NodeProps<Node<{ label: string }>>) {
  return (
    <div className="pointer-events-none w-[165px] border-b border-border pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {data.label}
    </div>
  )
}
