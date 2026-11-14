import { describe, expect, it } from 'vitest'
import { buildDraft, buildFounderDraft, hostLabel, initials, plural, safeHttpUrl } from './format'

describe('buildFounderDraft', () => {
  it('addresses the founder by first name and mentions the idea and their company', () => {
    const draft = buildFounderDraft({ personName: 'Ada Nowak', idea: 'A CRM for vets', company: 'CarMarket' })
    expect(draft.startsWith('Hi Ada,')).toBe(true)
    expect(draft).toContain("I'm building: A CRM for vets")
    expect(draft).toContain('CarMarket')
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
