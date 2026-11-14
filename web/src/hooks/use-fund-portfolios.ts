import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchFundPaths } from '@/lib/api'
import { fundKey } from '@/lib/paths'
import type { FundPathsResponse, FundStage } from '@/lib/types'

export type PortfolioState =
  | { status: 'loading' }
  | {
      status: 'done'
      companies: FundPathsResponse['companies']
      origin: 'cala' | 'cache'
      fund: string
      stage: FundStage
    }
  | { status: 'error'; message: string }

export interface PortfolioRequestItem {
  fund: string
  stage: FundStage
}

const requestCache = new Map<string, Promise<FundPathsResponse>>()

function portfolioRequest(
  item: PortfolioRequestItem,
  excludeKey: string,
  exclude: string[],
) {
  const key = `${fundKey(item.fund)}|${item.stage}|${excludeKey}`
  let promise = requestCache.get(key)
  if (!promise) {
    promise = fetchFundPaths(item.fund, item.stage, exclude)
    requestCache.set(key, promise)
    promise.catch(() => {
      if (requestCache.get(key) === promise) requestCache.delete(key)
    })
  }
  return promise
}

export function useFundPortfolios(exclude: string[]) {
  const [portfolios, setPortfolios] = useState<Record<string, PortfolioState>>({})
  const portfoliosRef = useRef<Record<string, PortfolioState>>({})
  const mountedRef = useRef(true)
  const queueRef = useRef<PortfolioRequestItem[]>([])
  const activeRef = useRef(0)
  const pumpRef = useRef<() => void>(() => {})
  const excludeKey = exclude.map((entry) => entry.toLocaleLowerCase()).sort().join('|')

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    pumpRef.current = () => {
      while (activeRef.current < 2 && queueRef.current.length) {
        const item = queueRef.current.shift() as PortfolioRequestItem
        activeRef.current += 1
        portfolioRequest(item, excludeKey, exclude)
          .then(
            (data) => {
              if (!mountedRef.current) return
              const next = {
                ...portfoliosRef.current,
                [fundKey(item.fund)]: {
                  status: 'done' as const,
                  companies: data.companies,
                  origin: data.origin,
                  fund: item.fund,
                  stage: item.stage,
                },
              }
              portfoliosRef.current = next
              setPortfolios(next)
            },
            (error: unknown) => {
              if (!mountedRef.current) return
              const next = {
                ...portfoliosRef.current,
                [fundKey(item.fund)]: {
                  status: 'error' as const,
                  message:
                    error instanceof Error ? error.message : 'Could not retrieve data.',
                },
              }
              portfoliosRef.current = next
              setPortfolios(next)
            },
          )
          .finally(() => {
            activeRef.current -= 1
            if (queueRef.current.length) pumpRef.current()
          })
      }
    }
  })

  const load = useCallback(
    (items: PortfolioRequestItem[]) => {
      const fresh = items.filter((item) => {
        const current = portfoliosRef.current[fundKey(item.fund)]
        if (!current || current.status === 'error') return true
        return current.status === 'done' && current.stage !== item.stage
      })
      if (!fresh.length) return
      const next = { ...portfoliosRef.current }
      for (const item of fresh) next[fundKey(item.fund)] = { status: 'loading' }
      portfoliosRef.current = next
      setPortfolios(next)
      queueRef.current.push(...fresh)
      pumpRef.current()
    },
    [],
  )

  return { portfolios, load }
}
