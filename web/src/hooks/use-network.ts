import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchNetwork, fetchRank, type NetworkRequest } from '@/lib/api'
import {
  bridgeFocus,
  bridgeFrontier,
  buildNetwork,
  describeCandidates,
  expansionIdentity,
  expansionRequest,
  identityOrganizations,
  mergeOrder,
  pathsFromMe,
  personKey,
  rankTargets,
  reviewedBridge,
  type MapSeed,
  type NetNode,
  type NetPath,
  type Network,
} from '@/lib/network'
import { introKey, introTargets, sameOrg } from '@/lib/intro'
import { rankLinkedinCandidates, type LinkedinCandidate } from '@/lib/linkedin-candidates'
import { sameFund } from '@/lib/paths'
import { useDossiers, type DossierState } from '@/hooks/use-dossiers'
import { useLinkedinConnections, type LinkedinConnections } from '@/hooks/use-linkedin-connections'
import { useMe, type MeStatus } from '@/hooks/use-me'
import type { ResolvedPartners } from '@/hooks/use-partners'
import type { Dossier, MeProfile, NetworkExpansion } from '@/lib/types'

export const AUTO_BUDGET = 12
export const INITIAL_DEPTH = 3
const MAX_CONCURRENT = 2
const LINKEDIN_BATCH = 3

export interface NetworkProgress {
  status: 'pending' | 'loading' | 'done' | 'stopped'
  detail: string
  agents: { label: string; status: 'loading' | 'done' | 'error' }[]
  stop: () => void
}

export interface LinkedinReview {
  total: number
  pending: number
  researchable: number
  promising: number
  selected: number
  researched: number
  searching: number
  failed: number
  ready: boolean
  candidates: LinkedinCandidate[]
}

export type ExpandState =
  | { status: 'loading' }
  | { status: 'done'; found: number }
  | { status: 'error'; message: string }

interface CrawlRun {
  expansions: { id: string; identity?: string; expansion: NetworkExpansion }[]
  states: Record<string, ExpandState>
  order: string[]
  started: number
  budget: number
  maxDepth: number
  exploreMore: boolean
  stopped: boolean
  linkedinCandidates: string[]
  linkedinScreened: string
}

const emptyRun: CrawlRun = {
  expansions: [],
  states: {},
  order: [],
  started: 0,
  budget: AUTO_BUDGET,
  maxDepth: INITIAL_DEPTH,
  exploreMore: false,
  stopped: false,
  linkedinCandidates: [],
  linkedinScreened: '',
}

const requestCache = new Map<string, Promise<NetworkExpansion>>()

function networkRequest(input: NetworkRequest): Promise<NetworkExpansion> {
  const key = JSON.stringify({
    ...input,
    known: [...input.known].sort(),
    focus: [...(input.focus ?? [])].sort(),
    focus_people: [...(input.focus_people ?? [])].sort(),
    identity_orgs: [...(input.identity_orgs ?? [])].sort(),
  }).toLowerCase()
  let promise = requestCache.get(key)
  if (!promise) {
    promise = fetchNetwork(input)
    requestCache.set(key, promise)
    promise.catch(() => {
      if (requestCache.get(key) === promise) requestCache.delete(key)
    })
  }
  return promise
}

const emptyNetwork: Network = { nodes: [], edges: [], skipped: [] }

export function useNetwork(
  map: MapSeed,
  resolved: ResolvedPartners[],
  focusTarget: { name: string; org: string; id?: string } | null = null,
): {
  me: { profile: MeProfile | null; status: MeStatus }
  linkedin: LinkedinConnections
  network: Network
  paths: Map<string, NetPath>
  ranked: { node: NetNode; path: NetPath | null }[]
  expandStates: Record<string, ExpandState>
  dossiers: Record<string, DossierState>
  running: boolean
  canSearchDeeper: boolean
  maxDepth: number
  linkedinReview: LinkedinReview
  progress: NetworkProgress
  expand: (id: string) => void
  deepExpand: (id: string) => void
  invalidateExpansion: (id: string) => void
  searchDeeper: () => void
  reviewMoreLinkedin: () => void
  reviewLinkedin: (key: string) => void
  stop: () => void
  loadDossier: (key: string) => void
} {
  const me = useMe()
  const linkedin = useLinkedinConnections()
  const profile = me.profile
  const signature = profile ? JSON.stringify({
    name: profile.name.trim().toLowerCase(),
    profile: profile.linkedin_url,
    employers: profile.employers,
    schools: profile.schools,
    target: focusTarget,
    linkedin: [linkedin.fileName, linkedin.importedAt, linkedin.connections.length],
  }) : ''

  const allTargets = useMemo(() => introTargets(resolved), [resolved])
  const targets = useMemo(
    () =>
      focusTarget
        ? allTargets.filter(
            (t) =>
              t.partner.name.trim().toLowerCase() === focusTarget.name.trim().toLowerCase() &&
              sameFund(t.fund, focusTarget.org),
          )
        : [],
    [allTargets, focusTarget],
  )
  const dossierTargets = useMemo(
    () => targets.map((target) => ({ name: target.partner.name, fund: target.fund })),
    [targets],
  )
  const dossierResults = useDossiers(dossierTargets, !!profile)
  const doneDossiers = useMemo(
    () =>
      Object.values(dossierResults.states)
        .filter((state): state is { status: 'done'; dossier: Dossier } => state.status === 'done')
        .map((state) => state.dossier),
    [dossierResults.states],
  )

  const [runs, setRuns] = useState<Record<string, CrawlRun>>({})
  const runsRef = useRef<Record<string, CrawlRun>>({})
  const mountedRef = useRef(true)
  const inFlightRef = useRef(0)
  const inFlightIdsRef = useRef(new Set<string>())
  const revisionsRef = useRef(new Map<string, number>())
  const networkRef = useRef<Network>(emptyNetwork)
  const rankInFlightRef = useRef<string | null>(null)
  const [rankOrder, setRankOrder] = useState<{ signature: string; fingerprint: string; ids: string[]; order: string[] }>({
    signature: '',
    fingerprint: '',
    ids: [],
    order: [],
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const applyRun = useCallback((sig: string, mutate: (run: CrawlRun) => CrawlRun) => {
    const next = {
      ...runsRef.current,
      [sig]: mutate(runsRef.current[sig] ?? emptyRun),
    }
    runsRef.current = next
    setRuns(next)
  }, [])

  const run = signature ? (runs[signature] ?? emptyRun) : emptyRun

  const network = useMemo(
    () =>
      profile
        ? buildNetwork({
            profile,
            linkedin: linkedin.connections,
            linkedinCandidates: new Set(run.linkedinCandidates),
            map,
            dossiers: doneDossiers,
            expansions: run.expansions,
          })
        : emptyNetwork,
    [profile, linkedin.connections, map, doneDossiers, run.expansions, run.linkedinCandidates],
  )
  const targetId = useMemo(() => {
    if (!focusTarget) return null
    const candidates = network.nodes.filter(
      (node) => node.target && personKey(node.label) === personKey(focusTarget.name),
    )
    const matchesOrg = (node: NetNode) =>
      sameOrg(node.fund ?? node.company ?? '', focusTarget.org) === 'exact'
    const byId = candidates.find((node) => node.id === focusTarget.id &&
      (node.target === 'person' && !focusTarget.org ? true : matchesOrg(node)))
    if (byId) return byId.id
    const byOrg = candidates.filter(matchesOrg)
    return byOrg.length === 1 ? byOrg[0].id : null
  }, [focusTarget, network])

  useEffect(() => {
    networkRef.current = network
  }, [network])

  const startExpansion = useCallback(
    (id: string, manual: boolean, deep = false) => {
      if (!signature || !targetId) return
      const net = networkRef.current
      const node = net.nodes.find((item) => item.id === id)
      if (node?.manualNeedsName) {
        applyRun(signature, (current) => ({
          ...current,
          states: { ...current.states, [id]: { status: 'error', message: 'Add their name before researching this profile.' } },
        }))
        return
      }
      const request = expansionRequest(net, id)
      if (!request) {
        applyRun(signature, (current) => ({
          ...current,
          states: { ...current.states, [id]: { status: 'done', found: 0 } },
        }))
        return
      }
      const subjectIdentity = node ? expansionIdentity(node) : undefined
      const revision = revisionsRef.current.get(id) ?? 0
      const selectedContact = !!node?.linkedinKey &&
        (runsRef.current[signature]?.linkedinCandidates.includes(node.linkedinKey) ?? false)
      const bridge = bridgeFocus(net, id, targetId)
      const identity = identityOrganizations(net, id)
      if (deep || id === 'me' || id === targetId) request.background = true
      inFlightRef.current += 1
      inFlightIdsRef.current.add(id)
      applyRun(signature, (current) => ({
        ...current,
        started: manual ? current.started : current.started + 1,
        order: current.order.includes(id) ? current.order : [...current.order, id],
        states: { ...current.states, [id]: { status: 'loading' } },
      }))
      networkRequest({
        ...request,
        ...bridge,
        deep,
        enhance: id === 'me' || id === targetId || node?.known === 'linkedin' || selectedContact,
        include_adjacent: selectedContact || (!!node?.manual && deep),
        identity_orgs: identity,
        profile_url: node?.profileUrl ?? '',
        known: [...new Set([...identity, ...bridge.focus])],
      }).then(
        (expansion) => {
          if (!mountedRef.current || (revisionsRef.current.get(id) ?? 0) !== revision) return
          const found =
            expansion.kind === 'person'
              ? expansion.connections.length + expansion.facts.length
              : expansion.people.length
          applyRun(signature, (current) => ({
            ...current,
            expansions: [
              ...current.expansions.filter((entry) => entry.id !== id),
              { id, identity: subjectIdentity, expansion },
            ],
            states: {
              ...current.states,
              [id]: expansion.failed.includes('identity')
                ? { status: 'error', message: 'Add a confirmed employer, school, or LinkedIn profile to identify this person.' }
                : { status: 'done', found },
            },
          }))
        },
        (error: unknown) => {
          if (!mountedRef.current || (revisionsRef.current.get(id) ?? 0) !== revision) return
          applyRun(signature, (current) => ({
            ...current,
            states: {
              ...current.states,
              [id]: {
                status: 'error',
                message: error instanceof Error ? error.message : 'Could not retrieve data.',
              },
            },
          }))
        },
      ).finally(() => {
        inFlightRef.current -= 1
        inFlightIdsRef.current.delete(id)
        if (mountedRef.current && (revisionsRef.current.get(id) ?? 0) !== revision) {
          const next = Object.fromEntries(Object.entries(runsRef.current).map(([key, value]) => [key, { ...value }]))
          runsRef.current = next
          setRuns(next)
        }
      })
    },
    [applyRun, signature, targetId],
  )

  const paths = useMemo(() => pathsFromMe(network), [network])
  const ranked = useMemo(() => rankTargets(network, paths), [network, paths])
  const rootsFinished = !!targetId && ['me', targetId].every(
    (id) => run.states[id] && run.states[id].status !== 'loading',
  )
  const completed = new Set(Object.entries(run.states)
    .filter(([, state]) => state.status === 'done' || state.status === 'error')
    .map(([id]) => id))
  const bridgeFound = !!targetId && reviewedBridge(
    network, paths.get(targetId), new Set(run.linkedinCandidates), completed,
  )
  const linkedinFingerprint = `${linkedin.fileName}|${linkedin.importedAt}|${linkedin.connections.length}`
  const targetDescription = useMemo(() => {
    const target = network.nodes.find((node) => node.id === targetId)
    if (!target) return ''
    const companies = [
      target.company ?? '',
      ...map.investments.filter((entry) => target.fund && sameFund(entry.fund, target.fund))
        .map((entry) => entry.company),
    ].filter(Boolean)
    return (map.contexts ?? []).filter((entry) =>
      companies.some((company) => sameOrg(company, entry.company) === 'exact'),
    ).map((entry) => entry.description).join(' ')
  }, [map, network, targetId])
  const linkedinCandidates = useMemo(
    () => targetId ? rankLinkedinCandidates(linkedin.connections, network, targetId, targetDescription) : [],
    [linkedin.connections, network, targetId, targetDescription],
  )

  useEffect(() => {
    if (!signature || !rootsFinished || run.stopped || bridgeFound ||
      run.linkedinScreened === linkedinFingerprint) return
    const selected = linkedinCandidates.filter((candidate) => candidate.researchable && candidate.score >= 10)
      .slice(0, LINKEDIN_BATCH).map((candidate) => candidate.key)
    applyRun(signature, (current) => ({
      ...current,
      linkedinScreened: linkedinFingerprint,
      linkedinCandidates: [...new Set([...current.linkedinCandidates, ...selected])],
    }))
  }, [signature, rootsFinished, run.stopped, run.linkedinScreened, bridgeFound,
    linkedinFingerprint, linkedinCandidates, applyRun])

  // Rank only candidates within the user-approved depth, after researching both endpoints.
  useEffect(() => {
    if (!profile || !signature || run.stopped || !focusTarget || !targetId || !rootsFinished) return
    if (bridgeFound && !run.exploreMore) return
    const taken = new Set([...Object.keys(run.states), ...inFlightIdsRef.current])
    const frontierIds = bridgeFrontier(network, targetId, taken, run.maxDepth).map((item) => item.id)
    if (frontierIds.some((id) => {
      const key = network.nodes.find((node) => node.id === id)?.linkedinKey
      return key && run.linkedinCandidates.includes(key)
    })) return
    const frontier = frontierIds.slice(0, 20)
    if (frontier.length < 3) return
    const fingerprint = `${signature}::${frontier.join('|')}`
    if (rankInFlightRef.current === fingerprint || rankOrder.fingerprint === fingerprint) return
    if (rankOrder.signature === signature) {
      const previous = new Set(rankOrder.ids)
      if (frontier.filter((id) => !previous.has(id)).length < 3) return
    }
    rankInFlightRef.current = fingerprint
    const meContext = [
      profile.employers.length ? `worked at ${profile.employers.map((e) => e.organization).join(', ')}` : '',
      profile.schools.length ? `studied at ${profile.schools.join(', ')}` : '',
    ].filter(Boolean).join('; ')
    fetchRank({
      me: { name: profile.name, context: meContext },
      targets: [{ name: focusTarget.name, org: focusTarget.org }],
      candidates: describeCandidates(network, frontier),
    })
      .then((data) => {
        if (mountedRef.current) setRankOrder({ signature, fingerprint, ids: frontier, order: data.order })
      })
      .catch(() => {
        if (mountedRef.current) setRankOrder({ signature, fingerprint, ids: frontier, order: [] })
      })
      .finally(() => {
        if (rankInFlightRef.current === fingerprint) rankInFlightRef.current = null
      })
  }, [profile, signature, network, run, rankOrder, focusTarget, targetId, rootsFinished, bridgeFound])

  // Research A and B first; stop as soon as an actionable route is found.
  useEffect(() => {
    if (!profile || !signature || run.stopped || !focusTarget || !targetId) return
    const taken = new Set<string>([
      ...Object.keys(run.states),
      ...inFlightIdsRef.current,
    ])
    const budget = run.budget - run.started
    const room = MAX_CONCURRENT - inFlightRef.current
    if (budget <= 0 || room <= 0) return
    let capacity = Math.min(budget, room)
    const roots = ['me', targetId].filter((id) => !taken.has(id))
    if (!rootsFinished) {
      for (const id of roots.slice(0, capacity)) startExpansion(id, false)
      return
    }
    if (bridgeFound && !run.exploreMore) return
    const candidates = bridgeFrontier(network, targetId, taken, run.maxDepth)
    const ids = candidates.map((candidate) => candidate.id)
    const priority = ids.filter((id) => {
      const key = network.nodes.find((node) => node.id === id)?.linkedinKey
      return key && run.linkedinCandidates.includes(key)
    })
    if (!priority.length && rankInFlightRef.current?.startsWith(`${signature}::`)) return
    const ranking = rankOrder.signature === signature ? rankOrder.order : []
    const ordered = [...priority, ...mergeOrder(ids, ranking).filter((id) => !priority.includes(id))]
    for (const id of ordered) {
      if (capacity <= 0) break
      taken.add(id)
      capacity -= 1
      startExpansion(id, false)
    }
  }, [profile, signature, network, run, startExpansion, rankOrder, focusTarget, targetId, rootsFinished, bridgeFound])

  const expand = useCallback(
    (id: string) => {
      if (!signature) return
      if (run.states[id]?.status === 'loading' || inFlightIdsRef.current.has(id)) return
      startExpansion(id, true)
    },
    [signature, run.states, startExpansion],
  )

  const deepExpand = useCallback(
    (id: string) => {
      if (!signature) return
      if (run.states[id]?.status === 'loading' || inFlightIdsRef.current.has(id)) return
      startExpansion(id, true, true)
    },
    [signature, run.states, startExpansion],
  )

  const invalidateExpansion = useCallback((id: string) => {
    revisionsRef.current.set(id, (revisionsRef.current.get(id) ?? 0) + 1)
    const next: Record<string, CrawlRun> = {}
    for (const [key, value] of Object.entries(runsRef.current)) {
      const states = { ...value.states }
      delete states[id]
      next[key] = {
        ...value,
        states,
        expansions: value.expansions.filter((entry) => entry.id !== id),
        order: value.order.filter((entry) => entry !== id),
      }
    }
    runsRef.current = next
    setRuns(next)
  }, [])

  const searchDeeper = useCallback(() => {
    if (!signature) return
    applyRun(signature, (current) => ({
      ...current,
      budget: current.budget + AUTO_BUDGET,
      maxDepth: current.maxDepth + 1,
      exploreMore: true,
      stopped: false,
    }))
  }, [signature, applyRun])

  const enqueueLinkedin = useCallback((keys: string[]) => {
    if (!signature || !targetId) return
    const selected = new Set(runsRef.current[signature]?.linkedinCandidates ?? [])
    const available = new Set(linkedinCandidates.filter((candidate) => candidate.researchable)
      .map((candidate) => candidate.key))
    const next = [...new Set(keys)].filter((key) => available.has(key) && !selected.has(key))
      .slice(0, LINKEDIN_BATCH)
    if (!next.length) return
    applyRun(signature, (current) => ({
      ...current,
      linkedinCandidates: [...new Set([...current.linkedinCandidates, ...next])],
      budget: current.budget + next.length,
      exploreMore: true,
      stopped: false,
    }))
  }, [signature, targetId, linkedinCandidates, applyRun])

  const reviewMoreLinkedin = useCallback(() => {
    enqueueLinkedin(linkedinCandidates.filter((candidate) => candidate.researchable)
      .slice(0, LINKEDIN_BATCH).map((candidate) => candidate.key))
  }, [enqueueLinkedin, linkedinCandidates])

  const reviewLinkedin = useCallback((key: string) => {
    enqueueLinkedin([key])
  }, [enqueueLinkedin])

  const stop = useCallback(() => {
    dossierResults.stop()
    if (!signature) return
    applyRun(signature, (current) => ({ ...current, stopped: true }))
  }, [dossierResults, signature, applyRun])

  const taken = useMemo(() => new Set(Object.keys(run.states)), [run.states])
  const remaining = useMemo(
    () => (profile && targetId ? bridgeFrontier(network, targetId, taken, run.maxDepth).length : 0),
    [profile, network, taken, targetId, run.maxDepth],
  )
  const beyond = useMemo(
    () => (profile && targetId ? bridgeFrontier(network, targetId, taken, run.maxDepth + 1).length : 0),
    [profile, network, taken, targetId, run.maxDepth],
  )
  const running = Object.values(run.states).some((state) => state.status === 'loading')
  const exhausted = run.stopped || run.started >= run.budget
  const paused = rootsFinished && bridgeFound && !run.exploreMore
  const canSearchDeeper = !running && (remaining > 0 || beyond > 0) &&
    (exhausted || paused || remaining === 0)

  const loadDossier = useCallback(
    (key: string) => {
      const target = targets.find((item) => introKey(item.partner.name, item.fund) === key)
      if (target) dossierResults.load({ name: target.partner.name, fund: target.fund })
    },
    [targets, dossierResults],
  )
  const selectedLinkedin = new Set(run.linkedinCandidates)
  const selectedNodes = network.nodes.filter((node) => node.linkedinKey && selectedLinkedin.has(node.linkedinKey))

  const progress = useMemo<NetworkProgress>(() => {
    const agents: NetworkProgress['agents'] = []
    const people = network.nodes.filter((node) => node.kind !== 'org').length
    const orgs = network.nodes.filter((node) => node.kind === 'org').length
    const searched = Object.values(run.states).filter(
      (state) => state.status !== 'loading',
    ).length
    const detail = `${searched} researched · depth ${run.maxDepth} · ${people} people · ${orgs} organizations`
    if (!profile) {
      return { status: 'pending', detail: '—', agents, stop }
    }
    if (!targetId) {
      return { status: 'pending', detail: 'Choose a person to start.', agents, stop }
    }
    agents.push({
      label: `Profile: ${profile.name}`,
      status: me.status === 'loading' ? 'loading' : me.status === 'error' ? 'error' : 'done',
    })
    for (const target of targets) {
      const state = dossierResults.states[introKey(target.partner.name, target.fund)]
      if (!state) continue
      agents.push({
        label: `Career: ${target.partner.name}`,
        status: state.status === 'loading' ? 'loading' : state.status === 'error' ? 'error' : 'done',
      })
    }
    const labelOf = new Map(network.nodes.map((node) => [node.id, node.label]))
    for (const id of run.order.slice(-12)) {
      const state = run.states[id]
      if (!state) continue
      agents.push({
        label: `Connections: ${labelOf.get(id) ?? id}`,
        status: state.status === 'loading' ? 'loading' : state.status === 'error' ? 'error' : 'done',
      })
    }
    const dossiersLoading = Object.values(dossierResults.states).some(
      (state) => state.status === 'loading',
    )
    const status = running || dossiersLoading || me.status === 'loading'
      ? 'loading'
      : run.stopped && remaining > 0
        ? 'stopped'
        : 'done'
    const suffix = paused ? ' · possible route found'
      : status === 'done' && remaining === 0 && beyond > 0
        ? ' · approval needed to go deeper'
        : status === 'done' && run.started >= run.budget && remaining > 0
          ? ' · more available'
          : ''
    return { status, detail: detail + suffix, agents, stop }
  }, [profile, network, run, targets, dossierResults.states, me.status, running, remaining, beyond, paused, targetId, stop])

  return {
    me: { profile, status: me.status },
    linkedin: {
      connections: linkedin.connections,
      fileName: linkedin.fileName,
      importedAt: linkedin.importedAt,
    },
    network,
    paths,
    ranked,
    expandStates: run.states,
    dossiers: dossierResults.states,
    running,
    canSearchDeeper,
    maxDepth: run.maxDepth,
    linkedinReview: {
      total: linkedin.connections.length,
      pending: linkedinCandidates.length,
      researchable: linkedinCandidates.filter((candidate) => candidate.researchable).length,
      promising: linkedinCandidates.filter((candidate) => candidate.score >= 10).length,
      selected: run.linkedinCandidates.length,
      researched: selectedNodes.filter((node) => run.states[node.id]?.status === 'done').length,
      searching: selectedNodes.filter((node) => run.states[node.id]?.status === 'loading').length,
      failed: selectedNodes.filter((node) => run.states[node.id]?.status === 'error').length,
      ready: !!targetId && rootsFinished,
      candidates: linkedinCandidates,
    },
    progress,
    expand,
    deepExpand,
    invalidateExpansion,
    searchDeeper,
    reviewMoreLinkedin,
    reviewLinkedin,
    stop,
    loadDossier,
  }
}
