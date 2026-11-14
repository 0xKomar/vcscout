import { ArrowUpRight, Asterisk, CircleDot, Link2, Sparkles, UserRound } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

const POINTS = [
  {
    number: '01 / start', label: 'You', icon: UserRound,
    position: 'left-[5%] top-[49%] sm:left-[4%] sm:top-[53%]',
    tone: 'bg-primary text-white',
  },
  {
    number: '02 / shared', label: 'Common ground', icon: Link2,
    position: 'left-[22%] top-[21%] sm:left-[28%] sm:top-[22%]',
    tone: 'bg-brand-soft text-brand',
  },
  {
    number: '03 / bridge', label: 'A person', icon: Sparkles,
    position: 'left-[46%] top-[66%] sm:left-[53%] sm:top-[60%]',
    tone: 'bg-connection-soft text-connection',
  },
  {
    number: '04 / meet', label: 'Your target', icon: ArrowUpRight,
    position: 'right-[4%] top-[42%] sm:right-[3%] sm:top-[31%]',
    tone: 'bg-brand text-white',
  },
]

export function ConnectionAtlas() {
  const reduceMotion = useReducedMotion()
  return (
    <div
      role="img"
      aria-label="Illustration of a possible path from you, through shared ground and another person, to a founder or investor."
      className="relative overflow-hidden rounded-[32px] px-2 pb-0 pt-10 sm:px-8 sm:pt-14 lg:px-16"
    >
      <motion.div
        aria-hidden
        className="atlas-light-rays absolute inset-x-0 bottom-0 h-[90%] rounded-[32px]"
        animate={reduceMotion ? undefined : { opacity: [0.7, 1, 0.7], scaleX: [1, 1.04, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="relative mx-auto max-w-[1120px] rounded-t-[24px] border border-white bg-white/75 p-1.5 shadow-[0_18px_75px_-28px_rgba(17,70,87,0.35)] sm:p-2"
        initial={reduceMotion ? false : { opacity: 0, y: 36, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="overflow-hidden rounded-t-[18px] border border-[#dce8ed] bg-white">
          <div className="flex h-14 items-center justify-between gap-3 border-b border-border px-4 sm:px-5">
            <div className="flex items-center gap-2 text-xs font-semibold sm:text-sm">
              <span className="grid size-7 place-items-center rounded-lg bg-primary text-white"><Asterisk className="size-4" /></span>
              Connection atlas
            </div>
            <div className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
              <span className="font-medium text-foreground">Path explorer</span>
              <span>Shared ground</span>
            </div>
            <span className="rounded-full border border-border bg-secondary/50 px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Illustration</span>
          </div>
          <div className="grid lg:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_180px]">
            <div className="hidden border-r border-border px-4 py-5 lg:block">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Your starting point</p>
              <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold"><span className="grid size-8 place-items-center rounded-full bg-brand-soft text-brand"><UserRound className="size-4" /></span> You</div>
                <p className="mt-2 text-[11px] leading-4 text-muted-foreground">Your people and places.</p>
              </div>
              <div className="ml-4 h-8 border-l border-dashed border-[#b4ced4]" />
              <div className="rounded-xl border border-connection/20 bg-connection-soft/60 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold"><span className="grid size-8 place-items-center rounded-full bg-white text-connection"><ArrowUpRight className="size-4" /></span> Someone new</div>
                <p className="mt-2 text-[11px] leading-4 text-muted-foreground">A founder or investor.</p>
              </div>
            </div>
            <div className="atlas-canvas relative h-[330px] overflow-hidden sm:h-[380px]">
              <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-border bg-white/90 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                <CircleDot className="size-3 text-connection" /> A possible path
              </div>
              <span className="absolute right-4 top-3 font-serif text-[70px] leading-none tracking-[-0.08em] text-brand/[0.07] sm:text-[100px]">06</span>
              <svg aria-hidden viewBox="0 0 600 550" className="absolute inset-0 h-full w-full sm:hidden" preserveAspectRatio="none">
                <defs><linearGradient id="atlas-mobile-line"><stop stopColor="#247ad6" /><stop offset="1" stopColor="#16a579" /></linearGradient></defs>
                <path d="M100 320 C145 290 160 175 260 175 S300 365 365 396 S420 285 490 280" fill="none" stroke="#d6e8ed" strokeWidth="2" strokeDasharray="5 8" />
                <motion.path d="M100 320 C145 290 160 175 260 175 S300 365 365 396 S420 285 490 280" fill="none" stroke="url(#atlas-mobile-line)" strokeWidth="3" strokeLinecap="round" initial={reduceMotion ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 2.2, delay: 0.3, ease: 'easeInOut' }} />
              </svg>
              <svg aria-hidden viewBox="0 0 800 400" className="absolute inset-0 hidden h-full w-full sm:block" preserveAspectRatio="none">
                <defs><linearGradient id="atlas-desktop-line"><stop stopColor="#247ad6" /><stop offset="1" stopColor="#16a579" /></linearGradient></defs>
                <path d="M95 240 C170 240 170 115 290 115 S360 272 455 260 S590 150 705 160" fill="none" stroke="#d6e8ed" strokeWidth="2" strokeDasharray="5 8" />
                <motion.path d="M95 240 C170 240 170 115 290 115 S360 272 455 260 S590 150 705 160" fill="none" stroke="url(#atlas-desktop-line)" strokeWidth="3" strokeLinecap="round" initial={reduceMotion ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 2.2, delay: 0.3, ease: 'easeInOut' }} />
                <path d="M290 115 C350 50 435 55 490 90 M455 260 C485 320 565 335 620 315 M95 240 C90 305 140 330 200 305" fill="none" stroke="#d9e9e9" strokeWidth="1.5" />
                <g fill="#c7e1dc"><circle cx="490" cy="90" r="5" /><circle cx="620" cy="315" r="5" /><circle cx="200" cy="305" r="5" /></g>
              </svg>
              {POINTS.map(({ number, label, icon: Icon, position, tone }, index) => (
                <motion.div
                  key={number}
                  className={cn('atlas-node absolute', position)}
                  initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.92 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  <motion.div
                    animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
                    transition={{ duration: 3.5 + index * 0.4, delay: index * 0.25, repeat: Infinity, ease: 'easeInOut' }}
                    className="flex items-center gap-1.5 rounded-2xl border border-[#e2ebef] bg-white p-2 shadow-[0_8px_26px_-12px_rgba(18,62,81,0.32)] min-[375px]:gap-2 min-[375px]:p-2.5"
                  >
                    <span className={cn('grid size-8 shrink-0 place-items-center rounded-full min-[375px]:size-9', tone)}><Icon className="size-4" /></span>
                    <span className="whitespace-nowrap text-left"><span className="block font-mono text-[8px] uppercase tracking-wider text-muted-foreground">{number}</span><span className="text-xs font-semibold">{label}</span></span>
                  </motion.div>
                </motion.div>
              ))}
              <div className="absolute inset-x-4 bottom-3 flex items-center justify-between border-t border-border/70 pt-2 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                <span>Context before contact</span><span className="hidden min-[360px]:inline">Illustrative path</span>
              </div>
            </div>
            <div className="hidden border-l border-border px-4 py-5 xl:block">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Shared context</p>
              <div className="mt-4 rounded-xl border border-border p-3">
                <span className="grid size-8 place-items-center rounded-lg bg-connection-soft text-connection"><Link2 className="size-4" /></span>
                <p className="mt-3 text-xs font-semibold">A reason to reach out</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Look for people, places and sources in common.</p>
              </div>
              <p className="mt-4 text-[10px] leading-4 text-muted-foreground">An example, not a claim that people know each other.</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
