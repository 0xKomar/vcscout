import { useCallback, useRef, useState } from 'react'
import { fetchCompany, fetchRisks, fetchSimilar } from '@/lib/api'
import { clean, preparePaths, stageLevel } from '@/lib/paths'
import type { CompanyRounds, IdeaQuery, Risk, SimilarMatch } from '@/lib/types'

export type MatchStatus = 'loading' | 'done' | 'empty' | 'error'

export interface MatchEntry {
  match: SimilarMatch
  status: MatchStatus
  data?: CompanyRounds
  message?: string
}

export type SimilarState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; matches: SimilarMatch[] }

export type RisksState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'skipped' }
  | { status: 'done'; risks: Risk[]; funds: string[] }
  | { status: 'error'; funds: string[] }

export interface DiscoveryState {
  query: IdeaQuery
  similar: SimilarState
  companies: MatchEntry[]
  risks: RisksState
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not retrieve data.'
}

export function useDiscovery() {
  const [state, setState] = useState<DiscoveryState | null>(null)
  const runRef = useRef(0)
  const queryRef = useRef<IdeaQuery | null>(null)

  const patchEntry = useCallback((index: number, patch: Partial<MatchEntry>) => {
    setState((current) =>
      current
        ? {
            ...current,
            companies: current.companies.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
          }
        : current,
    )
  }, [])

  const runRisks = useCallback(
    (id: number, query: IdeaQuery, ideaForApi: string, results: (CompanyRounds | null)[]) => {
      const done = results.filter((entry): entry is CompanyRounds => entry !== null)
      const funds = preparePaths(done, stageLevel(query.stage))
        .early.slice(0, 6)
        .map((node) => node.name)
      if (!funds.length) {
        setState((current) => (current ? { ...current, risks: { status: 'skipped' } } : current))
        return
      }
      setState((current) => (current ? { ...current, risks: { status: 'loading' } } : current))
      fetchRisks(ideaForApi, funds).then(
        (data) => {
          if (id === runRef.current) {
            setState((current) =>
              current ? { ...current, risks: { status: 'done', risks: data.risks || [], funds } } : current,
            )
          }
        },
        () => {
          if (id === runRef.current) {
            setState((current) => (current ? { ...current, risks: { status: 'error', funds } } : current))
          }
        },
      )
    },
    [],
  )

  const runCompanies = useCallback(
    async (id: number, query: IdeaQuery, ideaForApi: string, matches: SimilarMatch[]) => {
      const results: (CompanyRounds | null)[] = new Array(matches.length).fill(null)
      let next = 0
      const worker = async () => {
        while (next < matches.length) {
          const index = next
          next += 1
          const match = matches[index]
          try {
            const data = await fetchCompany(match.company, clean(match.description).slice(0, 1000))
            if (id !== runRef.current) return
            results[index] = data.rounds && data.rounds.length ? data : null
            patchEntry(
              index,
              results[index]
                ? { status: 'done', data }
                : { status: 'empty' },
            )
          } catch (error) {
            if (id !== runRef.current) return
            patchEntry(index, { status: 'error', message: messageOf(error) })
          }
        }
      }
      await Promise.all([worker(), worker()])
      if (id !== runRef.current) return
      runRisks(id, query, ideaForApi, results)
    },
    [patchEntry, runRisks],
  )

  const start = useCallback(
    (query: IdeaQuery) => {
      const id = ++runRef.current
      queryRef.current = query
      const ideaForApi = query.region ? `${query.idea} Rynek: ${query.region}` : query.idea
      setState({ query, similar: { status: 'loading' }, companies: [], risks: { status: 'idle' } })
      fetchSimilar(ideaForApi).then(
        (data) => {
          if (id !== runRef.current) return
          const matches = (data.matches || []).slice(0, 4)
          setState((current) =>
            current
              ? {
                  ...current,
                  similar: { status: 'done', matches },
                  companies: matches.map((match) => ({ match, status: 'loading' as const })),
                  ...(matches.length ? {} : { risks: { status: 'skipped' as const } }),
                }
              : current,
          )
          if (matches.length) void runCompanies(id, query, ideaForApi, matches)
        },
        (error: unknown) => {
          if (id !== runRef.current) return
          setState((current) =>
            current ? { ...current, similar: { status: 'error', message: messageOf(error) } } : current,
          )
        },
      )
    },
    [runCompanies],
  )

  const retrySimilar = useCallback(() => {
    const query = queryRef.current
    if (query) start(query)
  }, [start])

  const retryCompany = useCallback(
    (company: string) => {
      const current = state
      if (!current) return
      const index = current.companies.findIndex((entry) => entry.match.company === company)
      if (index < 0) return
      const match = current.companies[index].match
      const id = runRef.current
      patchEntry(index, { status: 'loading', message: undefined, data: undefined })
      fetchCompany(match.company, clean(match.description).slice(0, 1000)).then(
        (data) => {
          if (id !== runRef.current) return
          patchEntry(index, data.rounds && data.rounds.length ? { status: 'done', data } : { status: 'empty' })
        },
        (error: unknown) => {
          if (id !== runRef.current) return
          patchEntry(index, { status: 'error', message: messageOf(error) })
        },
      )
    },
    [patchEntry, state],
  )

  const reset = useCallback(() => {
    runRef.current += 1
    queryRef.current = null
    setState(null)
  }, [])

  return { state, start, retrySimilar, retryCompany, reset }
}
