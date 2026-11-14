import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchDossier } from '@/lib/api'
import { introKey } from '@/lib/intro'
import type { Dossier } from '@/lib/types'

export type DossierState =
  | { status: 'loading' }
  | { status: 'done'; dossier: Dossier }
  | { status: 'error'; message: string }

export interface DossierTarget {
  name: string
  fund: string
}

const requestCache = new Map<string, Promise<Dossier>>()

function dossierRequest(name: string, fund: string) {
  const key = introKey(name, fund)
  let promise = requestCache.get(key)
  if (!promise) {
    promise = fetchDossier(name, fund)
    requestCache.set(key, promise)
    promise.catch(() => {
      if (requestCache.get(key) === promise) requestCache.delete(key)
    })
  }
  return promise
}

export function useDossiers(
  targets: DossierTarget[],
  active: boolean,
): {
  states: Record<string, DossierState>
  stopped: boolean
  stop: () => void
  load: (target: DossierTarget) => void
} {
  const [states, setStates] = useState<Record<string, DossierState>>({})
  const [stopped, setStopped] = useState(false)
  const [prevActive, setPrevActive] = useState(active)
  const statesRef = useRef(states)
  const mountedRef = useRef(true)
  const queueRef = useRef<DossierTarget[]>([])
  const inFlightRef = useRef(0)
  const pumpRef = useRef<() => void>(() => {})

  if (prevActive !== active) {
    setPrevActive(active)
    if (!active) setStopped(false)
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const update = useCallback((key: string, state: DossierState) => {
    const next = { ...statesRef.current, [key]: state }
    statesRef.current = next
    setStates(next)
  }, [])

  useEffect(() => {
    pumpRef.current = () => {
      while (inFlightRef.current < 4 && queueRef.current.length) {
        const target = queueRef.current.shift() as DossierTarget
        const key = introKey(target.name, target.fund)
        inFlightRef.current += 1
        update(key, { status: 'loading' })
        dossierRequest(target.name, target.fund)
          .then(
            (dossier) => {
              if (!mountedRef.current) return
              update(key, { status: 'done', dossier })
            },
            (error: unknown) => {
              if (!mountedRef.current) return
              update(key, {
                status: 'error',
                message:
                  error instanceof Error ? error.message : 'Could not retrieve data.',
              })
            },
          )
          .finally(() => {
            inFlightRef.current -= 1
            if (queueRef.current.length) pumpRef.current()
          })
      }
    }
  })

  useEffect(() => {
    if (!active || stopped) return
    let queued = false
    for (const target of targets) {
      const key = introKey(target.name, target.fund)
      if (statesRef.current[key]) continue
      if (queueRef.current.some((item) => introKey(item.name, item.fund) === key)) continue
      queueRef.current.push(target)
      queued = true
    }
    if (queued) queueMicrotask(() => pumpRef.current())
  }, [targets, active, stopped])

  const stop = useCallback(() => {
    queueRef.current = []
    setStopped(true)
  }, [])

  const load = useCallback((target: DossierTarget) => {
    const key = introKey(target.name, target.fund)
    const current = statesRef.current[key]
    if (current && current.status !== 'error') return
    if (queueRef.current.some((item) => introKey(item.name, item.fund) === key)) return
    queueRef.current.push(target)
    update(key, { status: 'loading' })
    pumpRef.current()
  }, [update])

  const derived: Record<string, DossierState> = { ...states }
  if (active && !stopped) {
    for (const target of targets) {
      const key = introKey(target.name, target.fund)
      if (!derived[key]) derived[key] = { status: 'loading' }
    }
  }

  return { states: derived, stopped, stop, load }
}
