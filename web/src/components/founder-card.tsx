import { forwardRef } from 'react'
import { Asterisk, UserRound, UserRoundPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { STAGE_LABEL } from '@/lib/format'
import type { IdeaQuery } from '@/lib/types'

interface FounderCardProps {
  query: IdeaQuery
  meName?: string
  onAddYourself?: () => void
}

export const FounderCard = forwardRef<HTMLDivElement, FounderCardProps>(function FounderCard(
  { query, meName, onAddYourself },
  ref,
) {
  const meta = [STAGE_LABEL[query.stage], query.region, query.target ? `Target: ${query.target}` : '']
    .filter(Boolean)
    .join(' · ')
  return (
    <div ref={ref} className="rounded-lg border border-brand/40 bg-brand-soft p-4 shadow-xs">
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-md bg-brand text-brand-foreground">
          <Asterisk className="size-3.5" aria-hidden />
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your startup
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold">{query.startupName || 'Your idea'}</p>
      <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-muted-foreground">{query.idea}</p>
      <p className="mt-2 text-xs text-muted-foreground">{meta}</p>
      {onAddYourself && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 h-7 text-xs"
          onClick={onAddYourself}
        >
          {meName ? (
            <>
              <UserRound className="size-3" aria-hidden />
              {`You: ${meName.split(' ')[0]} · edit`}
            </>
          ) : (
            <>
              <UserRoundPlus className="size-3" aria-hidden />
              Add yourself
            </>
          )}
        </Button>
      )}
    </div>
  )
})
