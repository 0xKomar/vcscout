import { describe, expect, it } from 'vitest'
import type { GraphEdge, GraphNode } from '@/lib/graph'
import { fundStageLevels, graphColumns, layoutGraph } from '@/lib/graph-layout'

const nodes: GraphNode[] = [
  { id: 'idea', kind: 'idea', label: 'Idea' },
  { id: 's:a', kind: 'startup', label: 'A' },
  { id: 's:b', kind: 'startup', label: 'B' },
  { id: 'f:x', kind: 'fund', label: 'X' },
  { id: 'p:y', kind: 'person', label: 'Y' },
]

const edges: GraphEdge[] = [
  { id: 'e1', source: 'idea', target: 's:a', kind: 'similar', label: 'podobny' },
  { id: 'e2', source: 'idea', target: 's:b', kind: 'similar', label: 'podobny' },
  { id: 'e3', source: 'f:x', target: 's:a', kind: 'round', label: 'Seed' },
  { id: 'e4', source: 'p:y', target: 'f:x', kind: 'person-fund', label: 'Partner' },
]

describe('layoutGraph', () => {
  it('positions every node without NaN', () => {
    const out = layoutGraph(nodes, edges, {})
    for (const node of nodes) {
      expect(Number.isFinite(out[node.id].x)).toBe(true)
      expect(Number.isFinite(out[node.id].y)).toBe(true)
    }
  })

  it('keeps previous positions fixed', () => {
    const prev = { 's:a': { x: 123, y: -45 } }
    const out = layoutGraph(nodes, edges, prev)
    expect(out['s:a']).toEqual({ x: 123, y: -45 })
  })

  it('is deterministic', () => {
    const a = layoutGraph(nodes, edges, {})
    const b = layoutGraph(nodes, edges, {})
    expect(a).toEqual(b)
  })

  it('positions newly added nodes near existing ones', () => {
    const prev = layoutGraph(nodes.slice(0, 3), edges.slice(0, 2), {})
    const grown = layoutGraph(nodes, edges, prev)
    for (const id of Object.keys(prev)) {
      expect(grown[id]).toEqual(prev[id])
    }
    expect(Number.isFinite(grown['f:x'].x)).toBe(true)
    expect(Number.isFinite(grown['p:y'].y)).toBe(true)
  })

  it('places funds in funding-stage order, even when a later round arrives first', () => {
    const stageNodes: GraphNode[] = [
      { id: 'idea', kind: 'idea', label: 'Idea' },
      { id: 's:a', kind: 'startup', label: 'A', similar: true },
      { id: 'f:series-a', kind: 'fund', label: 'Series A fund' },
      { id: 'f:seed', kind: 'fund', label: 'Seed fund' },
      { id: 'f:series-b', kind: 'fund', label: 'Series B fund' },
    ]
    const stageEdges: GraphEdge[] = [
      { id: 'a', source: 'f:series-a', target: 's:a', kind: 'round', label: 'Series A · 2023' },
      { id: 'seed', source: 'f:seed', target: 's:a', kind: 'round', label: 'Seed · 2021' },
      { id: 'b', source: 'f:series-b', target: 's:a', kind: 'round', label: 'Series B · 2024' },
    ]
    const first = layoutGraph(stageNodes.slice(0, 3), stageEdges.slice(0, 1), {})
    const grown = layoutGraph(stageNodes, stageEdges, first)
    expect(grown['f:series-a']).toEqual(first['f:series-a'])
    expect(grown.idea.x).toBeLessThan(grown['s:a'].x)
    expect(grown['s:a'].x).toBeLessThan(grown['f:seed'].x)
    expect(grown['f:seed'].x).toBeLessThan(grown['f:series-a'].x)
    expect(grown['f:series-a'].x).toBeLessThan(grown['f:series-b'].x)
  })

  it('uses the earliest documented stage for multi-stage funds and keeps related people nearby', () => {
    const stageNodes: GraphNode[] = [
      { id: 's:a', kind: 'startup', label: 'A', similar: true },
      { id: 'f:multi', kind: 'fund', label: 'Multi-stage fund' },
      { id: 'f:later', kind: 'fund', label: 'Later fund' },
      { id: 'f:unknown', kind: 'fund', label: 'Unknown stage fund' },
      { id: 'p:investor', kind: 'person', label: 'Investor' },
    ]
    const stageEdges: GraphEdge[] = [
      { id: 'a', source: 'f:multi', target: 's:a', kind: 'round', label: 'Series A · 2022' },
      { id: 'seed', source: 'f:multi', target: 's:a', kind: 'round', label: 'Pre-seed · 2020' },
      { id: 'b', source: 'f:later', target: 's:a', kind: 'round', label: 'Series B · 2024' },
      { id: 'person', source: 'p:investor', target: 'f:multi', kind: 'person-fund', label: 'Partner' },
    ]
    const columns = graphColumns(stageNodes, stageEdges)
    expect(fundStageLevels(stageEdges)['f:multi']).toEqual([0, 1])
    expect(columns['f:multi']).toBeLessThan(columns['p:investor'])
    expect(columns['p:investor']).toBeLessThan(columns['f:later'])
    expect(columns['f:unknown']).toBeGreaterThan(columns['f:later'])
  })

  it('keeps the funds and people of each similar startup together, in startup order', () => {
    const familyNodes: GraphNode[] = [
      { id: 'idea', kind: 'idea', label: 'Idea' },
      { id: 's:a', kind: 'startup', label: 'A', similar: true },
      { id: 's:b', kind: 'startup', label: 'B', similar: true },
      { id: 'f:a1', kind: 'fund', label: 'A1' },
      { id: 'f:b1', kind: 'fund', label: 'B1' },
      { id: 'f:a2', kind: 'fund', label: 'A2' },
      { id: 'f:b2', kind: 'fund', label: 'B2' },
      { id: 'p:b1', kind: 'person', label: 'B1 partner' },
      { id: 'p:a2', kind: 'person', label: 'A2 partner' },
    ]
    const familyEdges: GraphEdge[] = [
      { id: 'e1', source: 'idea', target: 's:a', kind: 'similar', label: 'similar' },
      { id: 'e2', source: 'idea', target: 's:b', kind: 'similar', label: 'similar' },
      { id: 'e3', source: 'f:a1', target: 's:a', kind: 'round', label: 'Seed · 2021' },
      { id: 'e4', source: 'f:b1', target: 's:b', kind: 'round', label: 'Seed · 2021' },
      { id: 'e5', source: 'f:a2', target: 's:a', kind: 'round', label: 'Seed · 2022' },
      { id: 'e6', source: 'f:b2', target: 's:b', kind: 'round', label: 'Seed · 2022' },
      { id: 'e7', source: 'p:b1', target: 'f:b1', kind: 'person-fund', label: 'Partner' },
      { id: 'e8', source: 'p:b1', target: 's:b', kind: 'person-startup', label: 'linked' },
      { id: 'e9', source: 'p:a2', target: 'f:a2', kind: 'person-fund', label: 'Partner' },
      { id: 'e10', source: 'p:a2', target: 's:a', kind: 'person-startup', label: 'linked' },
    ]
    const out = layoutGraph(familyNodes, familyEdges, {})
    const funds = ['f:a1', 'f:b1', 'f:a2', 'f:b2'].sort((a, b) => out[a].y - out[b].y)
    expect(funds).toEqual(['f:a1', 'f:a2', 'f:b1', 'f:b2'])
    for (let i = 1; i < funds.length; i += 1) {
      expect(out[funds[i]].y - out[funds[i - 1]].y).toBeGreaterThanOrEqual(72.9)
    }
    expect(out['s:a'].y).toBeLessThan(out['s:b'].y)
    expect(out['p:a2'].y).toBeLessThan(out['p:b1'].y)
  })

  it('stacks founders directly under their startup', () => {
    const founderNodes: GraphNode[] = [
      { id: 'idea', kind: 'idea', label: 'Idea' },
      { id: 's:a', kind: 'startup', label: 'A', similar: true },
      { id: 's:b', kind: 'startup', label: 'B', similar: true },
      { id: 'f:a', kind: 'fund', label: 'A fund' },
      { id: 'p:b1', kind: 'person', label: 'B founder', founder: true },
      { id: 'p:a1', kind: 'person', label: 'A founder', founder: true },
      { id: 'p:a2', kind: 'person', label: 'A co-founder', founder: true },
    ]
    const founderEdges: GraphEdge[] = [
      { id: 'e1', source: 'idea', target: 's:a', kind: 'similar', label: 'similar' },
      { id: 'e2', source: 'idea', target: 's:b', kind: 'similar', label: 'similar' },
      { id: 'e3', source: 'f:a', target: 's:a', kind: 'round', label: 'Seed · 2021' },
      { id: 'e4', source: 'p:b1', target: 's:b', kind: 'founder', label: 'Founder' },
      { id: 'e5', source: 'p:a1', target: 's:a', kind: 'founder', label: 'Founder' },
      { id: 'e6', source: 'p:a2', target: 's:a', kind: 'founder', label: 'Founder' },
    ]
    const out = layoutGraph(founderNodes, founderEdges, {})
    const column = ['s:a', 's:b', 'p:b1', 'p:a1', 'p:a2']
    for (const id of column) expect(out[id].x).toBe(out['s:a'].x)
    expect(column.sort((a, b) => out[a].y - out[b].y)).toEqual(['s:a', 'p:a1', 'p:a2', 's:b', 'p:b1'])
  })

  it('keeps new nodes clear of fixed nodes while preserving their positions', () => {
    const crowdedNodes: GraphNode[] = [
      { id: 'f:seed', kind: 'fund', label: 'Seed fund' },
      { id: 'f:later', kind: 'fund', label: 'Later fund' },
      { id: 'p:seed', kind: 'person', label: 'Investor' },
    ]
    const crowdedEdges: GraphEdge[] = [
      { id: 'seed', source: 'f:seed', target: 's:a', kind: 'round', label: 'Seed' },
      { id: 'a', source: 'f:later', target: 's:a', kind: 'round', label: 'Series A' },
      { id: 'person', source: 'p:seed', target: 'f:seed', kind: 'person-fund', label: 'Partner' },
    ]
    const startup: GraphNode = { id: 's:a', kind: 'startup', label: 'A', similar: true }
    const prev = {
      'f:seed': { x: 410, y: 0 },
      'f:later': { x: 680, y: 0 },
      's:a': { x: 200, y: 0 },
    }
    const result = layoutGraph([...crowdedNodes, startup], crowdedEdges, prev)
    expect(result['f:seed']).toEqual(prev['f:seed'])
    expect(result['f:later']).toEqual(prev['f:later'])
    expect(result['p:seed'].y <= -83 || result['p:seed'].y >= 73).toBe(true)
  })
})
