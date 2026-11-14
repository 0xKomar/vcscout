import type { GraphEdge, GraphNode, GraphNodeKind } from '@/lib/graph'
import { roundLevel } from '@/lib/paths'

export interface XY {
  x: number
  y: number
}

const NODE_SIZE: Record<GraphNodeKind, { width: number; height: number }> = {
  idea: { width: 176, height: 36 },
  startup: { width: 160, height: 55 },
  fund: { width: 170, height: 65 },
  person: { width: 120, height: 75 },
}

const STARTUP_X = 200
const SEED_X = 410
const STAGE_GAP = 350
const RELATED_OFFSET = 180
const MAX_STAGE_COLUMN = 5

export function fundStageLevels(edges: GraphEdge[]): Record<string, number[]> {
  const stages: Record<string, Set<number>> = {}
  for (const edge of edges) {
    if (edge.kind !== 'round') continue
    const level = roundLevel(edge.label)
    if (level === null) continue
    const fundStages = (stages[edge.source] ??= new Set())
    fundStages.add(level)
  }
  return Object.fromEntries(
    Object.entries(stages).map(([id, levels]) => [id, [...levels].sort((a, b) => a - b)]),
  )
}

export function stageLabel(level: number): string {
  return level === 0 ? 'Pre-seed / Seed' : `Series ${String.fromCharCode(64 + level)}`
}

export function graphColumns(nodes: GraphNode[], edges: GraphEdge[]): Record<string, number> {
  const stages = fundStageLevels(edges)
  const knownLevels = Object.values(stages).flat()
  const lastKnownColumn = Math.min(Math.max(0, ...knownLevels), MAX_STAGE_COLUMN)
  const columns: Record<string, number> = {}

  for (const node of nodes) {
    if (node.kind !== 'fund') continue
    const level = stages[node.id]?.[0]
    const column = level === undefined ? lastKnownColumn + 1 : Math.min(level, MAX_STAGE_COLUMN)
    columns[node.id] = SEED_X + column * STAGE_GAP
  }

  for (const node of nodes) {
    if (node.kind !== 'person') continue
    const fundColumns = edges
      .filter((edge) => edge.kind === 'person-fund' && edge.source === node.id)
      .map((edge) => columns[edge.target])
      .filter((x): x is number => x !== undefined)
    columns[node.id] = fundColumns.length ? Math.min(...fundColumns) + RELATED_OFFSET : STARTUP_X
  }

  for (const node of nodes) {
    if (node.kind === 'idea') columns[node.id] = 0
    if (node.kind !== 'startup') continue
    if (node.similar) {
      columns[node.id] = STARTUP_X
      continue
    }
    const fundColumns = edges
      .filter((edge) => edge.kind === 'round' && edge.target === node.id)
      .map((edge) => columns[edge.source])
      .filter((x): x is number => x !== undefined)
    const personColumns = edges
      .filter((edge) => edge.kind === 'person-startup' && edge.target === node.id)
      .map((edge) => columns[edge.source])
      .filter((x): x is number => x !== undefined)
    columns[node.id] = fundColumns.length
      ? Math.min(...fundColumns) + RELATED_OFFSET
      : personColumns.length
        ? Math.min(...personColumns)
        : STARTUP_X
  }
  return columns
}

const ROW_GAP = 8
const SWEEPS = 4

interface Slot {
  top: number
  height: number
}

// Stacks slots in the given order, as close to their wanted tops as possible
// without overlapping: overlapping neighbours merge into a block that is
// centred on what its members asked for.
function stackSlots(slots: Slot[]): number[] {
  const blocks: { first: number; last: number; start: number; size: number }[] = []
  const offsets = new Array<number>(slots.length).fill(0)
  const merge = (first: number, last: number) => {
    let offset = 0
    let sum = 0
    for (let i = first; i <= last; i += 1) {
      offsets[i] = offset
      sum += slots[i].top - offset
      offset += slots[i].height + ROW_GAP
    }
    return { first, last, start: sum / (last - first + 1), size: offset - ROW_GAP }
  }
  slots.forEach((_, index) => {
    let block = merge(index, index)
    while (blocks.length) {
      const above = blocks[blocks.length - 1]
      if (above.start + above.size + ROW_GAP <= block.start) break
      blocks.pop()
      block = merge(above.first, block.last)
    }
    blocks.push(block)
  })
  const tops = new Array<number>(slots.length)
  for (const block of blocks) {
    for (let i = block.first; i <= block.last; i += 1) tops[i] = block.start + offsets[i]
  }
  return tops
}

export function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  prev: Record<string, XY>,
): Record<string, XY> {
  const columns = graphColumns(nodes, edges)
  const kinds = new Map(nodes.map((node) => [node.id, node.kind]))
  const position = new Map<string, XY>()
  for (const node of nodes) if (prev[node.id]) position.set(node.id, prev[node.id])

  // A person sits next to their fund; the link to the deal only matters for
  // nodes that have no other connection.
  const direct = new Map<string, string[]>()
  const loose = new Map<string, string[]>()
  for (const edge of edges) {
    if (!kinds.has(edge.source) || !kinds.has(edge.target)) continue
    const target = edge.kind === 'person-startup' ? loose : direct
    target.set(edge.source, [...(target.get(edge.source) ?? []), edge.target])
    target.set(edge.target, [...(target.get(edge.target) ?? []), edge.source])
  }
  const neighbors = (id: string) => direct.get(id) ?? loose.get(id) ?? []
  const height = (id: string) => NODE_SIZE[kinds.get(id) as GraphNodeKind].height
  const center = (id: string) => (position.get(id) as XY).y + height(id) / 2
  const wanted = (id: string): number | undefined => {
    const placed = neighbors(id).filter((other) => position.has(other))
    if (!placed.length) return undefined
    return placed.reduce((sum, other) => sum + center(other), 0) / placed.length
  }

  const byColumn = new Map<number, string[]>()
  for (const node of nodes) {
    if (prev[node.id]) continue
    const x = columns[node.id]
    byColumn.set(x, [...(byColumn.get(x) ?? []), node.id])
  }
  const xs = [...byColumn.keys()].sort((a, b) => a - b)

  const stack = (x: number, ids: string[], fallback: (id: string) => number) => {
    const tops = stackSlots(
      ids.map((id) => ({ top: (wanted(id) ?? fallback(id)) - height(id) / 2, height: height(id) })),
    )
    ids.forEach((id, index) => position.set(id, { x, y: tops[index] }))
  }

  // Left to right: order every column by where its already placed neighbours
  // are, so the funds and people of one startup stay together.
  for (const x of xs) {
    const ids = byColumn.get(x) as string[]
    const column = new Set(ids)
    const keys = new Map(ids.map((id, index) => [id, { wanted: wanted(id), index }]))
    // A node whose only anchor is in its own column (a founder under their
    // startup) follows that anchor instead of being sorted on its own.
    const anchorOf = (id: string) =>
      keys.get(id)?.wanted === undefined
        ? neighbors(id).find((other) => column.has(other) && keys.get(other)?.wanted !== undefined)
        : undefined
    const followers = new Map<string, string[]>()
    const leaders = ids.filter((id) => {
      const anchor = anchorOf(id)
      if (anchor) followers.set(anchor, [...(followers.get(anchor) ?? []), id])
      return !anchor
    })
    leaders.sort((a, b) => {
      const first = keys.get(a) as { wanted?: number; index: number }
      const second = keys.get(b) as { wanted?: number; index: number }
      const difference = (first.wanted ?? Infinity) - (second.wanted ?? Infinity)
      return difference || first.index - second.index
    })
    const ordered = leaders.flatMap((id) => [id, ...(followers.get(id) ?? [])])
    byColumn.set(x, ordered)
    stack(x, ordered, () => 0)
  }

  // Keep that order and pull each column towards all of its neighbours.
  for (let sweep = 0; sweep < SWEEPS; sweep += 1) {
    for (const x of sweep % 2 ? xs : [...xs].reverse()) {
      stack(x, byColumn.get(x) as string[], center)
    }
  }

  // Pinned nodes do not take part in the stacking. Move each new node that
  // lands on one to the nearest free vertical gap, including room for its action.
  const box = (id: string) => ({ ...(position.get(id) as XY), ...NODE_SIZE[kinds.get(id) as GraphNodeKind] })
  const settled = nodes.filter((node) => prev[node.id]).map((node) => node.id)
  for (const x of xs) {
    for (const id of byColumn.get(x) as string[]) {
      const own = box(id)
      const intervals = settled
        .map(box)
        .filter((other) => own.x < other.x + other.width + 8 && own.x + own.width + 8 > other.x)
        .map((other) => ({ start: other.y - own.height - 8, end: other.y + other.height + 8 }))
        .sort((a, b) => a.start - b.start)
      const merged: { start: number; end: number }[] = []
      for (const interval of intervals) {
        const last = merged[merged.length - 1]
        if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end)
        else merged.push({ ...interval })
      }
      const overlap = merged.find((interval) => interval.start < own.y && own.y < interval.end)
      if (overlap) {
        position.set(id, {
          x: own.x,
          y: own.y - overlap.start < overlap.end - own.y ? overlap.start : overlap.end,
        })
      }
      settled.push(id)
    }
  }

  const out: Record<string, XY> = {}
  for (const node of nodes) {
    const { x, y } = position.get(node.id) as XY
    out[node.id] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
  }
  return out
}
