import { describe, expect, it } from 'vitest'
import type { ExplorerGraph } from '@/lib/graph'
import { FAMILY_COLORS, familyColor, graphFamilies } from '@/lib/graph-colors'

const model: ExplorerGraph = {
  nodes: [
    { id: 'idea', kind: 'idea', label: 'Idea' },
    { id: 's:a', kind: 'startup', label: 'A', similar: true },
    { id: 's:b', kind: 'startup', label: 'B', similar: true },
    { id: 's:c', kind: 'startup', label: 'C', explored: true },
    { id: 'f:solo', kind: 'fund', label: 'Solo' },
    { id: 'f:shared', kind: 'fund', label: 'Shared' },
    { id: 'f:other', kind: 'fund', label: 'Other' },
    { id: 'p:one', kind: 'person', label: 'One' },
    { id: 'p:both', kind: 'person', label: 'Both' },
  ],
  edges: [
    { id: 'e1', source: 'idea', target: 's:a', kind: 'similar', label: 'similar' },
    { id: 'e2', source: 'idea', target: 's:b', kind: 'similar', label: 'similar' },
    { id: 'e3', source: 'f:solo', target: 's:a', kind: 'round', label: 'Seed' },
    { id: 'e4', source: 'f:shared', target: 's:a', kind: 'round', label: 'Series A' },
    { id: 'e5', source: 'f:shared', target: 's:b', kind: 'round', label: 'Seed' },
    { id: 'e6', source: 'f:other', target: 's:c', kind: 'round', label: 'Seed' },
    { id: 'e7', source: 'p:one', target: 'f:solo', kind: 'person-fund', label: 'Partner' },
    { id: 'e8', source: 'p:one', target: 's:a', kind: 'person-startup', label: 'linked' },
    { id: 'e9', source: 'p:both', target: 'f:shared', kind: 'person-fund', label: 'Partner' },
    { id: 'e10', source: 'p:both', target: 's:a', kind: 'person-startup', label: 'linked' },
    { id: 'e11', source: 'p:both', target: 's:b', kind: 'person-startup', label: 'linked' },
  ],
}

describe('graphFamilies', () => {
  const families = graphFamilies(model)

  it('gives each similar startup its own family, in graph order', () => {
    expect(families.startups).toEqual([
      { id: 's:a', label: 'A', family: 0 },
      { id: 's:b', label: 'B', family: 1 },
    ])
    expect(families.byNode['s:a']).toEqual([0])
    expect(families.byNode['s:c']).toBeUndefined()
  })

  it('passes families on to the funds and people linked to a similar startup', () => {
    expect(families.byNode['f:solo']).toEqual([0])
    expect(families.byNode['f:shared']).toEqual([0, 1])
    expect(families.byNode['f:other']).toBeUndefined()
    expect(families.byNode['p:one']).toEqual([0])
    expect(families.byNode['p:both']).toEqual([0, 1])
    expect(families.byNode.idea).toBeUndefined()
  })

  it('colors edges by the similar startup they lead to', () => {
    expect(families.byEdge.e1).toBe(0)
    expect(families.byEdge.e2).toBe(1)
    expect(families.byEdge.e4).toBe(0)
    expect(families.byEdge.e5).toBe(1)
    expect(families.byEdge.e6).toBeUndefined()
    expect(families.byEdge.e11).toBe(1)
  })

  it('colors a person-fund edge only when the person belongs to one family', () => {
    expect(families.byEdge.e7).toBe(0)
    expect(families.byEdge.e9).toBeUndefined()
  })
})

describe('familyColor', () => {
  it('cycles through the palette', () => {
    expect(familyColor(0)).toBe('var(--family-1)')
    expect(familyColor(FAMILY_COLORS)).toBe('var(--family-1)')
  })
})
