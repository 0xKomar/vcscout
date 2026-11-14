import { ChevronDown, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { SearchForm } from '@/components/search-form'
import { STAGE_LABEL } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { IdeaQuery } from '@/lib/types'

interface QuerySummaryProps {
  mode: 'idea' | 'name'
  idea?: IdeaQuery
  name?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmitIdea: (query: IdeaQuery) => void
  onSubmitName: (name: string) => void
}

export function QuerySummary({
  mode,
  idea,
  name,
  open,
  onOpenChange,
  onSubmitIdea,
  onSubmitName,
}: QuerySummaryProps) {
  const chips: string[] = []
  if (mode === 'idea' && idea) {
    if (idea.startupName) chips.push(idea.startupName)
    chips.push(STAGE_LABEL[idea.stage])
    if (idea.region) chips.push(idea.region)
    if (idea.target) chips.push(`Target: ${idea.target}`)
  }

  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4">
        <Collapsible open={open} onOpenChange={onOpenChange}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {mode === 'idea' ? 'Your idea' : 'Startup search'}
              </p>
              {mode === 'idea' ? (
                <>
                  <p className="mt-1 line-clamp-2 text-sm font-medium">{idea?.idea}</p>
                  {chips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {chips.map((chip) => (
                        <Badge key={chip} variant="secondary">
                          {chip}
                        </Badge>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-1 text-sm font-medium">{name}</p>
              )}
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="shrink-0">
                <Pencil className="size-3.5" aria-hidden />
                {open ? 'Close' : 'Edit'}
                <ChevronDown
                  className={cn('size-3.5 transition-transform', open && 'rotate-180')}
                  aria-hidden
                />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="pt-4">
            <div className="border-t border-border pt-4">
              <SearchForm
                mode={mode}
                initialIdea={idea}
                initialName={name}
                onSubmitIdea={(query) => {
                  onOpenChange(false)
                  onSubmitIdea(query)
                }}
                onSubmitName={(value) => {
                  onOpenChange(false)
                  onSubmitName(value)
                }}
                onCancel={() => onOpenChange(false)}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
