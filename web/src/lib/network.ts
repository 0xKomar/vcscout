import {
  clean,
  dateParts,
  leadNames,
  sameFund,
  sourceRounds,
  sourceUrls,
} from './paths'
import { foldText, orgAliases, sameOrg, SELF_REPORTED } from './intro'
import { linkedinIdentity, linkedinProfileKey, normalizeLinkedinProfileUrl } from './linkedin-csv'
import type {
  Certainty,
  CompanyRounds,
  Connection,
  ConnectionRelationship,
  Dossier,
  EvidenceOrigin,
  Fact,
  Founder,
  LinkedinConnection,
  MeProfile,
  NetworkExpansion,
  OrgRelationship,
  Partner,
  RankCandidate,
  Round,
  SimilarMatch,
  SourceEvidence,
} from './types'

export const LINKEDIN_EXPORT = 'linkedin-export'

export type NetOrgType = 'company' | 'fund' | 'school' | 'event'

export interface NetNode {
  id: string
  kind: 'me' | 'person' | 'org'
  label: string
  sublabel?: string
  orgType?: NetOrgType
  target?: 'partner' | 'founder' | 'person'
  fund?: string
  company?: string
  known?: 'contact' | 'linkedin'
  profileUrl?: string
  manual?: boolean
  manualNeedsName?: boolean
  identityUncertain?: boolean
  contactRefId?: string
  linkedinKey?: string
}

export type NetRelation =
  | 'knows'
  | 'linkedin'
  | ConnectionRelationship
  | 'founder'
  | 'member'
  | 'works'
  | 'board-seat'
  | 'deal'
  | 'invested'
  | 'advises'
  | 'took-part'
  | 'studied'
  | 'affiliated'
  | 'backed'
  | 'co-invested'
  | 'same-city'
  | 'possible-org-match'

export interface NetEdge {
  id: string
  source: string
  target: string
  relation: NetRelation
  label: string
  cost: number
  certainty: Certainty
  source_url: string
  origin?: EvidenceOrigin
  sources?: SourceEvidence[]
  context?: string
  start?: string | null
  end?: string | null
}

export interface Network {
  nodes: NetNode[]
  edges: NetEdge[]
  skipped?: { name: string; company: string }[]
}

export const RELATION_COST: Record<NetRelation, number> = {
  knows: 1,
  linkedin: 1.5,
  'co-founder': 1,
  colleague: 2,
  investor: 2,
  'portfolio-founder': 2,
  board: 2,
  classmate: 2,
  teammate: 2,
  'co-author': 2,
  advisor: 2.5,
  'co-appearance': 3,
  other: 3.5,
  founder: 1,
  member: 1,
  works: 1.25,
  'board-seat': 1.25,
  deal: 1.5,
  invested: 1.5,
  advises: 1.75,
  'took-part': 2,
  studied: 2.5,
  affiliated: 2.5,
  backed: 1.5,
  'co-invested': 3,
  'same-city': 3,
  'possible-org-match': 4,
}

export const RELATION_LABEL: Record<NetRelation, string> = {
  knows: 'you know them',
  linkedin: 'LinkedIn connection',
  'co-founder': 'co-founder',
  colleague: 'colleague',
  investor: 'investor',
  'portfolio-founder': 'portfolio founder',
  board: 'board',
  classmate: 'classmate',
  teammate: 'teammate',
  'co-author': 'co-author',
  advisor: 'advisor',
  'co-appearance': 'appeared together',
  other: 'linked',
  founder: 'founder',
  member: 'fund member',
  works: 'worked here',
  'board-seat': 'board seat',
  deal: 'linked to the investment',
  invested: 'invested',
  advises: 'advisor',
  'took-part': 'took part',
  studied: 'studied here',
  affiliated: 'affiliated',
  backed: 'invested',
  'co-invested': 'co-invested',
  'same-city': 'same city',
  'possible-org-match': 'similar organization names — verify',
}

export function personKey(name: string): string {
  return foldText(name)
    .toLowerCase()
    .replace(/^(?:(?:dr|prof|mgr|inż|inz|hab|mr|mrs|ms)\.?\s+)+/, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function personIdentity(node: NetNode): string {
  return JSON.stringify([
    personKey(node.label),
    node.target ?? '',
    node.fund ?? '',
    node.company ?? '',
    node.sublabel ?? '',
  ])
}

export function expansionIdentity(node: NetNode): string {
  return JSON.stringify([node.kind, personIdentity(node), linkedinProfileKey(node.profileUrl)])
}

export function linkedinNodeId(name: string, identity: string): string {
  let first = 2166136261
  let second = 2246822519
  for (let index = 0; index < identity.length; index += 1) {
    const code = identity.charCodeAt(index)
    first = Math.imul(first ^ code, 16777619)
    second = Math.imul(second ^ code, 3266489917)
  }
  return `p:${personKey(name)}#li-${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`
}

export function manualLinkedinNodeId(profileUrl: string): string {
  return linkedinNodeId('linkedin', `manual:${linkedinProfileKey(profileUrl)}`)
}

interface Builder {
  nodes: NetNode[]
  edges: NetEdge[]
  nodeById: Map<string, NetNode>
  personByKey: Map<string, NetNode[]>
  orgByAlias: Map<string, NetNode>
  edgeByKey: Map<string, NetEdge>
  meKey: string
}

interface EdgeOpts {
  source_url: string
  context?: string
  start?: string | null
  end?: string | null
  certainty?: Certainty
  origin?: EvidenceOrigin
  sources?: SourceEvidence[]
}

function isSelfSource(url: string): boolean {
  return url === SELF_REPORTED || url === LINKEDIN_EXPORT
}

function addEdge(
  b: Builder,
  a: string,
  c: string,
  relation: NetRelation,
  label: string,
  opts: EdgeOpts,
): void {
  if (!a || !c || a === c) return
  const key = `${a < c ? `${a}~${c}` : `${c}~${a}`}|${relation}|${label.toLowerCase()}`
  const touchesMe = a === 'me' || c === 'me'
  const uncertainIdentity = !isSelfSource(opts.source_url) &&
    (b.nodeById.get(a)?.identityUncertain || b.nodeById.get(c)?.identityUncertain)
  const certainty: Certainty =
    !opts.source_url || uncertainIdentity || (touchesMe && !isSelfSource(opts.source_url))
      ? 'inferred'
      : (opts.certainty ?? 'fact')
  const existing = b.edgeByKey.get(key)
  if (existing) {
    if (existing.certainty === 'inferred' && certainty === 'fact') {
      existing.certainty = 'fact'
      existing.source_url = opts.source_url
      existing.origin = opts.origin
    }
    if (!existing.source_url && opts.source_url) existing.source_url = opts.source_url
    if (!existing.context && opts.context) existing.context = opts.context
    if (opts.sources?.length) {
      const sources = existing.sources ?? []
      for (const source of opts.sources) {
        if (!sources.some((item) => item.url === source.url && item.origin === source.origin)) sources.push(source)
      }
      existing.sources = sources
    }
    if (existing.start == null && opts.start != null) existing.start = opts.start
    if (existing.end == null && opts.end != null) existing.end = opts.end
    return
  }
  const edge: NetEdge = {
    id: `e${b.edges.length}`,
    source: a,
    target: c,
    relation,
    label,
    cost: RELATION_COST[relation],
    certainty,
    source_url: opts.source_url,
  }
  if (opts.context) edge.context = opts.context
  if (opts.origin) edge.origin = opts.origin
  if (opts.sources?.length) edge.sources = [...opts.sources]
  if (opts.start != null) edge.start = opts.start
  if (opts.end != null) edge.end = opts.end
  b.edgeByKey.set(key, edge)
  b.edges.push(edge)
}

const CONTEXT_RELS = new Set<NetRelation>([
  'works',
  'founder',
  'member',
  'board-seat',
])

function personOrgKeys(b: Builder, nodeId: string, rels: Set<NetRelation>): Set<string> {
  const keys = new Set<string>()
  for (const edge of b.edges) {
    if (!rels.has(edge.relation) || edge.certainty !== 'fact') continue
    const other =
      edge.source === nodeId ? edge.target : edge.target === nodeId ? edge.source : null
    if (!other) continue
    const node = b.nodeById.get(other)
    if (node?.kind !== 'org' || !['company', 'fund'].includes(node.orgType ?? 'company')) continue
    for (const alias of orgAliases(node.label)) keys.add(alias)
  }
  return keys
}

interface PersonMatch {
  context?: (string | undefined | null)[]
  contact?: boolean
  profileUrl?: string
  separate?: boolean
  stableId?: string
}

function matchPerson(b: Builder, key: string, match: PersonMatch): NetNode | undefined {
  const profile = linkedinProfileKey(match.profileUrl)
  if (profile) {
    const matches = b.nodes.filter((candidate) =>
      (candidate.kind === 'person' || (candidate.kind === 'me' && !match.contact && key === b.meKey)) &&
      linkedinProfileKey(candidate.profileUrl) === profile)
    if (matches.length === 1) return matches[0]
    if (matches.length > 1) return undefined
  }
  const candidates = [...(b.personByKey.get(key) ?? [])]
  if (key === b.meKey && !match.contact) {
    const me = b.nodeById.get('me')
    if (me) candidates.push(me)
  }
  if (!candidates.length) return undefined
  if (key.split(/\s+/).length < 2) return undefined
  const contextKeys = new Set<string>()
  for (const name of match.context ?? []) {
    if (name) for (const alias of orgAliases(name)) contextKeys.add(alias)
  }
  const overlaps = (keys: Set<string>) => {
    for (const k of keys) if (contextKeys.has(k)) return true
    return false
  }
  if (!contextKeys.size) return undefined
  const matches = candidates.filter((candidate) => {
    const existingProfile = linkedinProfileKey(candidate.profileUrl)
    if (profile && existingProfile && profile !== existingProfile) return false
    return overlaps(personOrgKeys(b, candidate.id, CONTEXT_RELS))
  })
  return matches.length === 1 ? matches[0] : undefined
}

function personNode(
  b: Builder,
  name: string,
  patch: Partial<NetNode> = {},
  match: PersonMatch = {},
): NetNode | null {
  const key = personKey(name)
  if (!key) return null
  const existing = match.separate ? undefined : matchPerson(b, key, { ...match, profileUrl: patch.profileUrl })
  if (existing) {
    const incomingProfile = linkedinProfileKey(patch.profileUrl)
    if (existing.kind !== 'me' &&
      (!incomingProfile || incomingProfile !== linkedinProfileKey(existing.profileUrl))) {
      existing.identityUncertain = true
    }
    if (!existing.sublabel && patch.sublabel) existing.sublabel = patch.sublabel
    if (!existing.target && patch.target) existing.target = patch.target
    if (!existing.fund && patch.fund) existing.fund = patch.fund
    if (!existing.company && patch.company) existing.company = patch.company
    if (patch.known === 'contact' || (!existing.known && patch.known)) {
      existing.known = patch.known
    }
    if (!existing.profileUrl && patch.profileUrl) existing.profileUrl = patch.profileUrl
    return existing
  }
  const siblings = b.personByKey.get(key) ?? []
  let id = match.stableId ?? (siblings.length ? `p:${key}#${siblings.length + 1}` : `p:${key}`)
  if (b.nodeById.has(id)) {
    let suffix = 2
    while (b.nodeById.has(`${id}#${suffix}`)) suffix += 1
    id = `${id}#${suffix}`
  }
  const node: NetNode = { id, kind: 'person', label: name.trim() }
  if (patch.sublabel) node.sublabel = patch.sublabel
  if (patch.target) node.target = patch.target
  if (patch.fund) node.fund = patch.fund
  if (patch.company) node.company = patch.company
  if (patch.known) node.known = patch.known
  if (patch.profileUrl) node.profileUrl = patch.profileUrl
  if (patch.manual) node.manual = true
  if (patch.manualNeedsName) node.manualNeedsName = true
  b.nodeById.set(id, node)
  siblings.push(node)
  b.personByKey.set(key, siblings)
  b.nodes.push(node)
  return node
}

function registerOrg(b: Builder, node: NetNode, name: string): void {
  b.nodeById.set(node.id, node)
  b.nodes.push(node)
  for (const alias of orgAliases(name)) {
    if (!b.orgByAlias.has(alias)) b.orgByAlias.set(alias, node)
  }
}

function orgNode(b: Builder, name: string, orgType?: NetOrgType): NetNode | null {
  const aliases = orgAliases(name)
  if (!aliases.length) return null
  let existing: NetNode | undefined
  for (const alias of aliases) {
    existing = b.orgByAlias.get(alias)
    if (existing) break
  }
  if (!existing && orgType === 'fund') {
    existing = b.nodes.find(
      (node) => node.kind === 'org' && node.orgType === 'fund' && sameFund(node.label, name),
    )
  }
  if (existing) {
    if (!existing.orgType) existing.orgType = orgType
    else if (existing.orgType === 'company' && orgType === 'fund') existing.orgType = 'fund'
    return existing
  }
  const node: NetNode = { id: `o:${aliases[0]}`, kind: 'org', label: name.trim(), orgType }
  registerOrg(b, node, name)
  return node
}

function findContactOrg(b: Builder, name: string, allowNew = false): NetNode | undefined {
  for (const alias of orgAliases(name)) {
    const node = b.orgByAlias.get(alias)
    if (node) return node
  }
  const loose = b.nodes.filter(
    (node) => node.kind === 'org' && sameOrg(node.label, name) === 'loose',
  )
  if (!allowNew && loose.length !== 1) return undefined
  const reported = orgNode(b, name, 'company')
  if (reported && loose.length === 1) {
    addEdge(b, reported.id, loose[0].id, 'possible-org-match',
      RELATION_LABEL['possible-org-match'], {
        source_url: '',
        certainty: 'inferred',
        context: 'Similar names alone do not establish that these organizations are the same.',
      })
  }
  return reported ?? undefined
}

function applyFact(
  b: Builder,
  personId: string,
  fact: Fact,
  opts: { ownFund?: string; forMe?: boolean },
): void {
  const certainty = fact.certainty ?? (opts.forMe ? 'inferred' : undefined)
  const link = (orgType: NetOrgType, relation: NetRelation, label?: string) => {
    const org = orgNode(b, fact.organization, orgType)
    if (org) {
      addEdge(b, personId, org.id, relation, (label ?? fact.role) || RELATION_LABEL[relation], {
        source_url: fact.source_url,
        start: fact.start,
        end: fact.end,
        certainty,
        origin: fact.origin,
        sources: fact.sources,
      })
    }
  }
  switch (fact.kind) {
    case 'role': {
      const ownFund = !!opts.ownFund && sameFund(fact.organization, opts.ownFund)
      const relation: NetRelation = ownFund
        ? 'member'
        : /\b(?:co[ -]?)?founder\b/i.test(fact.role)
          ? 'founder'
          : 'works'
      link(ownFund ? 'fund' : 'company', relation, fact.role || undefined)
      break
    }
    case 'education':
      link('school', 'studied', fact.role || undefined)
      break
    case 'board':
      link('company', 'board-seat', fact.role || undefined)
      break
    case 'advisor':
      link('company', 'advises', fact.role || undefined)
      break
    case 'angel':
      link('company', 'invested', fact.role || undefined)
      break
    case 'program':
      link('event', 'took-part', fact.role || undefined)
      break
    case 'coinvestor': {
      if (!opts.ownFund || !fact.company) break
      const fund = orgNode(b, opts.ownFund, 'fund')
      const other = orgNode(b, fact.organization, 'fund')
      if (fund && other) {
        addEdge(b, fund.id, other.id, 'co-invested', `co-invested in ${fact.company}`, {
          source_url: fact.source_url,
          start: fact.start,
          end: fact.end,
        })
      }
      if (other && fact.person) {
        const person = personNode(
          b,
          fact.person,
          { sublabel: fact.organization },
          { context: [fact.organization] },
        )
        if (person) {
          addEdge(b, person.id, other.id, 'member', RELATION_LABEL.member, {
            source_url: fact.source_url,
          })
        }
      }
      break
    }
    case 'deal':
      break
  }
}

const VIA_LINKS: Partial<Record<ConnectionRelationship, { types: NetOrgType[]; relation: NetRelation }>> = {
  'co-founder': { types: ['company'], relation: 'founder' },
  colleague: { types: ['company', 'fund'], relation: 'works' },
  classmate: { types: ['school'], relation: 'studied' },
  teammate: { types: ['event'], relation: 'took-part' },
  'co-appearance': { types: ['event'], relation: 'took-part' },
}

function applyPersonExpansion(
  b: Builder,
  node: NetNode,
  expansion: Extract<NetworkExpansion, { kind: 'person' }>,
): void {
  for (const fact of expansion.facts) applyFact(b, node.id, fact, {})
  for (const c of expansion.connections) {
    const other = personNode(
      b,
      c.name,
      {
        sublabel: c.organization ? [c.role, c.organization].filter(Boolean).join(' · ') : undefined,
        profileUrl: c.profile_url,
      },
      { context: [c.organization, c.via] },
    )
    if (!other) continue
    addEdge(b, node.id, other.id, c.relationship, connectionLabel(c), {
      source_url: c.source_url,
      context: c.context || undefined,
      start: c.date,
      certainty: c.certainty,
      origin: c.origin,
      sources: c.sources,
    })
    const link = VIA_LINKS[c.relationship]
    if (c.via && link?.types.includes(c.via_type as NetOrgType)) {
      const via = orgNode(b, c.via, c.via_type as NetOrgType)
      if (!via) continue
      addEdge(b, other.id, via.id, link.relation, RELATION_LABEL[link.relation], {
        source_url: c.source_url,
        start: c.date,
        certainty: c.certainty,
        origin: c.origin,
        sources: c.sources,
      })
      addEdge(b, node.id, via.id, link.relation, RELATION_LABEL[link.relation], {
        source_url: c.source_url,
        start: c.date,
        certainty: c.certainty,
        origin: c.origin,
        sources: c.sources,
      })
    }
  }
}

function connectionLabel(c: Connection): string {
  return `${RELATION_LABEL[c.relationship]}${c.via ? ` · ${c.via}` : ''}`
}

const ORG_REL: Record<OrgRelationship, NetRelation> = {
  founder: 'founder',
  executive: 'works',
  employee: 'works',
  investor: 'affiliated',
  board: 'board-seat',
  advisor: 'advises',
  organizer: 'took-part',
  jury: 'took-part',
  mentor: 'took-part',
  speaker: 'took-part',
  participant: 'took-part',
  alumni: 'studied',
  other: 'affiliated',
}

function applyOrgExpansion(
  b: Builder,
  node: NetNode,
  expansion: Extract<NetworkExpansion, { kind: 'org' }>,
): void {
  for (const p of expansion.people) {
    const person = personNode(
      b,
      p.name,
      {
        sublabel: p.affiliation ? [p.role, p.affiliation].filter(Boolean).join(' · ') : undefined,
        profileUrl: p.profile_url,
      },
      { context: [p.affiliation, node.label] },
    )
    if (!person) continue
    const relation = ORG_REL[p.relationship] ?? 'affiliated'
    const roleAtOrg = !p.affiliation || sameOrg(p.affiliation, node.label) === 'exact'
    const label = roleAtOrg && ['founder', 'employee', 'executive', 'board', 'advisor'].includes(p.relationship)
      ? (p.role || RELATION_LABEL[relation])
      : RELATION_LABEL[relation]
    addEdge(b, person.id, node.id, relation, label, {
      source_url: p.source_url,
      start: p.start,
      end: p.end,
      certainty: p.relationship === 'investor' ? 'inferred' : p.certainty,
      origin: p.origin,
      sources: p.sources,
    })
    if (!p.affiliation) continue
    const affiliation = orgNode(b, p.affiliation, p.relationship === 'investor' ? 'fund' : undefined)
    if (!affiliation || affiliation.id === node.id) continue
    addEdge(b, person.id, affiliation.id, 'affiliated', RELATION_LABEL.affiliated, {
      source_url: p.source_url,
      certainty: 'inferred',
      origin: p.origin,
    })
  }
}

export interface MapSeed {
  startups: string[]
  contexts?: { company: string; description: string }[]
  founders: { company: string; founders: Founder[] }[]
  investments: { fund: string; company: string; label: string; source_url: string }[]
  partners: { company: string; fund: string; partners: Partner[] }[]
}

export interface NetworkInput {
  profile: MeProfile
  linkedin: LinkedinConnection[]
  linkedinCandidates?: ReadonlySet<string>
  map: MapSeed
  dossiers: Dossier[]
  expansions: { id: string; identity?: string; expansion: NetworkExpansion }[]
}

const LINKEDIN_PER_ORG = 6

export function buildNetwork(input: NetworkInput): Network {
  const b: Builder = {
    nodes: [],
    edges: [],
    nodeById: new Map(),
    personByKey: new Map(),
    orgByAlias: new Map(),
    edgeByKey: new Map(),
    meKey: personKey(input.profile.name),
  }
  const meNode: NetNode = { id: 'me', kind: 'me', label: input.profile.name, sublabel: 'You' }
  if (input.profile.linkedin_url) meNode.profileUrl = input.profile.linkedin_url
  b.nodeById.set('me', meNode)
  b.nodes.push(meNode)

  for (const fact of input.profile.facts) applyFact(b, 'me', fact, { forMe: true })

  for (const contact of input.profile.contacts) {
    if (contact.ref) continue
    const person = personNode(
      b,
      contact.name,
      {
        known: 'contact',
        sublabel: contact.organization || undefined,
      },
      { contact: true, context: [contact.organization] },
    )
    if (!person || person.id === 'me') continue
    addEdge(b, 'me', person.id, 'knows', RELATION_LABEL.knows, {
      source_url: SELF_REPORTED,
      certainty: 'fact',
    })
    const organization = contact.organization.trim()
    if (organization) {
      const org = orgNode(b, organization, 'company')
      if (org) {
        addEdge(b, person.id, org.id, 'works', RELATION_LABEL.works, {
          source_url: SELF_REPORTED,
          certainty: 'fact',
        })
      }
    }
  }

  for (const startup of input.map.startups) orgNode(b, startup, 'company')

  for (const entry of input.map.founders) {
    const org = orgNode(b, entry.company, 'company')
    for (const founder of entry.founders) {
      const person = personNode(
        b,
        founder.name,
        {
          target: 'founder',
          company: entry.company,
          sublabel: founder.role || 'Founder',
        },
        { context: [entry.company] },
      )
      if (person && org) {
        addEdge(b, person.id, org.id, 'founder', founder.role || RELATION_LABEL.founder, {
          source_url: founder.source_url,
        })
      }
    }
  }

  for (const investment of input.map.investments) {
    const fund = orgNode(b, investment.fund, 'fund')
    const company = orgNode(b, investment.company, 'company')
    if (fund && company) {
      addEdge(b, fund.id, company.id, 'backed', investment.label || RELATION_LABEL.backed, {
        source_url: investment.source_url,
      })
    }
  }

  for (const entry of input.map.partners) {
    const fund = orgNode(b, entry.fund, 'fund')
    const company = orgNode(b, entry.company, 'company')
    for (const partner of entry.partners) {
      const person = personNode(
        b,
        partner.name,
        {
          target: 'partner',
          fund: entry.fund,
          sublabel: partner.role || 'Investor',
        },
        { context: [entry.fund, entry.company] },
      )
      if (!person) continue
      if (fund) {
        addEdge(b, person.id, fund.id, 'member', partner.role || RELATION_LABEL.member, {
          source_url: partner.source_url,
        })
      }
      if (company) {
        addEdge(b, person.id, company.id, 'deal', partner.connection || RELATION_LABEL.deal, {
          source_url: partner.source_url,
        })
      }
    }
  }

  for (const entry of input.profile.manual_people ?? []) {
    if (!entry || typeof entry.name !== 'string' || typeof entry.profile_url !== 'string') continue
    const profileUrl = normalizeLinkedinProfileUrl(entry.profile_url)
    if (!profileUrl) continue
    const profileKey = linkedinProfileKey(profileUrl)
    if (!profileKey || profileKey === linkedinProfileKey(input.profile.linkedin_url)) continue
    const name = entry.name.trim()
    let slug = profileKey.slice('/in/'.length)
    try { slug = decodeURIComponent(slug) } catch { /* Keep the URL-encoded slug. */ }
    const label = name || `LinkedIn: ${slug}`
    const matches = b.nodes.filter((node) =>
      node.kind === 'person' && linkedinProfileKey(node.profileUrl) === profileKey)
    const person = matches.length === 1 ? matches[0] : matches.length ? undefined : personNode(
      b, label,
      { profileUrl, manual: true, manualNeedsName: !name },
      { separate: true, stableId: manualLinkedinNodeId(profileUrl) },
    )
    if (person) {
      person.manual = true
      if (entry.target && name && !person.target) person.target = 'person'
    }
  }

  for (const dossier of input.dossiers) {
    const candidates = b.personByKey.get(personKey(dossier.name)) ?? []
    const matching = candidates.filter(
      (node) => node.target === 'partner' && !!node.fund && sameFund(node.fund, dossier.fund),
    )
    const partner = matching.length === 1 ? matching[0] : undefined
    if (!partner) continue
    for (const fact of dossier.facts) {
      applyFact(b, partner.id, fact, { ownFund: partner.fund ?? dossier.fund })
    }
  }

  const pending = [...input.expansions]
  const applyPending = () => {
    let progressed = true
    while (progressed && pending.length) {
      progressed = false
      for (let i = pending.length - 1; i >= 0; i -= 1) {
        let node = b.nodeById.get(pending[i].id)
        if (pending[i].identity && (!node || expansionIdentity(node) !== pending[i].identity)) {
          const matches = b.nodes.filter((entry) => expansionIdentity(entry) === pending[i].identity)
          node = matches.length === 1 ? matches[0] : undefined
        }
        if (!node) continue
        const expansion = pending[i].expansion
        if (expansion.kind === 'person') {
          applyPersonExpansion(b, node, expansion)
        } else {
          applyOrgExpansion(b, node, expansion)
        }
        pending.splice(i, 1)
        progressed = true
      }
    }
  }
  applyPending()

  const perOrg = new Map<string, number>()
  const skipped: { name: string; company: string }[] = []
  for (const connection of input.linkedin) {
    const key = personKey(connection.name)
    if (!key) continue
    const contactKey = linkedinIdentity(connection)
    const selected = input.linkedinCandidates?.has(contactKey) ?? false
    const profileKey = linkedinProfileKey(connection.url)
    if (key === b.meKey && profileKey &&
      profileKey === linkedinProfileKey(input.profile.linkedin_url)) continue
    const known = matchPerson(b, key, {
      contact: true,
      context: [connection.company],
      profileUrl: connection.url,
    })
    if (known) {
      const sameProfile = (!!profileKey && profileKey === linkedinProfileKey(known.profileUrl)) ||
        known.linkedinKey === contactKey
      if (!sameProfile) known.identityUncertain = true
      else known.linkedinKey = contactKey
      if (known.known !== 'contact') known.known = 'linkedin'
      if (sameProfile && !known.sublabel && (connection.position || connection.company)) {
        known.sublabel = [connection.position, connection.company].filter(Boolean).join(' · ')
      }
      addEdge(b, 'me', known.id, 'linkedin',
        sameProfile ? RELATION_LABEL.linkedin : 'possible LinkedIn match — verify identity', {
        source_url: LINKEDIN_EXPORT,
        certainty: sameProfile ? 'fact' : 'inferred',
      })
      if (sameProfile) {
        const company = connection.company.trim()
        const org = company ? findContactOrg(b, company, true) : undefined
        const alreadyWorks =
          org &&
          b.edges.some(
            (edge) =>
              edge.relation === 'works' &&
              ((edge.source === known.id && edge.target === org.id) ||
                (edge.source === org.id && edge.target === known.id)),
          )
        if (org && !alreadyWorks) {
          addEdge(b, known.id, org.id, 'works', connection.position || RELATION_LABEL.works, {
            source_url: LINKEDIN_EXPORT,
            certainty: 'fact',
          })
        }
        continue
      }
      if (!selected) {
        skipped.push({ name: connection.name, company: connection.company.trim() })
        continue
      }
    }
    const company = connection.company.trim()
    const org = company ? findContactOrg(b, company, selected) : undefined
    if ((!org && !selected) || (org && !selected && (perOrg.get(org.id) ?? 0) >= LINKEDIN_PER_ORG)) {
      skipped.push({ name: connection.name, company })
      continue
    }
    if (org) perOrg.set(org.id, (perOrg.get(org.id) ?? 0) + 1)
    const person = personNode(
      b,
      connection.name,
      {
        known: 'linkedin',
        profileUrl: profileKey ? connection.url : undefined,
        sublabel: [connection.position, company].filter(Boolean).join(' · ') || undefined,
      },
      {
        contact: true,
        context: [company],
        separate: selected,
        stableId: selected ? linkedinNodeId(connection.name, contactKey) : undefined,
      },
    )
    if (!person || person.id === 'me') continue
    person.linkedinKey = contactKey
    addEdge(b, 'me', person.id, 'linkedin', RELATION_LABEL.linkedin, {
      source_url: LINKEDIN_EXPORT,
      certainty: 'fact',
    })
    if (org) {
      addEdge(b, person.id, org.id, 'works', connection.position || RELATION_LABEL.works, {
        source_url: LINKEDIN_EXPORT,
        certainty: 'fact',
      })
    }
  }
  applyPending()

  for (const contact of input.profile.contacts) {
    if (!contact.ref) continue
    let person = b.nodeById.get(contact.ref.id)
    if (contact.ref.profile_key) {
      const matches = b.nodes.filter((node) =>
        node.kind === 'person' && linkedinProfileKey(node.profileUrl) === contact.ref?.profile_key)
      person = matches.length === 1 ? matches[0] : undefined
    } else if (!person || person.kind !== 'person' || personIdentity(person) !== contact.ref.identity ||
      personKey(person.label) !== personKey(contact.name)) {
      person = undefined
    }
    if (!person) {
      // Keep the user's confirmation without attaching it to an ambiguous namesake.
      person = personNode(b, contact.name, {
        known: 'contact',
        sublabel: contact.organization || undefined,
      }, { contact: true }) ?? undefined
    }
    if (!person || person.kind !== 'person') continue
    person.known = 'contact'
    person.identityUncertain = false
    person.contactRefId = contact.ref.id
    addEdge(b, 'me', person.id, 'knows', RELATION_LABEL.knows, {
      source_url: SELF_REPORTED,
      certainty: 'fact',
    })
    if (contact.organization.trim()) {
      const org = orgNode(b, contact.organization, 'company')
      if (org) addEdge(b, person.id, org.id, 'works', RELATION_LABEL.works, {
        source_url: SELF_REPORTED,
        certainty: 'fact',
      })
    }
  }

  const byCity = new Map<string, { label: string; nodes: NetNode[] }>()
  for (const node of b.nodes) {
    if (node.kind !== 'org' || node.orgType !== 'school') continue
    const match = /(?:^|\s)(?:w|in)\s+([\p{L}][\p{L}\s-]{1,40}?)\s*$/u.exec(node.label)
    if (!match) continue
    const key = foldText(match[1]).toLowerCase()
    if (!key) continue
    const group = byCity.get(key) ?? { label: match[1].trim(), nodes: [] }
    if (group.nodes.length < 8) group.nodes.push(node)
    byCity.set(key, group)
  }
  for (const { label, nodes } of byCity.values()) {
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        addEdge(b, nodes[i].id, nodes[j].id, 'same-city', `both in ${label}`, {
          source_url: '',
          certainty: 'inferred',
        })
      }
    }
  }

  return { nodes: b.nodes, edges: b.edges, skipped }
}

export function mapSeed(input: {
  matches: SimilarMatch[]
  companies: CompanyRounds[]
  founders: { company: string; founders: Founder[] }[]
  partners: { company: string; fund: string; data: { partners: Partner[] } }[]
}): MapSeed {
  const roundLabel = (round: Round): string => {
    const type = clean(round.round_type)
    const year = dateParts(round.announcement_date)?.year
    return year ? `${type} · ${year}` : type
  }
  const investments: MapSeed['investments'] = []
  for (const company of input.companies) {
    for (const round of sourceRounds(company)) {
      const url = sourceUrls(round.source_urls)[0] ?? ''
      const label = roundLabel(round)
      const leads = leadNames(round.lead_investors)
      for (const fund of leads) {
        investments.push({ fund, company: company.company, label: `Led ${label}`, source_url: url })
      }
      const others = leadNames(round.investors)
        .filter((name) => !leads.some((lead) => sameFund(lead, name)))
        .slice(0, 8)
      for (const fund of others) {
        investments.push({ fund, company: company.company, label, source_url: url })
      }
    }
  }
  return {
    startups: input.matches.map((match) => match.company),
    contexts: input.matches.map((match) => ({
      company: match.company,
      description: [match.description, match.similarity_reason].filter(Boolean).join(' '),
    })),
    founders: input.founders,
    investments,
    partners: input.partners.map((entry) => ({
      company: entry.company,
      fund: entry.fund,
      partners: entry.data.partners,
    })),
  }
}

interface Step {
  from: string
  edge: NetEdge
}

function dijkstra(
  network: Network,
  sources: string[],
): { cost: Map<string, number>; prev: Map<string, Step> } {
  const neighbours = new Map<string, { id: string; edge: NetEdge }[]>()
  for (const edge of network.edges) {
    neighbours.set(edge.source, [...(neighbours.get(edge.source) ?? []), { id: edge.target, edge }])
    neighbours.set(edge.target, [...(neighbours.get(edge.target) ?? []), { id: edge.source, edge }])
  }
  const cost = new Map<string, number>()
  const prev = new Map<string, Step>()
  const queue: [number, string][] = []
  for (const id of sources) {
    cost.set(id, 0)
    queue.push([0, id])
  }
  while (queue.length) {
    let best = 0
    for (let i = 1; i < queue.length; i += 1) if (queue[i][0] < queue[best][0]) best = i
    const [current, id] = queue.splice(best, 1)[0]
    if (current > (cost.get(id) ?? Infinity)) continue
    for (const next of neighbours.get(id) ?? []) {
      const total = current + next.edge.cost + (next.edge.certainty === 'inferred' ? 2.5 : 0)
      if (total < (cost.get(next.id) ?? Infinity)) {
        cost.set(next.id, total)
        prev.set(next.id, { from: id, edge: next.edge })
        queue.push([total, next.id])
      }
    }
  }
  return { cost, prev }
}

export function costsFrom(network: Network, sources: string[]): Map<string, number> {
  return dijkstra(network, sources).cost
}

export interface NetPath {
  target: string
  nodes: string[]
  edges: NetEdge[]
  cost: number
  score: number
}

export function scoreFromCost(cost: number): number {
  return Math.min(100, Math.max(1, Math.round(100 / (1 + (cost - 1) / 3))))
}

export function pathsFromMe(network: Network): Map<string, NetPath> {
  const { cost, prev } = dijkstra(network, ['me'])
  const paths = new Map<string, NetPath>()
  for (const node of network.nodes) {
    const total = cost.get(node.id)
    if (total === undefined) continue
    const nodes: string[] = []
    const edges: NetEdge[] = []
    let current = node.id
    nodes.push(current)
    while (current !== 'me') {
      const step = prev.get(current)
      if (!step) break
      edges.unshift(step.edge)
      current = step.from
      nodes.unshift(current)
    }
    paths.set(node.id, {
      target: node.id,
      nodes,
      edges,
      cost: total,
      score: scoreFromCost(total),
    })
  }
  return paths
}

export function rankTargets(
  network: Network,
  paths: Map<string, NetPath>,
): { node: NetNode; path: NetPath | null }[] {
  const withPath: { node: NetNode; path: NetPath }[] = []
  const without: { node: NetNode; path: null }[] = []
  for (const node of network.nodes) {
    if (!node.target) continue
    const path = paths.get(node.id)
    if (path) withPath.push({ node, path })
    else without.push({ node, path: null })
  }
  withPath.sort(
    (a, b) =>
      b.path.score - a.path.score ||
      a.path.nodes.length - b.path.nodes.length ||
      a.node.label.localeCompare(b.node.label),
  )
  return [...withPath, ...without]
}

export function bestPathIds(ranked: { node: NetNode; path: NetPath | null }[]): {
  nodes: Set<string>
  edges: Set<string>
} {
  const nodes = new Set<string>(['me'])
  const edges = new Set<string>()
  for (const { path } of ranked) {
    if (!path) continue
    for (const id of path.nodes) nodes.add(id)
    for (const edge of path.edges) edges.add(edge.id)
  }
  return { nodes, edges }
}

export function pathsOnly(
  network: Network,
  ids: { nodes: Set<string>; edges: Set<string> },
): Network {
  return {
    nodes: network.nodes.filter((node) => ids.nodes.has(node.id)),
    edges: network.edges.filter((edge) => ids.edges.has(edge.id)),
    skipped: network.skipped,
  }
}

export interface PathLink {
  from: NetNode
  to: NetNode
  via: NetNode[]
  edges: NetEdge[]
  kind: 'self' | 'documented' | 'inferred'
}

export function pathLinks(network: Network, path: NetPath): PathLink[] {
  const byId = new Map(network.nodes.map((node) => [node.id, node]))
  const nodeAt = (index: number) => byId.get(path.nodes[index]) as NetNode
  const links: PathLink[] = []
  const link = (from: NetNode, to: NetNode, via: NetNode[], edges: NetEdge[]) => {
    let kind: PathLink['kind'] = 'inferred'
    if (!via.length) {
      if (edges.every((edge) => isSelfSource(edge.source_url) && edge.certainty === 'fact')) kind = 'self'
      else if (edges.every((edge) => edge.certainty === 'fact')) kind = 'documented'
    }
    links.push({ from, to, via, edges, kind })
  }
  let from = nodeAt(0)
  let via: NetNode[] = []
  let edges: NetEdge[] = []
  for (let i = 1; i < path.nodes.length; i += 1) {
    const node = nodeAt(i)
    edges.push(path.edges[i - 1])
    if (node.kind === 'org') {
      via.push(node)
      if (i === path.nodes.length - 1) {
        link(from, node, via.slice(0, -1), edges)
      }
      continue
    }
    link(from, node, via, edges)
    from = node
    via = []
    edges = []
  }
  return links
}

const KIND_RANK: Record<NetNode['kind'], number> = { me: 0, person: 1, org: 2 }

export function crawlOrder(
  network: Network,
  done: ReadonlySet<string>,
  options: { maxCostMe?: number; maxCostTarget?: number; onlyTargets?: ReadonlySet<string> } = {},
): string[] {
  const maxCostMe = options.maxCostMe ?? 9
  const maxCostTarget = options.maxCostTarget ?? 6
  const order = new Map(network.nodes.map((node, index) => [node.id, index]))
  const expandable = (node: NetNode) =>
    node.kind === 'me' || node.kind === 'person' || node.kind === 'org'
  const sort = (costs: Map<string, number>) => (a: NetNode, b: NetNode) =>
    (costs.get(a.id) ?? Infinity) - (costs.get(b.id) ?? Infinity) ||
    KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
    (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  const meCosts = costsFrom(network, ['me'])
  const meSide = network.nodes
    .filter(
      (node) => expandable(node) && !done.has(node.id) && (meCosts.get(node.id) ?? Infinity) <= maxCostMe,
    )
    .sort(sort(meCosts))
  const targetCosts = costsFrom(
    network,
    network.nodes
      .filter((node) => node.target && (!options.onlyTargets || options.onlyTargets.has(node.id)))
      .map((node) => node.id),
  )
  const targetSide = network.nodes
    .filter(
      (node) =>
        expandable(node) &&
        !done.has(node.id) &&
        (targetCosts.get(node.id) ?? Infinity) <= maxCostTarget,
    )
    .sort(sort(targetCosts))
  const result: string[] = []
  const seen = new Set<string>()
  let i = 0
  let j = 0
  while (i < meSide.length || j < targetSide.length) {
    if (i < meSide.length) {
      const id = meSide[i].id
      i += 1
      if (!seen.has(id)) {
        seen.add(id)
        result.push(id)
      }
    }
    if (j < targetSide.length) {
      const id = targetSide[j].id
      j += 1
      if (!seen.has(id)) {
        seen.add(id)
        result.push(id)
      }
    }
  }
  return result
}

export interface BridgeCandidate {
  id: string
  depth: number
  side: 'me' | 'target'
}

function searchDistances(network: Network, root: string, targetId: string): Map<string, number> {
  const byId = new Map(network.nodes.map((node) => [node.id, node]))
  const distances = new Map<string, number>()
  if (!byId.has(root)) return distances
  const neighbours = new Map<string, string[]>()
  for (const edge of network.edges) {
    if (['backed', 'co-invested', 'same-city', 'possible-org-match'].includes(edge.relation)) continue
    if (edge.relation === 'deal' && edge.source !== targetId && edge.target !== targetId) continue
    neighbours.set(edge.source, [...(neighbours.get(edge.source) ?? []), edge.target])
    neighbours.set(edge.target, [...(neighbours.get(edge.target) ?? []), edge.source])
  }
  distances.set(root, 0)
  const queue = [root]
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]
    for (const id of neighbours.get(current) ?? []) {
      const node = byId.get(id)
      if (!node || (node.target && id !== targetId) || distances.has(id)) continue
      distances.set(id, (distances.get(current) ?? 0) + 1)
      queue.push(id)
    }
  }
  return distances
}

export function bridgeFrontier(
  network: Network,
  targetId: string,
  done: ReadonlySet<string>,
  maxDepth: number,
): BridgeCandidate[] {
  const meDepth = searchDistances(network, 'me', targetId)
  const targetDepth = searchDistances(network, targetId, targetId)
  const candidates: BridgeCandidate[] = []
  for (const node of network.nodes) {
    if (done.has(node.id) || node.manualNeedsName || (node.target && node.id !== targetId)) continue
    const fromMe = meDepth.get(node.id) ?? Infinity
    const fromTarget = targetDepth.get(node.id) ?? Infinity
    const depth = Math.min(fromMe, fromTarget)
    // Expanding a node at depth N creates the next step, N + 1.
    if (!Number.isFinite(depth) || depth >= maxDepth) continue
    candidates.push({ id: node.id, depth, side: fromMe <= fromTarget ? 'me' : 'target' })
  }
  const byId = new Map(network.nodes.map((node) => [node.id, node]))
  candidates.sort((a, b) => {
    const priority = (candidate: BridgeCandidate) => {
      const node = byId.get(candidate.id)!
      if (node.id === 'me' || node.id === targetId) return 0
      if (node.known === 'contact' || node.known === 'linkedin') return 1
      if (meDepth.has(node.id) && targetDepth.has(node.id)) return 2
      return node.kind === 'person' ? 3 : 4
    }
    return a.depth - b.depth || priority(a) - priority(b) || a.id.localeCompare(b.id)
  })
  return candidates
}

export function bridgeFocus(
  network: Network,
  id: string,
  targetId: string,
): { focus: string[]; focus_people: string[]; counterpart: { name: string; context: string } } {
  const meDepth = searchDistances(network, 'me', targetId)
  const targetDepth = searchDistances(network, targetId, targetId)
  const fromUser = id === 'me' ||
    (id !== targetId && (meDepth.get(id) ?? Infinity) <= (targetDepth.get(id) ?? Infinity))
  const oppositeId = fromUser ? targetId : 'me'
  const oppositeDepth = fromUser ? targetDepth : meDepth
  const opposite = network.nodes.find((node) => node.id === oppositeId)
  const focus = network.nodes
    .filter((node) => node.kind === 'org' && (oppositeDepth.get(node.id) ?? Infinity) <= 2)
    .sort((a, b) => (oppositeDepth.get(a.id) ?? Infinity) - (oppositeDepth.get(b.id) ?? Infinity))
    .map((node) => node.label)
    .slice(0, 10)
  const focusPeople = network.nodes
    .filter((node) => node.kind !== 'org' && node.id !== id &&
      (oppositeDepth.get(node.id) ?? Infinity) <= 1 &&
      (!node.target || node.id === targetId))
    .map((node) => node.label)
    .slice(0, 10)
  return {
    focus,
    focus_people: focusPeople,
    counterpart: {
      name: opposite?.label ?? '',
      context: opposite ? [opposite.sublabel, opposite.fund ?? opposite.company].filter(Boolean).join(' · ') : '',
    },
  }
}

export function identityOrganizations(network: Network, id: string): string[] {
  const byId = new Map(network.nodes.map((node) => [node.id, node]))
  const names: string[] = []
  const relations: NetRelation[] = ['works', 'founder', 'member', 'studied', 'board-seat', 'advises']
  for (const edge of network.edges) {
    if (!relations.includes(edge.relation) || edge.certainty !== 'fact') continue
    const otherId = edge.source === id ? edge.target : edge.target === id ? edge.source : ''
    const other = byId.get(otherId)
    if (other?.kind === 'org' && !names.includes(other.label)) names.push(other.label)
  }
  return names.slice(0, 10)
}

export function actionableBridge(path: NetPath | undefined): boolean {
  if (!path || !path.edges.length) return false
  if (!path.edges.some((edge) => edge.relation === 'knows' || edge.relation === 'linkedin')) return false
  return path.edges.every((edge) =>
    edge.certainty === 'fact' && !!edge.source_url &&
    !['co-appearance', 'co-invested', 'other', 'same-city'].includes(edge.relation),
  )
}

export function reviewedBridge(
  network: Network,
  path: NetPath | undefined,
  selectedContacts: ReadonlySet<string>,
  researched: ReadonlySet<string>,
): boolean {
  if (!actionableBridge(path) || !path) return false
  const byId = new Map(network.nodes.map((node) => [node.id, node]))
  return !path.nodes.some((id) => {
    const key = byId.get(id)?.linkedinKey
    return key && selectedContacts.has(key) && !researched.has(id)
  })
}

const joinList = (items: string[]): string =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : (items[0] ?? '')

const clipText = (text: string, limit = 300) => (text.length > limit ? text.slice(0, limit) : text)

export function expansionRequest(
  network: Network,
  id: string,
): {
  kind: 'person' | 'org'
  name: string
  context: string
  background: boolean
  focus?: string[]
} | null {
  const byId = new Map(network.nodes.map((entry) => [entry.id, entry]))
  const node = byId.get(id)
  if (!node || node.manualNeedsName) return null
  const neighbours = (relations: NetRelation[], limit: number, kind: NetNode['kind']) => {
    const names: string[] = []
    for (const edge of network.edges) {
      if (edge.source !== id && edge.target !== id) continue
      if (!relations.includes(edge.relation)) continue
      const other = byId.get(edge.source === id ? edge.target : edge.source)
      if (!other || other.kind !== kind || names.includes(other.label)) continue
      names.push(other.label)
      if (names.length === limit) break
    }
    return names
  }
  const orgNeighbours = (relations: NetRelation[], limit: number) =>
    neighbours(relations, limit, 'org')
  const focus = knownOrganizations(network, 12).filter((name) => name !== node.label)
  if (node.kind === 'me') {
    const worked = orgNeighbours(['works', 'founder'], 3)
    const studied = orgNeighbours(['studied'], 2)
    const context =
      worked.length && studied.length
        ? `who has worked at ${joinList(worked)} and studied at ${joinList(studied)}`
        : worked.length
          ? `who has worked at ${joinList(worked)}`
          : studied.length
            ? `who has studied at ${joinList(studied)}`
            : ''
    return { kind: 'person', name: node.label, context: clipText(context), background: true, focus }
  }
  if (node.kind === 'person') {
    if (node.target === 'partner') {
      return {
        kind: 'person',
        name: node.label,
        context: clipText(`${node.sublabel || 'Investor'} at ${node.fund ?? ''}`.trim()),
        background: true,
        focus,
      }
    }
    if (node.target === 'founder') {
      return {
        kind: 'person',
        name: node.label,
        context: clipText(`${node.sublabel || 'Founder'} of ${node.company ?? ''}`.trim()),
        background: true,
        focus,
      }
    }
    return {
      kind: 'person',
      name: node.label,
      context: clipText(node.sublabel ?? ''),
      background: true,
      focus,
    }
  }
  let context = 'an organization'
  if (node.orgType === 'fund') context = 'a venture capital fund'
  else if (node.orgType === 'school') context = 'a university or school'
  else if (node.orgType === 'event') context = 'an event or program'
  else if (node.orgType === 'company') {
    const founders = neighbours(['founder'], 2, 'person')
    context = founders.length ? `a startup founded by ${joinList(founders)}` : 'a company'
  }
  return { kind: 'org', name: node.label, context: clipText(context), background: false, focus }
}

export function mergeOrder(crawl: string[], ai: string[]): string[] {
  const remaining = new Set(crawl)
  const head = ai.filter((id) => remaining.delete(id))
  return [...head, ...crawl.filter((id) => remaining.has(id))]
}

export function describeCandidates(network: Network, ids: string[]): RankCandidate[] {
  const byId = new Map(network.nodes.map((entry) => [entry.id, entry]))
  const candidates: RankCandidate[] = []
  for (const id of ids) {
    const node = byId.get(id)
    if (!node || node.kind === 'me') continue
    const links: string[] = []
    for (const edge of network.edges) {
      if (edge.source !== id && edge.target !== id) continue
      const other = byId.get(edge.source === id ? edge.target : edge.source)
      if (other && other.id !== 'me' && !links.includes(other.label) && links.length < 8) {
        links.push(other.label)
      }
    }
    candidates.push({
      id,
      label: node.label,
      kind: node.kind === 'org' ? 'org' : 'person',
      sublabel: node.sublabel,
      links,
    })
  }
  return candidates
}

export function knownOrganizations(network: Network, limit = 25): string[] {
  const byId = new Map(network.nodes.map((entry) => [entry.id, entry]))
  const adjacent = (id: string) => {
    const names: string[] = []
    for (const edge of network.edges) {
      if (edge.source !== id && edge.target !== id) continue
      const other = byId.get(edge.source === id ? edge.target : edge.source)
      if (other?.kind === 'org' && !names.includes(other.label)) names.push(other.label)
    }
    return names
  }
  const names: string[] = []
  const push = (list: string[]) => {
    for (const label of list) if (!names.includes(label) && names.length < limit) names.push(label)
  }
  push(adjacent('me'))
  for (const node of network.nodes) if (node.target) push(adjacent(node.id))
  push(network.nodes.filter((node) => node.kind === 'org').map((node) => node.label))
  return names
}

export function introAskFact(links: PathLink[], target: NetNode): string {
  const first = links[0]
  let opening = ''
  if (first) {
    if (first.kind === 'self') opening = "I hope you're doing well"
    else if (first.via.length) opening = `We may both be linked to ${first.via[0].label}`
    else if (first.kind === 'documented') opening = `We are publicly linked (${first.edges[0].label})`
    else opening = `We may be linked (${first.edges[0].label})`
  }
  const bridge = first?.to
  const between: string[] = []
  for (const step of links.slice(1)) {
    const labels = [step.from.label, ...step.via.map((node) => node.label), step.to.label]
    for (const label of labels) {
      if (label === bridge?.label || label === target.label || between.includes(label)) continue
      between.push(label)
    }
  }
  const relation = links.slice(1).some((step) =>
    step.kind === 'inferred' || step.edges.some((edge) => ['co-appearance', 'other'].includes(edge.relation)),
  )
    ? 'It looks like there may be a connection to'
    : "I saw that you're connected to"
  const closing = `${relation} ${target.label}${between.length ? ` through ${joinList(between)}` : ''}`
  return [opening, closing].filter(Boolean).join('. ') + '.'
}
