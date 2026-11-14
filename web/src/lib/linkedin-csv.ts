import type { LinkedinConnection } from './types'
import { foldText, orgKey } from './intro'

export function normalizeLinkedinProfileUrl(value: string): string | null {
  let input = value.trim()
  if (/^(?:www\.)?linkedin\.com\//i.test(input)) input = `https://${input}`
  try {
    const parsed = new URL(input)
    const host = parsed.hostname.toLowerCase()
    if (!['http:', 'https:'].includes(parsed.protocol) ||
      (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) ||
      parsed.username || parsed.password || parsed.port) return null
    const match = /^\/in\/([^/]+)\/?$/i.exec(parsed.pathname)
    if (!match) return null
    const slug = decodeURIComponent(match[1])
    if (!/^[\p{L}\p{N}_-]{1,150}$/u.test(slug)) return null
    const normalized = `https://www.linkedin.com/in/${encodeURIComponent(slug)}`
    return normalized.length <= 300 ? normalized : null
  } catch {
    return null
  }
}

export function linkedinProfileKey(url?: string): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if (!['http:', 'https:'].includes(parsed.protocol) ||
      (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) ||
      !parsed.pathname.startsWith('/in/')) return ''
    return parsed.pathname.replace(/\/+$/, '').toLowerCase()
  } catch {
    return ''
  }
}

export function linkedinIdentity(contact: LinkedinConnection): string {
  const profile = linkedinProfileKey(contact.url)
  return profile
    ? `linkedin:${profile}`
    : `${foldText(contact.name).toLowerCase().trim()}|${orgKey(contact.company)}|${foldText(contact.position).toLowerCase().trim()}`
}

function parseRows(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

const HEADERS: Record<string, string[]> = {
  first: ['First Name', 'Imi\u0119', 'Pr\u00e9nom', 'Vorname'],
  last: ['Last Name', 'Nazwisko', 'Nom', 'Nachname'],
  url: ['URL', 'Adres URL'],
  company: ['Company', 'Firma', 'Entreprise', 'Unternehmen'],
  position: ['Position', 'Stanowisko', 'Poste'],
}

export function parseLinkedinConnections(text: string): LinkedinConnection[] {
  const rows = parseRows(text.replace(/^\uFEFF/, ''))
  const header = rows.findIndex(
    (row) =>
      HEADERS.first.some((name) => row.includes(name)) &&
      HEADERS.last.some((name) => row.includes(name)),
  )
  if (header < 0) return []
  const columns = rows[header]
  const at = (key: string) => {
    for (const name of HEADERS[key]) {
      const index = columns.indexOf(name)
      if (index >= 0) return index
    }
    return -1
  }
  const [first, last, url, company, position] = [
    at('first'),
    at('last'),
    at('url'),
    at('company'),
    at('position'),
  ]
  const cell = (row: string[], index: number) =>
    (index >= 0 ? (row[index] ?? '') : '').trim()
  const connections: LinkedinConnection[] = []
  const seen = new Set<string>()
  for (const row of rows.slice(header + 1)) {
    const name = `${cell(row, first)} ${cell(row, last)}`.replace(/\s+/g, ' ').trim()
    if (!name) continue
    const connection: LinkedinConnection = {
      name,
      company: cell(row, company),
      position: cell(row, position),
      url: cell(row, url),
    }
    const key = connection.url || `${name}|${connection.company}`
    if (seen.has(key)) continue
    seen.add(key)
    connections.push(connection)
  }
  return connections
}
