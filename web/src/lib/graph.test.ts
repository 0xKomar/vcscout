import { describe, expect, it } from 'vitest'
import { buildExplorerGraph, personAffiliation, type ExplorerGraphInput } from '@/lib/graph'
import { preparePaths } from '@/lib/paths'
import type { CompanyRounds, IdeaQuery, Partner, SimilarMatch } from '@/lib/types'

const query: IdeaQuery = {
  idea: 'Marketplace for vintage cars',
  startupName: 'MotoSpot',
  stage: 'seed',
  region: 'Europe',
  target: '500k',
}

const MATCHES: SimilarMatch[] = [
  {
    company: 'CarMarket',
    description: 'Marketplace for used cars',
    similarity_reason: 'Same model',
    source_url: 'https://example.com/carmarket',
  },
  {
    company: 'BikeDeal',
    description: 'Marketplace for bikes',
    similarity_reason: 'Adjacent',
    source_url: 'https://example.com/bikedeal',
  },
]

const CAR_ROUNDS: CompanyRounds = {
  company: 'CarMarket',
  cached: false,
  rounds: [
    {
      round_type: 'Seed',
      announcement_date: '2020-03-01',
      lead_investors: 'Alpha Ventures',
      source_urls: 'https://example.com/seed',
    },
    {
      round_type: 'Series A',
      announcement_date: '2022-06-15',
      lead_investors: 'Beta Capital; Alpha Ventures',
      source_urls: 'https://example.com/a',
    },
    {
      round_type: '',
      announcement_date: '',
      lead_investors: 'Ghost Fund',
    },
  ],
}

const BIKE_ROUNDS: CompanyRounds = {
  company: 'BikeDeal',
  cached: false,
  rounds: [
    {
      round_type: 'Seed',
      announcement_date: '2021-01-10',
      lead_investors: 'Beta Capital',
      source_urls: 'https://example.com/seed2',
    },
  ],
}

const BASE = preparePaths([CAR_ROUNDS, BIKE_ROUNDS], 0)

function input(overrides: Partial<ExplorerGraphInput> = {}): ExplorerGraphInput {
  return {
    query,
    matches: MATCHES,
    roundsByCompany: {
      carmarket: CAR_ROUNDS,
      bikedeal: BIKE_ROUNDS,
    },
    base: BASE,
    riskFunds: new Set<string>(),
    partners: [],
    portfolios: [],
    personInvestments: [],
    explored: [],
    ...overrides,
  }
}

const person: Partner = {
  name: 'Jan Kowalski',
  role: 'Partner',
  connection: 'led the investment',
  source_url: 'https://example.com/jan',
}

describe('buildExplorerGraph', () => {
  it('builds idea, similar startups, funds and dedupes ids', () => {
    const graph = buildExplorerGraph(input())
    const ids = graph.nodes.map((node) => node.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(graph.nodes.find((n) => n.id === 'idea')?.label).toBe('MotoSpot')
    expect(graph.nodes.find((n) => n.id === 's:carmarket')?.similar).toBe(true)
    const fundIds = graph.nodes.filter((n) => n.kind === 'fund').map((n) => n.id)
    expect(fundIds).toContain('f:alpha ventures')
    expect(fundIds).toContain('f:beta capital')
    expect(graph.edges.filter((e) => e.kind === 'similar')).toHaveLength(2)
    // the invalid round (no type/date) adds no edge
    expect(graph.edges.filter((e) => e.label.includes('Ghost'))).toHaveLength(0)
  })

  it('marks route funds and route round edges from the base path graph', () => {
    const graph = buildExplorerGraph(input())
    const alpha = graph.nodes.find((n) => n.id === 'f:alpha ventures')
    expect(alpha?.route).toBe(1)
    const seedEdge = graph.edges.find(
      (e) => e.source === 'f:alpha ventures' && e.target === 's:carmarket',
    )
    expect(seedEdge?.route).toBe(true)
    const bikeEdge = graph.edges.find(
      (e) => e.source === 'f:beta capital' && e.target === 's:bikedeal',
    )
    expect(bikeEdge?.route).toBe(true)
    const ideaEdge = graph.edges.find((e) => e.source === 'idea' && e.target === 's:carmarket')
    expect(ideaEdge?.route).toBe(true)
  })

  it('merges fund name variants with sameFund and flags risk funds', () => {
    const graph = buildExplorerGraph(
      input({
        riskFunds: new Set(['beta capital']),
        partners: [
          {
            company: 'CarMarket',
            fund: 'Beta Capital Partners',
            data: { partners: [person] },
          },
        ],
      }),
    )
    // "Beta Capital Partners" merges into f:beta capital
    const funds = graph.nodes.filter((n) => n.kind === 'fund' && n.label.includes('Beta'))
    expect(funds).toHaveLength(1)
    expect(funds[0].flagged).toBe(true)
    expect(
      graph.edges.some((e) => e.kind === 'person-fund' && e.target === funds[0].id),
    ).toBe(true)
  })

  it('adds person nodes and person edges from resolved partners', () => {
    const graph = buildExplorerGraph(
      input({
        partners: [{ company: 'CarMarket', fund: 'Alpha Ventures', data: { partners: [person] } }],
      }),
    )
    const node = graph.nodes.find((n) => n.id === 'p:jan kowalski')
    expect(node?.kind).toBe('person')
    expect(node?.sublabel).toBe('Partner')
    expect(
      graph.edges.some(
        (e) => e.kind === 'person-fund' && e.source === node?.id && e.target === 'f:alpha ventures',
      ),
    ).toBe(true)
    expect(
      graph.edges.some(
        (e) => e.kind === 'person-startup' && e.source === node?.id && e.target === 's:carmarket',
      ),
    ).toBe(true)
  })

  it('adds founders as people linked to their similar startup', () => {
    const graph = buildExplorerGraph(
      input({
        founders: [
          {
            company: 'carmarket',
            founders: [
              { name: 'Ada Nowak', role: 'Co-founder & CEO', source_url: 'https://example.com/ada' },
              { name: 'Olek Lis', role: '', source_url: 'https://example.com/olek' },
            ],
          },
          { company: 'Unknown Co', founders: [{ name: 'No One', role: 'CEO', source_url: 'https://example.com/x' }] },
        ],
      }),
    )
    const ada = graph.nodes.find((n) => n.id === 'p:ada nowak')
    expect(ada).toMatchObject({
      kind: 'person',
      founder: true,
      sublabel: 'Co-founder & CEO',
      personCompany: 'CarMarket',
    })
    expect(ada?.person?.connection).toBe('Founder of CarMarket')
    expect(personAffiliation(ada!)).toEqual({ organization: 'CarMarket', kind: 'startup' })
    expect(graph.nodes.find((n) => n.id === 'p:olek lis')?.sublabel).toBe('Founder')
    expect(
      graph.edges.filter((e) => e.kind === 'founder' && e.target === 's:carmarket'),
    ).toHaveLength(2)
    expect(graph.nodes.some((n) => n.id === 'p:no one')).toBe(false)
  })

  it('creates a missing partner company as an explored startup', () => {
    const graph = buildExplorerGraph(
      input({
        partners: [{ company: 'NewCo', fund: 'Alpha Ventures', data: { partners: [person] } }],
      }),
    )
    expect(graph.nodes.find((n) => n.id === 's:newco')?.explored).toBe(true)
  })

  it('does not mark existing partner-linked similar startups as explored', () => {
    const graph = buildExplorerGraph(
      input({
        partners: [{ company: 'CarMarket', fund: 'Alpha Ventures', data: { partners: [person] } }],
      }),
    )
    expect(graph.nodes.find((n) => n.id === 's:carmarket')?.explored).toBeUndefined()
  })

  it('expands fund portfolios into explored startups and next-fund edges', () => {
    const portfolioCompany: CompanyRounds = {
      company: 'PortCo',
      cached: false,
      rounds: [
        {
          round_type: 'Seed',
          announcement_date: '2019-05-01',
          lead_investors: 'Alpha Ventures',
          source_urls: 'https://example.com/portseed',
        },
        {
          round_type: 'Series A',
          announcement_date: '2021-05-01',
          lead_investors: 'Gamma Fund',
          source_urls: 'https://example.com/gamma',
        },
      ],
    }
    const graph = buildExplorerGraph(
      input({
        portfolios: [{ fund: 'Alpha Ventures', companies: [portfolioCompany], startLevel: 0 }],
      }),
    )
    expect(graph.nodes.find((n) => n.id === 's:portco')?.explored).toBe(true)
    expect(graph.nodes.find((n) => n.id === 'f:gamma fund')?.explored).toBe(true)
    expect(
      graph.edges.some(
        (e) => e.kind === 'round' && e.source === 'f:gamma fund' && e.target === 's:portco',
      ),
    ).toBe(true)
  })

  it('expands person investments into startups, person and fund edges', () => {
    const graph = buildExplorerGraph(
      input({
        partners: [{ company: 'CarMarket', fund: 'Alpha Ventures', data: { partners: [person] } }],
        personInvestments: [
          {
            person,
            fund: 'Alpha Ventures',
            investments: [
              {
                company: 'InvCo',
                round_type: 'Seed',
                announcement_date: '2023-02-10',
                person_role: 'led the investment',
                source_url: 'https://example.com/invco',
              },
            ],
          },
        ],
      }),
    )
    expect(graph.nodes.find((n) => n.id === 's:invco')?.explored).toBe(true)
    expect(
      graph.edges.some(
        (e) =>
          e.kind === 'person-startup' && e.source === 'p:jan kowalski' && e.target === 's:invco',
      ),
    ).toBe(true)
    expect(
      graph.edges.some(
        (e) =>
          e.kind === 'round' && e.source === 'f:alpha ventures' && e.target === 's:invco',
      ),
    ).toBe(true)
  })

  it('expands explored startups into their round edges', () => {
    const graph = buildExplorerGraph(
      input({
        explored: [
          {
            company: 'DeepCo',
            cached: false,
            rounds: [
              {
                round_type: 'Seed',
                announcement_date: '2020-01-01',
                lead_investors: 'Delta VC',
                source_urls: 'https://example.com/delta',
              },
            ],
          },
        ],
      }),
    )
    expect(graph.nodes.find((n) => n.id === 's:deepco')?.explored).toBe(true)
    expect(
      graph.edges.some((e) => e.source === 'f:delta vc' && e.target === 's:deepco'),
    ).toBe(true)
  })

  it('dedupes edges and upgrades route flags', () => {
    const graph = buildExplorerGraph(
      input({
        portfolios: [
          { fund: 'Alpha Ventures', companies: [CAR_ROUNDS], startLevel: 0 },
        ],
      }),
    )
    const keys = graph.edges.map((e) => `${e.source}|${e.target}|${e.kind}|${e.label}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('is deterministic', () => {
    const a = buildExplorerGraph(input())
    const b = buildExplorerGraph(input())
    expect(a).toEqual(b)
  })
})
