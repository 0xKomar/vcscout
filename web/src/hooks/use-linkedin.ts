import { useEffect, useState, useSyncExternalStore } from 'react'
import { fetchLinkedin } from '@/lib/api'
import type { LinkedinKind, LinkedinProfile } from '@/lib/types'

export type LinkedinState =
  | { status: 'loading' }
  | { status: 'done'; profile: LinkedinProfile }
  | { status: 'error' }

const MAX_ACTIVE = 3
const requestCache = new Map<string, Promise<LinkedinProfile>>()
const prefetched = new Set<string>()
const waiting: (() => void)[] = []
const photoListeners = new Set<() => void>()
let photos: Record<string, string> = {}
let active = 0

export function linkedinKey(name: string, organization: string): string {
  return `${name.toLowerCase()}|${organization.toLowerCase()}`
}

// Photos of the people looked up so far, keyed by linkedinKey.
export function useLinkedinPhotos(): Record<string, string> {
  return useSyncExternalStore(
    (callback) => {
      photoListeners.add(callback)
      return () => photoListeners.delete(callback)
    },
    () => photos,
  )
}

function queued(name: string, organization: string, kind: LinkedinKind): Promise<LinkedinProfile> {
  return new Promise((resolve, reject) => {
    const run = () => {
      active += 1
      fetchLinkedin(name, organization, kind)
        .then(resolve, reject)
        .finally(() => {
          active -= 1
          waiting.shift()?.()
        })
    }
    if (active < MAX_ACTIVE) run()
    else waiting.push(run)
  })
}

function linkedinRequest(
  name: string,
  organization: string,
  kind: LinkedinKind,
): Promise<LinkedinProfile> {
  const key = linkedinKey(name, organization)
  let promise = requestCache.get(key)
  if (!promise) {
    promise = queued(name, organization, kind)
    requestCache.set(key, promise)
    promise.then(
      (profile) => {
        if (!profile.photo) return
        photos = { ...photos, [key]: profile.photo }
        for (const listener of photoListeners) listener()
      },
      () => {
        if (requestCache.get(key) === promise) requestCache.delete(key)
      },
    )
  }
  return promise
}

// Looks a person up once in the background. A failed lookup is retried only
// when the person's panel is opened.
export function prefetchLinkedin(name: string, organization: string, kind: LinkedinKind): void {
  const key = linkedinKey(name, organization)
  if (prefetched.has(key)) return
  prefetched.add(key)
  linkedinRequest(name, organization, kind).catch(() => {})
}

export function useLinkedin(name: string, organization: string, kind: LinkedinKind): LinkedinState {
  const key = linkedinKey(name, organization)
  const [result, setResult] = useState<{ key: string; state: LinkedinState } | null>(null)

  useEffect(() => {
    let cancelled = false
    linkedinRequest(name, organization, kind).then(
      (profile) => {
        if (!cancelled) setResult({ key, state: { status: 'done', profile } })
      },
      () => {
        if (!cancelled) setResult({ key, state: { status: 'error' } })
      },
    )
    return () => {
      cancelled = true
    }
  }, [name, organization, kind, key])

  return result?.key === key ? result.state : { status: 'loading' }
}
