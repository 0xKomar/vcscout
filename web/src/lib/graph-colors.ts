import type { ExplorerGraph } from '@/lib/graph'

export const FAMILY_COLORS = 6

export const familyColor = (family: number): string =>
  `var(--family-${(family % FAMILY_COLORS) + 1})`

export interface GraphFamilies {
  startups: { id: string; label: string; family: number }[]
  byNode: Record<string, number[]>
  byEdge: Record<string, number>
}

// Each similar startup is a color family. Funds and people inherit the
// families of the similar startups they are linked to; edges take the family
// of the similar startup they lead to.
export function graphFamilies(model: ExplorerGraph): GraphFamilies {
  const startups = model.nodes
    .filter((node) => node.kind === 'startup' && node.similar)
    .map((node, family) => ({ id: node.id, label: node.label, family }))
  const startupFamily = new Map(startups.map((startup) => [startup.id, startup.family]))

  const sets: Record<string, Set<number>> = {}
  for (const startup of startups) sets[startup.id] = new Set([startup.family])
  const byEdge: Record<string, number> = {}

  for (const edge of model.edges) {
    if (edge.kind === 'person-fund') continue
    const family = startupFamily.get(edge.target)
    if (family === undefined) continue
    byEdge[edge.id] = family
    if (edge.kind !== 'similar') (sets[edge.source] ??= new Set()).add(family)
  }

  const byNode = Object.fromEntries(
    Object.entries(sets).map(([id, families]) => [id, [...families].sort((a, b) => a - b)]),
  )

  for (const edge of model.edges) {
    if (edge.kind !== 'person-fund') continue
    const families = byNode[edge.source]
    if (families?.length === 1) byEdge[edge.id] = families[0]
  }

  return { startups, byNode, byEdge }
}
