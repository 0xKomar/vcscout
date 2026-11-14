import { AlertTriangle, Check, CircleDashed, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DiscoveryState } from '@/hooks/use-discovery'
import type { NetworkProgress as IntroProgress } from '@/hooks/use-network'
import type { PeoplePrefetch } from '@/hooks/use-people-prefetch'
import { plural } from '@/lib/format'
import { cn } from '@/lib/utils'

type StepStatus = 'pending' | 'loading' | 'done' | 'error' | 'skipped'

interface Step {
  label: string
  status: StepStatus
  detail: string
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'loading') {
    return <Loader2 className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden />
  }
  if (status === 'done') {
    return (
      <span className="grid size-5 place-items-center rounded-full bg-brand text-brand-foreground">
        <Check className="size-3" aria-hidden />
      </span>
    )
  }
  if (status === 'error') {
    return <AlertTriangle className="size-4 text-destructive" aria-hidden />
  }
  return <CircleDashed className="size-4 text-muted-foreground/50" aria-hidden />
}

export function ProgressSteps({
  state,
  people,
  founders,
  intros,
}: {
  state: DiscoveryState
  people?: PeoplePrefetch
  founders?: { settled: number; total: number; people: number }
  intros?: IntroProgress
}) {
  const companies = state.companies
  const completed = companies.filter((entry) => entry.status !== 'loading').length
  const failed = companies.filter((entry) => entry.status === 'empty' || entry.status === 'error').length
  const total = companies.length

  const steps: Step[] = []
  if (state.similar.status === 'loading') {
    steps.push({ label: 'Similar startups', status: 'loading', detail: 'Searching…' })
  } else if (state.similar.status === 'error') {
    steps.push({ label: 'Similar startups', status: 'error', detail: 'Error' })
  } else {
    steps.push({
      label: 'Similar startups',
      status: 'done',
      detail: String(state.similar.matches.length),
    })
  }

  if (!total) {
    steps.push({ label: 'Funding histories', status: 'pending', detail: '—' })
  } else {
    steps.push({
      label: 'Funding histories',
      status: completed < total ? 'loading' : 'done',
      detail: `${completed}/${total}${failed ? ` · no data: ${failed}` : ''}`,
    })
  }

  const risks = state.risks
  if (risks.status === 'idle') {
    steps.push({ label: 'Portfolio conflicts', status: 'pending', detail: '—' })
  } else if (risks.status === 'loading') {
    steps.push({ label: 'Portfolio conflicts', status: 'loading', detail: '…' })
  } else if (risks.status === 'skipped') {
    steps.push({ label: 'Portfolio conflicts', status: 'skipped', detail: 'Skipped' })
  } else if (risks.status === 'error') {
    steps.push({ label: 'Portfolio conflicts', status: 'error', detail: 'Error' })
  } else {
    steps.push({ label: 'Portfolio conflicts', status: 'done', detail: String(risks.risks.length) })
  }

  if (founders) {
    if (!founders.total) {
      steps.push({ label: 'Founders', status: 'pending', detail: '—' })
    } else if (founders.settled < founders.total) {
      steps.push({
        label: 'Founders',
        status: 'loading',
        detail: `${founders.settled}/${founders.total}`,
      })
    } else {
      steps.push({
        label: 'Founders',
        status: 'done',
        detail: `${founders.people} ${plural(founders.people, 'person', 'people')}`,
      })
    }
  }

  let peopleStep: { status: StepStatus; detail: string } | null = null
  if (people) {
    if (people.status === 'pending') {
      peopleStep = { status: 'pending', detail: '—' }
    } else if (people.status === 'stopped') {
      peopleStep = { status: 'pending', detail: `Stopped (${people.settled}/${people.total})` }
    } else if (people.status === 'done') {
      peopleStep = {
        status: 'done',
        detail: `${people.people} ${plural(people.people, 'person', 'people')}${people.errors ? ` · errors: ${people.errors}` : ''}`,
      }
    } else {
      peopleStep = {
        status: 'loading',
        detail: `${people.settled}/${people.total}${people.errors ? ` · errors: ${people.errors}` : ''}`,
      }
    }
  }

  let introsStep: { status: StepStatus; detail: string } | null = null
  if (intros && intros.status !== 'pending') {
    if (intros.status === 'stopped') {
      introsStep = { status: 'pending', detail: `Stopped (${intros.detail})` }
    } else {
      introsStep = {
        status: intros.status === 'loading' ? 'loading' : 'done',
        detail: intros.detail,
      }
    }
  }

  const anythingLoading =
    steps.some((step) => step.status === 'loading') ||
    peopleStep?.status === 'loading' ||
    intros?.status === 'loading'

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/70 px-4 py-3">
      <ol aria-live="polite" className="flex items-center gap-x-6 gap-y-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {steps.map((step) => (
          <li key={step.label} className="flex shrink-0 items-center gap-2 text-sm whitespace-nowrap">
            <StepIcon status={step.status} />
            <span className={cn('text-muted-foreground', step.status === 'done' && 'text-foreground')}>
              {step.label}
            </span>
            <span
              className={cn(
                'font-mono text-xs',
                step.status === 'error' ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {step.detail}
            </span>
          </li>
        ))}
        {peopleStep && (
          <li className="flex shrink-0 items-center gap-2 text-sm whitespace-nowrap">
            <StepIcon status={peopleStep.status} />
            <span
              className={cn(
                'text-muted-foreground',
                peopleStep.status === 'done' && 'text-foreground',
              )}
            >
              People at funds
            </span>
            <span className="font-mono text-xs text-muted-foreground">{peopleStep.detail}</span>
            {people?.status === 'loading' && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={people.stop}>
                Stop
              </Button>
            )}
          </li>
        )}
        {introsStep && (
          <li className="flex shrink-0 items-center gap-2 text-sm whitespace-nowrap">
            <StepIcon status={introsStep.status} />
            <span
              className={cn(
                'text-muted-foreground',
                introsStep.status === 'done' && 'text-foreground',
              )}
            >
              Warm intros
            </span>
            <span className="font-mono text-xs text-muted-foreground">{introsStep.detail}</span>
            {intros?.status === 'loading' && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={intros.stop}>
                Stop
              </Button>
            )}
          </li>
        )}
      </ol>
      {intros && intros.agents.length > 0 && (
        <ul
          aria-label="Cala agents"
          className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
        >
          {intros.agents.map((agent) => (
            <li
              key={agent.label}
              className={cn(
                'items-center gap-1',
                agent.status === 'done' ? 'hidden sm:flex' : 'flex',
              )}
            >
              {agent.status === 'loading' ? (
                <Loader2
                  className="size-3 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              ) : agent.status === 'error' ? (
                <AlertTriangle className="size-3 text-destructive" aria-hidden />
              ) : (
                <Check className="size-3 text-brand" aria-hidden />
              )}
              {agent.label}
            </li>
          ))}
        </ul>
      )}
      {anythingLoading && (
        <p className="text-xs text-muted-foreground">
          New Cala queries can take about a minute.
        </p>
      )}
    </div>
  )
}
