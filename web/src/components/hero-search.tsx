import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CtaButton } from '@/components/cta-button'
import { STAGE_LABEL } from '@/lib/format'
import { HERO_QUERY_ID } from '@/lib/hero-query'
import { IDEA_CHIPS, MIN_IDEA_LENGTH } from '@/lib/idea-examples'
import type { IdeaQuery, Stage } from '@/lib/types'

interface HeroSearchProps {
  examples: string[]
  onSubmitIdea: (query: IdeaQuery) => void
  onSubmitName: (name: string) => void
}

const CHIP_CLASS = 'rounded-full bg-card/80 px-3'

export function HeroSearch({ examples, onSubmitIdea, onSubmitName }: HeroSearchProps) {
  const [mode, setMode] = useState<'idea' | 'name'>('idea')
  const [idea, setIdea] = useState('')
  const [name, setName] = useState('')
  const [stage, setStage] = useState<Stage>('seed')
  const [startupName, setStartupName] = useState('')
  const [region, setRegion] = useState('')
  const [target, setTarget] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [error, setError] = useState('')

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

  const submitName = (event: FormEvent) => {
    event.preventDefault()
    const value = name.trim()
    if (value) onSubmitName(value)
  }

  const onIdeaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submitIdea()
    }
  }

  return (
    <div className="w-full max-w-[720px]">
      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as 'idea' | 'name')}
        className="gap-0"
      >
        <div className="rounded-[18px] border border-white/60 bg-white/45 p-1.5 shadow-[0_1px_2px_rgba(23,23,23,0.06),0_16px_48px_-16px_rgba(23,23,23,0.22)] md:rounded-[24px] md:p-2">
          <div className="rounded-[12px] border border-foreground/[0.06] bg-card text-left transition-colors focus-within:border-ring has-aria-invalid:border-destructive md:rounded-[16px]">
            <div className="flex items-center justify-between gap-2 px-3 pt-3">
              <TabsList>
                <TabsTrigger value="idea" className="px-2.5">
                  I have an idea
                </TabsTrigger>
                <TabsTrigger value="name" className="px-2.5">
                  I know a startup
                </TabsTrigger>
              </TabsList>
              {mode === 'idea' && (
                <span className="pr-1 font-mono text-xs text-muted-foreground">
                  {idea.length}/2000
                </span>
              )}
            </div>

            <TabsContent value="idea">
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
                {detailsOpen && (
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
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3">
                  <div className="flex items-center gap-2">
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
                    Build the graph
                  </CtaButton>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="name">
              <form onSubmit={submitName}>
                <Label htmlFor={HERO_QUERY_ID} className="sr-only">
                  Startup name
                </Label>
                <Input
                  id={HERO_QUERY_ID}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                  placeholder="E.g. Lovable, Attio, or Metaview"
                  className="h-14 rounded-none border-0 px-4 text-base focus-visible:ring-0 md:text-base"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3">
                  <p className="pl-1 text-xs text-muted-foreground">
                    Shows the company&apos;s funding rounds and lead investors.
                  </p>
                  <CtaButton type="submit" size="sm" disabled={!name.trim()}>
                    Show rounds
                  </CtaButton>
                </div>
              </form>
            </TabsContent>
          </div>
        </div>
      </Tabs>

      {mode === 'idea' ? (
        <>
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
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-sm text-foreground/70">Try:</span>
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
        </>
      ) : (
        examples.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-sm text-foreground/70">Saved results, no waiting:</span>
            {examples.map((example) => (
              <Button
                key={example}
                type="button"
                variant="outline"
                className={CHIP_CLASS}
                onClick={() => onSubmitName(example)}
              >
                {example}
              </Button>
            ))}
          </div>
        )
      )}
    </div>
  )
}
