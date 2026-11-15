import { describe, expect, it } from 'vitest'
import { pathLinks } from '@/lib/network'
import { clampSpotlightRect, TUTORIAL_PREVIEW, TUTORIAL_STEPS } from '@/lib/tutorial'

describe('TUTORIAL_STEPS', () => {
  it('covers all 8 steps including graph usage, linked sources, and generated message drafts', () => {
    expect(TUTORIAL_STEPS).toHaveLength(8)
    expect(TUTORIAL_STEPS.map((step) => step.id)).toEqual([
      'pipeline',
      'similar',
      'paths',
      'graph',
      'risks',
      'intros-graph',
      'evidence',
      'drafts',
    ])
    const pathsStep = TUTORIAL_STEPS.find((step) => step.id === 'paths')
    expect(pathsStep?.takeaway.toLowerCase()).toContain('dead end')

    const graphStep = TUTORIAL_STEPS.find((step) => step.id === 'intros-graph')
    expect(graphStep?.previewIntro).toBe(true)
    expect(graphStep?.interactiveSpotlight).toBe(true)

    const evidenceStep = TUTORIAL_STEPS.find((step) => step.id === 'evidence')
    expect(evidenceStep?.targets).toEqual(['connection-evidence'])
    expect(evidenceStep?.dockSide).toBe('left')

    const draftsStep = TUTORIAL_STEPS.find((step) => step.id === 'drafts')
    expect(draftsStep?.targets).toEqual(['message-drafts'])
    expect(draftsStep?.dockSide).toBe('left')
    expect(draftsStep?.interactiveSpotlight).toBe(true)
  })
})

describe('TUTORIAL_PREVIEW', () => {
  it('builds a multi-hop illustrative path with self, documented, and inferred source links', () => {
    const links = pathLinks(TUTORIAL_PREVIEW.network, TUTORIAL_PREVIEW.targetPath)
    expect(links.map((link) => link.kind)).toEqual(['self', 'documented', 'inferred'])
    expect(TUTORIAL_PREVIEW.targetNode.label).toBe('Clara Lindqvist')
    expect(TUTORIAL_PREVIEW.pathIds.nodes.has('p:maya')).toBe(true)
    expect(TUTORIAL_PREVIEW.pathIds.nodes.has('p:liam')).toBe(false)
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
