import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Compass, HeartHandshake, Link2, ScanSearch, Sparkles } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { MotionReveal } from '@/components/motion-reveal'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    number: '01',
    icon: Compass,
    title: 'Map your funding trajectory',
    text: 'Describe your startup to uncover peer companies, see which funds connect to later-stage leads, and avoid isolated dead-end investors.',
    tag: 'AVOID DEAD-END CAPITAL',
    preview: ['Your startup description', 'Funds with follow-on bridges', 'Founders & partners in reach'],
    caption: 'Spot funds whose networks carry startups to the next round.',
  },
  {
    number: '02',
    icon: ScanSearch,
    title: 'Choose who to meet',
    text: 'Pick a founder or investor and add your own background and contacts. The search starts from both ends.',
    tag: 'CHOOSE A PERSON',
    preview: ['You and your network', 'A person to meet', 'Research from both sides'],
    caption: 'Choose who matters and explore from both ends.',
  },
  {
    number: '03',
    icon: HeartHandshake,
    title: 'Find a way in',
    text: 'Explore shared places, people, and possible bridges. Check the evidence, then make the introduction your own.',
    tag: 'CONTEXT BEFORE CONTACT',
    preview: ['Someone you know', 'A shared experience', 'A possible introduction'],
    caption: 'Find a thoughtful reason to start a conversation.',
  },
]

export function LandingFeatures() {
  const [active, setActive] = useState(0)
  const reduceMotion = useReducedMotion()
  const current = STEPS[active]
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 sm:px-8 md:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <MotionReveal>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs text-foreground/70">
            <Sparkles className="size-3.5 text-connection" aria-hidden /> How it works
          </p>
          <h2 className="mt-5 max-w-[500px] font-serif text-[clamp(36px,4.4vw,54px)] leading-[1.1] tracking-[-0.04em]">
            A smaller world starts with a better question.
          </h2>
          <p className="mt-5 max-w-[440px] text-sm leading-7 text-foreground/65">
            Six degrees is a theory, not a promise. Follow the threads you can actually see
            and turn cold outreach into a more thoughtful first conversation.
          </p>
          <ol className="mt-8 flex flex-col gap-2" aria-label="Explore how VCScout works">
            {STEPS.map(({ number, icon: Icon, title, text }, index) => (
              <li key={number}>
                <motion.button
                  type="button"
                  aria-pressed={active === index}
                  onClick={() => setActive(index)}
                  whileHover={reduceMotion ? undefined : { x: 4 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors',
                    active === index ? 'border-brand/20 bg-brand-soft/60' : 'border-transparent hover:border-border hover:bg-secondary/50',
                  )}
                >
                  <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', active === index ? 'bg-white text-brand' : 'bg-secondary text-muted-foreground')}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold"><span className="font-mono text-[10px] font-normal text-muted-foreground">{number}</span> {title}</span>
                    {active === index && <span className="mt-1 block text-xs leading-5 text-muted-foreground">{text}</span>}
                  </span>
                  <ArrowUpRight className={cn('mt-1 size-4 shrink-0', active === index ? 'text-brand' : 'text-muted-foreground/50')} aria-hidden />
                </motion.button>
              </li>
            ))}
          </ol>
        </MotionReveal>
        <MotionReveal delay={0.12}>
          <div className="relative overflow-hidden rounded-[28px] border border-[#d9ebea] bg-gradient-to-br from-[#e4f6ef] via-[#f4fbfb] to-[#dceefe] px-5 py-12 sm:px-10 sm:py-16">
            <motion.div
              aria-hidden
              animate={reduceMotion ? undefined : { x: [0, 20, 0], y: [0, -15, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -right-10 top-0 size-52 rounded-full bg-[#8ac8f2]/25 blur-3xl"
            />
            <motion.div
              aria-hidden
              animate={reduceMotion ? undefined : { x: [0, -15, 0], y: [0, 16, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-10 left-0 size-52 rounded-full bg-[#80dbb0]/30 blur-3xl"
            />
            <div className="relative mx-auto max-w-[430px] rounded-[24px] border border-white/80 bg-white/70 p-2 shadow-[0_20px_70px_-28px_rgba(33,95,103,0.35)]">
              <div className="overflow-hidden rounded-[18px] border border-border bg-white">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <span className="flex items-center gap-2 text-xs font-semibold"><span className="grid size-7 place-items-center rounded-lg bg-connection-soft text-connection"><Link2 className="size-3.5" /></span> The connection journey</span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Example</span>
                </div>
                <div className="min-h-[320px] p-5 sm:p-7" aria-live="polite">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={current.number}
                      initial={reduceMotion ? false : { opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, x: -20 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    >
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-brand">{current.number} / {current.tag}</p>
                      <p className="mt-2 max-w-[300px] font-serif text-[23px] leading-tight tracking-[-0.02em]">{current.caption}</p>
                      <div className="mt-6">
                        {current.preview.map((item, index) => (
                          <motion.div
                            key={item}
                            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, delay: index * 0.1 }}
                            className="relative"
                          >
                            {index > 0 && <div className="ml-4 h-4 border-l border-dashed border-[#9dcfc8]" />}
                            <div className="flex items-center gap-3 rounded-xl border border-border bg-[#fbfdfd] px-3 py-2.5 text-xs font-medium">
                              <span className={cn('grid size-8 place-items-center rounded-full font-mono text-[10px]', index === 2 ? 'bg-connection-soft text-connection' : 'bg-brand-soft text-brand')}>0{index + 1}</span>
                              {item}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="flex items-center gap-2 border-t border-border bg-secondary/40 px-5 py-3 text-[11px] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-connection" />
                  An illustration, not a guaranteed introduction.
                </div>
              </div>
            </div>
          </div>
        </MotionReveal>
      </div>
      <MotionReveal className="mt-12 flex flex-col gap-4 rounded-2xl bg-[#eef8f4] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Curiosity is good. Certainty needs evidence.</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            An inferred link is a lead to verify, not proof that two people know each other.
          </p>
        </div>
        <ArrowDownRight className="hidden size-5 shrink-0 text-brand sm:block" aria-hidden />
      </MotionReveal>
    </section>
  )
}
