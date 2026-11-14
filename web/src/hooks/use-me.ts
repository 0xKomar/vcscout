import { useSyncExternalStore } from 'react'
import { fetchMe } from '@/lib/api'
import { factKey, mergeMeFacts, selfFacts } from '@/lib/intro'
import { linkedinProfileKey } from '@/lib/linkedin-csv'
import type { Fact, ManualPerson, MeContact, MeInput, MeProfile } from '@/lib/types'

export type MeStatus = 'idle' | 'loading' | 'error'

const STORAGE_KEY = 'vcscout:me'

interface MeSnapshot {
  profile: MeProfile | null
  status: MeStatus
  message?: string
}

function loadStored(): MeProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (
      !value ||
      typeof value !== 'object' ||
      typeof (value as MeProfile).name !== 'string' ||
      !Array.isArray((value as MeProfile).employers) ||
      !Array.isArray((value as MeProfile).schools) ||
      !Array.isArray((value as MeProfile).facts) ||
      !Array.isArray((value as MeProfile).hidden)
    ) {
      return null
    }
    const profile = value as MeProfile
    if (!Array.isArray(profile.contacts)) profile.contacts = []
    if (!Array.isArray(profile.manual_people)) profile.manual_people = []
    else profile.manual_people = profile.manual_people.filter((person) =>
      person && typeof person.name === 'string' && typeof person.profile_url === 'string')
    return profile
  } catch {
    return null
  }
}

let snapshot: MeSnapshot = { profile: loadStored(), status: 'idle' }
const listeners = new Set<() => void>()
let run = 0

function notify(next: MeSnapshot) {
  snapshot = next
  try {
    if (next.profile) localStorage.setItem(STORAGE_KEY, JSON.stringify(next.profile))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage may be unavailable; the profile then lives in memory only.
  }
  for (const listener of listeners) listener()
}

function save(input: MeInput) {
  const id = ++run
  const previous = snapshot.profile
  const samePerson = previous?.name.trim().toLowerCase() === input.name.trim().toLowerCase()
  const hidden = samePerson ? (previous?.hidden ?? []) : []
  const keptFound = samePerson
    ? (previous?.facts ?? []).filter((fact) => fact.certainty === 'inferred')
    : []
  const own = selfFacts(input)
  const manualPeople = samePerson ? previous?.manual_people ?? [] : []
  notify({
    profile: { ...input, manual_people: manualPeople, facts: mergeMeFacts(own, keptFound, hidden), hidden },
    status: 'loading',
  })
  fetchMe(input).then(
    (data) => {
      if (id !== run) return
      const current = snapshot.profile
      notify({
        profile: {
          ...input,
          contacts: current?.contacts ?? input.contacts,
          manual_people: current?.manual_people ?? manualPeople,
          facts: mergeMeFacts(own, data.facts, hidden),
          hidden,
        },
        status: 'idle',
      })
    },
    (error: unknown) => {
      if (id !== run) return
      notify({
        ...snapshot,
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not retrieve data.',
      })
    },
  )
}

function remove() {
  run += 1
  notify({ profile: null, status: 'idle' })
}

function hideFact(fact: Fact) {
  const profile = snapshot.profile
  if (!profile) return
  const key = factKey(fact)
  const hidden = profile.hidden.includes(key) ? profile.hidden : [...profile.hidden, key]
  notify({
    ...snapshot,
    profile: {
      ...profile,
      hidden,
      facts: profile.facts.filter(
        (item) => item.certainty !== 'inferred' || factKey(item) !== key,
      ),
    },
  })
}

function setContacts(contacts: MeContact[]) {
  const profile = snapshot.profile
  if (!profile) return
  notify({ ...snapshot, profile: { ...profile, contacts } })
}

export function useMe(): {
  profile: MeProfile | null
  status: MeStatus
  message?: string
  save: (input: MeInput) => void
  remove: () => void
  hideFact: (fact: Fact) => void
  addContact: (name: string, organization: string, ref?: MeContact['ref']) => void
  removeContact: (name: string, refId?: string) => void
  setManualPeople: (people: ManualPerson[]) => void
} {
  const state = useSyncExternalStore(
    (callback) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    () => snapshot,
  )
  const addContact = (name: string, organization: string, ref?: MeContact['ref']) => {
    const contacts = [...(state.profile?.contacts ?? [])]
    const key = name.trim().toLowerCase()
    if (!key || contacts.some((contact) =>
      contact.name.trim().toLowerCase() === key &&
      (ref ? contact.ref?.id === ref.id : !contact.ref && contact.organization === organization.trim()),
    )) return
    contacts.push({ name: name.trim(), organization: organization.trim(), ref })
    setContacts(contacts)
  }
  const removeContact = (name: string, refId?: string) => {
    const key = name.trim().toLowerCase()
    const contacts = state.profile?.contacts ?? []
    const exactRef = refId && contacts.some(
      (contact) => contact.name.trim().toLowerCase() === key && contact.ref?.id === refId,
    )
    const legacy = contacts.filter((contact) => contact.name.trim().toLowerCase() === key && !contact.ref)
    setContacts(
      contacts.filter((contact) => {
        if (contact.name.trim().toLowerCase() !== key) return true
        if (exactRef) return contact.ref?.id !== refId
        return !!contact.ref || legacy.length !== 1
      }),
    )
  }
  const setManualPeople = (people: ManualPerson[]) => {
    const profile = snapshot.profile
    if (!profile) return
    const byProfile = new Map(people.map((person) => [linkedinProfileKey(person.profile_url), person]))
    const contacts = profile.contacts.map((contact) => {
      const person = contact.ref?.profile_key && byProfile.get(contact.ref.profile_key)
      return person?.name.trim() ? { ...contact, name: person.name.trim() } : contact
    })
    notify({ ...snapshot, profile: { ...profile, contacts, manual_people: people } })
  }
  return { ...state, save, remove, hideFact, addContact, removeContact, setManualPeople }
}
