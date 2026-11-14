import { useCallback, useRef, useState } from 'react'
import { fetchCompany } from '@/lib/api'
import type { CompanyRounds } from '@/lib/types'

export type CompanyState =
  | { status: 'idle' }
  | { status: 'loading'; name: string }
  | { status: 'done'; name: string; data: CompanyRounds }
  | { status: 'error'; name: string; message: string }

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not retrieve data.'
}

export function useCompany() {
  const [state, setState] = useState<CompanyState>({ status: 'idle' })
  const runRef = useRef(0)
  const nameRef = useRef('')

  const start = useCallback((name: string) => {
    const id = ++runRef.current
    nameRef.current = name
    setState({ status: 'loading', name })
    fetchCompany(name).then(
      (data) => {
        if (id === runRef.current) setState({ status: 'done', name, data })
      },
      (error: unknown) => {
        if (id === runRef.current) setState({ status: 'error', name, message: messageOf(error) })
      },
    )
  }, [])

  const retry = useCallback(() => {
    if (nameRef.current) start(nameRef.current)
  }, [start])

  const reset = useCallback(() => {
    runRef.current += 1
    nameRef.current = ''
    setState({ status: 'idle' })
  }, [])

  return { state, start, retry, reset }
}
