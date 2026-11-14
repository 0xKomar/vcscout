import { useCallback, useEffect, useRef, useState } from 'react'
import { prefetchPartners } from '@/hooks/use-partners'

export type PeoplePrefetchStatus = 'pending' | 'loading' | 'done' | 'stopped'

export interface PeoplePrefetch {
  status: PeoplePrefetchStatus
  settled: number
  total: number
  people: number
  errors: number
  byKey: Record<string, number>
  stop: () => void
}

const pairKey = (pair: { fund: string; company: string }) =>
  `${pair.company.toLowerCase()}|${pair.fund.toLowerCase()}`

export function usePeoplePrefetch(
  pairs: { fund: string; company: string }[],
  active: boolean,
): PeoplePrefetch {
  const [stopped, setStopped] = useState(false)
  const [stats, setStats] = useState({
    settled: 0,
    total: 0,
    people: 0,
    errors: 0,
    byKey: {} as Record<string, number>,
  })
  const mountedRef = useRef(true)
  const stoppedRef = useRef(false)
  const seenRef = useRef(new Set<string>())
  const queueRef = useRef<{ fund: string; company: string }[]>([])
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
      while (!stoppedRef.current && activeRef.current < 2 && queueRef.current.length) {
        const pair = queueRef.current.shift() as { fund: string; company: string }
        activeRef.current += 1
        prefetchPartners(pair.company, pair.fund)
          .then(
            (data) => {
              if (!mountedRef.current) return
              setStats((current) => ({
                ...current,
                settled: current.settled + 1,
                total: seenRef.current.size,
                people: current.people + data.partners.length,
                byKey: { ...current.byKey, [pairKey(pair)]: data.partners.length },
              }))
            },
            () => {
              if (!mountedRef.current) return
              setStats((current) => ({
                ...current,
                settled: current.settled + 1,
                total: seenRef.current.size,
                errors: current.errors + 1,
              }))
            },
          )
          .finally(() => {
            activeRef.current -= 1
            if (!mountedRef.current) return
            if (queueRef.current.length) pumpRef.current()
          })
      }
    }
  })

  useEffect(() => {
    if (!active || stoppedRef.current) return
    for (const pair of pairs) {
      const key = pairKey(pair)
      if (seenRef.current.has(key)) continue
      seenRef.current.add(key)
      queueRef.current.push(pair)
    }
    pumpRef.current()
  }, [pairs, active])

  const stop = useCallback(() => {
    stoppedRef.current = true
    queueRef.current = []
    setStopped(true)
  }, [])

  const status: PeoplePrefetchStatus = stopped
    ? 'stopped'
    : !active
      ? 'pending'
      : stats.settled < Math.max(stats.total, pairs.length)
        ? 'loading'
        : 'done'

  return {
    status,
    settled: stats.settled,
    total: Math.max(stats.total, pairs.length),
    people: stats.people,
    errors: stats.errors,
    byKey: stats.byKey,
    stop,
  }
}
