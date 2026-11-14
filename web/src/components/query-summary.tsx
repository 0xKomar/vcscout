import { ChevronDown, Pencil, UserRound, UserRoundPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { SearchForm } from '@/components/search-form'
import { STAGE_LABEL } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { IdeaQuery } from '@/lib/types'

interface QuerySummaryProps {
  idea: IdeaQuery
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmitIdea: (query: IdeaQuery) => void
  meName?: string
  onAddYourself?: () => void
}

export function QuerySummary({
  idea,
  open,
  onOpenChange,
  onSubmitIdea,
  meName,
  onAddYourself,
}: QuerySummaryProps) {
  const chips: string[] = []
  if (idea.startupName) chips.push(idea.startupName)
  chips.push(STAGE_LABEL[idea.stage])
  if (idea.region) chips.push(idea.region)
  if (idea.target) chips.push(`Target: ${idea.target}`)

  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4">
        <Collapsible open={open} onOpenChange={onOpenChange}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Your startup
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-medium">{idea.idea}</p>
              {chips.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {chips.map((chip) => (
                    <Badge key={chip} variant="secondary">
                      {chip}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            {onAddYourself && (
              <Button variant="outline" size="sm" className="shrink-0" onClick={onAddYourself}>
                {meName ? (
                  <>
                    <UserRound className="size-3.5" aria-hidden />
                    {`You: ${meName.split(' ')[0]}`}
                  </>
                ) : (
                  <>
                    <UserRoundPlus className="size-3.5" aria-hidden />
                    Add yourself
                  </>
                )}
              </Button>
            )}
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
                initialIdea={idea}
                onSubmitIdea={(query) => {
                  onOpenChange(false)
                  onSubmitIdea(query)
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
