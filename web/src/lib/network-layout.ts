import type { XY } from './graph-layout'
import type { NetNode, Network } from './network'

const FOOTPRINT: Record<NetNode['kind'], { width: number; height: number }> = {
  me: { width: 190, height: 48 },
  person: { width: 130, height: 78 },
  org: { width: 220, height: 44 },
}
const GAP_X = 22
const GAP_Y = 14
const CELL_X = 250
const CELL_Y = 100
const CHARGE = -560
const CHARGE_REACH = 1000
const LINK_STRENGTH = 0.9
const PULL_X = 0.05
const PULL_Y = 0.035
const DECAY = 0.6

export function layoutPathVertical(network: Network, path: string[]): Record<string, XY> {
  const byId = new Map(network.nodes.map((node) => [node.id, node]))
  const positions: Record<string, XY> = {}
  path.forEach((id, index) => {
    const node = byId.get(id)
    if (node) positions[id] = {
      x: (FOOTPRINT.org.width - FOOTPRINT[node.kind].width) / 2,
      y: index * 120,
    }
  })
  return positions
}

function hash(text: string): number {
  let value = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i)
    value = Math.imul(value, 16777619)
  }
  return (value >>> 0) / 4294967296
}

function hops(adjacency: number[][], sources: number[]): number[] {
  const distance = new Array<number>(adjacency.length).fill(-1)
  const queue: number[] = []
  for (const source of sources) {
    if (distance[source] >= 0) continue
    distance[source] = 0
    queue.push(source)
  }
  for (let head = 0; head < queue.length; head += 1) {
    for (const next of adjacency[queue[head]]) {
      if (distance[next] >= 0) continue
      distance[next] = distance[queue[head]] + 1
      queue.push(next)
    }
  }
  return distance
}

// Force layout with a left-to-right prior: you on the left, the people you
// want to reach on the right, everything else placed by its links. `previous`
// is a warm start, so a growing network moves instead of reshuffling.
export function layoutNetwork(network: Network, previous: Record<string, XY> = {}): Record<string, XY> {
  const nodes = network.nodes
  const count = nodes.length
  if (!count) return {}
  const index = new Map(nodes.map((node, i) => [node.id, i]))
  const adjacency: number[][] = nodes.map(() => [])
  const links: [number, number][] = []
  const linked = new Set<number>()
  for (const edge of network.edges) {
    const a = index.get(edge.source)
    const b = index.get(edge.target)
    if (a === undefined || b === undefined || a === b) continue
    const key = a < b ? a * count + b : b * count + a
    if (linked.has(key)) continue
    linked.add(key)
    links.push([a, b])
    adjacency[a].push(b)
    adjacency[b].push(a)
  }
  const degree = adjacency.map((list) => Math.max(1, list.length))
  const me = index.get('me') ?? -1
  const fromMe = hops(adjacency, me >= 0 ? [me] : [])
  const fromTarget = hops(
    adjacency,
    nodes.flatMap((node, i) => (node.target ? [i] : [])),
  )
  const span = Math.max(900, 150 * Math.sqrt(count))
  const prior = nodes.map((_, i) => {
    const l = fromMe[i]
    const r = fromTarget[i]
    if (l >= 0 && r >= 0) return (l + r === 0 ? 0 : l / (l + r)) * span
    if (l >= 0) return Math.min(0.4, l * 0.12) * span
    if (r >= 0) return (1 - Math.min(0.4, r * 0.12)) * span
    return 0.5 * span
  })
  const size = nodes.map((node) => FOOTPRINT[node.kind])
  const shiftX = FOOTPRINT.me.width / 2
  const shiftY = FOOTPRINT.me.height / 2

  const x = new Array<number>(count).fill(0)
  const y = new Array<number>(count).fill(0)
  const placed = new Array<boolean>(count).fill(false)
  let kept = 0
  nodes.forEach((node, i) => {
    const before = previous[node.id]
    if (i === me) {
      placed[i] = true
    } else if (before) {
      x[i] = before.x + size[i].width / 2 - shiftX
      y[i] = before.y + size[i].height / 2 - shiftY
      placed[i] = true
      kept += 1
    }
  })
  const depth = (i: number) => (fromMe[i] < 0 ? 99 : fromMe[i])
  const order = nodes.map((_, i) => i).sort((a, b) => depth(a) - depth(b) || a - b)
  for (const i of order) {
    if (placed[i]) continue
    const near = adjacency[i].filter((j) => placed[j])
    const angle = hash(nodes[i].id) * Math.PI * 2
    const radius = 90 + hash(`${nodes[i].id}#r`) * 70
    if (near.length) {
      x[i] = near.reduce((sum, j) => sum + x[j], 0) / near.length + Math.cos(angle) * radius
      y[i] = near.reduce((sum, j) => sum + y[j], 0) / near.length + Math.sin(angle) * radius
    } else {
      x[i] = prior[i] + Math.cos(angle) * radius
      y[i] = Math.sin(angle) * (radius + 200 * hash(`${nodes[i].id}#y`))
    }
    placed[i] = true
  }

  const collide = (strength: number): boolean => {
    let moved = false
    const cells = new Map<string, number[]>()
    for (let i = 0; i < count; i += 1) {
      const key = `${Math.floor(x[i] / CELL_X)},${Math.floor(y[i] / CELL_Y)}`
      const cell = cells.get(key)
      if (cell) cell.push(i)
      else cells.set(key, [i])
    }
    for (let i = 0; i < count; i += 1) {
      const cellX = Math.floor(x[i] / CELL_X)
      const cellY = Math.floor(y[i] / CELL_Y)
      for (let gx = cellX - 1; gx <= cellX + 1; gx += 1) {
        for (let gy = cellY - 1; gy <= cellY + 1; gy += 1) {
          for (const j of cells.get(`${gx},${gy}`) ?? []) {
            if (j <= i) continue
            const dx = x[j] - x[i]
            const dy = y[j] - y[i]
            const overlapX = (size[i].width + size[j].width) / 2 + GAP_X - Math.abs(dx)
            if (overlapX <= 0) continue
            const overlapY = (size[i].height + size[j].height) / 2 + GAP_Y - Math.abs(dy)
            if (overlapY <= 0) continue
            moved = true
            const share = i === me ? 0 : j === me ? 1 : 0.5
            if (overlapX * 0.6 < overlapY) {
              const left = dx < 0 || (dx === 0 && hash(nodes[i].id + nodes[j].id) < 0.5)
              const push = overlapX * strength * (left ? -1 : 1)
              x[i] -= push * share
              x[j] += push * (1 - share)
            } else {
              const up = dy < 0 || (dy === 0 && hash(nodes[j].id + nodes[i].id) < 0.5)
              const push = overlapY * strength * (up ? -1 : 1)
              y[i] -= push * share
              y[j] += push * (1 - share)
            }
          }
        }
      }
    }
    return moved
  }

  const warm = kept >= count * 0.6
  const ticks = Math.max(
    count > 500 ? 30 : 50,
    Math.min(warm ? 120 : 300, Math.round((warm ? 3.2e6 : 8e6) / (count * count))),
  )
  let alpha = warm ? 0.22 : 1
  const cooling = 1 - Math.pow(0.003 / alpha, 1 / ticks)
  const vx = new Array<number>(count).fill(0)
  const vy = new Array<number>(count).fill(0)
  const reach = CHARGE_REACH * CHARGE_REACH
  const rest = (a: number, b: number) => {
    if (a === me || b === me) return 170
    const orgs = (nodes[a].kind === 'org' ? 1 : 0) + (nodes[b].kind === 'org' ? 1 : 0)
    return orgs === 2 ? 210 : orgs === 1 ? 135 : 160
  }
  for (let tick = 0; tick < ticks; tick += 1) {
    alpha -= alpha * cooling
    for (const [a, b] of links) {
      let dx = x[b] + vx[b] - x[a] - vx[a]
      let dy = y[b] + vy[b] - y[a] - vy[a]
      const distance = Math.sqrt(dx * dx + dy * dy) || 1
      const pull =
        ((distance - rest(a, b)) / distance) * alpha * (LINK_STRENGTH / Math.min(degree[a], degree[b]))
      dx *= pull
      dy *= pull
      const bias = degree[a] / (degree[a] + degree[b])
      vx[b] -= dx * bias
      vy[b] -= dy * bias
      vx[a] += dx * (1 - bias)
      vy[a] += dy * (1 - bias)
    }
    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        const dx = x[j] - x[i]
        const dy = y[j] - y[i]
        const d2 = dx * dx + dy * dy
        if (d2 > reach) continue
        const force = (CHARGE * alpha) / Math.max(d2, 900)
        vx[i] += dx * force
        vy[i] += dy * force
        vx[j] -= dx * force
        vy[j] -= dy * force
      }
    }
    for (let i = 0; i < count; i += 1) {
      if (i === me) continue
      vx[i] = (vx[i] + (prior[i] - x[i]) * PULL_X * alpha) * DECAY
      vy[i] = (vy[i] - y[i] * PULL_Y * alpha) * DECAY
      x[i] += vx[i]
      y[i] += vy[i]
    }
    if (alpha < 0.25) collide(0.5)
  }
  const passes = Math.max(60, Math.min(600, Math.round(240000 / count)))
  for (let pass = 0; pass < passes; pass += 1) {
    if (!collide(1)) break
  }
  // Whatever the relaxation left overlapping is moved straight down, so the
  // result never has two nodes on top of each other.
  const touches = (i: number, j: number) =>
    Math.abs(x[j] - x[i]) < (size[i].width + size[j].width) / 2 + 2 &&
    Math.abs(y[j] - y[i]) < (size[i].height + size[j].height) / 2 + 2
  for (let i = 0; i < count; i += 1) {
    if (i === me) continue
    for (let guard = 0; guard < count; guard += 1) {
      let lowest: number | null = null
      for (let j = 0; j < count; j += 1) {
        if (j !== i && touches(i, j)) lowest = Math.max(lowest ?? -Infinity, y[j] + size[j].height / 2)
      }
      if (lowest === null) break
      y[i] = lowest + GAP_Y + size[i].height / 2
    }
  }

  const positions: Record<string, XY> = {}
  nodes.forEach((node, i) => {
    positions[node.id] = {
      x: Math.round(x[i] - size[i].width / 2 + shiftX),
      y: Math.round(y[i] - size[i].height / 2 + shiftY),
    }
  })
  return positions
}
