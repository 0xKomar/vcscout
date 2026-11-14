import { Fragment, useEffect, useState } from 'react'
import { Info, Link2 } from 'lucide-react'
import { CtaButton } from '@/components/cta-button'
import { HeroGraphPreview } from '@/components/hero-graph-preview'
import { HeroSearch } from '@/components/hero-search'
import { LandingFeatures } from '@/components/landing-features'
import { fetchExamples } from '@/lib/api'
import { focusHeroQuery } from '@/lib/hero-query'
import type { IdeaQuery } from '@/lib/types'

interface LandingPageProps {
  onSubmitIdea: (query: IdeaQuery) => void
  onSubmitName: (name: string) => void
}

const HEADLINE = ['The', 'investors', 'behind', 'startups', 'like', 'yours,', 'mapped', 'in one', 'graph']

const PROMISES = ['A source on every round', 'Saved examples open instantly', 'Research leads, not advice']

const fadeIn = (delay: number) => ({ animationDelay: `${delay}s` })

export function LandingPage({ onSubmitIdea, onSubmitName }: LandingPageProps) {
  const [examples, setExamples] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    fetchExamples()
      .then((data) => {
        if (!cancelled) setExamples(data.names || [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="flex-1 overflow-clip bg-card">
      <div className="relative pb-[72px] md:pb-[110px]">
        <div className="relative">
          <div
            aria-hidden
            style={{ clipPath: 'inset(0 20px 0 20px round 0 0 48px 48px)' }}
            className="pointer-events-none absolute inset-x-0 top-0 bottom-[max(140px,calc(100%-max(520px,100svh-72px)))] bg-linear-to-b from-card from-55% to-hero-glow md:bottom-[max(240px,calc(100%-max(600px,100svh-84px)))]"
          />
          <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pt-12 text-center sm:px-8 lg:pt-16">
            <p
              className="entrance-fade mb-6 flex items-center gap-2 rounded-2xl border border-border bg-card/60 px-4 py-3 text-sm leading-none tracking-[0.45px] text-foreground/80 sm:text-[15px] md:mb-[30px]"
              style={fadeIn(0)}
            >
              <Link2 className="size-4 shrink-0" aria-hidden />
              <span>
                Funding research for founders, <span className="text-foreground">with sources</span>
              </span>
            </p>
            <h1 className="max-w-[960px] font-serif text-[clamp(30px,8.2vw,34px)] leading-[1.15] tracking-[0.02em] text-balance md:text-[54px] lg:text-[62px]">
              {HEADLINE.map((word, index) => (
                <Fragment key={word}>
                  <span className="-my-[0.2em] inline-block overflow-hidden py-[0.2em] align-bottom">
                    <span className="entrance-word inline-block" style={fadeIn(0.15 + index * 0.05)}>
                      {word}
                    </span>
                  </span>{' '}
                </Fragment>
              ))}
            </h1>
            <p
              className="entrance-fade mt-6 max-w-[600px] text-base leading-[1.45] tracking-[0.3px] md:text-[17px]"
              style={fadeIn(0.45)}
            >
              Describe what you&apos;re building. VCScout finds similar startups, traces their funding
              rounds, and draws the funds and people connected to them.
            </p>
            <div className="entrance-fade mt-9 flex w-full justify-center" style={fadeIn(0.55)}>
              <HeroSearch
                examples={examples}
                onSubmitIdea={onSubmitIdea}
                onSubmitName={onSubmitName}
              />
            </div>
            <div
              id="graph"
              className="entrance-fade mt-12 w-full scroll-mt-24"
              style={{ ...fadeIn(0.65), animationDuration: '1s' }}
            >
              <HeroGraphPreview />
            </div>
          </section>
        </div>

        <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
          <p className="entrance-fade mx-auto mt-3 flex max-w-[320px] items-start justify-center gap-1.5 text-center text-xs leading-4 text-foreground/55 md:mt-4 md:max-w-none md:items-center" style={fadeIn(0.75)}>
            <Info className="mt-0.5 size-3 shrink-0 md:mt-0" aria-hidden />
            Illustrative preview built from saved example results. Your graph is generated from your
            own query.
          </p>
          {examples.length > 0 && (
            <div
              id="saved"
              className="entrance-fade mx-auto mt-12 flex w-full max-w-[1040px] scroll-mt-24 flex-col items-center gap-3 text-[15px] tracking-[0.45px] md:mt-16 md:flex-row md:gap-8"
              style={fadeIn(0.8)}
            >
              <p className="shrink-0 leading-[1.3] text-foreground/70">
                <span className="text-foreground">{examples.length} startups</span> with saved
                results, no waiting
              </p>
              <ul className="flex min-w-0 flex-1 flex-wrap justify-center gap-x-1 gap-y-1 md:justify-end">
                {examples.map((example) => (
                  <li key={example}>
                    <button
                      type="button"
                      onClick={() => onSubmitName(example)}
                      className="rounded-full px-3 py-1.5 font-medium text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {example}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <LandingFeatures />

      <div aria-hidden className="my-[72px] border-t border-border md:my-[110px]" />

      <section className="mx-auto w-full max-w-6xl px-4 pb-[72px] sm:px-8 md:pb-[110px]">
        <div className="scroll-reveal flex flex-col items-center rounded-[28px] bg-panel px-6 py-14 text-center text-panel-foreground md:rounded-[36px] md:py-20">
          <h2 className="max-w-[640px] font-serif text-[28px] leading-[1.2] tracking-[0.02em] text-balance md:text-[40px]">
            Start with one sentence about what you&apos;re building
          </h2>
          <p className="mt-5 max-w-[500px] text-[15px] leading-[1.45] tracking-[0.3px] text-panel-foreground/70">
            The graph starts drawing as soon as you search and grows as funding histories and
            people come in.
          </p>
          <CtaButton tone="light" className="mt-9" onClick={focusHeroQuery}>
            Describe your idea
          </CtaButton>
          <ul className="mt-9 flex flex-wrap justify-center gap-2.5">
            {PROMISES.map((promise) => (
              <li
                key={promise}
                className="rounded-full border border-white/25 bg-linear-to-b from-white/12 to-white/20 px-3.5 py-2 text-sm leading-none tracking-[0.4px] whitespace-nowrap md:px-[18px] md:text-base"
              >
                {promise}
              </li>
            ))}
          </ul>
          <p className="mt-9 max-w-[520px] text-xs leading-relaxed text-panel-foreground/55">
            Results are research leads, not investment recommendations. Always check the sources.
          </p>
        </div>
      </section>
    </main>
  )
}
