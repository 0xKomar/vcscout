import { useState, type FormEvent } from 'react'
import { Link2, UserRoundPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { normalizeLinkedinProfileUrl } from '@/lib/linkedin-csv'
import type { ManualPerson } from '@/lib/types'

interface ManualPersonFormProps {
  initial?: ManualPerson
  onClose: () => void
  onSave: (person: ManualPerson) => string | null
  onRemove?: () => void
}

export function ManualPersonForm({ initial, onClose, onSave, onRemove }: ManualPersonFormProps) {
  const [url, setUrl] = useState(initial?.profile_url ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [target, setTarget] = useState(!!initial?.target)
  const [error, setError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const profileUrl = normalizeLinkedinProfileUrl(url)
    if (!profileUrl) {
      setError('Enter a LinkedIn person profile, for example linkedin.com/in/anna-nowak.')
      return
    }
    if (target && !name.trim()) {
      setError('Add their name before using this person as a target.')
      return
    }
    const message = onSave({ profile_url: profileUrl, name: name.trim(), target })
    if (message) setError(message)
    else onClose()
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="gap-2 border-b border-border bg-secondary/40 px-5 py-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-brand">Your connection atlas</span>
          <SheetTitle className="font-serif text-2xl tracking-[-0.03em]">
            {initial ? 'Edit added person' : 'Add a missing person'}
          </SheetTitle>
          <SheetDescription className="leading-6">
            Paste their LinkedIn profile to add them to your map. A link does not mean you know them.
          </SheetDescription>
        </SheetHeader>
        <form className="flex flex-col gap-5 px-5 pb-6" onSubmit={submit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manual-linkedin">LinkedIn profile URL</Label>
            <Input
              id="manual-linkedin"
              inputMode="url"
              autoComplete="off"
              placeholder="https://www.linkedin.com/in/anna-nowak"
              maxLength={300}
              value={url}
              readOnly={!!initial}
              onChange={(event) => { setUrl(event.target.value); setError('') }}
              aria-describedby="manual-linkedin-hint"
            />
            <p id="manual-linkedin-hint" className="text-xs leading-5 text-muted-foreground">
              {initial ? 'To use a different profile, remove this person and add the new link.' : 'A profile link identifies the person; it does not import their LinkedIn data.'}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manual-name">Full name <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              id="manual-name"
              value={name}
              onChange={(event) => { setName(event.target.value); setError('') }}
              maxLength={150}
              placeholder="e.g. Anna Nowak"
              aria-describedby="manual-name-hint"
            />
            <p id="manual-name-hint" className="text-xs leading-5 text-muted-foreground">
              You can add the link alone. A name is needed to research them or select them as a target.
            </p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-secondary/40 p-3">
            <input
              type="checkbox"
              checked={target}
              onChange={(event) => { setTarget(event.target.checked); setError('') }}
              className="mt-1 size-4 shrink-0 accent-brand"
            />
            <span>
              <span className="block text-sm font-medium">This is someone I want to reach</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                Add them to your target list. Research starts only when you select them.
              </span>
            </span>
          </label>
          <div className="flex gap-2 rounded-xl bg-brand-soft/70 p-3 text-xs leading-5 text-foreground/70">
            <Link2 className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            The entry stays in your browser. Selecting a target or researching this person sends their
            details to Cala and AI web search and may use credits.
          </div>
          {error && <p role="alert" className="text-xs leading-5 text-destructive">{error}</p>}
          <Button type="submit" className="self-start">
            <UserRoundPlus className="size-4" aria-hidden />
            {initial ? 'Save person' : 'Add to map'}
          </Button>
          {onRemove && (
            <div className="border-t border-border pt-4">
              {confirmRemove ? (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-xs leading-5 text-muted-foreground">
                    Remove this addition and any &quot;I know this person&quot; confirmation attached to it?
                    Imported contacts and people found elsewhere are not deleted.
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="destructive" size="sm" onClick={() => { onRemove(); onClose() }}>
                      Yes, remove person
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setConfirmRemove(false)}>
                      Keep person
                    </Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmRemove(true)}>
                  Remove added person
                </Button>
              )}
            </div>
          )}
        </form>
      </SheetContent>
    </Sheet>
  )
}
