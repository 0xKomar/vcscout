import { describe, expect, it } from 'vitest'
import {
  actionableBridge,
  bestPathIds,
  bridgeFocus,
  bridgeFrontier,
  buildNetwork,
  crawlOrder,
  describeCandidates,
  expansionIdentity,
  expansionRequest,
  identityOrganizations,
  introAskFact,
  knownOrganizations,
  manualLinkedinNodeId,
  mapSeed,
  mergeOrder,
  pathsFromMe,
  pathsOnly,
  pathLinks,
  personKey,
  personIdentity,
  rankTargets,
  scoreFromCost,
  type MapSeed,
  type NetNode,
  type Network,
} from './network'
import { introKey, orgKey, selfFacts } from './intro'
import { linkedinProfileKey } from './linkedin-csv'
import type {
  Connection,
  Dossier,
  Fact,
  LinkedinConnection,
  MeProfile,
  NetworkExpansion,
  OrgPerson,
} from './types'
import connRows from './__fixtures__/conn-gawel-rows.json'

const profile = (contacts: { name: string; organization: string }[] = []): MeProfile => ({
  name: 'Igor Komar',
  linkedin_url: '',
  employers: [{ organization: 'ZdajTo!', start: '2018', end: '' }],
  schools: ['Politechnika Poznańska'],
  contacts: contacts.map((c) => ({ name: c.name, organization: c.organization })),
  hidden: [],
  facts: [
    ...selfFacts({
      employers: [{ organization: 'ZdajTo!', start: '2018', end: '' }],
      schools: ['Politechnika Poznańska'],
    }),
  ],
})

const map: MapSeed = {
  startups: ['Minerva'],
  founders: [
    {
      company: 'Minerva',
      founders: [
        { name: 'Wiktor Gaweł', role: 'CEO & Co-founder', source_url: 'https://minerva.ai/team' },
        { name: 'Piotr Gerke', role: 'Co-founder & CTO', source_url: 'https://minerva.ai/team' },
      ],
    },
  ],
  investments: [
    {
      fund: 'Open Ocean',
      company: 'Minerva',
      label: 'Led Seed · 2025',
      source_url: 'https://news.example.com/minerva-seed',
    },
  ],
  partners: [
    {
      company: 'Minerva',
      fund: 'Open Ocean',
      partners: [
        {
          name: 'Patrik Backman',
          role: 'Managing Partner',
          connection: 'Led the seed round',
          source_url: 'https://openocean.vc/team',
        },
      ],
    },
  ],
}

const gawelConnections: Connection[] = connRows.map((row) => ({
  name: row.connected_person,
  role: row.connected_person_role ?? '',
  organization: row.connected_person_organization ?? '',
  via: row.organization ?? '',
  via_type: (row.organization_type ?? 'other') as Connection['via_type'],
  relationship: row.relationship as Connection['relationship'],
  context: row.context ?? '',
  date: row.date ?? null,
  source_url: row.source_url,
}))

const personExpansion = (
  name: string,
  connections: Connection[],
  facts: Fact[] = [],
): { id: string; expansion: NetworkExpansion } => ({
  id: `p:${personKey(name)}`,
  expansion: {
    kind: 'person',
    name,
    entity: null,
    connections,
    facts,
    origin: 'cala',
    failed: [],
  },
})

const orgExpansion = (
  name: string,
  people: OrgPerson[] = [],
): { id: string; expansion: NetworkExpansion } => ({
  id: `o:${orgKey(name)}`,
  expansion: { kind: 'org', name, entity: null, people, origin: 'cala', failed: [] },
})

const gawelExpansion = personExpansion('Wiktor Gaweł', gawelConnections)

const base = (
  over: Partial<Parameters<typeof buildNetwork>[0]> = {},
): Network =>
  buildNetwork({
    profile: profile([{ name: 'Jan Kowalski', organization: 'Minerva' }]),
    linkedin: [],
    map,
    dossiers: [],
    expansions: [gawelExpansion],
    ...over,
  })

const node = (net: Network, id: string) => net.nodes.find((n) => n.id === id) as NetNode
const edgeBetween = (net: Network, a: string, b: string, relation?: string) =>
  net.edges.find(
    (e) =>
      (relation === undefined || e.relation === relation) &&
      ((e.source === a && e.target === b) || (e.source === b && e.target === a)),
  )

describe('buildNetwork', () => {
  it('grows the map outward from both ends', () => {
    const net = base()
    expect(node(net, 'me').label).toBe('Igor Komar')
    expect(node(net, 'p:jan kowalski').known).toBe('contact')
    const gawel = node(net, 'p:wiktor gawel')
    expect(gawel.target).toBe('founder')
    expect(gawel.company).toBe('Minerva')
    // Jan → Minerva → Wiktor path exists
    expect(edgeBetween(net, 'me', 'p:jan kowalski', 'knows')).toBeTruthy()
    const minerva = net.nodes.find((n) => n.kind === 'org' && n.label === 'Minerva') as NetNode
    expect(edgeBetween(net, 'p:jan kowalski', minerva.id, 'works')).toBeTruthy()
    expect(edgeBetween(net, gawel.id, minerva.id, 'founder')).toBeTruthy()
    // connections expansion: co-founders
    const gerke = node(net, 'p:piotr gerke')
    expect(gerke.target).toBe('founder')
    const cofounder = edgeBetween(net, gawel.id, gerke.id, 'co-founder')
    expect(cofounder?.label).toBe('co-founder · Minerva')
    const classmate = edgeBetween(net, gawel.id, gerke.id, 'classmate')
    expect(classmate?.label).toContain('IV Liceum')
    const stoinski = edgeBetween(net, gawel.id, 'p:maciej stoinski', 'co-founder')
    expect(stoinski?.label).toBe('co-founder · Minerva')
    // via orgs get person→org links
    const school = net.nodes.find(
      (n) => n.kind === 'org' && n.label === 'IV Liceum Ogólnokształcące w Poznaniu',
    ) as NetNode
    expect(school.orgType).toBe('school')
    expect(edgeBetween(net, gawel.id, school.id, 'studied')).toBeTruthy()
    expect(edgeBetween(net, gerke.id, school.id, 'studied')).toBeTruthy()
    // investors get invested edges via Minerva
    const backman = node(net, 'p:patrik backman')
    expect(backman.target).toBe('partner')
    expect(edgeBetween(net, gawel.id, backman.id, 'investor')).toBeTruthy()
    // A person-to-person "investor" relationship does not prove a personal investment.
    expect(edgeBetween(net, backman.id, minerva.id, 'invested')).toBeFalsy()
    // co-appearance edges to an event org
    const event = net.nodes.find(
      (n) => n.kind === 'org' && n.label.includes('Kongres Controllingowy'),
    ) as NetNode
    expect(event.orgType).toBe('event')
    expect(edgeBetween(net, gawel.id, 'p:michal szudejko', 'co-appearance')).toBeTruthy()
    expect(edgeBetween(net, 'p:michal szudejko', event.id, 'took-part')).toBeTruthy()
    expect(edgeBetween(net, gawel.id, event.id, 'took-part')).toBeTruthy()
    // no self loops, no duplicate edges
    expect(net.edges.every((e) => e.source !== e.target)).toBe(true)
    const keys = net.edges.map(
      (e) => `${[e.source, e.target].sort().join('~')}|${e.relation}|${e.label.toLowerCase()}`,
    )
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('marks Cala-sourced edges to me as inferred and self entries as fact', () => {
    const net = base({
      profile: {
        ...profile(),
        facts: [
          ...selfFacts({
            employers: [{ organization: 'ZdajTo!', start: '2018', end: '' }],
            schools: [],
          }),
          {
            kind: 'role',
            organization: 'Found in public',
            role: 'Intern',
            start: null,
            end: null,
            source_url: 'https://example.com/x',
            certainty: 'inferred',
          },
        ],
      },
    })
    const publicOrg = net.nodes.find((n) => n.label === 'Found in public') as NetNode
    const inferred = edgeBetween(net, 'me', publicOrg.id, 'works')
    expect(inferred?.certainty).toBe('inferred')
    const self = edgeBetween(net, 'me', net.nodes.find((n) => n.label === 'ZdajTo!')!.id, 'works')
    expect(self?.certainty).toBe('fact')
    expect(self?.label).toBe('worked here')
  })

  it('does not merge a same-name person into the user without identity evidence', () => {
    const net = base({
      linkedin: [{ name: 'Igor Komar', company: 'Minerva', position: 'CEO', url: '' }],
    })
    expect(net.nodes.filter((n) => n.id === 'me')).toHaveLength(1)
    expect(net.nodes.some((n) => n.id === 'p:igor komar')).toBe(true)
    expect(net.edges.every((e) => e.source !== e.target)).toBe(true)
    // An unrelated same-name connection must not become a relationship to the user.
    const net2 = base({
      expansions: [
        personExpansion('Wiktor Gaweł', [
          { ...gawelConnections[0], name: 'Igor Komar', via: '', via_type: 'other' },
        ]),
      ],
    })
    expect(net2.nodes.some((n) => n.id === 'p:igor komar')).toBe(true)
    expect(edgeBetween(net2, 'me', 'p:wiktor gawel')).toBeFalsy()
  })

  it('keeps contact over linkedin for the same person', () => {
    const net = base({
      linkedin: [
        {
          name: 'Jan Kowalski',
          company: 'Minerva',
          position: 'Engineer',
          url: 'https://linkedin.com/in/jan',
        },
      ],
    })
    const jan = node(net, 'p:jan kowalski')
    expect(jan.known).toBe('contact')
    expect(jan.profileUrl).toBeUndefined()
    expect(edgeBetween(net, 'me', jan.id, 'knows')).toBeTruthy()
    expect(edgeBetween(net, 'me', jan.id, 'linkedin')).toBeTruthy()
    expect(edgeBetween(net, 'me', jan.id, 'linkedin')?.certainty).toBe('inferred')
  })

  it('merges orgs by alias and upgrades company to fund, never the reverse', () => {
    const net = base()
    const openOceans = net.nodes.filter((n) => n.kind === 'org' && n.label === 'Open Ocean')
    expect(openOceans).toHaveLength(1)
    expect(openOceans[0].orgType).toBe('fund')
    const withCompanyFirst = buildNetwork({
      profile: profile(),
      linkedin: [],
      map: {
        startups: ['Open Ocean'],
        founders: [],
        investments: [
          { fund: 'Open Ocean', company: 'Minerva', label: 'Led Seed', source_url: 'x' },
        ],
        partners: [],
      },
      dossiers: [],
      expansions: [],
    })
    const merged = withCompanyFirst.nodes.find((n) => n.label === 'Open Ocean') as NetNode
    expect(merged.orgType).toBe('fund')
    const withFundFirst = buildNetwork({
      profile: profile(),
      linkedin: [],
      map: {
        startups: ['Minerva'],
        founders: [],
        investments: [
          { fund: 'Minerva Capital', company: 'Minerva', label: 'Seed', source_url: 'x' },
        ],
        partners: [],
      },
      dossiers: [],
      expansions: [orgExpansion('Minerva')],
    })
    expect(withFundFirst.nodes.find((n) => n.label === 'Minerva')?.orgType).toBe('company')
  })

  it('matches funds loosely by prefix but never other org types', () => {
    const seed: MapSeed = {
      startups: [],
      founders: [],
      investments: [
        { fund: 'Point Nine Capital', company: 'Acme', label: 'Seed', source_url: 'x' },
      ],
      partners: [
        {
          company: 'Acme',
          fund: 'Point Nine',
          partners: [{ name: 'Pawel Chudzinski', role: 'Partner', connection: 'x', source_url: 'x' }],
        },
      ],
    }
    const net = buildNetwork({
      profile: profile(),
      linkedin: [],
      map: seed,
      dossiers: [],
      expansions: [],
    })
    const pointNines = net.nodes.filter((n) => n.kind === 'org' && n.label.includes('Point Nine'))
    expect(pointNines).toHaveLength(1)
    // companies with a prefix relation stay separate
    const loose = buildNetwork({
      profile: profile(),
      linkedin: [],
      map: {
        startups: ['Bain', 'Bain Capital'],
        founders: [],
        investments: [],
        partners: [],
      },
      dossiers: [],
      expansions: [],
    })
    expect(loose.nodes.filter((n) => n.kind === 'org' && n.label.startsWith('Bain'))).toHaveLength(2)
  })

  it('keeps expansions attaching until none can attach', () => {
    const net = base({
      expansions: [
        // the school expansion arrives before the school node exists
        {
          id: 'o:iv liceum ogolnoksztalcace w poznaniu',
          expansion: {
            kind: 'org' as const,
            name: 'IV Liceum Ogólnokształcące w Poznaniu',
            entity: null,
            people: [
              {
                name: 'Maria Nowicka',
                role: 'Student',
                relationship: 'alumni' as const,
                affiliation: '',
                start: '2015',
                end: '2018',
                source_url: 'https://example.com/nowicka',
              },
            ],
            origin: 'cala' as const,
            failed: [],
          },
        },
        gawelExpansion,
      ],
    })
    expect(node(net, 'p:maria nowicka')).toBeTruthy()
  })

  it('adds LinkedIn import edges for people and orgs already on the map', () => {
    const linkedin: LinkedinConnection[] = [
      { name: 'Piotr Gerke', company: 'Minerva', position: 'CTO', url: 'https://linkedin.com/in/pg' },
      { name: 'Ola Testowa', company: 'Minerva', position: 'Ops', url: '' },
      { name: 'Unmatched Person', company: 'Nowhere LLC', position: '', url: '' },
    ]
    const net = base({ linkedin })
    const gerke = node(net, 'p:piotr gerke')
    expect(gerke.known).toBe('linkedin')
    expect(gerke.profileUrl).toBeUndefined()
    expect(gerke.identityUncertain).toBe(true)
    expect(edgeBetween(net, 'me', gerke.id, 'linkedin')).toBeTruthy()
    const ola = node(net, 'p:ola testowa')
    expect(ola.known).toBe('linkedin')
    expect(edgeBetween(net, 'me', ola.id, 'linkedin')).toBeTruthy()
    const minerva = net.nodes.find((n) => n.label === 'Minerva') as NetNode
    expect(edgeBetween(net, ola.id, minerva.id, 'works')?.label).toBe('Ops')
    // unmatched company: nothing added
    expect(net.nodes.every((n) => !n.label.includes('Unmatched'))).toBe(true)
  })

  it('skips LinkedIn colleagues whose company loosely matches several orgs', () => {
    const net = base({
      linkedin: [{ name: 'Ada Nowak', company: 'Acme', position: 'PM', url: '' }],
      map: { ...map, startups: ['Acme AI', 'Acme Robotics'] },
    })
    expect(net.nodes.every((n) => n.id !== 'p:ada nowak')).toBe(true)
  })

  it('keeps a LinkedIn employer separate from a similar organization name', () => {
    const net = base({
      linkedin: [{ name: 'Ada Nowak', company: 'Minerva AI', position: 'PM', url: '' }],
    })
    const ada = node(net, 'p:ada nowak')
    const minerva = net.nodes.find((n) => n.label === 'Minerva') as NetNode
    expect(ada.known).toBe('linkedin')
    expect(edgeBetween(net, 'me', ada.id, 'linkedin')).toBeTruthy()
    const reported = net.nodes.find((n) => n.kind === 'org' && n.label === 'Minerva AI')!
    expect(edgeBetween(net, ada.id, reported.id, 'works')?.certainty).toBe('fact')
    expect(edgeBetween(net, ada.id, minerva.id, 'works')).toBeFalsy()
    const possible = edgeBetween(net, reported.id, minerva.id, 'possible-org-match')
    expect(possible?.certainty).toBe('inferred')
    expect(possible?.source_url).toBe('')
  })

  it('does not use a possible company match as verified identity or search context', () => {
    const net = base({
      profile: profile(),
      expansions: [],
      linkedin: [{ name: 'Ada Nowak', company: 'Minerva AI', position: 'PM', url: '' }],
    })
    const ada = node(net, 'p:ada nowak')
    const target = node(net, 'p:wiktor gawel')
    expect(identityOrganizations(net, ada.id)).toEqual(['Minerva AI'])
    expect(bridgeFocus(net, 'me', target.id).focus).not.toContain('Minerva AI')
    const path = pathsFromMe(net).get(target.id)!
    expect(actionableBridge(path)).toBe(false)
    expect(introAskFact(pathLinks(net, path), target)).toContain('there may be a connection')
  })

  it('links an existing node to its LinkedIn company when the org is on the map', () => {
    const zdajto = orgExpansion('ZdajTo!', [
      {
        name: 'Łukasz Kowalski',
        role: '',
        relationship: 'participant',
        affiliation: 'ZdajTo!',
        start: null,
        end: null,
        source_url: '',
      },
    ])
    const net = base({
      linkedin: [
        { name: 'Łukasz Kowalski', company: 'Minerva', position: 'Engineer', url: '' },
      ],
      expansions: [gawelExpansion, zdajto],
    })
    const lukasz = net.nodes.find((n) => n.label === 'Łukasz Kowalski' && n.known === 'linkedin')!
    const minerva = net.nodes.find((n) => n.label === 'Minerva') as NetNode
    expect(lukasz.known).toBe('linkedin')
    expect(edgeBetween(net, 'me', lukasz.id, 'linkedin')).toBeTruthy()
    expect(edgeBetween(net, lukasz.id, minerva.id, 'works')?.label).toBe('Engineer')
    expect(net.nodes.filter((n) => n.label === 'Łukasz Kowalski')).toHaveLength(2)
    // no duplicate works edge if the expansion already provided one
    const zdajtoWorks = orgExpansion('ZdajTo!', [
      {
        name: 'Igor Ptak',
        role: '',
        relationship: 'participant',
        affiliation: 'ZdajTo!',
        start: null,
        end: null,
        source_url: '',
      },
    ])
    const ptakExpansion = personExpansion('Igor Ptak', [], [
      {
        kind: 'role',
        organization: 'Minerva',
        role: 'Engineer',
        start: '',
        end: '',
        source_url: '',
        certainty: 'fact',
      },
    ])
    const net2 = base({
      linkedin: [{ name: 'Igor Ptak', company: 'Minerva', position: 'Engineer', url: '' }],
      expansions: [gawelExpansion, zdajtoWorks, ptakExpansion],
    })
    const ptak = node(net2, 'p:igor ptak')
    const works = net2.edges.filter(
      (e) =>
        e.relation === 'works' &&
        ((e.source === ptak.id && e.target === minerva.id) ||
          (e.source === minerva.id && e.target === ptak.id)),
    )
    expect(works.length).toBeLessThanOrEqual(2)
  })

  it('links organizations located in the same city', () => {
    const zdajto = orgExpansion('ZdajTo!', [
      {
        name: 'Igor Ptak',
        role: '',
        relationship: 'participant',
        affiliation: 'ZdajTo!',
        start: null,
        end: null,
        source_url: '',
      },
    ])
    const ptakExpansion = personExpansion('Igor Ptak', [], [
      {
        kind: 'education',
        organization: 'VIII Liceum Ogólnokształcące w Poznaniu',
        role: '',
        start: '',
        end: '',
        source_url: '',
        certainty: 'fact',
      },
    ])
    const net = base({ expansions: [gawelExpansion, zdajto, ptakExpansion] })
    const lo4 = net.nodes.find((n) => n.label.includes('IV Liceum')) as NetNode
    const lo8 = net.nodes.find((n) => n.label.includes('VIII Liceum')) as NetNode
    const edge = edgeBetween(net, lo4.id, lo8.id, 'same-city')
    expect(edge?.certainty).toBe('inferred')
    expect(edge?.label).toBe('both in Poznaniu')
  })

  it('caps LinkedIn colleagues at 6 per org', () => {
    const linkedin: LinkedinConnection[] = Array.from({ length: 9 }, (_, i) => ({
      name: `Person Number${i}`,
      company: 'Minerva',
      position: 'Engineer',
      url: '',
    }))
    const net = base({ linkedin })
    expect(net.nodes.filter((n) => n.known === 'linkedin')).toHaveLength(6)
  })

  it('applies dossier facts to the partner node and coinvestor orgs', () => {
    const dossier: Dossier = {
      name: 'Patrik Backman',
      fund: 'Open Ocean',
      origin: 'cala',
      facts: [
        {
          kind: 'role',
          organization: 'Open Ocean',
          role: 'Managing Partner',
          start: null,
          end: null,
          source_url: 'https://openocean.vc',
        },
        {
          kind: 'coinvestor',
          organization: 'Keen Venture Partners',
          company: 'Minerva',
          person: 'Aleksander Dobosz',
          role: '',
          start: null,
          end: null,
          source_url: 'https://example.com/coinv',
        },
        {
          kind: 'program',
          organization: 'Forbes 30 under 30',
          role: '',
          start: '2020',
          end: null,
          source_url: 'https://example.com/forbes',
        },
        {
          kind: 'deal',
          organization: 'Nowhere',
          role: '',
          start: null,
          end: null,
          source_url: 'x',
        },
      ],
    }
    const net = base({ dossiers: [dossier] })
    const keen = net.nodes.find((n) => n.label === 'Keen Venture Partners') as NetNode
    const openOcean = net.nodes.find((n) => n.label === 'Open Ocean') as NetNode
    expect(keen.orgType).toBe('fund')
    const coinvested = edgeBetween(net, openOcean.id, keen.id, 'co-invested')
    expect(coinvested?.label).toBe('co-invested in Minerva')
    const dobosz = node(net, 'p:aleksander dobosz')
    expect(edgeBetween(net, dobosz.id, keen.id, 'member')).toBeTruthy()
    const forbes = net.nodes.find((n) => n.label === 'Forbes 30 under 30') as NetNode
    expect(forbes.orgType).toBe('event')
    const backman = node(net, 'p:patrik backman')
    expect(edgeBetween(net, backman.id, forbes.id, 'took-part')).toBeTruthy()
    // deal facts are skipped
    expect(net.nodes.every((n) => n.label !== 'Nowhere')).toBe(true)
  })
})

describe('paths', () => {
  it('finds the cheapest path, scores it and ranks targets', () => {
    const net = base()
    const paths = pathsFromMe(net)
    const gawelPath = paths.get('p:wiktor gawel')
    expect(gawelPath?.nodes).toEqual(['me', 'p:jan kowalski', 'o:minerva', 'p:wiktor gawel'])
    expect(gawelPath?.cost).toBeCloseTo(1 + 1.25 + 1)
    expect(scoreFromCost(3.25)).toBe(57)
    expect(scoreFromCost(1)).toBe(100)
    const ranked = rankTargets(net, paths)
    expect(ranked[0].node.target).toBe('founder')
    expect(ranked[0].node.company).toBe('Minerva')
    expect(ranked[0].path?.nodes).toContain('p:jan kowalski')
    expect(ranked.every((r) => r.node.target)).toBe(true)
    const ids = bestPathIds(ranked)
    expect(ids.nodes.has('me')).toBe(true)
    expect(ids.nodes.has('p:jan kowalski')).toBe(true)
    const slim = pathsOnly(net, ids)
    expect(slim.nodes.length).toBeLessThan(net.nodes.length)
    expect(slim.edges.length).toBeGreaterThan(0)
  })

  it('segments a path into person-to-person links through orgs', () => {
    const net = base()
    const paths = pathsFromMe(net)
    const links = pathLinks(net, paths.get('p:wiktor gawel')!)
    expect(links).toHaveLength(2)
    expect(links[0].kind).toBe('self')
    expect(links[0].to.label).toBe('Jan Kowalski')
    expect(links[1].kind).toBe('inferred')
    expect(links[1].via.map((n) => n.label)).toEqual(['Minerva'])
    expect(links[1].to.label).toBe('Wiktor Gaweł')
  })

  it('marks direct documented person links as documented', () => {
    const net = base()
    const paths = pathsFromMe(net)
    const path = paths.get('p:michal szudejko')!
    const links = pathLinks(net, path)
    const last = links[links.length - 1]
    expect(last.to.id).toBe('p:michal szudejko')
    // me→…→wiktor→szudejko: last edge is co-appearance with a public source
    expect(last.kind).toBe('documented')
  })

  it('marks a link ending at an organization as documented when sourced', () => {
    const net = base({
      profile: profile(),
      linkedin: [
        {
          name: 'Wiktor Gaweł',
          company: 'Minerva',
          position: 'CEO',
          url: 'https://linkedin.com/in/wiktor',
        },
      ],
    })
    const paths = pathsFromMe(net)
    const minerva = net.nodes.find((n) => n.kind === 'org' && n.label === 'Minerva')!
    const links = pathLinks(net, paths.get(minerva.id)!)
    const last = links[links.length - 1]
    expect(last.to.id).toBe(minerva.id)
    // me→wiktor→minerva: last edge is the sourced founder link
    expect(last.kind).toBe('documented')
    // A same-name LinkedIn match without the same profile is only a candidate.
    expect(links[0].kind).toBe('inferred')
  })
})

describe('crawlOrder and expansionRequest', () => {
  it('walks outward from me and from targets, deduplicated', () => {
    const net = base()
    const order = crawlOrder(net, new Set())
    expect(order[0]).toBe('me')
    expect(new Set(order).size).toBe(order.length)
    // targets get expanded from the target side
    expect(order).toContain('p:wiktor gawel')
    expect(order).toContain('p:patrik backman')
    // schools expand too — they are common ground
    const school = net.nodes.find((n) => n.kind === 'org' && n.orgType === 'school')!
    expect(order).toContain(school.id)
    const rest = crawlOrder(net, new Set(order))
    expect(rest).toHaveLength(0)
  })

  it('limits the walk by cost on both sides', () => {
    const net = base()
    const order = crawlOrder(net, new Set(), { maxCostMe: 0.5, maxCostTarget: 0.5 })
    expect(order).toEqual(expect.arrayContaining(['me', 'p:wiktor gawel', 'p:patrik backman']))
    expect(order).not.toContain('p:jan kowalski')
    expect(order).not.toContain('p:michal szudejko')
  })

  it('builds the expansion request per node kind', () => {
    const net = base()
    expect(expansionRequest(net, 'me')).toEqual({
      kind: 'person',
      name: 'Igor Komar',
      context: 'who has worked at ZdajTo! and studied at Politechnika Poznańska',
      background: true,
      focus: expect.arrayContaining(['ZdajTo!', 'Minerva']),
    })
    expect(expansionRequest(net, 'p:wiktor gawel')).toEqual({
      kind: 'person',
      name: 'Wiktor Gaweł',
      context: 'CEO & Co-founder of Minerva',
      background: true,
      focus: expect.arrayContaining(['Minerva']),
    })
    const backman = expansionRequest(net, 'p:patrik backman')
    expect(backman?.kind).toBe('person')
    expect(backman?.background).toBe(true)
    expect(backman?.context).toBe('Managing Partner at Open Ocean')
    const minerva = net.nodes.find((n) => n.label === 'Minerva')!
    expect(expansionRequest(net, minerva.id)).toEqual({
      kind: 'org',
      name: 'Minerva',
      context: 'a startup founded by Wiktor Gaweł and Piotr Gerke',
      background: false,
      focus: expect.arrayContaining(['Politechnika Poznańska', 'ZdajTo!']),
    })
    const openOcean = net.nodes.find((n) => n.label === 'Open Ocean')!
    expect(expansionRequest(net, openOcean.id)).toEqual({
      kind: 'org',
      name: 'Open Ocean',
      context: 'a venture capital fund',
      background: false,
      focus: expect.arrayContaining(['Minerva']),
    })
    const school = net.nodes.find((n) => n.orgType === 'school')!
    const schoolRequest = expansionRequest(net, school.id)
    expect(schoolRequest?.kind).toBe('org')
    expect(schoolRequest?.context).toBe('a university or school')
    // the query is scoped to orgs on the other side, not random alumni
    expect(schoolRequest?.focus).toContain('Minerva')
    expect(schoolRequest?.focus).not.toContain('Politechnika Poznańska')
  })

  it('mergeOrder puts ai-ranked ids first and keeps the crawl tail', () => {
    const order = mergeOrder(
      ['me', 'p:a', 'o:b', 'p:c'],
      ['o:b', 'p:c', 'missing'],
    )
    expect(order).toEqual(['o:b', 'p:c', 'me', 'p:a'])
    expect(mergeOrder(['me', 'p:a'], [])).toEqual(['me', 'p:a'])
  })

  it('describeCandidates lists each node with its linked labels', () => {
    const net = base()
    const candidates = describeCandidates(net, ['p:wiktor gawel', 'o:minerva'])
    const gawel = candidates.find((c) => c.id === 'p:wiktor gawel')
    expect(gawel?.kind).toBe('person')
    expect(gawel?.links).toContain('Minerva')
    const minerva = candidates.find((c) => c.id === 'o:minerva')
    expect(minerva?.kind).toBe('org')
    expect(minerva?.links).toContain('Wiktor Gaweł')
    // the me node is never a candidate
    expect(describeCandidates(net, ['me'])).toEqual([])
  })

  it('collects org labels adjacent to me and targets first', () => {
    const net = base()
    const known = knownOrganizations(net)
    expect(known).toContain('ZdajTo!')
    expect(known).toContain('Politechnika Poznańska')
    expect(known).toContain('Minerva')
    expect(known.length).toBeLessThanOrEqual(25)
    expect(new Set(known).size).toBe(known.length)
  })
})

describe('introAskFact', () => {
  it('opens on the first link and names the orgs between bridge and target', () => {
    const net = base()
    const paths = pathsFromMe(net)
    const gawel = node(net, 'p:wiktor gawel')
    const text = introAskFact(pathLinks(net, paths.get(gawel.id)!), gawel)
    expect(text).toBe(
      "I hope you're doing well. It looks like there may be a connection to Wiktor Gaweł through Minerva.",
    )
  })

  it('names the shared org when the first link is documented through an org', () => {
    const net = base({
      linkedin: [{ name: 'Piotr Gerke', company: 'Minerva', position: 'CTO', url: '' }],
    })
    const paths = pathsFromMe(net)
    const backman = node(net, 'p:patrik backman')
    const path = paths.get(backman.id)
    expect(path).toBeTruthy()
    const text = introAskFact(pathLinks(net, path!), backman)
    expect(text).toContain('there may be a connection to Patrik Backman')
  })
})

describe('mapSeed', () => {
  it('turns rounds into backed edges for leads and co-investors', () => {
    const seed = mapSeed({
      matches: [
        {
          company: 'Minerva',
          description: '',
          similarity_reason: '',
          source_url: '',
        },
      ],
      companies: [
        {
          company: 'Minerva',
          cached: true,
          rounds: [
            {
              round_type: 'Seed',
              announcement_date: '2025-03-01',
              lead_investors: 'Open Ocean',
              investors: 'Open Ocean, Keen Venture Partners',
              source_urls: 'https://example.com/seed',
              raised_amount: '€1M',
            },
          ],
        },
      ],
      founders: [],
      partners: [],
    })
    expect(seed.startups).toEqual(['Minerva'])
    expect(seed.investments).toEqual([
      {
        fund: 'Open Ocean',
        company: 'Minerva',
        label: 'Led Seed · 2025',
        source_url: 'https://example.com/seed',
      },
      {
        fund: 'Keen Venture Partners',
        company: 'Minerva',
        label: 'Seed · 2025',
        source_url: 'https://example.com/seed',
      },
    ])
  })

  it('does not construct an introduction through a phrase describing anonymous experts', () => {
    const seed = mapSeed({
      matches: [{
        company: 'Forgent AI', description: '', similarity_reason: '', source_url: '',
      }],
      companies: [{
        company: 'Forgent AI', cached: false,
        rounds: [{
          round_type: 'Pre-Seed',
          announcement_date: '2025',
          lead_investors: 'Cherry Ventures',
          investors: 'Cherry Ventures, Mehdi Ghissassi, and leading experts from OpenAI, Anthropic, and DeepMind',
          source_urls: 'https://example.com/announcement',
        }],
      }],
      founders: [{
        company: 'Forgent AI',
        founders: [{ name: 'Erik Heinelt', role: 'Co-founder', source_url: 'https://example.com/team' }],
      }],
      partners: [],
    })
    expect(seed.investments.map((investment) => investment.fund))
      .toEqual(['Cherry Ventures', 'Mehdi Ghissassi'])
    const network = base({
      map: seed,
      profile: profile(),
      expansions: [],
      linkedin: [{
        name: 'Tilman Resch', company: 'OpenAI', position: 'Member of GTM Staff', url: '',
      }],
    })
    expect(network.nodes.some((n) => /leading experts|^and DeepMind$|^Anthropic$/i.test(n.label)))
      .toBe(false)
    expect(pathsFromMe(network).has('p:erik heinelt')).toBe(false)
  })

  it('does not match OpenAI to an already-present descriptive pseudo-organization', () => {
    const seed: MapSeed = {
      startups: ['Forgent AI'],
      founders: [{
        company: 'Forgent AI',
        founders: [{ name: 'Erik Heinelt', role: 'Founder', source_url: 'https://example.com/team' }],
      }],
      investments: [{
        fund: 'and leading experts from OpenAI', company: 'Forgent AI',
        label: 'Pre-Seed · 2025', source_url: 'https://example.com/announcement',
      }],
      partners: [],
    }
    const network = base({
      map: seed,
      profile: profile(),
      expansions: [],
      linkedin: [{ name: 'Tilman Resch', company: 'OpenAI', position: 'Member of GTM Staff', url: '' }],
    })
    expect(pathsFromMe(network).has('p:erik heinelt')).toBe(false)
    expect(network.skipped).toContainEqual({ name: 'Tilman Resch', company: 'OpenAI' })
  })

  it('preserves a confirmed contact when the erroneous investor node disappears', () => {
    const me = profile()
    const previous: NetNode = {
      id: 'p:tilman resch', kind: 'person', label: 'Tilman Resch',
      sublabel: 'Member of GTM Staff · OpenAI',
    }
    me.contacts = [{
      name: 'Tilman Resch',
      organization: '',
      ref: { id: previous.id, identity: personIdentity(previous) },
    }]
    const network = base({ profile: me, linkedin: [], expansions: [] })
    const contact = node(network, previous.id)
    expect(contact.known).toBe('contact')
    expect(contact.contactRefId).toBe(previous.id)
    expect(edgeBetween(network, 'me', contact.id, 'knows')?.certainty).toBe('fact')
    expect(network.edges.some((edge) =>
      (edge.source === contact.id || edge.target === contact.id) && edge.relation === 'works',
    )).toBe(false)
  })
})

describe('personKey and introKey', () => {
  it('folds accents and titles', () => {
    expect(personKey('Wiktor Gaweł')).toBe('wiktor gawel')
    expect(personKey('dr Piotr Gerke')).toBe('piotr gerke')
    expect(introKey('Wiktor Gaweł', 'Open Ocean')).toBe('wiktor gaweł|open ocean')
  })
})

describe('namesake disambiguation', () => {
  const jans = (net: Network) =>
    net.nodes.filter((n) => n.kind === 'person' && n.label === 'Jan Kowalski')

  it('keeps same-name strangers in separate nodes', () => {
    const net = base({
      expansions: [
        personExpansion('Wiktor Gaweł', [
          {
            name: 'Jan Kowalski',
            relationship: 'colleague',
            via: 'Acme Robotics',
            via_type: 'company',
            role: 'Engineer',
            organization: 'Acme Robotics',
            context: '',
            source_url: 'https://example.com/jk',
            date: null,
          },
        ]),
      ],
    })
    expect(jans(net)).toHaveLength(2)
    const contact = jans(net).find((n) => n.known === 'contact') as NetNode
    const stranger = jans(net).find((n) => n.id !== contact.id) as NetNode
    const minerva = net.nodes.find((n) => n.kind === 'org' && n.label === 'Minerva') as NetNode
    const acme = net.nodes.find((n) => n.kind === 'org' && n.label === 'Acme Robotics') as NetNode
    expect(edgeBetween(net, contact.id, minerva.id, 'works')).toBeTruthy()
    expect(edgeBetween(net, stranger.id, acme.id, 'works')).toBeTruthy()
    expect(edgeBetween(net, 'me', stranger.id, 'knows')).toBeFalsy()
  })

  it('merges same-name people on shared organization evidence', () => {
    const net = base({
      expansions: [
        orgExpansion('Minerva', [
          {
            name: 'Jan Kowalski',
            role: 'Engineer',
            relationship: 'employee',
            affiliation: 'Minerva',
            start: null,
            end: null,
            source_url: 'https://example.com/jan',
          },
        ]),
      ],
    })
    expect(jans(net)).toHaveLength(1)
    const jan = jans(net)[0]
    expect(jan.known).toBe('contact')
    expect(jan.identityUncertain).toBe(true)
    const minerva = net.nodes.find((n) => n.kind === 'org' && n.label === 'Minerva') as NetNode
    expect(edgeBetween(net, jan.id, minerva.id, 'works')).toBeTruthy()
    expect(net.edges.find((edge) => edge.label === 'Engineer' && edge.target === minerva.id)?.certainty)
      .toBe('inferred')
  })

  it('splits a LinkedIn namesake whose employer conflicts', () => {
    const net = base({
      linkedin: [
        {
          name: 'Wiktor Gaweł',
          company: 'Open Ocean',
          position: 'Partner',
          url: '',
        },
      ],
    })
    const wiktors = net.nodes.filter(
      (n) => n.kind === 'person' && n.label === 'Wiktor Gaweł',
    )
    // founder Wiktor (founder→Minerva) does not merge with a Wiktor at Open Ocean
    expect(wiktors).toHaveLength(2)
    const founder = wiktors.find((n) => n.target === 'founder') as NetNode
    const contact = wiktors.find((n) => n.id !== founder.id) as NetNode
    expect(contact.known).toBe('linkedin')
    const ocean = net.nodes.find((n) => n.kind === 'org' && n.label === 'Open Ocean') as NetNode
    expect(edgeBetween(net, contact.id, ocean.id, 'works')).toBeTruthy()
    expect(edgeBetween(net, founder.id, ocean.id, 'works')).toBeFalsy()
  })

  it('keeps a LinkedIn contact separate from an unanchored namesake', () => {
    const net = base({
      expansions: [
        personExpansion('Wiktor Gaweł', [
          {
            name: 'Marek Nowak',
            relationship: 'co-appearance',
            via: 'OpenAI x START Hackathon',
            via_type: 'event',
            role: '',
            organization: '',
            context: '',
            source_url: 'https://example.com/hack',
            date: null,
          },
        ]),
      ],
      linkedin: [
        {
          name: 'Marek Nowak',
          company: 'Minerva',
          position: 'Engineer',
          url: 'https://linkedin.com/in/marek',
        },
      ],
    })
    const mareks = net.nodes.filter(
      (n) => n.kind === 'person' && n.label === 'Marek Nowak',
    )
    expect(mareks).toHaveLength(2)
    const contact = mareks.find((n) => n.known === 'linkedin')!
    const minerva = net.nodes.find((n) => n.kind === 'org' && n.label === 'Minerva') as NetNode
    expect(edgeBetween(net, contact.id, minerva.id, 'works')).toBeTruthy()
  })
})

describe('focused bridge search', () => {
  it('limits each side by hops and excludes unrelated targets and investments', () => {
    const nodes: NetNode[] = [
      { id: 'me', kind: 'me', label: 'Me' },
      ...['a', 'b', 'c', 'd'].map((id) => ({ id, kind: 'person' as const, label: id })),
      { id: 'target', kind: 'person', label: 'Target', target: 'founder' },
      { id: 'other', kind: 'person', label: 'Other', target: 'founder' },
      { id: 'org', kind: 'org', label: 'Target company', orgType: 'company' },
      { id: 'fund', kind: 'org', label: 'Other fund', orgType: 'fund' },
    ]
    const connect = (source: string, target: string, relation: Network['edges'][number]['relation'] = 'works') => ({
      id: `${source}-${target}`, source, target, relation, label: relation, cost: 1,
      certainty: 'fact' as const, source_url: 'https://example.com',
    })
    const network: Network = { nodes, edges: [
      connect('me', 'a'), connect('a', 'b'), connect('b', 'c'), connect('c', 'd'),
      connect('target', 'org', 'founder'), connect('org', 'other', 'founder'),
      connect('org', 'fund', 'backed'),
    ] }
    const depth3 = bridgeFrontier(network, 'target', new Set(), 3).map((c) => c.id)
    expect(depth3).toEqual(expect.arrayContaining(['me', 'target', 'a', 'b', 'org']))
    expect(depth3).not.toEqual(expect.arrayContaining(['c']))
    expect(depth3).not.toEqual(expect.arrayContaining(['other', 'fund']))
    const depth4 = bridgeFrontier(network, 'target', new Set(depth3), 4).map((c) => c.id)
    expect(depth4).toContain('c')
    expect(depth4).not.toContain('d')
  })

  it('provides the opposite endpoint and its nearby organizations to each root', () => {
    const net = base()
    const fromMe = bridgeFocus(net, 'me', 'p:wiktor gawel')
    expect(fromMe.counterpart.name).toBe('Wiktor Gaweł')
    expect(fromMe.focus).toContain('Minerva')
    expect(fromMe.focus).not.toContain('Open Ocean')
    const fromTarget = bridgeFocus(net, 'p:wiktor gawel', 'p:wiktor gawel')
    expect(fromTarget.counterpart.name).toBe('Igor Komar')
    expect(fromTarget.focus).toEqual(expect.arrayContaining(['ZdajTo!', 'Politechnika Poznańska']))
    expect(fromTarget.focus_people).toContain('Jan Kowalski')
  })

  it('does not stop on an inferred LinkedIn identity or a geographic guess', () => {
    const net = base()
    const path = pathsFromMe(net).get('p:wiktor gawel')!
    expect(actionableBridge(path)).toBe(true)
    expect(actionableBridge({
      ...path,
      edges: path.edges.map((edge, index) => index === 0 ? { ...edge, certainty: 'inferred' } : edge),
    })).toBe(false)
    expect(actionableBridge({
      ...path,
      edges: path.edges.map((edge, index) => index === 1 ? { ...edge, relation: 'same-city' } : edge),
    })).toBe(false)
  })

  it('binds an explicitly confirmed contact to the selected identity without inventing an employer', () => {
    const before = base({ profile: profile(), expansions: [] })
    const target = node(before, 'p:wiktor gawel')
    const me = profile()
    me.contacts = [{ name: target.label, organization: '', ref: { id: target.id, identity: personIdentity(target) } }]
    const after = base({ profile: me, expansions: [] })
    expect(edgeBetween(after, 'me', target.id, 'knows')?.certainty).toBe('fact')
    expect(after.edges.filter((edge) => edge.relation === 'works' &&
      (edge.source === target.id || edge.target === target.id))).toHaveLength(0)
    const wrong = { ...me, contacts: [{ ...me.contacts[0], ref: { id: target.id, identity: 'different' } }] }
    expect(edgeBetween(base({ profile: wrong, expansions: [] }), 'me', target.id, 'knows')).toBeFalsy()
  })

  it('keeps advisory roles and AI source certainty without claiming employment', () => {
    const expansion = personExpansion('Wiktor Gaweł', [], [{
      kind: 'advisor', organization: 'Acme', role: 'Advisor', start: null, end: null,
      source_url: 'https://example.com/advisory', origin: 'openai', certainty: 'inferred',
      sources: [{ url: 'https://example.com/advisory', origin: 'openai' }],
    }])
    const net = base({ expansions: [expansion] })
    const acme = net.nodes.find((n) => n.label === 'Acme')!
    const edge = edgeBetween(net, 'p:wiktor gawel', acme.id, 'advises')
    expect(edge?.certainty).toBe('inferred')
    expect(edge?.origin).toBe('openai')
    expect(edge?.sources?.[0].url).toBe('https://example.com/advisory')
    expect(edgeBetween(net, 'p:wiktor gawel', acme.id, 'works')).toBeFalsy()
  })
})

describe('manually added LinkedIn profiles', () => {
  const url = 'https://www.linkedin.com/in/wiktor-manual'

  it('adds a URL-only node without inventing a name, relationship or employer', () => {
    const me = { ...profile(), manual_people: [{ name: '', profile_url: url }] }
    const net = base({ profile: me, expansions: [] })
    const person = node(net, manualLinkedinNodeId(url))
    expect(person.label).toBe('LinkedIn: wiktor-manual')
    expect(person.manualNeedsName).toBe(true)
    expect(person.profileUrl).toBe(url)
    expect(net.edges.some((edge) => edge.source === person.id || edge.target === person.id)).toBe(false)
    expect(expansionRequest(net, person.id)).toBeNull()
  })

  it('keeps an unrelated namesake separate and makes a named target selectable', () => {
    const me = { ...profile(), manual_people: [{ name: 'Wiktor Gaweł', profile_url: url, target: true }] }
    const net = base({ profile: me, expansions: [] })
    const added = node(net, manualLinkedinNodeId(url))
    expect(added.target).toBe('person')
    expect(node(net, 'p:wiktor gawel').target).toBe('founder')
    expect(added.id).not.toBe('p:wiktor gawel')
    expect(edgeBetween(net, 'me', added.id)).toBeFalsy()
    expect(rankTargets(net, pathsFromMe(net)).some((entry) => entry.node.id === added.id)).toBe(true)
  })

  it('preserves an explicit confirmation when a URL-only entry is named', () => {
    const before = { ...profile(), manual_people: [{ name: '', profile_url: url }] }
    const initial = node(base({ profile: before, expansions: [] }), manualLinkedinNodeId(url))
    const after = {
      ...before,
      manual_people: [{ name: 'Wiktor Gaweł', profile_url: url }],
      contacts: [{
        name: initial.label,
        organization: '',
        ref: { id: initial.id, identity: personIdentity(initial), profile_key: linkedinProfileKey(url) },
      }],
    }
    const net = base({ profile: after, expansions: [] })
    const added = node(net, initial.id)
    expect(added.label).toBe('Wiktor Gaweł')
    expect(edgeBetween(net, 'me', added.id, 'knows')?.certainty).toBe('fact')
    expect(edgeBetween(net, 'me', 'p:wiktor gawel', 'knows')).toBeFalsy()
  })

  it('matches an imported contact by the exact URL even when names differ', () => {
    const me = { ...profile(), manual_people: [{ name: 'Wiktor Gaweł', profile_url: url }] }
    const net = base({
      profile: me,
      expansions: [],
      linkedin: [{ name: 'Wiktor Gawel', company: '', position: '', url }],
    })
    const matches = net.nodes.filter((entry) => entry.profileUrl === url)
    expect(matches).toHaveLength(1)
    expect(edgeBetween(net, 'me', matches[0].id, 'linkedin')?.certainty).toBe('fact')
  })

  it('adds sourced research to the manually selected profile without creating a known relationship', () => {
    const me = { ...profile(), manual_people: [{ name: 'Taylor Voss', profile_url: url }] }
    const initial = node(base({ profile: me, expansions: [] }), manualLinkedinNodeId(url))
    const result = personExpansion('Taylor Voss', [], [{
      kind: 'role', organization: 'Common Studio', role: 'Engineer', start: '2020', end: '2022',
      source_url: 'https://example.com/team', origin: 'openai', certainty: 'inferred',
    }])
    const net = base({
      profile: me,
      expansions: [{ ...result, id: initial.id, identity: expansionIdentity(initial) }],
    })
    const company = net.nodes.find((entry) => entry.label === 'Common Studio')!
    const edge = edgeBetween(net, initial.id, company.id, 'works')
    expect(edge?.certainty).toBe('inferred')
    expect(edge?.source_url).toBe('https://example.com/team')
    expect(edgeBetween(net, 'me', initial.id)).toBeFalsy()
  })
})
