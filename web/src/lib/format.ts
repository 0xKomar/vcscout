import { clean } from './paths'
import type { Round, Stage } from './types'

export function safeHttpUrl(url: string): URL | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null
  } catch {
    return null
  }
}

export function hostLabel(url: string): string {
  const parsed = safeHttpUrl(url)
  return parsed ? parsed.hostname.replace(/^www\./, '') : ''
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

export const STAGE_LABEL: Record<Stage, string> = {
  seed: 'Pre-seed / Seed',
  'series-a': 'Series A',
}

export function formatAmount(round: Round): string {
  return [clean(round.amount), clean(round.currency)].filter(Boolean).join(' ')
}

export function buildDraft({
  personName,
  idea,
  fund,
  company,
}: {
  personName: string
  idea: string
  fund: string
  company: string
}): string {
  const firstName = personName.split(' ')[0]
  return `Hi ${firstName},

I'm building: ${idea}

I was interested in ${fund}'s investment in ${company}. I'd love to share more about what I'm building and learn whether it fits your investment focus.

Would you be open to a short conversation?

Best`
}

export function buildFounderDraft({
  personName,
  idea,
  company,
}: {
  personName: string
  idea: string
  company: string
}): string {
  const firstName = personName.split(' ')[0]
  return `Hi ${firstName},

I'm building: ${idea}

I've been following ${company} and I'm preparing to raise in a similar space. I'd love to hear how you approached your early rounds and which investors were most helpful.

Would you be open to a short conversation?

Best`
}
