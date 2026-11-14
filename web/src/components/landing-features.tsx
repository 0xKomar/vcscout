import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Lightbulb,
  Route,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react'
import { FeatureCard } from '@/components/feature-card'

const ROUNDS = [
  { label: 'Pre-Seed', width: 'w-16' },
  { label: 'Seed', width: 'w-24' },
  { label: 'Series A', width: 'w-20' },
]

export function LandingFeatures() {
  return (
    <section
      id="how-it-works"
      className="mx-auto flex w-full max-w-6xl scroll-mt-24 flex-col items-center px-4 sm:px-8"
    >
      <p className="scroll-reveal flex w-fit items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2 text-[15px] leading-[1.3] tracking-[0.3px] text-foreground/80">
        <Sparkles className="size-[15px] text-brand" aria-hidden />
        How it works
      </p>
      <h2 className="scroll-reveal mt-6 max-w-[620px] text-center font-serif text-[28px] leading-[1.2] tracking-[0.02em] text-balance md:text-[36px]">
        From one sentence to the people worth a first message
      </h2>
      <p className="scroll-reveal mt-6 max-w-[520px] text-center text-[15px] leading-[1.45] tracking-[0.3px] text-foreground/80">
        VCScout compares your idea with startups that already raised, then follows their rounds to
        the funds and people involved. Every link points to a public source.
      </p>

      <div className="scroll-reveal mt-12 flex w-full flex-col gap-3 rounded-[28px] border border-card bg-linear-to-b from-secondary to-card p-2 md:rounded-[36px] md:p-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <FeatureCard
            icon={Lightbulb}
            title="Describe what you're building"
            text="Your product, customers, and market. Add your stage and round target if you have them."
          >
            <div className="w-full max-w-xs rounded-xl border border-border p-3 text-left">
              <p className="text-sm leading-relaxed">
                An AI tool for recruiting teams that analyzes job interviews
                <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-foreground" />
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium">
                  Seed
                </span>
                <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
                  <ArrowRight className="size-3.5" />
                </span>
              </div>
            </div>
          </FeatureCard>
          <FeatureCard
            icon={Route}
            title="Similar startups and their funding histories"
            text="Cala finds companies close to your idea and the rounds they raised, with lead investors and a source for each round."
          >
            <ol className="flex w-full max-w-md flex-col gap-2.5 text-left">
              {ROUNDS.map((round) => (
                <li
                  key={round.label}
                  className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"
                >
                  <span className="size-2 shrink-0 rounded-full bg-brand" />
                  <span className="w-16 shrink-0 text-xs font-medium">{round.label}</span>
                  <span className={`h-2 rounded-full bg-muted ${round.width}`} />
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    Source
                    <ArrowUpRight className="size-3" />
                  </span>
                </li>
              ))}
            </ol>
          </FeatureCard>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <FeatureCard
            icon={Users}
            title="Funds and the people behind each round"
            text="Explore the graph from any node: a fund's other early investments, a partner's deals, and a draft for your first message."
          >
            <div className="flex w-full max-w-md items-start gap-3 rounded-xl border border-border p-3 text-left">
              <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-border bg-secondary text-[11px] font-semibold">
                MH
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">Magnus Hambleton</p>
                <p className="text-xs text-muted-foreground">Partner · byFounders</p>
                <p className="mt-2 text-xs leading-relaxed text-foreground/70">
                  Author of the Lovable investment article
                </p>
                <span className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  byfounders.vc
                  <ArrowUpRight className="size-3" />
                </span>
              </div>
            </div>
          </FeatureCard>
          <FeatureCard
            icon={ShieldAlert}
            title="Potential portfolio conflicts, flagged early"
            text="Before you reach out, see which funds already back a company that competes with your idea."
          >
            <div className="w-full max-w-xs rounded-xl border border-warning/40 bg-warning-soft p-3 text-left">
              <p className="flex items-center gap-2 text-xs font-medium text-warning-foreground">
                <AlertTriangle className="size-3.5" />
                Potential conflict
              </p>
              <span className="mt-3 block h-2 w-40 rounded-full bg-warning/25" />
              <span className="mt-2 block h-2 w-28 rounded-full bg-warning/25" />
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  )
}
