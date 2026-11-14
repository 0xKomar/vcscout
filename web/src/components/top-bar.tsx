import { Asterisk, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CtaButton } from '@/components/cta-button'

interface TopBarProps {
  landing: boolean
  onHome: () => void
  onStartSearch: () => void
}

const NAV = [
  { href: '#graph', label: 'The graph' },
  { href: '#saved', label: 'Saved startups' },
  { href: '#how-it-works', label: 'How it works' },
]

export function TopBar({ landing, onHome, onStartSearch }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-foreground/[0.06] bg-card">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={onHome}
            aria-label="VCScout home"
            className="flex items-center gap-2 rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Asterisk className="size-4" aria-hidden />
            </span>
            <span className="text-lg font-semibold tracking-tight">
              vcscout<span className="text-brand">.</span>
            </span>
          </button>
          {landing && (
            <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3 py-1.5 text-[15px] text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="hidden h-10 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-medium sm:inline-flex">
            <span className="size-1.5 rounded-full bg-warning" aria-hidden />
            Data: Cala
          </span>
          {landing ? (
            <CtaButton size="sm" onClick={onStartSearch}>
              Start a search
            </CtaButton>
          ) : (
            <Button
              variant="secondary"
              onClick={onHome}
              aria-label="New search"
              className="h-10 rounded-full px-3 sm:px-4"
            >
              <RotateCcw className="size-4" aria-hidden />
              <span className="hidden sm:inline">New search</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
