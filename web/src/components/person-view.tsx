import { useRef, useState } from 'react'
import { ArrowLeft, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LinkedinLink } from '@/components/linkedin-link'
import { PersonAvatar } from '@/components/person-avatar'
import { SourceLink } from '@/components/source-link'
import { linkedinKey, useLinkedinPhotos } from '@/hooks/use-linkedin'
import { buildDraft, buildFounderDraft } from '@/lib/format'
import type { Partner } from '@/lib/types'

interface PersonViewProps {
  person: Partner
  fund: string
  company: string
  idea?: string
  founder?: boolean
  onBack: () => void
}

export function PersonView({ person, fund, company, idea, founder, onBack }: PersonViewProps) {
  const organization = founder ? company : fund
  const photo = useLinkedinPhotos()[linkedinKey(person.name, organization)]
  const draftRef = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState(() => {
    if (!idea) return ''
    return founder
      ? buildFounderDraft({ personName: person.name, idea, company })
      : buildDraft({ personName: person.name, idea, fund, company })
  })
  const [copyLabel, setCopyLabel] = useState('Copy draft')

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draft)
      setCopyLabel('Copied ✓')
    } catch {
      draftRef.current?.focus()
      draftRef.current?.select()
      setCopyLabel('Selected — copy the text')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <PersonAvatar name={person.name} photo={photo} size="lg" className="text-sm" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{person.name}</p>
          <p className="text-xs text-muted-foreground">
            {person.role || 'Person linked to the investment'}
          </p>
        </div>
      </div>
      <section className="flex flex-col gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Context and source
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {person.connection || 'Person linked to the investment.'}
        </p>
        <SourceLink url={person.source_url} label="Check source" />
      </section>
      <section className="flex flex-col gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">LinkedIn</p>
        <LinkedinLink
          name={person.name}
          organization={organization}
          kind={founder ? 'startup' : 'fund'}
        />
      </section>
      {idea ? (
        <section className="flex flex-col gap-2">
          <Label htmlFor="draft-message">Message draft</Label>
          <Textarea
            id="draft-message"
            ref={draftRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={9}
            className="text-xs leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyDraft}>
              <Copy className="size-3.5" aria-hidden />
              {copyLabel}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The draft stays in your browser — the app does not send anything automatically.
          </p>
        </section>
      ) : (
        <p className="text-xs text-muted-foreground">
          Message drafts are available in the &quot;I have an idea&quot; flow.
        </p>
      )}
    </div>
  )
}
