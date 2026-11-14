import { describe, expect, it } from 'vitest'
import { normalizeLinkedinProfileUrl, parseLinkedinConnections } from './linkedin-csv'

const HEADER = 'First Name,Last Name,URL,Email Address,Company,Position,Connected On'

describe('normalizeLinkedinProfileUrl', () => {
  it('accepts profile URLs and drops tracking parameters', () => {
    expect(normalizeLinkedinProfileUrl(' linkedin.com/in/anna-nowak-123/?trk=share#intro '))
      .toBe('https://www.linkedin.com/in/anna-nowak-123')
    expect(normalizeLinkedinProfileUrl('https://pl.linkedin.com/in/%C5%81ukasz-kowalski'))
      .toBe('https://www.linkedin.com/in/%C5%81ukasz-kowalski')
  })

  it('rejects links that do not identify a single LinkedIn profile', () => {
    for (const url of [
      '', 'javascript:alert(1)', 'https://linkedin.com.evil.example/in/anna',
      'https://user@linkedin.com/in/anna', 'https://linkedin.com/in/',
      'https://linkedin.com/company/acme', 'https://linkedin.com/in/a%2Fb',
      'https://linkedin.com/in/anna/details/experience',
    ]) expect(normalizeLinkedinProfileUrl(url)).toBeNull()
  })
})

describe('parseLinkedinConnections', () => {
  it('skips the Notes preamble and a BOM', () => {
    const text = `\uFEFFNotes:\n"When exporting your connection data, you may notice that some email addresses are missing."\n\n${HEADER}\nJan,Kowalski,https://www.linkedin.com/in/jank,,Minerva,Founder,01 Jan 2025\n`
    expect(parseLinkedinConnections(text)).toEqual([
      {
        name: 'Jan Kowalski',
        company: 'Minerva',
        position: 'Founder',
        url: 'https://www.linkedin.com/in/jank',
      },
    ])
  })

  it('parses quoted companies with commas and escaped quotes', () => {
    const text = `${HEADER}\nAda,Nowak,https://www.linkedin.com/in/ada,,"Bigpoint, GmbH","CEO ""interim""",01 Jan 2020\n`
    expect(parseLinkedinConnections(text)).toEqual([
      {
        name: 'Ada Nowak',
        company: 'Bigpoint, GmbH',
        position: 'CEO "interim"',
        url: 'https://www.linkedin.com/in/ada',
      },
    ])
  })

  it('handles CRLF line endings and missing company or position', () => {
    const text = `${HEADER}\r\nPiotr,Gerke,https://www.linkedin.com/in/pg,,,,01 Jan 2021\r\n`
    expect(parseLinkedinConnections(text)).toEqual([
      { name: 'Piotr Gerke', company: '', position: '', url: 'https://www.linkedin.com/in/pg' },
    ])
  })

  it('dedupes by url and skips empty names', () => {
    const text = `${HEADER}\nJan,Kowalski,https://www.linkedin.com/in/jank,,Minerva,Founder,01 Jan 2025\nJan,Kowalski,https://www.linkedin.com/in/jank,,Cato,CEO,02 Jan 2025\n,,,,,,\n`
    expect(parseLinkedinConnections(text)).toHaveLength(1)
  })

  it('parses non-English export headers', () => {
    const text = `Imię,Nazwisko,Adres URL,Adres e-mail,Firma,Stanowisko,Data połączenia\nJan,Kowalski,https://www.linkedin.com/in/jank,,Minerva,Founder,01 sty 2025\n`
    expect(parseLinkedinConnections(text)).toEqual([
      {
        name: 'Jan Kowalski',
        company: 'Minerva',
        position: 'Founder',
        url: 'https://www.linkedin.com/in/jank',
      },
    ])
  })

  it('returns an empty list without a header row', () => {
    expect(parseLinkedinConnections('a,b,c\n1,2,3\n')).toEqual([])
  })
})
