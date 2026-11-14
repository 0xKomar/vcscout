import type { GraphNode } from '@/lib/graph'

export type ExploreStatus = 'idle' | 'loading' | 'done' | 'error'

export interface GraphNodeData extends Record<string, unknown> {
  node: GraphNode
  dimmed: boolean
  stages?: number[]
  families?: number[]
  photo?: string
  explore?: { status: ExploreStatus; onLoad: () => void }
}
