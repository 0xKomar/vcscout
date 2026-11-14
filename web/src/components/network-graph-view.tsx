import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  Panel,
  useNodesInitialized,
  useReactFlow,
  useStore,
  useUpdateNodeInternals,
  type Edge,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Loader2, Maximize2, Search, Square } from 'lucide-react'
import { GraphMeNode } from '@/components/graph-me-node'
import { GraphNetPersonNode } from '@/components/graph-net-person-node'
import { GraphOrgNode } from '@/components/graph-org-node'
import type { NetNodeData } from '@/components/network-node-data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { linkedinKey, useLinkedinPhotos } from '@/hooks/use-linkedin'
import { useMediaQuery } from '@/hooks/use-media-query'
import { layoutNetwork, layoutPathVertical } from '@/lib/network-layout'
import { pathsOnly, type NetNode, type NetPath, type Network } from '@/lib/network'
import type { XY } from '@/lib/graph-layout'
import type { ExpandState } from '@/hooks/use-network'

const nodeTypes = {
  me: GraphMeNode,
  org: GraphOrgNode,
  person: GraphNetPersonNode,
}

const EMPTY_POSITIONS: Record<string, XY> = {}

const LABEL_STYLE = { fontSize: 10, fill: 'var(--muted-foreground)' } as const
const LABEL_BG = { fill: 'var(--card)', fillOpacity: 0.85, borderRadius: 3 } as const

interface NetworkGraphViewProps {
  network: Network
  paths: Map<string, NetPath>
  pathIds: { nodes: Set<string>; edges: Set<string> }
  selection: string | null
  focusKey?: string
  onSelect: (id: string | null) => void
  expandStates: Record<string, ExpandState>
  onExpand: (id: string) => void
  running: boolean
  inFlight: number
  canSearchDeeper: boolean
  maxDepth: number
  onSearchDeeper: () => void
  onStop: () => void
  researchEnabled: boolean
}

const SUGGESTION_TAG: Record<NetNode['kind'], string> = {
  me: 'you',
  person: 'person',
  org: 'organization',
}

function NetworkGraphFlow({
  network,
  paths,
  pathIds,
  selection,
  focusKey,
  onSelect,
  expandStates,
  onExpand,
  running,
  inFlight,
  canSearchDeeper,
  maxDepth,
  onSearchDeeper,
  onStop,
  researchEnabled,
}: NetworkGraphViewProps) {
  const flow = useReactFlow()
  const isMobile = useMediaQuery('(max-width: 639px)')
  const updateNodeInternals = useUpdateNodeInternals()
  const nodesInitialized = useNodesInitialized()
  const uninitialized = useStore((state) => {
    const ids: string[] = []
    for (const node of state.nodeLookup.values()) {
      if (!node.hidden && !node.internals.handleBounds) ids.push(node.id)
    }
    return ids.join('\n')
  })
  useEffect(() => {
    if (uninitialized) updateNodeInternals(uninitialized.split('\n'))
  }, [uninitialized, updateNodeInternals])
  const photos = useLinkedinPhotos()
  const [filter, setFilter] = useState<'all' | 'paths'>('all')
  const filterForFocus = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (filterForFocus.current === focusKey) return
    filterForFocus.current = focusKey
    setFilter(focusKey ? 'paths' : 'all')
  }, [focusKey])
  const [hover, setHover] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [legendOpen, setLegendOpen] = useState(false)
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({})
  const [layout, setLayout] = useState<{
    filtered: Network
    positions: Record<string, XY>
    cache: Partial<Record<'all' | 'paths', Record<string, XY>>>
  } | null>(null)
  const fittedIdsRef = useRef<string | null>(null)
  const userPannedRef = useRef(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(
    () => (filter === 'paths' ? pathsOnly(network, pathIds) : network),
    [filter, network, pathIds],
  )

  if (layout?.filtered !== filtered) {
    const positions = layoutNetwork(filtered, layout?.cache[filter] ?? {})
    setLayout({
      filtered,
      positions,
      cache: { ...layout?.cache, [filter]: positions },
    })
  }
  const mobilePath = isMobile && filter === 'paths' && focusKey ? paths.get(focusKey) : undefined
  const positions = useMemo(
    () => mobilePath
      ? layoutPathVertical(filtered, [
          ...mobilePath.nodes,
          ...filtered.nodes.filter((node) => !mobilePath.nodes.includes(node.id)).map((node) => node.id),
        ])
      : (layout?.positions ?? EMPTY_POSITIONS),
    [filtered, layout, mobilePath],
  )

  const bestEdgeIds = pathIds.edges

  const connected = useMemo(() => {
    const active = hover ?? selection
    if (!active) return null
    const nodes = new Set<string>([active])
    const edges = new Set<string>()
    for (const edge of filtered.edges) {
      if (edge.source === active || edge.target === active) {
        edges.add(edge.id)
        nodes.add(edge.source)
        nodes.add(edge.target)
      }
    }
    const path = paths.get(active)
    if (path) {
      for (const id of path.nodes) nodes.add(id)
      for (const edge of path.edges) edges.add(edge.id)
    }
    return { nodes, edges }
  }, [hover, selection, filtered.edges, paths])

  const rfNodes = useMemo<Node[]>(() => {
    const result: Node[] = []
    for (const node of filtered.nodes) {
      const position = positions[node.id]
      if (!position) continue
      const dimmed = !!connected && !connected.nodes.has(node.id)
      const expandable = researchEnabled && !node.manualNeedsName &&
        (node.kind === 'person' || node.kind === 'org')
      const expand = expandable
        ? {
            status: expandStates[node.id]?.status ?? ('idle' as const),
            onLoad: () => onExpand(node.id),
          }
        : undefined
      const data: NetNodeData = {
        node,
        dimmed,
        expand,
        photo:
          node.kind === 'person'
            ? photos[linkedinKey(node.label, node.fund ?? node.company ?? '')]
            : undefined,
      }
      result.push({
        id: node.id,
        type: node.kind === 'me' ? 'me' : node.kind === 'org' ? 'org' : 'person',
        position,
        selected: selection === node.id,
        measured: measured[node.id],
        data,
      })
    }
    return result
  }, [filtered, positions, connected, selection, measured, photos, expandStates, onExpand, researchEnabled])

  const rfEdges = useMemo<Edge[]>(
    () =>
      filtered.edges.map((edge) => {
        const highlighted = !!connected && connected.edges.has(edge.id)
        const best = bestEdgeIds.has(edge.id)
        const sourceX = positions[edge.source]?.x ?? 0
        const targetX = positions[edge.target]?.x ?? 0
        const sourceRight = sourceX <= targetX
        const sourceAbove = (positions[edge.source]?.y ?? 0) <= (positions[edge.target]?.y ?? 0)
        const inferred = edge.certainty === 'inferred'
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: mobilePath ? (sourceAbove ? 'b' : 't') : (sourceRight ? 'r' : 'l'),
          targetHandle: mobilePath ? (sourceAbove ? 't' : 'b') : (sourceRight ? 'l' : 'r'),
          label: highlighted ? edge.label : undefined,
          labelStyle: LABEL_STYLE,
          labelBgStyle: LABEL_BG,
          labelBgPadding: [4, 2] as [number, number],
          style: {
            stroke: inferred ? 'var(--warning)' : 'var(--brand)',
            strokeWidth: best ? 2.5 : 1,
            strokeDasharray: inferred ? '5 4' : undefined,
            strokeOpacity: connected
              ? highlighted
                ? best
                  ? 1
                  : 0.7
                : 0.12
              : best
                ? 0.9
                : 0.35,
          },
        }
      }),
    [filtered.edges, connected, bestEdgeIds, positions, mobilePath],
  )

  const idsKey = useMemo(
    () => `${mobilePath ? 'vertical' : 'horizontal'}:${filtered.nodes.map((node) => node.id).join('|')}`,
    [filtered, mobilePath],
  )

  useLayoutEffect(() => {
    if (!nodesInitialized || !rfNodes.length) return
    const first = fittedIdsRef.current === null
    const changed = fittedIdsRef.current !== idsKey
    fittedIdsRef.current = idsKey
    if (first || (changed && !userPannedRef.current)) {
      flow.fitView({ padding: 0.15, duration: first ? 0 : 250, maxZoom: 1.2 })
    }
  }, [nodesInitialized, rfNodes, idsKey, flow])

  useEffect(() => {
    userPannedRef.current = false
    fittedIdsRef.current = null
    flow.fitView({ padding: 0.15, duration: 250, maxZoom: 1.2 })
  }, [filter, flow])

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    let raf = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        flow.fitView({ padding: 0.15, duration: 200, maxZoom: 1.2 })
      })
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [flow])

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    return filtered.nodes
      .filter((node) => node.label.toLowerCase().includes(needle))
      .slice(0, 8)
  }, [query, filtered])

  const selectNode = useCallback(
    (id: string) => {
      setQuery('')
      onSelect(id)
    },
    [onSelect],
  )

  const people = filtered.nodes.filter((node) => node.kind !== 'org').length
  const orgs = filtered.nodes.filter((node) => node.kind === 'org').length

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2" data-testid="network-toolbar">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && suggestions.length) selectNode(suggestions[0].id)
            }}
            placeholder="Search the network…"
            aria-label="Search the network"
            className="h-8 w-56 bg-card pl-8 text-xs"
          />
          {suggestions.length > 0 && (
            <ul className="absolute left-0 top-full z-10 mt-1 w-full min-w-56 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-md">
              {suggestions.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted"
                    onClick={() => selectNode(node.id)}
                  >
                    <span className="truncate font-medium">{node.label}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {SUGGESTION_TAG[node.kind]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            userPannedRef.current = false
            flow.fitView({ padding: 0.15, duration: 250, maxZoom: 1.2 })
          }}
        >
          <Maximize2 className="size-3.5" aria-hidden />
          Fit graph
        </Button>
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(value) => value && setFilter(value as 'all' | 'paths')}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="all">Whole network</ToggleGroupItem>
          <ToggleGroupItem value="paths">Paths only</ToggleGroupItem>
        </ToggleGroup>
        {running ? (
          <Button variant="outline" size="sm" onClick={onStop}>
            <Square className="size-3" aria-hidden />
            Stop
          </Button>
        ) : (
          canSearchDeeper && (
            <Button variant="outline" size="sm" onClick={onSearchDeeper}>
              Search deeper (allow depth {maxDepth + 1})
            </Button>
          )
        )}
      </div>
      <div
        ref={wrapperRef}
        className="network-flow relative h-[70vh] min-h-[460px] overflow-hidden rounded-2xl border border-border bg-[#f8fbfd] lg:h-[82vh] lg:min-h-[640px]"
      >
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={(changes: NodeChange[]) => {
            for (const change of changes) {
              if (
                change.type === 'dimensions' &&
                change.dimensions?.width !== undefined &&
                change.dimensions?.height !== undefined
              ) {
                const { width, height } = change.dimensions
                setMeasured((current) => ({ ...current, [change.id]: { width, height } }))
              }
            }
          }}
          onNodeMouseEnter={(_, node) => setHover(node.id)}
          onNodeMouseLeave={() => setHover(null)}
          onMoveStart={(event) => {
            if (event) userPannedRef.current = true
          }}
          connectionMode={ConnectionMode.Loose}
          nodesConnectable={false}
          nodesDraggable={false}
          onlyRenderVisibleElements={filtered.nodes.length > 150}
          onNodeClick={(_, node) => onSelect(node.id)}
          onPaneClick={() => onSelect(null)}
          minZoom={0.1}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
          <Controls showInteractive={false} />
          <Panel
            position="bottom-left"
            className="flex flex-col items-start gap-1.5"
            style={{ left: 52 }}
          >
            {legendOpen && (
              <div className="max-w-64 rounded-lg border border-border bg-card/95 p-2.5 text-xs shadow-xs">
                <ul className="flex flex-col gap-1">
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-2.5 shrink-0 rounded-sm border-2 border-brand bg-brand-soft" aria-hidden />
                    You
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-2.5 shrink-0 rounded-full border-2 border-brand bg-secondary" aria-hidden />
                    Person you want to reach (founder or partner)
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-2.5 shrink-0 rounded-full border-2 border-foreground bg-secondary" aria-hidden />
                    Person you know
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-2.5 shrink-0 rounded-full border border-border bg-secondary" aria-hidden />
                    Other person
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-2.5 shrink-0 rounded-sm border border-brand/50 bg-card" aria-hidden />
                    Organization, school or event
                  </li>
                  <li className="mt-1 flex items-center gap-2 text-muted-foreground">
                    <span className="h-1 w-4 shrink-0 rounded-full bg-brand" aria-hidden />
                    On your warmest path
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-0.5 w-4 shrink-0 bg-brand" aria-hidden />
                    Documented public link (with a source)
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <span className="w-4 shrink-0 border-t border-dashed border-warning" aria-hidden />
                    Inferred or matched by name — verify it
                  </li>
                </ul>
                <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                  Links are documented public facts, your own entries or inferences. They
                  are not confirmed relationships or introductions.
                </p>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              aria-expanded={legendOpen}
              onClick={() => setLegendOpen((open) => !open)}
            >
              Legend
            </Button>
          </Panel>
          {running && (
            <Panel position="top-center">
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-1 text-xs text-muted-foreground shadow-xs">
                <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />
                Searching {inFlight} · {people} people · {orgs} organizations
              </span>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  )
}

export function NetworkGraphView(props: NetworkGraphViewProps) {
  return (
    <ReactFlowProvider>
      <NetworkGraphFlow {...props} />
    </ReactFlowProvider>
  )
}
