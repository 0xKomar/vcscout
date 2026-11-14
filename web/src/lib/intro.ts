import { dateParts, fundKey, sameFund } from './paths'
import type { Certainty, Fact, MeInput, Partner } from './types'

const ORG_SUFFIXES = new Set(
  'inc incorporated llc llp lp ltd limited plc corp corporation co company gmbh ag se sa sas sarl ab as asa oy oyj bv nv spa srl sl kg kk pte pty scr pbc aps technologies technology holdings holding group management'.split(
    ' ',
  ),
)

export function foldText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .replace(/ø/g, 'o')
    .replace(/Ø/g, 'O')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/ß/g, 'ss')
    .replace(/ẞ/g, 'SS')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
}

function normalizeAlias(text: string): string {
  const words = foldText(text)
    .toLowerCase()
    .replace(/\bsp\.? ?z ?o\.? ?o\.?(?![a-z0-9])/g, ' ')
    .replace(/\ba\/s\b/g, ' as ')
    .replace(/&/g, ' and ')
    .replace(/[.'’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  if (words[0] === 'the') words.shift()
  while (words.length > 1 && ORG_SUFFIXES.has(words[words.length - 1])) words.pop()
  if (words.length > 1 && words[words.length - 1] === 'and') words.pop()
  if (words[0] === 'university' && words[1] === 'of' && words.length > 2) {
    return [...words.slice(2), 'university'].join(' ')
  }
  return words.join(' ') || text.trim().toLowerCase()
}

export function orgAliases(name: string): string[] {
  const aliases: string[] = []
  const parts = [name.replace(/\([^)]*\)/g, ' ')]
  for (const match of name.matchAll(/\(([^)]*)\)/g)) {
    parts.push(match[1].replace(/^\s*(formerly|previously|fka|aka|now)\b[\s:.,-]*/i, ''))
  }
  for (const part of parts) {
    const alias = normalizeAlias(part)
    if (alias && !aliases.includes(alias)) aliases.push(alias)
  }
  return aliases
}

export function orgKey(name: string): string {
  return orgAliases(name)[0] ?? ''
}

export function sameOrg(a: string, b: string): 'exact' | 'loose' | null {
  const as = orgAliases(a)
  const bs = orgAliases(b)
  if (!as.length || !bs.length) return null
  for (const x of as) for (const y of bs) if (x === y) return 'exact'
  if (as[0].startsWith(bs[0] + ' ') || bs[0].startsWith(as[0] + ' ')) return 'loose'
  const isUseBrand = (long: string, short: string) =>
    short.length >= 5 && !short.includes(' ') && long === `use${short}`
  if (isUseBrand(as[0], bs[0]) || isUseBrand(bs[0], as[0])) {
    return 'loose'
  }
  return null
}

export interface Span {
  start: string | null
  end: string | null
}

export type Overlap =
  | { status: 'overlap'; from: number; to: number; assumed: boolean; open: boolean }
  | { status: 'none' }
  | { status: 'unknown' }

export function yearsOverlap(a: Span, b: Span, now = new Date().getFullYear()): Overlap {
  const nowEnd = now * 12 + 11
  const resolve = (
    span: Span,
  ): { start: number; end: number; assumedEnd: boolean; currentEnd: boolean } | null => {
    const present = typeof span.end === 'string' && span.end.trim().toLowerCase() === 'present'
    const start = span.start == null ? null : dateParts(span.start)
    const end = present || span.end == null ? null : dateParts(span.end)
    if (!start && !end && !present) return null
    let endIndex: number, assumedEnd: boolean, endYear: number, endMonth: number | null
    if (present || !end) {
      endIndex = nowEnd
      assumedEnd = !present
      endYear = now
      endMonth = null
    } else {
      endIndex = end.year * 12 + (end.month ?? 12) - 1
      assumedEnd = false
      endYear = end.year
      endMonth = end.month
    }
    const startIndex = start
      ? start.year * 12 + (start.month ?? 1) - 1
      : endYear * 12 + (endMonth ?? 1) - 1
    return { start: startIndex, end: endIndex, assumedEnd, currentEnd: present || !end }
  }
  const sa = resolve(a)
  const sb = resolve(b)
  if (!sa || !sb) return { status: 'unknown' }
  const from = Math.max(sa.start, sb.start)
  const to = Math.min(sa.end, sb.end)
  if (from > to) return { status: 'none' }
  const assumed = (from > sa.start && sa.assumedEnd) || (from > sb.start && sb.assumedEnd)
  const open = (to === sa.end && sa.currentEnd) || (to === sb.end && sb.currentEnd)
  return { status: 'overlap', from: Math.floor(from / 12), to: Math.floor(to / 12), assumed, open }
}

export function overlapYears(overlap: Extract<Overlap, { status: 'overlap' }>): string {
  if (overlap.open) return `since ${overlap.from}`
  return overlap.from === overlap.to ? `${overlap.from}` : `${overlap.from}–${overlap.to}`
}

export const SELF_REPORTED = 'self-reported'

export function selfFacts(input: Pick<MeInput, 'employers' | 'schools'>): Fact[] {
  const facts: Fact[] = []
  for (const employer of input.employers) {
    const organization = employer.organization.trim()
    if (!organization) continue
    const start = employer.start.trim() || null
    facts.push({
      kind: 'role',
      organization,
      role: '',
      start,
      end: employer.end.trim() || (start ? 'present' : null),
      source_url: SELF_REPORTED,
      certainty: 'fact',
    })
  }
  for (const school of input.schools) {
    const organization = school.trim()
    if (!organization) continue
    facts.push({
      kind: 'education',
      organization,
      role: '',
      start: null,
      end: null,
      source_url: SELF_REPORTED,
      certainty: 'fact',
    })
  }
  return facts
}

export function factKey(fact: Fact): string {
  return `${fact.kind}|${orgKey(fact.organization)}|${fact.role.toLowerCase()}`
}

export function mergeMeFacts(own: Fact[], found: Fact[], hidden: string[]): Fact[] {
  const kept = found
    .map((fact) => ({ ...fact, certainty: 'inferred' as Certainty }))
    .filter(
      (fact) =>
        !hidden.includes(factKey(fact)) &&
        !own.some((mine) => mine.kind === fact.kind && sameOrg(mine.organization, fact.organization) !== null),
    )
  return [...own, ...kept]
}

export function introKey(name: string, fund: string): string {
  return `${name.trim().toLowerCase()}|${fundKey(fund.trim())}`
}

export interface IntroTarget {
  partner: Partner
  fund: string
  deals: Fact[]
}

export function introTargets(
  resolved: { company: string; fund: string; data: { partners: Partner[] } }[],
): IntroTarget[] {
  const targets: IntroTarget[] = []
  for (const entry of resolved) {
    for (const person of entry.data.partners) {
      let target = targets.find(
        (t) => t.partner.name.toLowerCase() === person.name.toLowerCase() && sameFund(t.fund, entry.fund),
      )
      if (!target) {
        target = { partner: person, fund: entry.fund, deals: [] }
        targets.push(target)
      }
      if (!target.deals.some((deal) => deal.organization.toLowerCase() === entry.company.toLowerCase())) {
        target.deals.push({
          kind: 'deal',
          organization: entry.company,
          role: person.connection,
          start: null,
          end: null,
          source_url: person.source_url,
        })
      }
    }
  }
  return targets
}

export function fallbackReason(fund: string): string {
  return `${fund} came up in my research on investors for this round`
}

export function factYears(fact: Pick<Fact, 'start' | 'end'>): string {
  if (fact.start && fact.end) return `${fact.start}–${fact.end}`
  if (fact.start) return `since ${fact.start}`
  if (fact.end) return `until ${fact.end}`
  return ''
}

export function evidenceText(fact: Fact): string {
  switch (fact.kind) {
    case 'role':
      return fact.role || 'Role'
    case 'education':
      return fact.role || 'Studied here'
    case 'board':
      return `${fact.role || 'Board seat'} at ${fact.organization}`
    case 'advisor':
      return `${fact.role || 'Advisor'} at ${fact.organization}`
    case 'angel':
      return `Angel investment in ${fact.organization}${fact.role ? ` (${fact.role})` : ''}`
    case 'program':
      return fact.role || 'Took part'
    case 'deal':
      return fact.role || `Linked to the investment in ${fact.organization}`
    case 'coinvestor':
      return `Co-invested with ${fact.organization} in ${fact.company}${fact.role ? ` (${fact.role})` : ''}`
  }
}
