import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowRight, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { GraphFundNode } from '@/components/graph-fund-node'
import { GraphIdeaNode } from '@/components/graph-idea-node'
import { GraphPersonNode } from '@/components/graph-person-node'
import { GraphStageLabel } from '@/components/graph-stage-label'
import { GraphStartupNode } from '@/components/graph-startup-node'
import type { GraphNodeData } from '@/components/graph-node-data'
import { linkedinKey, prefetchLinkedin, useLinkedinPhotos } from '@/hooks/use-linkedin'
import { personAffiliation, type ExplorerGraph, type GraphNode } from '@/lib/graph'
import { familyColor, graphFamilies } from '@/lib/graph-colors'
import { fundStageLevels, graphColumns, stageLabel, type XY } from '@/lib/graph-layout'

const nodeTypes = {
  idea: GraphIdeaNode,
  startup: GraphStartupNode,
  fund: GraphFundNode,
  person: GraphPersonNode,
  stageLabel: GraphStageLabel,
}

const LEGEND_NODES: { swatch: string; label: string }[] = [
  { swatch: 'rounded-full border-2 border-brand bg-brand-soft', label: 'Your startup' },
  { swatch: 'rounded-full border border-dashed border-border bg-card', label: 'Explored startup' },
  { swatch: 'rounded-full border border-border bg-card', label: 'Fund' },
  { swatch: 'rounded-full bg-brand', label: 'Fund on path (1 – your stage, 2 – next round)' },
  { swatch: 'rounded-full border border-border bg-secondary', label: 'Person' },
]

const SAME_COLUMN = 60

export interface GraphExplore {
  status: 'idle' | 'loading' | 'done' | 'error'
  onLoad: () => void
}

interface ExplorerGraphProps {
  model: ExplorerGraph
  positions: Record<string, XY>
  selection: string | null
  onSelect: (id: string | null) => void
  onNodeMove: (id: string, position: XY) => void
  onNodeDragEnd: (id: string) => void
  exploreFor: (node: GraphNode) => GraphExplore | undefined
  status?: string
}

export function ExplorerGraphView(props: ExplorerGraphProps) {
  return (
    <ReactFlowProvider>
      <ExplorerGraphInner {...props} />
    </ReactFlowProvider>
  )
}

function ExplorerGraphInner({
  model,
  positions,
  selection,
  onSelect,
  onNodeMove,
  onNodeDragEnd,
  exploreFor,
  status,
}: ExplorerGraphProps) {
  const flow = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const [filter, setFilter] = useState<'all' | 'route'>('all')
  const [search, setSearch] = useState('')
  const [legendOpen, setLegendOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({})
  const wrapperRef = useRef<HTMLDivElement>(null)
  const pendingFitRef = useRef<{ ids?: string[] } | null>({})

  const routeNodeIds = useMemo(() => {
    const ids = new Set<string>(['idea'])
    for (const node of model.nodes) if (node.route) ids.add(node.id)
    for (const edge of model.edges) {
      if (edge.route) {
        ids.add(edge.source)
        ids.add(edge.target)
      }
    }
    return ids
  }, [model])

  const visibleNodes = useMemo(
    () => (filter === 'route' ? model.nodes.filter((n) => routeNodeIds.has(n.id)) : model.nodes),
    [filter, model, routeNodeIds],
  )
  const visibleEdges = useMemo(
    () => (filter === 'route' ? model.edges.filter((e) => e.route) : model.edges),
    [filter, model],
  )
  const families = useMemo(() => graphFamilies(model), [model])
  const photos = useLinkedinPhotos()

  const active = hovered && visibleNodes.some((node) => node.id === hovered) ? hovered : selection

  const connected = useMemo(() => {
    if (!active) return null
    const set = new Set<string>([active])
    for (const edge of visibleEdges) {
      if (edge.source === active) set.add(edge.target)
      if (edge.target === active) set.add(edge.source)
    }
    return set
  }, [active, visibleEdges])

  const expandOriginRef = useRef<string | null>(null)
  const stagesByFund = useMemo(() => fundStageLevels(model.edges), [model.edges])

  // Look up the LinkedIn profile of every person as soon as they are on the map.
  useEffect(() => {
    for (const node of visibleNodes) {
      const affiliation = node.kind === 'person' ? personAffiliation(node) : null
      if (affiliation) prefetchLinkedin(node.label, affiliation.organization, affiliation.kind)
    }
  }, [visibleNodes])

  const rfNodes: Node[] = visibleNodes.map((node) => {
    const explore = exploreFor(node)
    const affiliation = node.kind === 'person' ? personAffiliation(node) : null
    return {
      id: node.id,
      type: node.kind,
      position: positions[node.id] ?? { x: 0, y: 0 },
      data: {
        node,
        dimmed: !!connected && !connected.has(node.id),
        stages: node.kind === 'fund' ? stagesByFund[node.id] ?? [] : undefined,
        families: families.byNode[node.id],
        photo: affiliation ? photos[linkedinKey(node.label, affiliation.organization)] : undefined,
        explore: explore && {
          ...explore,
          onLoad: () => {
            expandOriginRef.current = node.id
            explore.onLoad()
          },
        },
      } satisfies GraphNodeData,
      measured: measured[node.id],
      selected: selection === node.id,
    }
  })

  const columns = graphColumns(model.nodes, model.edges)
  const headings = new Map<number, string>()
  for (const node of visibleNodes) {
    const x = columns[node.id]
    if (x === undefined) continue
    if (node.kind === 'idea') headings.set(x, 'Your idea')
    if (node.kind === 'startup' && node.similar) headings.set(x, 'Similar startups')
    if (node.kind === 'fund') {
      const level = stagesByFund[node.id]?.[0]
      headings.set(x, level === undefined ? 'Stage unknown' : level >= 5 ? 'Series E+' : stageLabel(level))
    }
  }
  const headingY = Math.min(0, ...visibleNodes.map((node) => positions[node.id]?.y ?? 0)) - 70
  for (const [x, label] of headings) {
    const id = `heading:${x}`
    rfNodes.push({
      id,
      type: 'stageLabel',
      position: { x, y: headingY },
      data: { label },
      measured: measured[id],
      draggable: false,
      selectable: false,
      focusable: false,
      connectable: false,
      deletable: false,
    })
  }

  const centerX = (id: string) => (positions[id]?.x ?? 0) + (measured[id]?.width ?? 0) / 2

  // Person-to-startup links repeat the person → fund → startup path, so they
  // only show for the node being inspected.
  const rfEdges: Edge[] = visibleEdges
    .filter(
      (edge) => edge.kind !== 'person-startup' || edge.source === active || edge.target === active,
    )
    .map((edge) => {
      const touches = active === edge.source || active === edge.target
      const faded = !!connected && !touches
      const family = families.byEdge[edge.id]
      const person = edge.kind.startsWith('person')
      const founder = edge.kind === 'founder'
      const dx = centerX(edge.target) - centerX(edge.source)
      const sameColumn = Math.abs(dx) < SAME_COLUMN
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: founder ? 'l' : sameColumn || dx > 0 ? 'r' : 'l',
        targetHandle: founder ? 'l' : sameColumn || dx < 0 ? 'r' : 'l',
        label: touches ? edge.label : undefined,
        labelShowBg: true,
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        labelBgStyle: { fill: 'var(--card)' },
        labelStyle: { fontSize: 10, fill: 'var(--foreground)' },
        style: {
          stroke: family === undefined ? 'var(--muted-foreground)' : familyColor(family),
          strokeWidth: edge.route || touches ? 2.25 : 1.25,
          strokeOpacity: faded ? 0.1 : touches || edge.route ? 1 : family === undefined ? 0.4 : 0.6,
          strokeDasharray: person ? '4 4' : undefined,
        },
      }
    })

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return model.nodes.filter((node) => node.label.toLowerCase().includes(q)).slice(0, 8)
  }, [search, model])

  const applyFit = (request: { ids?: string[] }) => {
    if (request.ids?.length) {
      flow.fitView({
        nodes: request.ids.map((id) => ({ id })),
        padding: 0.3,
        duration: 400,
        maxZoom: 1.1,
      })
    } else {
      flow.fitView({ padding: 0.15, duration: 250, maxZoom: 1.2 })
    }
  }

  // Refit when the container resizes.
  useEffect(() => {
    const element = wrapperRef.current
    if (!element) return
    let raf = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => applyFit({}))
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refit after switching between the full graph and the route.
  const firstFilterRef = useRef(true)
  useEffect(() => {
    if (firstFilterRef.current) {
      firstFilterRef.current = false
      return
    }
    pendingFitRef.current = {}
  }, [filter])

  // Focus the expanded node and its new neighbors after an expansion.
  const prevIdsRef = useRef<Set<string> | null>(null)
  useEffect(() => {
    const ids = new Set(model.nodes.map((node) => node.id))
    const prev = prevIdsRef.current
    prevIdsRef.current = ids
    if (!prev) return
    const added = [...ids].filter((id) => !prev.has(id))
    if (!added.length) return
    const origin = expandOriginRef.current
    expandOriginRef.current = null
    pendingFitRef.current =
      origin && ids.has(origin) && !added.includes(origin)
        ? { ids: [origin, ...added] }
        : origin && ids.has(origin)
          ? { ids: added }
          : {}
  }, [model.nodes, selection])

  // Apply pending fits once the involved nodes are measured.
  useEffect(() => {
    if (!nodesInitialized) return
    const request = pendingFitRef.current
    if (!request) return
    pendingFitRef.current = null
    applyFit(request)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesInitialized, model.nodes, filter])

  // Center on the selected node (click, search, panel-driven selection).
  const prevSelectionRef = useRef(selection)
  useEffect(() => {
    const prev = prevSelectionRef.current
    prevSelectionRef.current = selection
    if (!selection || selection === prev || !nodesInitialized) return
    const pos = positions[selection]
    if (!pos) return
    const size = measured[selection]
    flow.setCenter(pos.x + (size?.width ?? 120) / 2, pos.y + (size?.height ?? 40) / 2, {
      zoom: Math.min(Math.max(flow.getZoom(), 0.9), 1.2),
      duration: 300,
    })
  }, [selection, nodesInitialized, positions, measured, flow])

  const centerOn = (id: string) => {
    onSelect(id)
    setSearch('')
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2" data-testid="graph-toolbar">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && suggestions[0]) centerOn(suggestions[0].id)
            }}
            placeholder="Search the graph…"
            aria-label="Search the graph"
            className="w-44 bg-card pl-8 text-xs sm:w-56"
          />
          {suggestions.length > 0 && (
            <ul className="absolute left-0 top-full z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card py-1 shadow-md">
              {suggestions.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted"
                    onClick={() => centerOn(node.id)}
                  >
                    <span className="truncate font-medium">{node.label}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {node.kind === 'fund'
                        ? 'fund'
                        : node.kind === 'person'
                          ? 'person'
                          : node.kind === 'idea'
                            ? 'idea'
                            : 'startup'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => applyFit({})}>
          Fit graph
        </Button>
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(value) => value && setFilter(value as 'all' | 'route')}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="all">Full graph</ToggleGroupItem>
          <ToggleGroupItem value="route">Path only</ToggleGroupItem>
        </ToggleGroup>
        {families.startups.length > 0 && (
          <ul aria-label="Similar startups by color" className="flex flex-wrap items-center gap-1">
            {families.startups.map((startup) => (
              <li key={startup.id}>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={selection === startup.id}
                  onClick={() => onSelect(selection === startup.id ? null : startup.id)}
                  onMouseEnter={() => setHovered(startup.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: familyColor(startup.family) }}
                    aria-hidden
                  />
                  {startup.label}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Earlier funding stages</span>
        <ArrowRight className="size-3" aria-hidden />
        <span className="font-medium text-foreground">Later stages</span>
        <span className="hidden sm:inline" aria-hidden>·</span>
        <span>Funds in multiple stages appear at their earliest known stage.</span>
      </p>
      <div
        ref={wrapperRef}
        className="relative h-[70vh] min-h-[520px] overflow-hidden rounded-xl border border-border bg-card"
      >
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={(changes: NodeChange[]) => {
            for (const change of changes) {
              if (change.type === 'position' && change.position) {
                onNodeMove(change.id, change.position)
              }
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
          onNodeDragStop={(_, node) => onNodeDragEnd(node.id)}
          onNodeMouseEnter={(_, node) => {
            if (node.type !== 'stageLabel') setHovered(node.id)
          }}
          onNodeMouseLeave={() => setHovered(null)}
          connectionMode={ConnectionMode.Loose}
          nodesConnectable={false}
          onNodeClick={(_, node) => {
            if (node.type !== 'stageLabel') onSelect(node.id)
          }}
          onPaneClick={() => onSelect(null)}
          minZoom={0.2}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            className="hidden lg:block"
            style={{ width: 160, height: 110 }}
          />
          {status && (
            <Panel position="top-center">
              <p
                role="status"
                className="flex items-center gap-2 rounded-full border border-border bg-card/95 px-3.5 py-2 text-xs font-medium shadow-xs"
              >
                <Loader2
                  className="size-3.5 animate-spin text-brand motion-reduce:animate-none"
                  aria-hidden
                />
                {status}
              </p>
            </Panel>
          )}
          <Panel
            position="bottom-left"
            className="flex flex-col items-start gap-1.5"
            style={{ left: 52 }}
          >
            {legendOpen && (
              <div className="max-w-64 rounded-lg border border-border bg-card/95 p-2.5 text-xs shadow-xs">
                <ul className="flex flex-col gap-1">
                  {LEGEND_NODES.map((item) => (
                    <li key={item.label} className="flex items-center gap-2 text-muted-foreground">
                      <span className={`inline-block size-2.5 shrink-0 ${item.swatch}`} aria-hidden />
                      {item.label}
                    </li>
                  ))}
                  <li className="mt-1 flex items-center gap-2 text-muted-foreground">
                    <span className="h-0.5 w-4 shrink-0 rounded bg-foreground" aria-hidden />
                    Thick line: path for your idea
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <span className="w-4 shrink-0 border-t border-dashed border-foreground" aria-hidden />
                    Person at a fund
                  </li>
                  <li className="text-muted-foreground">
                    Each similar startup has a color. Its rounds, funds, and people share it.
                  </li>
                  <li className="text-muted-foreground">Founders sit under their startup.</li>
                  <li className="text-muted-foreground">
                    Hover or select a node to see its links and the deals a person is tied to.
                  </li>
                </ul>
                <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                  Connections show publicly documented rounds and links, not confirmed personal
                  relationships or introductions.
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
        </ReactFlow>
      </div>
    </div>
  )
}
