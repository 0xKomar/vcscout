import { useEffect, useMemo, useState } from 'react'
import { fetchFounders } from '@/lib/api'
import { clean } from '@/lib/paths'
import type { Founder, FoundersResponse, SimilarMatch } from '@/lib/types'

export interface CompanyFounders {
  company: string
  founders: Founder[]
}

const requestCache = new Map<string, Promise<FoundersResponse>>()

function foundersRequest(match: SimilarMatch): Promise<FoundersResponse> {
  const key = match.company.toLowerCase()
  let promise = requestCache.get(key)
  if (!promise) {
    promise = fetchFounders(match.company, clean(match.description).slice(0, 1000))
    requestCache.set(key, promise)
    promise.catch(() => {
      if (requestCache.get(key) === promise) requestCache.delete(key)
    })
  }
  return promise
}

export function useFounders(matches: SimilarMatch[]) {
  const [results, setResults] = useState<Record<string, Founder[] | null>>({})

  useEffect(() => {
    let cancelled = false
    for (const match of matches) {
      foundersRequest(match).then(
        (data) => {
          if (!cancelled) setResults((current) => ({ ...current, [match.company]: data.founders }))
        },
        () => {
          if (!cancelled) setResults((current) => ({ ...current, [match.company]: null }))
        },
      )
    }
    return () => {
      cancelled = true
    }
  }, [matches])

  return useMemo(() => {
    const settled = matches.filter((match) => match.company in results)
    const list: CompanyFounders[] = settled.flatMap((match) => {
      const founders = results[match.company]
      return founders ? [{ company: match.company, founders }] : []
    })
    return {
      list,
      settled: settled.length,
      total: matches.length,
      people: list.reduce((sum, entry) => sum + entry.founders.length, 0),
    }
  }, [matches, results])
}
