import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { fetchPartners } from '@/lib/api'
import type { PartnersResponse } from '@/lib/types'

export interface ResolvedPartners {
  company: string
  fund: string
  data: PartnersResponse
}

const partnersCache = new Map<string, Promise<PartnersResponse>>()
const resolvedPartners = new Map<string, ResolvedPartners>()
const partnersListeners = new Set<() => void>()
let partnersSnapshot: ResolvedPartners[] = []

function notifyPartners() {
  partnersSnapshot = [...resolvedPartners.values()]
  for (const listener of partnersListeners) listener()
}

export function useResolvedPartners(): ResolvedPartners[] {
  return useSyncExternalStore(
    (callback) => {
      partnersListeners.add(callback)
      return () => partnersListeners.delete(callback)
    },
    () => partnersSnapshot,
  )
}

function partnersKey(company: string, fund: string): string {
  return `${company.toLowerCase()}|${fund.toLowerCase()}`
}

function partnersRequest(company: string, fund: string): Promise<PartnersResponse> {
  const key = partnersKey(company, fund)
  let promise = partnersCache.get(key)
  if (!promise) {
    promise = fetchPartners(company, fund)
    partnersCache.set(key, promise)
    promise.then(
      (data) => {
        if (partnersCache.get(key) === promise) {
          resolvedPartners.set(key, { company, fund, data })
          notifyPartners()
        }
      },
      () => partnersCache.delete(key),
    )
  }
  return promise
}

export function prefetchPartners(company: string, fund: string): Promise<PartnersResponse> {
  return partnersRequest(company, fund)
}

export type PartnersState =
  | { status: 'loading' }
  | { status: 'done'; data: PartnersResponse }
  | { status: 'error'; message: string }

export function usePartners(company: string, fund: string) {
  const queryKey = partnersKey(company, fund)
  const [state, setState] = useState<PartnersState>(() => {
    const cached = resolvedPartners.get(queryKey)
    return cached ? { status: 'done', data: cached.data } : { status: 'loading' }
  })
  const requestRef = useRef(0)

  const [prevKey, setPrevKey] = useState(queryKey)
  if (prevKey !== queryKey) {
    setPrevKey(queryKey)
    const cached = resolvedPartners.get(queryKey)
    setState(cached ? { status: 'done', data: cached.data } : { status: 'loading' })
  }

  useEffect(() => {
    const id = ++requestRef.current
    partnersRequest(company, fund).then(
      (data) => {
        if (id === requestRef.current) setState({ status: 'done', data })
      },
      (error: unknown) => {
        if (id === requestRef.current) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Could not retrieve data.',
          })
        }
      },
    )
  }, [company, fund])

  const retry = useCallback(() => {
    const id = ++requestRef.current
    setState({ status: 'loading' })
    partnersRequest(company, fund).then(
      (data) => {
        if (id === requestRef.current) setState({ status: 'done', data })
      },
      (error: unknown) => {
        if (id === requestRef.current) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Could not retrieve data.',
          })
        }
      },
    )
  }, [company, fund])

  return { state, retry }
}
