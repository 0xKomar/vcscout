import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPersonInvestments } from '@/lib/api'
import type { Partner, PersonInvestment } from '@/lib/types'

export type PersonInvestmentsState =
  | { status: 'loading' }
  | { status: 'done'; investments: PersonInvestment[]; person: Partner; fund: string }
  | { status: 'error'; message: string }

const requestCache = new Map<
  string,
  Promise<{ investments: PersonInvestment[]; origin: string }>
>()

export function personKey(name: string, fund: string): string {
  return `${name.toLowerCase()}|${fund.toLowerCase()}`
}

function personRequest(name: string, fund: string) {
  const key = personKey(name, fund)
  let promise = requestCache.get(key)
  if (!promise) {
    promise = fetchPersonInvestments(name, fund)
    requestCache.set(key, promise)
    promise.catch(() => {
      if (requestCache.get(key) === promise) requestCache.delete(key)
    })
  }
  return promise
}

export function usePersonInvestments() {
  const [states, setStates] = useState<Record<string, PersonInvestmentsState>>({})
  const statesRef = useRef<Record<string, PersonInvestmentsState>>({})
  const mountedRef = useRef(true)
  const queueRef = useRef<{ person: Partner; fund: string }[]>([])
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
        const item = queueRef.current.shift() as { person: Partner; fund: string }
        activeRef.current += 1
        personRequest(item.person.name, item.fund)
          .then(
            (data) => {
              if (!mountedRef.current) return
              const next = {
                ...statesRef.current,
                [personKey(item.person.name, item.fund)]: {
                  status: 'done' as const,
                  investments: data.investments,
                  person: item.person,
                  fund: item.fund,
                },
              }
              statesRef.current = next
              setStates(next)
            },
            (error: unknown) => {
              if (!mountedRef.current) return
              const next = {
                ...statesRef.current,
                [personKey(item.person.name, item.fund)]: {
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

  const load = useCallback((person: Partner, fund: string) => {
    const key = personKey(person.name, fund)
    const current = statesRef.current[key]
    if (current && current.status !== 'error') return
    const next = { ...statesRef.current, [key]: { status: 'loading' as const } }
    statesRef.current = next
    setStates(next)
    queueRef.current.push({ person, fund })
    pumpRef.current()
  }, [])

  return { states, load }
}
