import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CtaButton } from '@/components/cta-button'
import { STAGE_LABEL } from '@/lib/format'
import { HERO_QUERY_ID } from '@/lib/hero-query'
import { IDEA_CHIPS, MIN_IDEA_LENGTH } from '@/lib/idea-examples'
import type { IdeaQuery, Stage } from '@/lib/types'

interface HeroSearchProps {
  onSubmitIdea: (query: IdeaQuery) => void
}

const CHIP_CLASS = 'rounded-full bg-card/80 px-3'

export function HeroSearch({ onSubmitIdea }: HeroSearchProps) {
  const [idea, setIdea] = useState('')
  const [stage, setStage] = useState<Stage>('seed')
  const [startupName, setStartupName] = useState('')
  const [region, setRegion] = useState('')
  const [target, setTarget] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [error, setError] = useState('')
  const reduceMotion = useReducedMotion()

  const ideaQuery = (text: string): IdeaQuery => ({
    idea: text,
    startupName: startupName.trim(),
    stage,
    region: region.trim(),
    target: target.trim(),
  })

  const submitIdea = (event?: FormEvent) => {
    event?.preventDefault()
    const value = idea.trim()
    if (value.length < MIN_IDEA_LENGTH) {
      setError(`Describe your idea in at least ${MIN_IDEA_LENGTH} characters.`)
      return
    }
    onSubmitIdea(ideaQuery(value))
  }

  const onIdeaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submitIdea()
    }
  }

  return (
    <div className="w-full max-w-[720px]">
      <div className="rounded-[22px] border border-white/70 bg-white/45 p-1.5 shadow-[0_18px_60px_-28px_rgba(28,48,37,0.35)] md:rounded-[26px] md:p-2">
        <div className="rounded-[12px] border border-foreground/[0.06] bg-card text-left transition-colors focus-within:border-ring has-aria-invalid:border-destructive md:rounded-[16px]">
          <div className="flex items-center justify-between gap-2 px-4 pt-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-brand">
              Describe your startup
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {idea.length}/2000
            </span>
          </div>

          <form onSubmit={submitIdea}>
            <Label htmlFor={HERO_QUERY_ID} className="sr-only">
              Describe your startup
            </Label>
            <Textarea
              id={HERO_QUERY_ID}
              value={idea}
              onChange={(event) => {
                setIdea(event.target.value)
                if (error) setError('')
              }}
              onKeyDown={onIdeaKeyDown}
              maxLength={2000}
              rows={3}
              placeholder="Describe what you're building: the product, your customers, and the market…"
              aria-invalid={!!error}
              aria-describedby="hero-query-hint"
              className="max-h-60 min-h-24 resize-none overflow-y-auto rounded-none border-0 px-4 py-3 text-base focus-visible:ring-0 aria-invalid:ring-0 md:text-base"
            />
            <AnimatePresence initial={false}>
              {detailsOpen && (
                <motion.div
                  initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="grid gap-3 border-t border-border px-4 py-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="hero-startup-name" className="text-xs text-muted-foreground">
                        Startup name
                      </Label>
                      <Input
                        id="hero-startup-name"
                        value={startupName}
                        onChange={(event) => setStartupName(event.target.value)}
                        maxLength={80}
                        placeholder="e.g. VeriFlow AI"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="hero-region" className="text-xs text-muted-foreground">
                        Market
                      </Label>
                      <Input
                        id="hero-region"
                        value={region}
                        onChange={(event) => setRegion(event.target.value)}
                        maxLength={80}
                        placeholder="e.g. Poland / Europe"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="hero-target" className="text-xs text-muted-foreground">
                        Round target
                      </Label>
                      <Input
                        id="hero-target"
                        value={target}
                        onChange={(event) => setTarget(event.target.value)}
                        maxLength={50}
                        placeholder="e.g. €1.2 million"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                  type="single"
                  value={stage}
                  onValueChange={(value) => value && setStage(value as Stage)}
                  aria-label="Current stage"
                  variant="outline"
                  size="sm"
                >
                  <ToggleGroupItem value="seed">{STAGE_LABEL.seed}</ToggleGroupItem>
                  <ToggleGroupItem value="series-a">{STAGE_LABEL['series-a']}</ToggleGroupItem>
                </ToggleGroup>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-expanded={detailsOpen}
                  onClick={() => setDetailsOpen((open) => !open)}
                >
                  <SlidersHorizontal aria-hidden />
                  Details
                </Button>
              </div>
              <CtaButton type="submit" size="sm">
                Search
              </CtaButton>
            </div>
          </form>
        </div>
      </div>

      <p
        id="hero-query-hint"
        className={
          error
            ? 'mt-3 text-sm font-medium text-destructive'
            : 'mt-3 text-xs text-foreground/55'
        }
      >
        {error ||
          'Enter to search · Shift + Enter for a new line. A new Cala query can take about a minute.'}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-foreground/70">Try an example description:</span>
        {IDEA_CHIPS.map((chip) => (
          <Button
            key={chip.label}
            type="button"
            variant="outline"
            className={CHIP_CLASS}
            onClick={() => {
              setIdea(chip.idea)
              setError('')
              onSubmitIdea(ideaQuery(chip.idea))
            }}
          >
            {chip.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
