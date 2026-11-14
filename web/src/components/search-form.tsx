import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { STAGE_LABEL } from '@/lib/format'
import { IDEA_CHIPS, MIN_IDEA_LENGTH } from '@/lib/idea-examples'
import type { IdeaQuery, Stage } from '@/lib/types'

export interface SearchFormProps {
  initialIdea?: IdeaQuery
  onSubmitIdea: (query: IdeaQuery) => void
  onCancel?: () => void
}

export function SearchForm({
  initialIdea,
  onSubmitIdea,
  onCancel,
}: SearchFormProps) {
  const [idea, setIdea] = useState(initialIdea?.idea ?? '')
  const [startupName, setStartupName] = useState(initialIdea?.startupName ?? '')
  const [stage, setStage] = useState<Stage>(initialIdea?.stage ?? 'seed')
  const [region, setRegion] = useState(initialIdea?.region ?? '')
  const [target, setTarget] = useState(initialIdea?.target ?? '')
  const [ideaError, setIdeaError] = useState('')

  const submitIdea = () => {
    const value = idea.trim()
    if (value.length < MIN_IDEA_LENGTH) {
      setIdeaError(`Describe your idea in at least ${MIN_IDEA_LENGTH} characters.`)
      return
    }
    setIdeaError('')
    onSubmitIdea({
      idea: value,
      startupName: startupName.trim(),
      stage,
      region: region.trim(),
      target: target.trim(),
    })
  }

  const handleFormKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      submitIdea()
    }
  }

  const onIdeaSubmit = (event: FormEvent) => {
    event.preventDefault()
    submitIdea()
  }

  return (
    <form onSubmit={onIdeaSubmit} onKeyDown={handleFormKeyDown} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="idea-input">Describe your startup</Label>
          <span className="font-mono text-xs text-muted-foreground">{idea.length}/2000</span>
        </div>
        <Textarea
          id="idea-input"
          value={idea}
          onChange={(event) => {
            setIdea(event.target.value)
            if (ideaError) setIdeaError('')
          }}
          maxLength={2000}
          rows={4}
          placeholder="E.g. I'm building an AI tool that automates customer verification and compliance for European B2B fintechs…"
          aria-invalid={!!ideaError}
          aria-describedby="idea-hint idea-error"
        />
        {ideaError ? (
          <p id="idea-error" className="text-xs font-medium text-destructive">
            {ideaError}
          </p>
        ) : (
          <p id="idea-hint" className="text-xs text-muted-foreground">
            Describe the product, customers, and market — the more specific, the better.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="startup-name">
            Startup name <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="startup-name"
            value={startupName}
            onChange={(event) => setStartupName(event.target.value)}
            maxLength={80}
            placeholder="e.g. VeriFlow AI"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label id="stage-label">Current stage</Label>
          <ToggleGroup
            type="single"
            value={stage}
            onValueChange={(value) => value && setStage(value as Stage)}
            aria-labelledby="stage-label"
            variant="outline"
            className="justify-start"
          >
            <ToggleGroupItem value="seed">{STAGE_LABEL.seed}</ToggleGroupItem>
            <ToggleGroupItem value="series-a">{STAGE_LABEL['series-a']}</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="startup-region">
            Market <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="startup-region"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            maxLength={80}
            placeholder="e.g. Poland / Europe"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="startup-target">
            Round target <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="startup-target"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            maxLength={50}
            placeholder="e.g. €1.2 million"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Try:</span>
        {IDEA_CHIPS.map((chip) => (
          <Button
            key={chip.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setIdea(chip.idea)
              setIdeaError('')
              onSubmitIdea({
                idea: chip.idea,
                startupName: startupName.trim(),
                stage,
                region: region.trim(),
                target: target.trim(),
              })
            }}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">⌘/Ctrl + Enter submits the form.</p>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit">
            Search
            <ArrowUpRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </form>
  )
}
