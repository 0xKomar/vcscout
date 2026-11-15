import { useState } from 'react'
import { MotionConfig } from 'motion/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { IdeaResults } from '@/components/idea-results'
import { LandingPage } from '@/components/landing-page'
import { TopBar } from '@/components/top-bar'
import { useDiscovery } from '@/hooks/use-discovery'
import { focusHeroQuery } from '@/lib/hero-query'
import type { IdeaQuery } from '@/lib/types'

type View = { kind: 'landing' } | { kind: 'idea' }

export default function App() {
  const discovery = useDiscovery()
  const [view, setView] = useState<View>({ kind: 'landing' })
  const [runId, setRunId] = useState(0)
  const [walkthroughOnRun, setWalkthroughOnRun] = useState(true)

  const show = (next: View) => {
    setView(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const submitFromLanding = (query: IdeaQuery) => {
    const skip =
      typeof window !== 'undefined' &&
      window.localStorage.getItem('vcscout:skip-walkthrough') === '1'
    setWalkthroughOnRun(!skip)
    setRunId((id) => id + 1)
    discovery.start(query)
    show({ kind: 'idea' })
  }

  const submitRefinement = (query: IdeaQuery) => {
    setWalkthroughOnRun(false)
    setRunId((id) => id + 1)
    discovery.start(query)
    show({ kind: 'idea' })
  }

  const goHome = () => {
    discovery.reset()
    show({ kind: 'landing' })
  }

  return (
    <TooltipProvider>
      <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <TopBar
          landing={view.kind === 'landing'}
          onHome={goHome}
          onStartSearch={focusHeroQuery}
        />
        {view.kind === 'landing' && (
          <LandingPage onSubmitIdea={submitFromLanding} />
        )}
        {view.kind === 'idea' && discovery.state && (
          <IdeaResults
            key={runId}
            state={discovery.state}
            initialWalkthrough={walkthroughOnRun}
            onSubmitIdea={submitRefinement}
            retrySimilar={discovery.retrySimilar}
            retryCompany={discovery.retryCompany}
          />
        )}
        <footer className="bg-primary text-primary-foreground">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span>
              <span className="font-semibold tracking-tight">
                vcscout<span className="text-[#a6e6cf]">.</span>
              </span>
              <span className="text-primary-foreground/60"> · made for meaningful introductions</span>
            </span>
            <span className="text-xs text-primary-foreground/60">Research leads, not guarantees. Check the sources.</span>
          </div>
        </footer>
      </div>
      </MotionConfig>
    </TooltipProvider>
  )
}
