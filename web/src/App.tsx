import { useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { IdeaResults } from '@/components/idea-results'
import { LandingPage } from '@/components/landing-page'
import { NameResults } from '@/components/name-results'
import { TopBar } from '@/components/top-bar'
import { useCompany } from '@/hooks/use-company'
import { useDiscovery } from '@/hooks/use-discovery'
import { focusHeroQuery } from '@/lib/hero-query'
import type { IdeaQuery } from '@/lib/types'

type View = { kind: 'landing' } | { kind: 'idea' } | { kind: 'name' }

export default function App() {
  const discovery = useDiscovery()
  const company = useCompany()
  const [view, setView] = useState<View>({ kind: 'landing' })
  const [runId, setRunId] = useState(0)

  const show = (next: View) => {
    setView(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const submitIdea = (query: IdeaQuery) => {
    setRunId((id) => id + 1)
    discovery.start(query)
    show({ kind: 'idea' })
  }

  const submitName = (name: string) => {
    setRunId((id) => id + 1)
    company.start(name)
    show({ kind: 'name' })
  }

  const goHome = () => {
    discovery.reset()
    company.reset()
    show({ kind: 'landing' })
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <TopBar
          landing={view.kind === 'landing'}
          onHome={goHome}
          onStartSearch={focusHeroQuery}
        />
        {view.kind === 'landing' && (
          <LandingPage onSubmitIdea={submitIdea} onSubmitName={submitName} />
        )}
        {view.kind === 'idea' && discovery.state && (
          <IdeaResults
            key={runId}
            state={discovery.state}
            onSubmitIdea={submitIdea}
            onSubmitName={submitName}
            retrySimilar={discovery.retrySimilar}
            retryCompany={discovery.retryCompany}
          />
        )}
        {view.kind === 'name' && (
          <NameResults
            key={runId}
            state={company.state}
            onSubmitName={submitName}
            onSubmitIdea={submitIdea}
            onRetry={company.retry}
          />
        )}
        <footer className="bg-primary text-primary-foreground">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span>
              <span className="font-semibold tracking-tight">
                vcscout<span className="text-brand">.</span>
              </span>
              <span className="text-primary-foreground/60"> · local prototype</span>
            </span>
            <span className="text-primary-foreground/60">Data: Cala</span>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  )
}
