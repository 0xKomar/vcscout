import { describe, expect, it } from 'vitest'
import { linkedinIdentity } from './linkedin-csv'
import { rankLinkedinCandidates } from './linkedin-candidates'
import {
  buildNetwork,
  expansionIdentity,
  linkedinNodeId,
  pathsFromMe,
  pathLinks,
  reviewedBridge,
  type MapSeed,
  type NetNode,
} from './network'
import type { LinkedinConnection, MeProfile, NetworkExpansion } from './types'

const profile: MeProfile = {
  name: 'Test Person', linkedin_url: '', employers: [], schools: [], contacts: [], hidden: [], facts: [],
}
const map: MapSeed = {
  startups: ['Forgent AI'],
  founders: [{
    company: 'Forgent AI',
    founders: [{ name: 'Target Founder', role: 'CEO', source_url: 'https://example.com/team' }],
  }],
  investments: [],
  partners: [],
}
const contacts: LinkedinConnection[] = Array.from({ length: 823 }, (_, index) => ({
  name: index === 800 ? 'Ava Engineer' : `Contact ${index}`,
  company: index === 800 ? 'Google' : `Other Company ${index}`,
  position: index === 800 ? 'AI Engineer' : 'Chef',
  url: `https://linkedin.com/in/contact-${index}`,
}))
const build = (selected: string[] = [], expansions: { id: string; expansion: NetworkExpansion }[] = []) =>
  buildNetwork({ profile, map, linkedin: contacts, linkedinCandidates: new Set(selected), dossiers: [], expansions })

describe('LinkedIn candidate review', () => {
  it('screens all contacts locally and prioritizes a relevant person near the end of the export', () => {
    const network = build()
    expect(network.skipped).toHaveLength(823)
    const ranked = rankLinkedinCandidates(contacts, network, 'p:target founder')
    expect(ranked).toHaveLength(823)
    expect(ranked[0].contact.name).toBe('Ava Engineer')
    expect(ranked[0].reason).toContain('technical')
    expect(network.nodes.length).toBeLessThan(10)
  })

  it('uses the target startup description when its name does not reveal its industry', () => {
    const neutralMap: MapSeed = {
      ...map,
      startups: ['Minerva'],
      founders: [{ ...map.founders[0], company: 'Minerva' }],
    }
    const network = buildNetwork({ profile, map: neutralMap, linkedin: contacts, dossiers: [], expansions: [] })
    const without = rankLinkedinCandidates(contacts, network, 'p:target founder')
    const withDescription = rankLinkedinCandidates(contacts, network, 'p:target founder', 'AI procurement software')
    expect(without.find((candidate) => candidate.contact.name === 'Ava Engineer')?.score).toBe(1)
    expect(withDescription[0].contact.name).toBe('Ava Engineer')
    expect(withDescription[0].score).toBeGreaterThan(10)
  })

  it('keeps contacts without an identity anchor visible but does not offer unsafe research', () => {
    const unknown: LinkedinConnection = { name: 'Ada Nowak', company: '', position: 'Engineer', url: '' }
    const network = buildNetwork({ profile, map, linkedin: [unknown], dossiers: [], expansions: [] })
    const candidates = rankLinkedinCandidates([unknown], network, 'p:target founder')
    expect(candidates).toHaveLength(1)
    expect(candidates[0].researchable).toBe(false)
    expect(candidates[0].reason).toContain('employer or LinkedIn profile')
  })

  it('researches only selected contacts, and attaches results after the contact is added', () => {
    const key = linkedinIdentity(contacts[800])
    const expansion: NetworkExpansion = {
      kind: 'person', name: 'Ava Engineer', entity: null, origin: 'openai', failed: [],
      connections: [],
      facts: [{
        kind: 'role', organization: 'BridgeWorks', role: 'Engineer', start: null, end: null,
        source_url: 'https://example.com/ava', origin: 'openai',
      }],
    }
    const network = build([key], [{ id: linkedinNodeId('Ava Engineer', key), expansion }])
    const ava = network.nodes.find((node) => node.label === 'Ava Engineer')!
    expect(ava.known).toBe('linkedin')
    expect(ava.profileUrl).toBe(contacts[800].url)
    expect(network.nodes.some((node) => node.label === 'Google')).toBe(true)
    expect(network.nodes.some((node) => node.label === 'BridgeWorks')).toBe(true)
    expect(network.nodes.length).toBeLessThan(10)
    expect(network.skipped).toHaveLength(822)
    expect(pathsFromMe(network).has('p:target founder')).toBe(false)
  })

  it('does not merge a selected same-name LinkedIn contact into the target without identity proof', () => {
    const contact: LinkedinConnection = {
      name: 'Target Founder', company: 'Forgent AI', position: 'Analyst',
      url: 'https://linkedin.com/in/someone-else',
    }
    const initial = buildNetwork({ profile, map, linkedin: [contact], dossiers: [], expansions: [] })
    const key = linkedinIdentity(contact)
    expect(rankLinkedinCandidates([contact], initial, 'p:target founder')).toHaveLength(1)
    const network = buildNetwork({
      profile, map, linkedin: [contact], linkedinCandidates: new Set([key]), dossiers: [], expansions: [],
    })
    const namesakes = network.nodes.filter((node) => node.label === 'Target Founder')
    expect(namesakes).toHaveLength(2)
    expect(namesakes.find((node) => node.linkedinKey === key)?.id).not.toBe('p:target founder')
    const direct = network.edges.find((edge) =>
      [edge.source, edge.target].includes('me') && [edge.source, edge.target].includes('p:target founder'),
    )
    expect(direct?.certainty).toBe('inferred')
    const path = pathsFromMe(network).get('p:target founder')!
    expect(pathLinks(network, path).at(-1)?.kind).toBe('inferred')
    const linkedInPerson = namesakes.find((node) => node.linkedinKey === key)!
    expect(reviewedBridge(network, path, new Set([key]), new Set())).toBe(false)
    expect(reviewedBridge(network, path, new Set([key]), new Set([linkedInPerson.id]))).toBe(true)
  })

  it('does not apply a cached expansion to an unrelated node that reuses an ID', () => {
    const key = linkedinIdentity(contacts[800])
    const ava: NetNode = {
      id: linkedinNodeId('Ava Engineer', key), kind: 'person', label: 'Ava Engineer',
      sublabel: 'AI Engineer · Google', profileUrl: contacts[800].url,
    }
    const expansion: NetworkExpansion = {
      kind: 'person', name: 'Ava Engineer', entity: null, origin: 'openai', failed: [],
      connections: [],
      facts: [{ kind: 'role', organization: 'BridgeWorks', role: 'Engineer', start: null, end: null,
        source_url: 'https://example.com/ava', origin: 'openai' }],
    }
    const network = buildNetwork({
      profile, map, linkedin: contacts, linkedinCandidates: new Set([key]), dossiers: [],
      expansions: [{ id: 'p:target founder', identity: expansionIdentity(ava), expansion }],
    })
    const bridge = network.nodes.find((node) => node.label === 'BridgeWorks')!
    expect(network.edges.some((edge) =>
      [edge.source, edge.target].includes(ava.id) && [edge.source, edge.target].includes(bridge.id),
    )).toBe(true)
    expect(network.edges.some((edge) =>
      [edge.source, edge.target].includes('p:target founder') && [edge.source, edge.target].includes(bridge.id),
    )).toBe(false)
  })
})
