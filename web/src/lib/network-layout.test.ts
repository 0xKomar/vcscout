import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/network-layout.json'
import { layoutNetwork, layoutPathVertical } from './network-layout'
import type { NetNode, Network } from './network'

const SIZE = { me: [190, 48], person: [130, 78], org: [220, 44] } as const

const person = (id: string, target?: 'partner' | 'founder'): NetNode => ({
  id,
  kind: 'person',
  label: id,
  target,
})
const org = (id: string): NetNode => ({ id, kind: 'org', label: id, orgType: 'company' })

const edge = (i: number, source: string, target: string) => ({
  id: `e${i}`,
  source,
  target,
  relation: 'works' as const,
  label: 'x',
  cost: 1.25,
  certainty: 'fact' as const,
  source_url: 'x',
})

// me with 60 contacts across 20 organizations, and 40 unconnected targets
const bigNetwork = (): Network => {
  const nodes: NetNode[] = [{ id: 'me', kind: 'me', label: 'Me' }]
  const edges: ReturnType<typeof edge>[] = []
  let e = 0
  const orgs = Array.from({ length: 20 }, (_, i) => org(`o:org${i}`))
  nodes.push(...orgs)
  for (let i = 0; i < 60; i += 1) {
    const p = person(`p:person${i}`)
    nodes.push(p)
    edges.push(edge(e++, 'me', p.id))
    edges.push(edge(e++, p.id, orgs[i % orgs.length].id))
  }
  for (let i = 0; i < 40; i += 1) {
    const t = person(`p:target${i}`, i % 2 ? 'founder' : 'partner')
    const company = org(`o:company${i}`)
    nodes.push(t, company)
    edges.push(edge(e++, t.id, company.id))
    if (i > 0) edges.push(edge(e++, `p:target${i - 1}`, t.id))
  }
  return { nodes, edges }
}

const real = fixture as unknown as Network

const boxes = (network: Network, positions: Record<string, { x: number; y: number }>) =>
  network.nodes.map((node) => {
    const p = positions[node.id]
    return { x1: p.x, y1: p.y, x2: p.x + SIZE[node.kind][0], y2: p.y + SIZE[node.kind][1], id: node.id }
  })

const overlapping = (network: Network, positions: Record<string, { x: number; y: number }>) => {
  const list = boxes(network, positions)
  const pairs: string[] = []
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i]
      const b = list[j]
      if (Math.min(a.x2, b.x2) > Math.max(a.x1, b.x1) && Math.min(a.y2, b.y2) > Math.max(a.y1, b.y1)) {
        pairs.push(`${a.id} / ${b.id}`)
      }
    }
  }
  return pairs
}

const bounds = (network: Network, positions: Record<string, { x: number; y: number }>) => {
  const list = boxes(network, positions)
  const width = Math.max(...list.map((b) => b.x2)) - Math.min(...list.map((b) => b.x1))
  const height = Math.max(...list.map((b) => b.y2)) - Math.min(...list.map((b) => b.y1))
  return { width, height }
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

describe('layoutNetwork', () => {
  it('lays out a selected path vertically without overlapping nodes on narrow screens', () => {
    const network: Network = {
      nodes: [{ id: 'me', kind: 'me', label: 'Me' }, person('p:bridge'), org('o:shared'), person('p:target', 'founder')],
      edges: [edge(0, 'me', 'p:bridge'), edge(1, 'p:bridge', 'o:shared'), edge(2, 'o:shared', 'p:target')],
    }
    const path = ['me', 'p:bridge', 'o:shared', 'p:target']
    const positions = layoutPathVertical(network, path)
    expect(overlapping(network, positions)).toEqual([])
    expect(path.map((id) => positions[id].y)).toEqual([0, 120, 240, 360])
    expect(bounds(network, positions).width).toBeLessThanOrEqual(220)
  })

  it('is deterministic and pins me at the origin', () => {
    const net = bigNetwork()
    const a = layoutNetwork(net)
    expect(layoutNetwork(net)).toEqual(a)
    expect(a.me).toEqual({ x: 0, y: 0 })
    for (const node of net.nodes) expect(a[node.id]).toBeDefined()
    expect(layoutNetwork({ nodes: [], edges: [] })).toEqual({})
  })

  it('reads left to right: your side on the left, the people to reach on the right', () => {
    for (const net of [bigNetwork(), real]) {
      const pos = layoutNetwork(net)
      const targets = net.nodes.filter((node) => node.target)
      const mine = net.edges
        .filter((item) => item.source === 'me' || item.target === 'me')
        .map((item) => (item.source === 'me' ? item.target : item.source))
      for (const node of targets) expect(pos[node.id].x).toBeGreaterThan(pos.me.x)
      expect(mean(targets.map((node) => pos[node.id].x))).toBeGreaterThan(
        mean(mine.map((id) => pos[id].x)) + 300,
      )
    }
  })

  it('leaves no overlapping boxes', () => {
    for (const net of [bigNetwork(), real]) {
      expect(overlapping(net, layoutNetwork(net))).toEqual([])
    }
  })

  it('packs a real network into a compact, wide picture', () => {
    const { width, height } = bounds(real, layoutNetwork(real))
    expect(width / height).toBeGreaterThan(1)
    expect(width / height).toBeLessThan(2.6)
    expect((width * height) / real.nodes.length).toBeLessThan(70000)
  })

  it('keeps a growing network in place: previous positions are a warm start', () => {
    for (const net of [bigNetwork(), real]) {
      const before = layoutNetwork(net)
      const grown: Network = {
        nodes: [...net.nodes, person('p:new')],
        edges: [...net.edges, edge(9999, 'p:new', net.nodes[5].id)],
      }
      const after = layoutNetwork(grown, before)
      const moves = net.nodes.map((node) =>
        Math.hypot(after[node.id].x - before[node.id].x, after[node.id].y - before[node.id].y),
      )
      expect(mean(moves)).toBeLessThan(80)
      expect(moves.filter((move) => move >= 150).length).toBeLessThanOrEqual(
        Math.ceil(net.nodes.length * 0.15),
      )
      expect(overlapping(grown, after)).toEqual([])
    }
  })
})
