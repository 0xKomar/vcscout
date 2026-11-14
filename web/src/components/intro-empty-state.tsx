import { ArrowRight, Link2, UserRound, UserRoundPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface IntroEmptyStateProps {
  onAddYourself: () => void
}

export function IntroEmptyState({ onAddYourself }: IntroEmptyStateProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[1fr_0.8fr] md:items-center">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand">
            Your starting point
          </p>
          <h3 className="mt-3 max-w-sm font-serif text-[30px] leading-[1.15] tracking-[-0.03em]">
            Every introduction starts with you.
          </h3>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            Add the places you&apos;ve worked and studied, and the people you already know.
            They become the starting points for finding shared ground with someone you want to meet.
          </p>
          <Button className="mt-6 h-10 rounded-full px-4" onClick={onAddYourself}>
            <UserRoundPlus className="size-4" aria-hidden />
            Add yourself
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
        <div aria-hidden className="relative flex min-h-44 items-center justify-center overflow-hidden rounded-2xl bg-[#edf7f8] p-5">
          <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(#8bb9bd_0.75px,transparent_0.75px)] [background-size:16px_16px]" />
          <div className="relative flex w-full max-w-64 items-center">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><UserRound className="size-5" /></span>
            <span className="h-px flex-1 border-t border-dashed border-brand/40" />
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-brand/20 bg-card text-brand"><Link2 className="size-5" /></span>
            <span className="h-px flex-1 border-t border-dashed border-brand/40" />
            <span className="grid size-12 shrink-0 place-items-center rounded-full border border-connection/25 bg-connection-soft font-serif text-xl text-connection">?</span>
          </div>
        </div>
      </div>
      <p className="border-t border-border bg-secondary/40 px-6 py-3 text-xs leading-relaxed text-muted-foreground sm:px-8">
        Your profile stays in this browser. Research may send selected details to Cala and AI web search.
      </p>
    </div>
  )
}
