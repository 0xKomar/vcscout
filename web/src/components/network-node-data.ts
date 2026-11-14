import type { NetNode } from '@/lib/network'
import type { ExpandState } from '@/hooks/use-network'

export interface NetNodeData extends Record<string, unknown> {
  node: NetNode
  dimmed: boolean
  photo?: string
  expand?: { status: ExpandState['status'] | 'idle'; onLoad: () => void }
}
