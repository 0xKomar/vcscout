import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCompany } from '@/lib/api'
import type { CompanyRounds } from '@/lib/types'

export type ExploredState =
  | { status: 'loading' }
  | { status: 'done'; data: CompanyRounds }
  | { status: 'error'; message: string }

const requestCache = new Map<string, Promise<CompanyRounds>>()

function startupRequest(name: string) {
  const key = name.toLowerCase()
  let promise = requestCache.get(key)
  if (!promise) {
    promise = fetchCompany(name)
    requestCache.set(key, promise)
    promise.catch(() => {
      if (requestCache.get(key) === promise) requestCache.delete(key)
    })
  }
  return promise
}

export function useExploredStartups() {
  const [states, setStates] = useState<Record<string, ExploredState>>({})
  const statesRef = useRef<Record<string, ExploredState>>({})
  const mountedRef = useRef(true)
  const queueRef = useRef<string[]>([])
  const activeRef = useRef(0)
  const pumpRef = useRef<() => void>(() => {})

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    pumpRef.current = () => {
      while (activeRef.current < 2 && queueRef.current.length) {
        const name = queueRef.current.shift() as string
        activeRef.current += 1
        startupRequest(name)
          .then(
            (data) => {
              if (!mountedRef.current) return
              const next = {
                ...statesRef.current,
                [name.toLowerCase()]: { status: 'done' as const, data },
              }
              statesRef.current = next
              setStates(next)
            },
            (error: unknown) => {
              if (!mountedRef.current) return
              const next = {
                ...statesRef.current,
                [name.toLowerCase()]: {
                  status: 'error' as const,
                  message:
                    error instanceof Error ? error.message : 'Could not retrieve data.',
                },
              }
              statesRef.current = next
              setStates(next)
            },
          )
          .finally(() => {
            activeRef.current -= 1
            if (queueRef.current.length) pumpRef.current()
          })
      }
    }
  })

  const load = useCallback((name: string) => {
    const key = name.toLowerCase()
    const current = statesRef.current[key]
    if (current && current.status !== 'error') return
    const next = { ...statesRef.current, [key]: { status: 'loading' as const } }
    statesRef.current = next
    setStates(next)
    queueRef.current.push(name)
    pumpRef.current()
  }, [])

  return { states, load }
}
