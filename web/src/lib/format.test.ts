import { describe, expect, it } from 'vitest'
import {
  buildDraft,
  buildForwardableBlurb,
  buildFounderDraft,
  buildIntroAskDraft,
  buildPersonDraft,
  hostLabel,
  initials,
  plural,
  safeHttpUrl,
} from './format'

describe('buildForwardableBlurb', () => {
  it('produces the exact blurb text', () => {
    expect(
      buildForwardableBlurb({
        me: 'Ada Nowak',
        idea: 'AI for job interviews.',
        partner: 'Khaled Helioui',
        fund: 'Plural',
        reason: 'we both worked at Bigpoint (2014–2016)',
      }),
    ).toBe(
      "Hi Khaled — I'm Ada Nowak, and I'm building: AI for job interviews. I'm reaching out because we both worked at Bigpoint (2014–2016). Would you be open to a short call to see whether this fits Plural's focus?",
    )
  })

  it('does not double the period after a reason ending in one', () => {
    const blurb = buildForwardableBlurb({
      me: 'Siadhal Magos',
      idea: 'AI notetaker for hiring interviews',
      partner: 'Jonathan Heiliger',
      fund: 'Vertex Ventures US',
      reason: 'we have both been on the board of Metaview Technologies Inc.',
    })
    expect(blurb).toContain('Inc. Would you')
    expect(blurb).not.toContain('Inc..')
  })
})

describe('buildIntroAskDraft', () => {
  it('produces the exact draft text', () => {
    expect(
      buildIntroAskDraft({
        bridge: 'Henri Moissinac',
        partner: 'Khaled Helioui',
        fund: 'Plural',
        commonFact: 'I saw that we both worked at Uber, and that Plural invested in Dott.',
        idea: 'AI for job interviews',
      }),
    ).toBe(
      "Hi Henri,\n\nI saw that we both worked at Uber, and that Plural invested in Dott.\n\nI'm building: AI for job interviews\n\nI'm preparing to raise and would love to talk to Khaled Helioui at Plural. Do you know Khaled well enough to introduce us? No worries at all if not.\n\nI've added a short blurb below that you can forward.\n\nBest",
    )
  })

  it('uses a placeholder when no bridge is given', () => {
    expect(
      buildIntroAskDraft({
        partner: 'Khaled Helioui',
        fund: 'Plural',
        commonFact: 'We have investors in common.',
        idea: 'AI for job interviews',
      }).startsWith('Hi [name],'),
    ).toBe(true)
  })
})

describe('buildFounderDraft', () => {
  it('addresses the founder by first name and mentions the idea and their company', () => {
    const draft = buildFounderDraft({ personName: 'Ada Nowak', idea: 'A CRM for vets', company: 'CarMarket' })
    expect(draft.startsWith('Hi Ada,')).toBe(true)
    expect(draft).toContain("I'm building: A CRM for vets")
    expect(draft).toContain('CarMarket')
  })
})

describe('drafts for a person without a known role', () => {
  it('does not invent a company or fund', () => {
    const ask = buildIntroAskDraft({ partner: 'Anna Nowak', fund: '', commonFact: 'You may know Anna.', idea: 'A product' })
    const blurb = buildForwardableBlurb({
      me: 'Alex', idea: 'A product', partner: 'Anna Nowak', fund: '',
      reason: "I'd love to learn more about your work", kind: 'person',
    })
    expect(ask).toContain('talk to Anna Nowak.')
    expect(ask).not.toContain(' at .')
    expect(blurb).toContain('short conversation')
    expect(buildPersonDraft({ personName: 'Anna Nowak', idea: 'A product' })).toContain('Hi Anna,')
  })
})

describe('buildDraft', () => {
  it('produces the exact draft text', () => {
    expect(
      buildDraft({
        personName: 'Khaled Helioui',
        idea: 'AI for job interviews',
        fund: 'Plural',
        company: 'Metaview',
      }),
    ).toBe(
      "Hi Khaled,\n\nI'm building: AI for job interviews\n\nI was interested in Plural's investment in Metaview. I'd love to share more about what I'm building and learn whether it fits your investment focus.\n\nWould you be open to a short conversation?\n\nBest",
    )
  })
})

describe('initials', () => {
  it('takes first letters of the first two words', () => {
    expect(initials('Khaled Helioui')).toBe('KH')
    expect(initials('Madonna')).toBe('M')
    expect(initials('  Anna  Maria Kowalska  ')).toBe('AM')
  })
})

describe('safeHttpUrl', () => {
  it('accepts http and https', () => {
    expect(safeHttpUrl('https://example.com/x')?.hostname).toBe('example.com')
    expect(safeHttpUrl('http://example.com')?.protocol).toBe('http:')
  })
  it('rejects javascript: and garbage', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpUrl('not a url')).toBeNull()
    expect(safeHttpUrl('')).toBeNull()
  })
})

describe('hostLabel', () => {
  it('strips www', () => {
    expect(hostLabel('https://www.example.com/a')).toBe('example.com')
    expect(hostLabel('https://tech.eu/x')).toBe('tech.eu')
  })
})

describe('plural', () => {
  it('uses singular only for one', () => {
    expect(plural(0, 'round', 'rounds')).toBe('rounds')
    expect(plural(1, 'round', 'rounds')).toBe('round')
    expect(plural(2, 'round', 'rounds')).toBe('rounds')
    expect(plural(22, 'person', 'people')).toBe('people')
  })
})
