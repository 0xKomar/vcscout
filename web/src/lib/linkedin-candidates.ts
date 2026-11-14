import { foldText, orgKey, sameOrg } from './intro'
import { linkedinIdentity, linkedinProfileKey } from './linkedin-csv'
import { bridgeFocus, personKey, type Network } from './network'
import type { LinkedinConnection } from './types'

export interface LinkedinCandidate {
  key: string
  contact: LinkedinConnection
  score: number
  reason: string
  researchable: boolean
}

// This is a local prioritization signal, never evidence that people are connected.
export function rankLinkedinCandidates(
  contacts: LinkedinConnection[],
  network: Network,
  targetId: string,
  targetDescription = '',
): LinkedinCandidate[] {
  const target = network.nodes.find((node) => node.id === targetId)
  if (!target) return []
  const pending = new Set((network.skipped ?? []).map(
    (contact) => `${personKey(contact.name)}|${orgKey(contact.company)}`,
  ))
  const focus = bridgeFocus(network, 'me', targetId)
  const context = foldText([
    target.label, target.sublabel, target.company, target.fund, targetDescription, ...focus.focus,
  ].filter(Boolean).join(' ')).toLowerCase()
  const aiTarget = /\b(?:ai|artificial intelligence|machine learning|software|data)\b/.test(context)
  const ventureTarget = /\b(?:partner|investor|founder|venture|capital)\b/.test(context)
  const seen = new Set<string>()
  const candidates: LinkedinCandidate[] = []
  for (const contact of contacts) {
    if (!pending.has(`${personKey(contact.name)}|${orgKey(contact.company)}`)) continue
    if (!contact.name.trim()) continue
    const researchable = !!contact.company.trim() || !!linkedinProfileKey(contact.url)
    const key = linkedinIdentity(contact)
    if (seen.has(key)) continue
    seen.add(key)
    const role = foldText(contact.position).toLowerCase()
    const orgMatch = contact.company && focus.focus.some((org) => sameOrg(org, contact.company))
    const nameMatch = focus.focus_people.some((name) => personKey(name) === personKey(contact.name))
    let score = 0
    let reason = ''
    if (nameMatch) { score += 100; reason = 'Name appears near target — identity needs checking' }
    if (orgMatch) { score += 60; reason ||= 'Organization resembles target background' }
    if (aiTarget && /\b(?:ai|machine learning|software|engineer|developer|data|product)\b/.test(role)) {
      score += 10
      reason ||= 'Relevant technical or product role'
    }
    if (ventureTarget && /\b(?:founder|investor|partner|venture|startup)\b/.test(role)) {
      score += 10
      reason ||= 'Relevant founder or investment role'
    }
    if (linkedinProfileKey(contact.url)) score += 1
    candidates.push({
      key,
      contact,
      score: researchable ? score : -1,
      reason: researchable ? (reason || 'No known connection to target yet')
        : 'Add an employer or LinkedIn profile before researching this person',
      researchable,
    })
  }
  return candidates.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
}
