import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/paths-parity.json'
import {
  dateParts,
  extendGraph,
  fundPortfolioPaths,
  leadNames,
  peoplePairs,
  preparePaths,
  roundLevel,
  sameFund,
  sourceUrls,
  strictlyLater,
  type PathGraph,
} from './paths'
import type { CompanyRounds, Round } from './types'

interface FixtureCase {
  name: string
  stage: 'seed' | 'series-a'
  examples: CompanyRounds[]
  expected: { early: { name: string; evidence: unknown[] }[]; later: { name: string; evidence: unknown[] }[]; edges: unknown[] }
}

function strip(graph: PathGraph) {
  const node = ({ name, evidence }: { key: string; name: string; evidence: unknown[] }) => ({
    name,
    evidence,
  })
  return {
    early: graph.early.map(node),
    later: graph.later.map(node),
    edges: graph.edges,
  }
}

describe('preparePaths parity with the legacy paths.js output', () => {
  for (const item of (fixture as { cases: FixtureCase[] }).cases) {
    it(item.name, () => {
      const graph = preparePaths(item.examples, item.stage === 'series-a' ? 1 : 0)
      expect(strip(graph)).toEqual(item.expected)
    })
  }
})

describe('roundLevel', () => {
  it.each([
    ['Seed', 0],
    ['Pre-Seed', 0],
    ['Pre-Seed / Seed', 0],
    ['seed round', 0],
    ['Series A', 1],
    ['Series B', 2],
    ['series c', 3],
    ['Venture Round', null],
    ['', null],
    [null, null],
  ])('%s → %s', (value, expected) => {
    expect(roundLevel(value)).toBe(expected)
  })
})

describe('dateParts', () => {
  it.each([
    ['2023-03-15', { year: 2023, month: 3 }],
    ['March 2024', { year: 2024, month: 3 }],
    ['~September/October 2021', { year: 2021, month: 9 }],
    ['2021', { year: 2021, month: null }],
    ['24 November 2021', { year: 2021, month: 11 }],
    ['TBD', null],
    [null, null],
  ])('%s → %j', (value, expected) => {
    expect(dateParts(value)).toEqual(expected)
  })
})

describe('strictlyLater', () => {
  it.each([
    ['2023-03-15', 'March 2024', true],
    ['2021', '2022', true],
    ['2021', '2021', false],
    ['January 2022', 'March 2022', true],
    ['March 2022', 'January 2022', false],
    ['2021', 'March 2021', false],
    ['TBD', '2022', false],
  ])('%s vs %s → %s', (first, second, expected) => {
    expect(strictlyLater(first, second)).toBe(expected)
  })
})

describe('leadNames', () => {
  it('splits on commas and semicolons and trims', () => {
    expect(leadNames('  Accel, Index Ventures ; Benchmark ')).toEqual([
      'Accel',
      'Index Ventures',
      'Benchmark',
    ])
  })
  it('drops placeholders and anonymous leads', () => {
    expect(leadNames('Undisclosed, angel investors, N/A, Unknown, null, Accel')).toEqual(['Accel'])
  })
  it('handles arrays and null', () => {
    expect(leadNames(['Sequoia Capital', 'Undisclosed'])).toEqual(['Sequoia Capital'])
    expect(leadNames(null)).toEqual([])
  })
  it('does not turn a collective of experts or their employers into investors', () => {
    const names =
      'Cherry Ventures, Mehdi Ghissassi, and leading experts from OpenAI, Anthropic, and DeepMind'
    expect(leadNames(names)).toEqual(['Cherry Ventures', 'Mehdi Ghissassi'])
    expect(leadNames([
      'Cherry Ventures',
      'and leading experts from OpenAI',
      'Anthropic',
      'and DeepMind',
    ])).toEqual(['Cherry Ventures'])
    expect(leadNames('Accel; employees at OpenAI; Anthropic; Index Ventures')).toEqual(['Accel'])
  })
  it('does not interpret anonymous groups or conjunction fragments as named investors', () => {
    expect(leadNames('Accel, several individual investors, and DeepMind')).toEqual(['Accel'])
    expect(leadNames('Accel, OpenAI staff, Anthropic')).toEqual(['Accel'])
  })
})

describe('sourceUrls', () => {
  it('extracts http(s) urls from a mixed string', () => {
    expect(sourceUrls('https://a.example/x ; https://b.example/y, not-a-url')).toEqual([
      'https://a.example/x',
      'https://b.example/y',
    ])
  })
  it('handles arrays and empty values', () => {
    expect(sourceUrls(['https://a.example'])).toEqual(['https://a.example'])
    expect(sourceUrls(null)).toEqual([])
  })
})

describe('sameFund', () => {
  it.each([
    ['Point Nine', 'Point Nine', true],
    ['Point Nine', 'Point Nine Capital', true],
    ['Point Nine Capital', 'Point Nine', true],
    ['GV', 'GV (Google Ventures)', true],
    ['gv (google ventures)', 'GV', true],
    ['Accel', 'Accel Partners', true],
    ['Accel', 'Sequoia', false],
    ['Point Nine', 'Nine Points', false],
    ['Plum', 'Plum Ventures', true],
  ])('%s vs %s → %s', (a, b, expected) => {
    expect(sameFund(a, b)).toBe(expected)
  })
})

const round = (over: Partial<Round>): Round => ({
  company: 'X',
  source_urls: 'https://example.com/r',
  lead_investors: 'Lead',
  ...over,
})

describe('fundPortfolioPaths', () => {
  const examples: CompanyRounds[] = [
    {
      company: 'Alpha',
      rounds: [
        round({ company: 'Alpha', round_type: 'Seed', announcement_date: 'March 2020', lead_investors: 'Point Nine Capital' }),
        round({ company: 'Alpha', round_type: 'Series A', announcement_date: 'June 2021', lead_investors: 'Plural' }),
        round({ company: 'Alpha', round_type: 'Series B', announcement_date: 'May 2023', lead_investors: 'Accel' }),
      ],
      cached: false,
    },
    {
      company: 'Beta',
      rounds: [
        round({ company: 'Beta', round_type: 'Seed', announcement_date: 'January 2019', lead_investors: 'Sequoia' }),
      ],
      cached: false,
    },
    {
      company: 'Gamma',
      rounds: [
        round({ company: 'Gamma', round_type: 'Seed', announcement_date: 'April 2020', lead_investors: 'Point Nine' }),
      ],
      cached: false,
    },
    {
      company: 'NoSource',
      rounds: [
        round({ company: 'NoSource', round_type: 'Seed', announcement_date: 'April 2020', lead_investors: 'Point Nine', source_urls: '' }),
      ],
      cached: false,
    },
  ]

  it('picks the fund stage round (name-variant match) and the right next round', () => {
    const paths = fundPortfolioPaths('Point Nine', examples, 0)
    expect(paths.map((p) => p.company)).toEqual(['Alpha', 'Gamma'])
    expect(paths[0].next && paths[0].next.round_type).toBe('Series A')
    expect(paths[1].next).toBeNull()
  })

  it('skips companies where the fund is not a stage lead', () => {
    const paths = fundPortfolioPaths('Point Nine', examples, 0)
    expect(paths.some((p) => p.company === 'Beta')).toBe(false)
  })

  it('ignores rounds without sources', () => {
    const paths = fundPortfolioPaths('Point Nine', examples, 0)
    expect(paths.some((p) => p.company === 'NoSource')).toBe(false)
  })

  it('returns empty when the fund never led the stage', () => {
    expect(fundPortfolioPaths('Benchmark', examples, 0)).toEqual([])
  })
})

describe('extendGraph', () => {
  const seedRound = (company: string, date = 'March 2020', lead = 'Vertex Ventures US'): Round =>
    round({ company, round_type: 'Seed', announcement_date: date, lead_investors: lead })
  const aRound = (company: string, lead: string, date = 'June 2021'): Round =>
    round({ company, round_type: 'Series A', announcement_date: date, lead_investors: lead })

  const examples: CompanyRounds[] = [
    {
      company: 'Metaview',
      rounds: [
        seedRound('Metaview', 'December 2021'),
        aRound('Metaview', 'Plural', 'March 2024'),
      ],
      cached: true,
    },
  ]
  const base = preparePaths(examples, 0)
  const early = base.early[0]
  const paths = fundPortfolioPaths(
    'Vertex Ventures US',
    [
      {
        company: 'Talkdesk',
        rounds: [seedRound('Talkdesk', 'October 2015'), aRound('Talkdesk', 'Plural', 'June 2016')],
        cached: false,
      },
      {
        company: 'LaunchNotes',
        rounds: [seedRound('LaunchNotes', 'March 2018'), aRound('LaunchNotes', 'Northzone', 'November 2019')],
        cached: false,
      },
      {
        company: 'SelfEdge',
        rounds: [seedRound('SelfEdge', 'May 2017'), aRound('SelfEdge', 'Vertex Ventures US', 'July 2018')],
        cached: false,
      },
    ],
    0,
  )

  it('adds a new later node and a portfolio-only edge', () => {
    const graph = extendGraph(base, [{ fund: 'Vertex Ventures US', paths }])
    const northzone = graph.later.find((n) => n.name === 'Northzone')
    expect(northzone).toBeTruthy()
    expect(northzone?.evidence).toEqual([])
    expect(northzone?.portfolio?.map((e) => e.company)).toEqual(['LaunchNotes'])
    const edge = graph.edges.find((e) => e.to === northzone?.key)
    expect(edge?.evidence).toEqual([])
    expect(edge?.portfolio?.map((e) => e.company)).toEqual(['LaunchNotes'])
    expect(graph.early).toEqual(base.early)
  })

  it('merges portfolio evidence into an existing later node and edge', () => {
    const graph = extendGraph(base, [{ fund: 'Vertex Ventures US', paths }])
    const plural = graph.later.find((n) => n.name === 'Plural')
    expect(plural?.evidence.map((e) => e.company)).toEqual(['Metaview'])
    expect(plural?.portfolio?.map((e) => e.company)).toEqual(['Talkdesk'])
    const edge = graph.edges.find((e) => e.from === early.key && e.to === plural?.key)
    expect(edge?.evidence.map((e) => e.company)).toEqual(['Metaview'])
    expect(edge?.portfolio?.map((e) => e.company)).toEqual(['Talkdesk'])
  })

  it('does not create self-edges', () => {
    const graph = extendGraph(base, [{ fund: 'Vertex Ventures US', paths }])
    expect(graph.edges.every((e) => e.from !== e.to)).toBe(true)
    expect(graph.later.some((n) => sameFund(n.name, early.name))).toBe(false)
  })

  it('does not add early nodes and ignores funds outside the base graph', () => {
    const graph = extendGraph(base, [
      { fund: 'Unknown Fund', paths },
      { fund: 'Vertex Ventures US', paths },
    ])
    expect(graph.early).toEqual(base.early)
  })

  it('leaves the base graph untouched', () => {
    const snapshot = structuredClone(base)
    extendGraph(base, [{ fund: 'Vertex Ventures US', paths }])
    expect(base).toEqual(snapshot)
  })
})

describe('peoplePairs', () => {
  const graph: PathGraph = {
    early: [
      {
        key: 'vertex ventures us',
        name: 'Vertex Ventures US',
        evidence: [{ company: 'Metaview', round: round({}) }],
      },
      {
        key: 'fly ventures',
        name: 'Fly Ventures',
        evidence: [{ company: 'Metaview', round: round({}) }],
      },
    ],
    later: [
      {
        key: 'plural',
        name: 'Plural',
        evidence: [{ company: 'Metaview', round: round({}) }],
      },
      { key: 'ghost', name: 'Ghost Fund', evidence: [] },
      {
        key: 'northzone',
        name: 'Northzone',
        evidence: [],
        portfolio: [
          {
            company: 'LaunchNotes',
            fund: 'Vertex Ventures US',
            early: round({}),
            later: round({}),
          },
        ],
      },
    ],
    edges: [],
  }

  it('returns early-then-later pairs with the node company', () => {
    expect(peoplePairs(graph)).toEqual([
      { fund: 'Vertex Ventures US', company: 'Metaview' },
      { fund: 'Fly Ventures', company: 'Metaview' },
      { fund: 'Plural', company: 'Metaview' },
      { fund: 'Northzone', company: 'LaunchNotes' },
    ])
  })

  it('dedupes case-insensitively and skips empty companies', () => {
    const dup: PathGraph = {
      early: [
        { key: 'a', name: 'A', evidence: [{ company: 'X', round: round({}) }] },
        { key: 'a2', name: 'A', evidence: [{ company: 'x', round: round({}) }] },
      ],
      later: [{ key: 'b', name: 'B', evidence: [] }],
      edges: [],
    }
    expect(peoplePairs(dup)).toEqual([{ fund: 'A', company: 'X' }])
    expect(graph.later.find((n) => n.name === 'Ghost Fund')).toBeTruthy()
    expect(peoplePairs(graph).some((p) => p.fund === 'Ghost Fund')).toBe(false)
  })

  it('caps at the limit', () => {
    const big: PathGraph = {
      early: Array.from({ length: 10 }, (_, i) => ({
        key: `e${i}`,
        name: `E${i}`,
        evidence: [{ company: `C${i}`, round: round({}) }],
      })),
      later: Array.from({ length: 10 }, (_, i) => ({
        key: `l${i}`,
        name: `L${i}`,
        evidence: [{ company: `D${i}`, round: round({}) }],
      })),
      edges: [],
    }
    expect(peoplePairs(big)).toHaveLength(16)
    expect(peoplePairs(big, 3)).toEqual([
      { fund: 'E0', company: 'C0' },
      { fund: 'E1', company: 'C1' },
      { fund: 'E2', company: 'C2' },
    ])
  })
})
