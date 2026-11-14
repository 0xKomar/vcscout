import { describe, expect, it } from 'vitest'
import { clampSpotlightRect, TUTORIAL_STEPS } from '@/lib/tutorial'

describe('TUTORIAL_STEPS', () => {
  it('walks through all core views and ends on Warm intros ready for action', () => {
    expect(TUTORIAL_STEPS).toHaveLength(6)
    expect(TUTORIAL_STEPS[0].tab).toBe('map')
    expect(TUTORIAL_STEPS[0].view).toBe('intros')
    expect(TUTORIAL_STEPS.map((step) => step.id)).toEqual([
      'pipeline',
      'similar',
      'paths',
      'graph',
      'risks',
      'intros',
    ])
    const pathsStep = TUTORIAL_STEPS.find((step) => step.id === 'paths')
    expect(pathsStep?.takeaway.toLowerCase()).toContain('dead end')
    const last = TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1]
    expect(last.tab).toBe('map')
    expect(last.view).toBe('intros')
  })
})

describe('clampSpotlightRect', () => {
  it('adds padding and clamps top below the sticky header', () => {
    const rect = clampSpotlightRect(
      { left: 40, top: 60, right: 540, bottom: 260, width: 500, height: 200 },
      { width: 1440, height: 900 },
      72,
      8,
    )
    expect(rect).toEqual({
      x: 32,
      y: 78,
      width: 516,
      height: 190,
      rx: 18,
    })
  })

  it('returns null when element is scrolled completely offscreen above header', () => {
    const rect = clampSpotlightRect(
      { left: 40, top: -300, right: 540, bottom: 50, width: 500, height: 350 },
      { width: 1440, height: 900 },
      72,
      8,
    )
    expect(rect).toBeNull()
  })

  it('returns null for zero-size hidden elements', () => {
    const rect = clampSpotlightRect(
      { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
      { width: 1440, height: 900 },
      72,
    )
    expect(rect).toBeNull()
  })
})
