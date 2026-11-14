import { useRef, useState } from 'react'
import { Loader2, Plus, Upload, X } from 'lucide-react'
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
import { SourceLink } from '@/components/source-link'
import { useLinkedinConnections } from '@/hooks/use-linkedin-connections'
import { useMe } from '@/hooks/use-me'
import { factYears } from '@/lib/intro'
import type { Fact, MeContact, MeEmployer, MeInput } from '@/lib/types'

const KIND_LABEL: Record<Fact['kind'], string> = {
  role: 'Role',
  education: 'Education',
  board: 'Board seat',
  advisor: 'Advisor',
  angel: 'Angel investment',
  program: 'Program',
  coinvestor: 'Co-investor',
  deal: 'Deal',
}

function emptyEmployer(): MeEmployer {
  return { organization: '', start: '', end: '' }
}

interface MeProfileFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MeProfileForm({ open, onOpenChange }: MeProfileFormProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="gap-2 border-b border-border bg-secondary/40 px-5 py-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-brand">Your starting point</span>
          <SheetTitle className="font-serif text-2xl tracking-[-0.03em]">Your profile</SheetTitle>
          <SheetDescription className="leading-6">
            Your experiences and the people you know can be the first step toward someone new.
            Add what you&apos;re comfortable sharing.
          </SheetDescription>
        </SheetHeader>
        {open && <MeProfileFormInner onOpenChange={onOpenChange} />}
      </SheetContent>
    </Sheet>
  )
}

function MeProfileFormInner({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const me = useMe()
  const [name, setName] = useState(me.profile?.name ?? '')
  const [linkedinUrl, setLinkedinUrl] = useState(me.profile?.linkedin_url ?? '')
  const [employers, setEmployers] = useState<MeEmployer[]>(() =>
    me.profile?.employers.length
      ? me.profile.employers.map((employer) => ({ ...employer }))
      : [emptyEmployer()],
  )
  const [schools, setSchools] = useState<string[]>(() =>
    me.profile?.schools.length ? [...me.profile.schools] : [''],
  )
  const [contacts, setContacts] = useState<MeContact[]>(() =>
    me.profile?.contacts.length ? me.profile.contacts.map((c) => ({ ...c })) : [],
  )
  const [urlError, setUrlError] = useState(false)
  const linkedin = useLinkedinConnections()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')

  const patchContact = (index: number, patch: Partial<MeContact>) => {
    setContacts((current) =>
      current.map((contact, i) => (i === index ? { ...contact, ...patch } : contact)),
    )
  }

  const importCsv = async (file: File) => {
    setImporting(true)
    setImportError('')
    try {
      await linkedin.importFile(file)
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : 'Could not find connections in this file.',
      )
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const patchEmployer = (index: number, patch: Partial<MeEmployer>) => {
    setEmployers((current) =>
      current.map((employer, i) => (i === index ? { ...employer, ...patch } : employer)),
    )
  }

  const submit = () => {
    const url = linkedinUrl.trim()
    const urlOk =
      !url ||
      ((url.startsWith('http://') || url.startsWith('https://')) &&
        url.includes('linkedin.com/'))
    setUrlError(!urlOk)
    if (!urlOk) return
    const input: MeInput = {
      name: name.trim(),
      linkedin_url: url,
      employers: employers
        .map((employer) => ({
          organization: employer.organization.trim(),
          start: employer.start.trim(),
          end: employer.end.trim(),
        }))
        .filter((employer) => employer.organization),
      schools: schools.map((school) => school.trim()).filter(Boolean),
      contacts: contacts
        .map((contact) => ({
          name: contact.name.trim(),
          organization: contact.organization.trim(),
          ref: contact.ref,
        }))
        .filter((contact) => contact.name),
    }
    me.save(input)
    onOpenChange(false)
  }

  const profile = me.profile
  const foundFacts = profile?.facts.filter((fact) => fact.certainty === 'inferred') ?? []

  return (
    <form
      className="flex flex-col gap-5 px-4 pb-6"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <section className="flex flex-col gap-1.5">
        <Label htmlFor="me-name">Full name</Label>
        <Input
          id="me-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={150}
          placeholder="First and last name"
          autoComplete="name"
        />
      </section>

      <section className="flex flex-col gap-1.5">
        <Label htmlFor="me-linkedin">
          LinkedIn URL <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="me-linkedin"
          value={linkedinUrl}
          onChange={(event) => {
            setLinkedinUrl(event.target.value)
            setUrlError(false)
          }}
          maxLength={200}
          placeholder="https://www.linkedin.com/in/…"
          inputMode="url"
        />
        {urlError && (
          <p className="text-xs text-destructive">
            Enter a LinkedIn profile URL or leave it empty.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <p className="text-sm font-medium">Employers</p>
          <p className="text-xs text-muted-foreground">
            Years let VCScout check whether you overlapped with a partner. Leave
            &quot;To&quot; empty for a current job.
          </p>
        </div>
        {employers.map((employer, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <Input
              value={employer.organization}
              onChange={(event) => patchEmployer(index, { organization: event.target.value })}
              maxLength={120}
              placeholder="Company"
              className="min-w-0 flex-1"
            />
            <Input
              value={employer.start}
              onChange={(event) => patchEmployer(index, { start: event.target.value })}
              maxLength={7}
              inputMode="numeric"
              placeholder="From"
              className="w-16 shrink-0"
            />
            <Input
              value={employer.end}
              onChange={(event) => patchEmployer(index, { end: event.target.value })}
              maxLength={7}
              inputMode="numeric"
              placeholder="Present"
              className="w-20 shrink-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label="Remove employer"
              onClick={() =>
                setEmployers((current) => current.filter((_, i) => i !== index))
              }
            >
              <X className="size-3.5" aria-hidden />
            </Button>
          </div>
        ))}
        {employers.length < 12 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setEmployers((current) => [...current, emptyEmployer()])}
          >
            <Plus className="size-3.5" aria-hidden />
            Add employer
          </Button>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <p className="text-sm font-medium">Schools (university, high school)</p>
          <p className="text-xs text-muted-foreground">
            Universities and schools you attended.
          </p>
        </div>
        {schools.map((school, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <Input
              value={school}
              onChange={(event) =>
                setSchools((current) =>
                  current.map((entry, i) => (i === index ? event.target.value : entry)),
                )
              }
              maxLength={120}
              placeholder="University or school"
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label="Remove school"
              onClick={() => setSchools((current) => current.filter((_, i) => i !== index))}
            >
              <X className="size-3.5" aria-hidden />
            </Button>
          </div>
        ))}
        {schools.length < 8 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setSchools((current) => [...current, ''])}
          >
            <Plus className="size-3.5" aria-hidden />
            Add school
          </Button>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <p className="text-sm font-medium">People you know</p>
          <p className="text-xs text-muted-foreground">
            People you already know — for example LinkedIn connections at a startup or
            fund. They become the first hop of an intro path.
          </p>
        </div>
        {contacts.map((contact, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <Input
              value={contact.name}
              onChange={(event) => patchContact(index, { name: event.target.value })}
              maxLength={120}
              placeholder="Full name"
              className="min-w-0 flex-1"
            />
            <Input
              value={contact.organization}
              onChange={(event) =>
                patchContact(index, { organization: event.target.value })
              }
              maxLength={120}
              placeholder="Company or organization"
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label="Remove person"
              onClick={() => setContacts((current) => current.filter((_, i) => i !== index))}
            >
              <X className="size-3.5" aria-hidden />
            </Button>
          </div>
        ))}
        {contacts.length < 20 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              setContacts((current) => [...current, { name: '', organization: '' }])
            }
          >
            <Plus className="size-3.5" aria-hidden />
            Add person
          </Button>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <p className="text-sm font-medium">LinkedIn connections</p>
          <p className="text-xs text-muted-foreground">
            Optional. On LinkedIn: Settings &amp; Privacy → Data privacy → Get a copy of
            your data → Connections. The CSV is parsed and stored in this browser. Selected
            contacts&apos; details may be sent for research when you choose a target.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void importCsv(file)
          }}
        />
        {linkedin.connections.length > 0 ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
            <p className="text-xs">
              {linkedin.connections.length} connection{linkedin.connections.length === 1 ? '' : 's'} imported
              {linkedin.fileName ? (
                <span className="text-muted-foreground"> · {linkedin.fileName}</span>
              ) : null}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={linkedin.clear}
            >
              Remove
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? (
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <Upload className="size-3.5" aria-hidden />
            )}
            Import Connections.csv
          </Button>
        )}
        {importError && <p className="text-xs text-destructive">{importError}</p>}
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Your profile is saved in this browser. Research sends relevant details through the local
        server to Cala and AI web search. No messages or introductions are sent.
      </p>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={!name.trim()}>
          Save profile
        </Button>
        {profile && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              me.remove()
              onOpenChange(false)
            }}
          >
            Remove profile
          </Button>
        )}
      </div>

      {profile && (
        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Found by Cala
          </p>
          {me.status === 'loading' && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
              Checking Cala for public facts about you… this can take about a minute.
            </p>
          )}
          {me.status === 'error' && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                {me.message ?? 'The lookup failed.'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                  me.save({
                    name: profile.name,
                    linkedin_url: profile.linkedin_url,
                    employers: profile.employers,
                    schools: profile.schools,
                    contacts: profile.contacts,
                  })
                }
              >
                Try again
              </Button>
            </div>
          )}
          {me.status !== 'loading' && me.status !== 'error' && (
            <>
              {foundFacts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Cala found no additional public facts. Your own entries are used.
                </p>
              )}
              {foundFacts.map((fact, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0 text-xs">
                    <p className="font-medium">
                      {fact.organization}
                      <span className="font-normal text-muted-foreground">
                        {` · ${KIND_LABEL[fact.kind]}${fact.role ? ` · ${fact.role}` : ''}${factYears(fact) ? ` · ${factYears(fact)}` : ''}`}
                      </span>
                    </p>
                    <SourceLink url={fact.source_url} />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 shrink-0 px-2 text-xs"
                    onClick={() => me.hideFact(fact)}
                  >
                    Not me
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Matched by name — remove anything that is not you. These count as inferred.
              </p>
            </>
          )}
        </section>
      )}
    </form>
  )
}
