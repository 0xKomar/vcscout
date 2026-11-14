import { ArrowDownRight, Sparkles } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { CtaButton } from '@/components/cta-button'
import { ConnectionAtlas } from '@/components/connection-atlas'
import { FundingStrategy } from '@/components/funding-strategy'
import { HeroSearch } from '@/components/hero-search'
import { LandingFeatures } from '@/components/landing-features'
import { MotionReveal } from '@/components/motion-reveal'
import { focusHeroQuery } from '@/lib/hero-query'
import type { IdeaQuery } from '@/lib/types'

interface LandingPageProps {
  onSubmitIdea: (query: IdeaQuery) => void
}

export function LandingPage({ onSubmitIdea }: LandingPageProps) {
  const reduceMotion = useReducedMotion()

  return (
    <main className="flex-1 overflow-clip bg-background">
      <section className="relative mx-auto max-w-[1440px] px-4 pb-6 pt-16 sm:px-6 md:pt-20">
        <div className="relative z-10 mx-auto flex max-w-[950px] flex-col items-center text-center">
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-2 text-xs text-foreground/75 shadow-[0_2px_10px_rgba(27,70,83,0.03)]"
          >
            <Sparkles className="size-3.5 text-connection" aria-hidden />
            Six degrees. Connected funding paths, not dead ends.
          </motion.p>
          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 35 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7 max-w-[900px] font-serif text-[clamp(44px,6.2vw,76px)] leading-[1.04] tracking-[-0.045em] text-balance"
          >
            The right people are <span className="text-brand italic">closer</span> than you think.
          </motion.h1>
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-[630px] text-base leading-[1.65] text-foreground/70 sm:text-lg"
          >
            Find the strongest funding path for your startup — avoid dead-end funds with small
            networks and no follow-on reach, and uncover the shared ground that gets you a warm
            first conversation.
          </motion.p>
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.52 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-2"
          >
            <motion.div whileHover={reduceMotion ? undefined : { scale: 1.04, y: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.97 }}>
              <CtaButton onClick={focusHeroQuery}>Find your way in</CtaButton>
            </motion.div>
            <a href="#how-it-works" className="inline-flex items-center gap-1.5 rounded-full px-4 py-3 text-sm font-medium text-foreground/70 transition-colors hover:text-brand">
              How it works <ArrowDownRight className="size-4" aria-hidden />
            </a>
          </motion.div>
        </div>
        <div id="graph" className="mx-auto mt-6 scroll-mt-24 sm:mt-8">
          <ConnectionAtlas />
        </div>
        <MotionReveal className="mx-auto mt-6 flex max-w-3xl items-center justify-center gap-3 px-4 text-center">
          <span className="font-serif text-3xl leading-none text-connection">06</span>
          <p className="max-w-[460px] text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Inspired by six degrees of separation. Grounded in real people, real context, and sources you can check.
          </p>
        </MotionReveal>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-20 sm:px-8 md:pt-28">
        <div className="relative overflow-hidden rounded-[28px] border border-[#e0edf0] bg-[#f5fafb] px-5 py-10 sm:px-10 md:py-14 lg:grid lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16 lg:px-14">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_100%,rgba(115,214,172,0.17),transparent_45%),radial-gradient(ellipse_at_100%_0%,rgba(127,190,243,0.16),transparent_45%)]" />
          <MotionReveal className="relative">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs text-foreground/70"><Sparkles className="size-3.5 text-brand" aria-hidden /> Start here</p>
            <h2 className="mt-5 max-w-[440px] font-serif text-[clamp(34px,4vw,49px)] leading-[1.1] tracking-[-0.035em]">
              Tell us what you&apos;re building.
            </h2>
            <p className="mt-4 max-w-[420px] text-sm leading-7 text-foreground/65">
              Describe your startup and we&apos;ll map comparable companies, separate well-connected
              funds with real follow-on bridges from isolated dead ends, and guide you step by step
              toward a warm introduction.
            </p>
          </MotionReveal>
          <MotionReveal delay={0.12} className="relative mt-8 lg:mt-0">
            <HeroSearch onSubmitIdea={onSubmitIdea} />
          </MotionReveal>
        </div>
      </section>

      <FundingStrategy />
      <LandingFeatures />

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 md:pb-24">
        <MotionReveal className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#123b6d] via-[#0f5b73] to-[#17775e] px-7 py-14 text-white sm:px-12 md:py-20">
          <motion.span
            aria-hidden
            animate={reduceMotion ? undefined : { y: [0, -15, 0], rotate: [0, 3, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -right-3 -top-14 font-serif text-[210px] leading-none text-white/[0.08] md:text-[300px]"
          >06</motion.span>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#a5e4d1]">Your next conversation starts here</p>
          <h2 className="relative mt-5 max-w-[700px] font-serif text-[clamp(35px,5vw,58px)] leading-[1.08] tracking-[-0.04em]">
            You don&apos;t have to know everyone. Just where to begin.
          </h2>
          <p className="relative mt-5 max-w-[510px] text-sm leading-7 text-white/75">
            Start with your idea. We&apos;ll help you find a more human way to reach the right people.
          </p>
          <CtaButton tone="light" className="relative mt-8" onClick={focusHeroQuery}>Start your search</CtaButton>
        </MotionReveal>
      </section>
    </main>
  )
}
