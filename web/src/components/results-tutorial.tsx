import { useCallback, useEffect, useId, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Lightbulb, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { clampSpotlightRect, TUTORIAL_STEPS, type SpotlightRect } from '@/lib/tutorial'
import { cn } from '@/lib/utils'

interface ResultsTutorialProps {
  open: boolean
  paused?: boolean
  stepIndex: number
  onStepChange: (index: number) => void
  onClose: () => void
}

export function ResultsTutorial({
  open,
  paused = false,
  stepIndex,
  onStepChange,
  onClose,
}: ResultsTutorialProps) {
  const maskId = useId()
  const reduceMotion = useReducedMotion()
  const [rects, setRects] = useState<SpotlightRect[]>([])
  const [minimized, setMinimized] = useState(false)

  const active = open && !paused
  const step = TUTORIAL_STEPS[stepIndex] ?? TUTORIAL_STEPS[0]

  const measure = useCallback(() => {
    if (!active) return
    const header = document.querySelector('header')
    const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 72
    const viewport = { width: window.innerWidth, height: window.innerHeight }
    const next: SpotlightRect[] = []
    for (const target of step.targets) {
      const elements = Array.from(document.querySelectorAll<HTMLElement>(`[data-tutorial="${target}"]`))
      for (const el of elements) {
        const clamped = clampSpotlightRect(el.getBoundingClientRect(), viewport, headerBottom, 8)
        if (clamped) next.push(clamped)
      }
    }
    setRects(next)
  }, [active, step.targets])

  useEffect(() => {
    if (!active) return
    let raf = requestAnimationFrame(measure)
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const resizeObserver = new ResizeObserver(schedule)
    for (const target of step.targets) {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[data-tutorial="${target}"]`))) {
        resizeObserver.observe(el)
      }
    }
    const main = document.querySelector('main')
    const mutationObserver = new MutationObserver(schedule)
    if (main) {
      mutationObserver.observe(main, { childList: true, subtree: true, attributes: false })
    }
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [active, measure, step.targets])

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName
      const editable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (!editable && event.key === 'ArrowRight' && stepIndex < TUTORIAL_STEPS.length - 1) {
        event.preventDefault()
        onStepChange(stepIndex + 1)
      } else if (!editable && event.key === 'ArrowLeft' && stepIndex > 0) {
        event.preventDefault()
        onStepChange(stepIndex - 1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, onClose, onStepChange, stepIndex])

  if (!active) return null

  const isLast = stepIndex >= TUTORIAL_STEPS.length - 1

  return (
    <>
      <div
        data-testid="tutorial-spotlight"
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[45]"
      >
        <svg className="size-full">
          <defs>
            <mask id={maskId}>
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {rects.map((rect, index) => (
                <rect
                  key={index}
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  rx={rect.rx}
                  ry={rect.rx}
                  fill="black"
                />
              ))}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(14, 34, 53, 0.46)"
            mask={`url(#${maskId})`}
          />
          {rects.map((rect, index) => (
            <rect
              key={index}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={rect.rx}
              ry={rect.rx}
              fill="none"
              stroke="rgba(255, 255, 255, 0.92)"
              strokeWidth="2"
            />
          ))}
        </svg>
      </div>

      <motion.section
        data-testid="results-tutorial"
        role="region"
        aria-label="Interactive walkthrough"
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-auto relative z-[48] rounded-2xl border border-[#cde0e7] bg-card p-4 shadow-[0_24px_70px_-20px_rgba(14,42,63,0.45)] xl:fixed xl:right-6 xl:bottom-6 xl:max-h-[78vh] xl:w-[390px] xl:overflow-y-auto xl:p-5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 font-mono text-[10px] font-semibold text-brand">
              {step.number} / 0{TUTORIAL_STEPS.length}
            </span>
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
              {step.location}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              aria-label={minimized ? 'Expand tutorial' : 'Minimize tutorial'}
              onClick={() => setMinimized((value) => !value)}
            >
              <ChevronDown
                className={cn('size-4 transition-transform', minimized && 'rotate-180')}
                aria-hidden
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              aria-label="Close tutorial"
              onClick={onClose}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-1" role="tablist" aria-label="Tutorial steps">
          {TUTORIAL_STEPS.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={index === stepIndex}
              aria-label={`Step ${index + 1}: ${entry.title}`}
              onClick={() => onStepChange(index)}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                index === stepIndex
                  ? 'bg-brand'
                  : index < stepIndex
                    ? 'bg-brand/35 hover:bg-brand/55'
                    : 'bg-secondary hover:bg-muted-foreground/25',
              )}
            />
          ))}
        </div>

        <h2 className="mt-3 font-serif text-lg leading-snug tracking-[-0.025em] sm:text-xl">
          {step.title}
        </h2>

        {!minimized && (
          <div className="mt-2.5 flex flex-col gap-2.5">
            <p className="text-xs leading-5 text-muted-foreground">{step.where}</p>
            <p className="text-xs leading-5 text-foreground">
              <span className="font-semibold text-brand">What to do: </span>
              {step.action}
            </p>
            <div className="rounded-xl border border-connection/20 bg-[#eef8f4] px-3 py-2.5">
              <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.11em] text-connection">
                <Lightbulb className="size-3" aria-hidden />
                What conclusion to draw
              </p>
              <p className="mt-1 text-xs leading-5 text-foreground/85">{step.takeaway}</p>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <Button type="button" variant="ghost" size="sm" className="px-2 text-xs" onClick={onClose}>
            Skip tutorial
          </Button>
          <div className="flex items-center gap-1.5">
            {stepIndex > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onStepChange(stepIndex - 1)}
              >
                <ArrowLeft className="size-3.5" aria-hidden />
                Back
              </Button>
            )}
            {isLast ? (
              <Button type="button" size="sm" onClick={onClose}>
                Start exploring
                <Check className="size-3.5" aria-hidden />
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => onStepChange(stepIndex + 1)}>
                Next
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </motion.section>
    </>
  )
}
