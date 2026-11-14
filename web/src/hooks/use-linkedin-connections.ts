import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { parseLinkedinConnections } from '@/lib/linkedin-csv'
import type { LinkedinConnection } from '@/lib/types'

export const LINKEDIN_CONNECTIONS_KEY = 'vcscout:linkedin-connections'

export interface LinkedinConnections {
  connections: LinkedinConnection[]
  fileName: string
  importedAt: string
}

const empty: LinkedinConnections = { connections: [], fileName: '', importedAt: '' }

let memoryOverride: LinkedinConnections | null = null

function read(): string {
  if (memoryOverride) return JSON.stringify(memoryOverride)
  try {
    return localStorage.getItem(LINKEDIN_CONNECTIONS_KEY) ?? ''
  } catch {
    return ''
  }
}

function parse(raw: string): LinkedinConnections {
  if (!raw) return empty
  try {
    const value = JSON.parse(raw) as Partial<LinkedinConnections>
    if (!Array.isArray(value.connections)) return empty
    return {
      connections: value.connections.filter(
        (item): item is LinkedinConnection =>
          !!item && typeof item.name === 'string' && item.name.trim().length > 0,
      ),
      fileName: typeof value.fileName === 'string' ? value.fileName : '',
      importedAt: typeof value.importedAt === 'string' ? value.importedAt : '',
    }
  } catch {
    return empty
  }
}

const listeners = new Set<() => void>()
function emit() {
  for (const listener of listeners) listener()
}

function store(next: LinkedinConnections | null) {
  memoryOverride = next
  try {
    if (next) localStorage.setItem(LINKEDIN_CONNECTIONS_KEY, JSON.stringify(next))
    else localStorage.removeItem(LINKEDIN_CONNECTIONS_KEY)
  } catch {
    // storage unavailable — keep the import in memory only
  }
  emit()
}

export function useLinkedinConnections(): {
  connections: LinkedinConnection[]
  fileName: string
  importedAt: string
  importFile: (file: File) => Promise<number>
  clear: () => void
} {
  const raw = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    read,
  )
  const value = useMemo(() => parse(raw), [raw])

  const importFile = useCallback(async (file: File): Promise<number> => {
    const text = await file.text()
    const connections = parseLinkedinConnections(text)
    if (!connections.length) throw new Error('Could not find connections in this file.')
    store({
      connections,
      fileName: file.name,
      importedAt: new Date().toISOString(),
    })
    return connections.length
  }, [])

  const clear = useCallback(() => {
    store(null)
  }, [])

  return {
    connections: value.connections,
    fileName: value.fileName,
    importedAt: value.importedAt,
    importFile,
    clear,
  }
}
