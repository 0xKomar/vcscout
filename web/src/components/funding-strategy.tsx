import { AlertTriangle, ArrowRight, Check, GitBranch } from 'lucide-react'
import { MotionReveal } from '@/components/motion-reveal'

const DEAD_END_POINTS = [
  'Small partner network with few active co-investors in your space',
  'No documented portfolio companies graduating to Series A or B',
  'Leaves you starting from cold outreach again at the next round',
]

const CONNECTED_POINTS = [
  'Backed similar companies that went on to raise strong Series A+ rounds',
  'Partners connected to downstream leads, angels, and peer founders',
  'Gives you warm context for today’s check and bridges for the next one',
]

export function FundingStrategy() {
  return (
    <section
      id="funding-paths"
      className="mx-auto max-w-7xl scroll-mt-24 border-b border-border px-5 py-20 sm:px-8 md:py-24"
    >
      <div className="grid items-start gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
        <MotionReveal>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs text-foreground/75">
            <GitBranch className="size-3.5 text-brand" aria-hidden />
            Think two rounds ahead
          </p>
          <h2 className="mt-5 max-w-[520px] font-serif text-[clamp(33px,4.2vw,52px)] leading-[1.1] tracking-[-0.04em]">
            Don&apos;t let your first check become a <span className="text-brand italic">dead end</span>.
          </h2>
          <p className="mt-5 max-w-[470px] text-sm leading-7 text-foreground/70">
            Not every early-stage check opens the same doors. Choosing a fund with a small network
            and no follow-on track record can trap your startup in a dead end — leaving you without
            warm paths to Series A leads, relevant co-investors, or operators who know your market.
          </p>
          <p className="mt-4 max-w-[470px] text-sm leading-7 text-foreground/65">
            VCScout traces how comparable startups actually moved from Seed to later rounds, helping
            you prioritize well-connected funds whose networks keep working after the wire lands.
          </p>
        </MotionReveal>

        <MotionReveal delay={0.1} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col justify-between rounded-3xl border border-warning/35 bg-warning-soft/55 p-5 sm:p-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.13em] text-warning-foreground">
                  Funding dead end
                </span>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/80 text-warning">
                  <AlertTriangle className="size-3.5" aria-hidden />
                </span>
              </div>
              <p className="mt-3 font-serif text-xl leading-snug tracking-[-0.02em] text-foreground">
                Isolated fund, narrow reach
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-1.5 rounded-2xl border border-warning/25 bg-white/80 px-3 py-2.5 text-[11px] font-medium">
                <span className="rounded-full bg-secondary px-2 py-0.5">Seed</span>
                <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                <span className="rounded-full bg-warning-soft px-2 py-0.5 text-warning-foreground">
                  Isolated fund
                </span>
                <span className="font-mono text-[10px] text-warning-foreground">· dead end</span>
              </div>
              <ul className="mt-4 flex flex-col gap-2.5 text-xs leading-5 text-foreground/75">
                {DEAD_END_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-[#cde6df] bg-gradient-to-b from-[#edf8f4] to-[#ebf4fd] p-5 sm:p-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.13em] text-connection">
                  Connected trajectory
                </span>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-connection">
                  <Check className="size-3.5" aria-hidden />
                </span>
              </div>
              <p className="mt-3 font-serif text-xl leading-snug tracking-[-0.02em] text-foreground">
                Strong network, follow-on pull
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-1.5 rounded-2xl border border-brand/20 bg-white/90 px-3 py-2.5 text-[11px] font-medium">
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-brand">Seed lead</span>
                <ArrowRight className="size-3 shrink-0 text-brand" aria-hidden />
                <span className="rounded-full bg-connection-soft px-2 py-0.5 text-connection">
                  Series A+ leads
                </span>
              </div>
              <ul className="mt-4 flex flex-col gap-2.5 text-xs leading-5 text-foreground/75">
                {CONNECTED_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-connection" aria-hidden />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </MotionReveal>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Historical progressions reflect documented past rounds in comparable startups — a lens on
        network reach to verify with primary sources, not a guarantee of future follow-on capital.
      </p>
    </section>
  )
}
