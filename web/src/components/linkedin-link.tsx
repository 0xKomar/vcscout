import { ArrowUpRight, Loader2 } from 'lucide-react'
import { useLinkedin } from '@/hooks/use-linkedin'
import type { LinkedinKind } from '@/lib/types'

interface LinkedinLinkProps {
  name: string
  organization: string
  kind: LinkedinKind
}

const LINK_CLASS =
  'inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline'

export function LinkedinLink({ name, organization, kind }: LinkedinLinkProps) {
  const state = useLinkedin(name, organization, kind)

  if (state.status === 'loading') {
    return (
      <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />
        Looking for a LinkedIn profile…
      </p>
    )
  }

  if (state.status === 'done' && state.profile.url) {
    return (
      <div className="flex flex-col gap-1">
        <a href={state.profile.url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          LinkedIn profile
          <ArrowUpRight className="size-3" aria-hidden />
        </a>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Matched by web search{state.profile.evidence ? `: ${state.profile.evidence}` : ''}. Check
          that it is the right person.
        </p>
      </div>
    )
  }

  const search = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${name} ${organization}`)}`
  return (
    <div className="flex flex-col gap-1">
      <a href={search} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        Search on LinkedIn
        <ArrowUpRight className="size-3" aria-hidden />
      </a>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {state.status === 'error'
          ? 'The profile lookup failed.'
          : 'No profile could be matched with confidence.'}
      </p>
    </div>
  )
}
