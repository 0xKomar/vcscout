import { describe, expect, it } from 'vitest'
import {
  SELF_REPORTED,
  evidenceText,
  factKey,
  factYears,
  fallbackReason,
  foldText,
  introTargets,
  mergeMeFacts,
  orgKey,
  overlapYears,
  sameOrg,
  selfFacts,
  yearsOverlap,
} from './intro'
import type { Fact, Partner } from './types'

const fact = (partial: Partial<Fact> & Pick<Fact, 'kind' | 'organization'>): Fact => ({
  role: '',
  start: null,
  end: null,
  source_url: 'https://example.com',
  ...partial,
})

const partner = (name: string, role = 'Partner'): Partner => ({
  name,
  role,
  connection: 'Linked',
  source_url: 'https://example.com',
})

describe('foldText', () => {
  it('strips diacritics and maps letters NFKD misses', () => {
    expect(foldText('Gaweł')).toBe('Gawel')
    expect(foldText('Żabka')).toBe('Zabka')
    expect(foldText('Łódź Øresund')).toBe('Lodz Oresund')
    expect(foldText('École Œdipe Æon Straße')).toBe('Ecole OEdipe AEon Strasse')
  })
})

describe('orgKey', () => {
  it('strips legal suffixes and punctuation', () => {
    expect(orgKey('Bigpoint GmbH')).toBe('bigpoint')
    expect(orgKey('TA ASSOCIATES, L.P.')).toBe('ta associates')
    expect(orgKey('Uber Technologies, Inc.')).toBe('uber')
    expect(orgKey('Metaview Technologies Inc.')).toBe('metaview')
    expect(orgKey('Point Nine Management GmbH')).toBe('point nine')
    expect(orgKey('Klarna AB')).toBe('klarna')
    expect(orgKey('Banco Santander S.A.')).toBe('banco santander')
    expect(orgKey('Allegro sp. z o.o.')).toBe('allegro')
    expect(orgKey('McKinsey & Company')).toBe('mckinsey')
    expect(orgKey('École Polytechnique')).toBe('ecole polytechnique')
    expect(orgKey('Anthropic, PBC')).toBe('anthropic')
    expect(orgKey('Maersk A/S')).toBe('maersk')
    expect(orgKey('Żabka sp. z o.o.')).toBe('zabka')
  })
  it('normalizes university word order', () => {
    expect(orgKey('University of Oxford')).toBe('oxford university')
    expect(orgKey('University of Oxford')).toBe(orgKey('Oxford University'))
  })
})

describe('sameOrg', () => {
  it('matches exact, loose or not at all', () => {
    expect(sameOrg('Bigpoint', 'Bigpoint GmbH')).toBe('exact')
    expect(sameOrg('Plural', 'Plural France')).toBe('loose')
    expect(sameOrg('Opsware', 'Loudcloud (Opsware)')).toBe('exact')
    expect(sameOrg('Meta', 'Metaview')).toBeNull()
    expect(sameOrg('Bain & Company', 'Bain Capital')).toBe('loose')
    expect(sameOrg('DataCrunch', 'Verda (formerly DataCrunch)')).toBe('exact')
    expect(sameOrg('BCG', 'Boston Consulting Group (BCG)')).toBe('exact')
    expect(sameOrg('Paris Dauphine', 'École Centrale (Paris)')).toBeNull()
    expect(sameOrg('', '')).toBeNull()
  })

  it('does not match a name contained inside a descriptive phrase', () => {
    expect(sameOrg('and leading experts from OpenAI', 'OpenAI')).toBeNull()
    expect(sameOrg('researchers at OpenAI', 'OpenAI')).toBeNull()
    expect(sameOrg('useMinerva', 'Minerva')).toBe('loose')
  })
})

describe('yearsOverlap', () => {
  it('detects documented overlaps', () => {
    expect(
      yearsOverlap({ start: '2014', end: '2016' }, { start: '2013-03', end: '2017-03' }, 2026),
    ).toEqual({ status: 'overlap', from: 2014, to: 2016, assumed: false, open: false })
    expect(
      yearsOverlap({ start: '2012', end: '2013-02' }, { start: '2013-03', end: '2017-03' }, 2026),
    ).toEqual({ status: 'none' })
    expect(yearsOverlap({ start: '2010', end: '2013' }, { start: null, end: '2012' }, 2026)).toEqual({
      status: 'overlap',
      from: 2012,
      to: 2012,
      assumed: false,
      open: false,
    })
    expect(yearsOverlap({ start: '2008', end: '2010' }, { start: null, end: '2012' }, 2026)).toEqual({
      status: 'none',
    })
  })
  it('flags assumed and open ends', () => {
    expect(
      yearsOverlap({ start: '2023', end: 'present' }, { start: '2021', end: null }, 2026),
    ).toEqual({ status: 'overlap', from: 2023, to: 2026, assumed: true, open: true })
    expect(yearsOverlap({ start: '2021', end: '2022' }, { start: '2021', end: null }, 2026)).toEqual({
      status: 'overlap',
      from: 2021,
      to: 2022,
      assumed: false,
      open: false,
    })
    expect(yearsOverlap({ start: '2019', end: '2020' }, { start: '2021', end: null }, 2026)).toEqual({
      status: 'none',
    })
    expect(
      yearsOverlap({ start: null, end: null }, { start: '2010', end: '2012' }, 2026),
    ).toEqual({ status: 'unknown' })
  })
})

describe('overlapYears', () => {
  it('formats ranges, single years and open overlaps', () => {
    expect(
      overlapYears({ status: 'overlap', from: 2014, to: 2016, assumed: false, open: false }),
    ).toBe('2014–2016')
    expect(
      overlapYears({ status: 'overlap', from: 2012, to: 2012, assumed: false, open: false }),
    ).toBe('2012')
    expect(
      overlapYears({ status: 'overlap', from: 2023, to: 2026, assumed: true, open: true }),
    ).toBe('since 2023')
  })
})

describe('selfFacts', () => {
  it('skips blank rows and only marks present when a start is given', () => {
    const facts = selfFacts({
      employers: [
        { organization: 'Uber', start: '2014', end: '2018' },
        { organization: '  ', start: '2010', end: '2011' },
        { organization: 'Metaview', start: '', end: '' },
      ],
      schools: ['Aalborg University', ' '],
    })
    expect(facts).toEqual([
      {
        kind: 'role',
        organization: 'Uber',
        role: '',
        start: '2014',
        end: '2018',
        source_url: SELF_REPORTED,
        certainty: 'fact',
      },
      {
        kind: 'role',
        organization: 'Metaview',
        role: '',
        start: null,
        end: null,
        source_url: SELF_REPORTED,
        certainty: 'fact',
      },
      {
        kind: 'education',
        organization: 'Aalborg University',
        role: '',
        start: null,
        end: null,
        source_url: SELF_REPORTED,
        certainty: 'fact',
      },
    ])
    expect(
      selfFacts({ employers: [{ organization: 'Uber', start: '2014', end: '' }], schools: [] })[0].end,
    ).toBe('present')
  })
})

describe('mergeMeFacts', () => {
  it('marks found facts inferred, drops own duplicates and hidden keys', () => {
    const own = selfFacts({ employers: [{ organization: 'Metaview', start: '2018', end: '' }], schools: [] })
    const found = [
      fact({ kind: 'role', organization: 'Metaview Technologies Inc.', role: 'CEO' }),
      fact({ kind: 'board', organization: 'Metaview Technologies Inc.', role: 'Director' }),
      fact({ kind: 'role', organization: 'Uber', role: 'PM', start: '2014' }),
    ]
    const merged = mergeMeFacts(own, found, [])
    expect(merged).toHaveLength(3)
    expect(merged[1]).toMatchObject({ kind: 'board', organization: 'Metaview Technologies Inc.', certainty: 'inferred' })
    expect(merged[2]).toMatchObject({ kind: 'role', organization: 'Uber', certainty: 'inferred' })
    const hiddenKey = factKey(fact({ kind: 'role', organization: 'Uber', role: 'PM', start: '2014' }))
    expect(mergeMeFacts(own, found, [hiddenKey])).toHaveLength(2)
  })
})

describe('introTargets', () => {
  it('merges resolved pairs per person and fund', () => {
    const targets = introTargets([
      {
        company: 'Metaview',
        fund: 'Plural',
        data: { partners: [partner('Khaled Helioui'), partner('Pierre-Dimitri Gore-Coty')] },
      },
      { company: 'Metaview', fund: 'Vertex Ventures US', data: { partners: [partner('Jonathan Heiliger')] } },
      { company: 'Granola', fund: 'Plural', data: { partners: [partner('Khaled Helioui')] } },
    ])
    expect(targets).toHaveLength(3)
    const khaledTarget = targets.find((t) => t.partner.name === 'Khaled Helioui')
    expect(khaledTarget?.deals.map((deal) => deal.organization)).toEqual(['Metaview', 'Granola'])
  })
})

describe('factYears', () => {
  it('renders start and end when both are set', () => {
    expect(factYears({ start: '2019', end: '2021' })).toBe('2019–2021')
    expect(factYears({ start: '2019', end: 'present' })).toBe('2019–present')
  })

  it('renders a one-sided span', () => {
    expect(factYears({ start: '2019', end: null })).toBe('since 2019')
    expect(factYears({ start: null, end: '2021' })).toBe('until 2021')
  })

  it('returns an empty string without dates', () => {
    expect(factYears({ start: null, end: null })).toBe('')
  })
})

describe('evidenceText', () => {
  it('renders every fact kind', () => {
    expect(evidenceText(fact({ kind: 'role', organization: 'Uber', role: 'Senior PM' }))).toBe('Senior PM')
    expect(evidenceText(fact({ kind: 'role', organization: 'Uber' }))).toBe('Role')
    expect(evidenceText(fact({ kind: 'education', organization: 'Oxford' }))).toBe('Studied here')
    expect(evidenceText(fact({ kind: 'board', organization: 'Dott', role: 'Director' }))).toBe('Director at Dott')
    expect(evidenceText(fact({ kind: 'angel', organization: 'Helsing', role: 'Seed' }))).toBe('Angel investment in Helsing (Seed)')
    expect(evidenceText(fact({ kind: 'program', organization: 'Forbes 30' }))).toBe('Took part')
    expect(evidenceText(fact({ kind: 'program', organization: 'Y Combinator', role: 'Finalist' }))).toBe('Finalist')
    expect(evidenceText(fact({ kind: 'deal', organization: 'Metaview' }))).toBe('Linked to the investment in Metaview')
    expect(evidenceText(fact({ kind: 'coinvestor', organization: 'Accel', company: 'Helsing', role: 'Seed' }))).toBe('Co-invested with Accel in Helsing (Seed)')
  })
})

describe('fallbackReason', () => {
  it('mentions the fund and the research', () => {
    expect(fallbackReason('Plural')).toBe('Plural came up in my research on investors for this round')
  })
})
