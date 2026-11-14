import { Asterisk, RotateCcw } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { CtaButton } from '@/components/cta-button'

interface TopBarProps {
  landing: boolean
  onHome: () => void
  onStartSearch: () => void
}

const NAV = [
  { href: '#graph', label: 'The idea' },
  { href: '#funding-paths', label: 'Funding paths' },
  { href: '#how-it-works', label: 'How it works' },
]

export function TopBar({ landing, onHome, onStartSearch }: TopBarProps) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.header
      initial={reduceMotion ? false : { y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-40 border-b border-foreground/[0.07] bg-background/95 backdrop-blur-md"
    >
      <div className="relative mx-auto flex h-[72px] w-full max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8">
        {landing && (
          <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-1.5 text-sm text-foreground/75 outline-none transition-colors hover:bg-secondary hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
        <button
          type="button"
          onClick={onHome}
          aria-label="VCScout home"
          className="flex items-center gap-2 rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 lg:absolute lg:left-1/2 lg:-translate-x-1/2"
        >
          <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
            <Asterisk className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            vcscout<span className="text-connection">.</span>
          </span>
        </button>
        <div className="ml-auto flex items-center gap-2 whitespace-nowrap">
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
    </motion.header>
  )
}
