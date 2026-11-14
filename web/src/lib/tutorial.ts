export type TutorialTab = 'map' | 'companies' | 'risks'
export type TutorialMapView = 'intros' | 'paths' | 'graph'

export interface TutorialStep {
  id: string
  number: string
  location: string
  title: string
  where: string
  action: string
  takeaway: string
  targets: string[]
  tab: TutorialTab
  view: TutorialMapView
}

export interface SpotlightRect {
  x: number
  y: number
  width: number
  height: number
  rx: number
}

export interface RawBox {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'pipeline',
    number: '01',
    location: 'Top bar · Brief & live pipeline',
    title: 'Your startup brief and research status',
    where:
      'At the top sit your startup summary, the Add yourself profile button, and the live status bar tracking comparable companies, rounds, conflicts, founders, and fund partners.',
    action:
      'Let the research steps finish (about a minute for a fresh query), or click Edit anytime if you want to sharpen your product, market, or stage.',
    takeaway:
      'Everything downstream depends on comparable startups. If the matched peers target a different buyer or category, refine your description before judging investors.',
    targets: ['query-and-progress'],
    tab: 'map',
    view: 'intros',
  },
  {
    id: 'similar',
    number: '02',
    location: 'Tab · Similar startups',
    title: 'Inspect comparable startups and round leads',
    where:
      'The Similar startups tab lists matched companies alongside their chronological Pre-seed, Seed, and Series A+ rounds, lead investors, participants, and source links.',
    action:
      'Click each company card to compare how it raised, then select any lead investor badge to inspect associated partners and primary sources.',
    takeaway:
      'Pay closest attention to lead investors rather than passive participants — leads price rounds and drive conviction. Always open the cited source to verify dates and stage fit.',
    targets: ['workspace-tabs'],
    tab: 'companies',
    view: 'intros',
  },
  {
    id: 'paths',
    number: '03',
    location: 'People & paths · Paths',
    title: 'Avoid dead-end funds with small networks',
    where:
      'Under Paths, investors at your stage sit in the middle column and investors who led later rounds for the exact same startups sit on the right.',
    action:
      'Switch to Paths only to isolate multi-round bridges, click a fund to trace its follow-on links, and load other portfolio startups to test whether that bridge repeats.',
    takeaway:
      'Taking a check from an isolated fund with a tiny network and zero follow-on bridges can trap you in a dead end before Series A. Favor funds whose startups repeatedly graduate to strong downstream leads.',
    targets: ['workspace-tabs'],
    tab: 'map',
    view: 'paths',
  },
  {
    id: 'graph',
    number: '04',
    location: 'People & paths · Relationship graph',
    title: 'Measure ecosystem depth across stages',
    where:
      'Relationship graph maps your idea, peer startups, founders, and funds from earlier stages on the left to later stages on the right.',
    action:
      'Toggle Path only or Full graph, search any fund or person in the toolbar, and click a partner or fund node to explore other deals they are tied to.',
    takeaway:
      'Look for hub connectivity, not just a logo. Partners linked across multiple comparable startups and co-investors bring warm doors for future rounds; isolated clusters signal narrow reach.',
    targets: ['workspace-tabs'],
    tab: 'map',
    view: 'graph',
  },
  {
    id: 'risks',
    number: '05',
    location: 'Tab · Potential conflicts',
    title: 'Screen out competitor conflicts early',
    where:
      'Potential conflicts checks up to six early-stage funds from your map for documented links to competing companies, pairing each flag with its source.',
    action:
      'Open Check source on any flagged fund to judge whether the portfolio company truly competes, and click Show on map to see where that fund sits.',
    takeaway:
      'A fund that looks ideal on paper may already back a direct rival. Even if zero flags appear here, review a fund’s current portfolio before sharing confidential metrics.',
    targets: ['workspace-tabs'],
    tab: 'risks',
    view: 'intros',
  },
  {
    id: 'intros',
    number: '06',
    location: 'People & paths · Warm intros & drafts',
    title: 'Turn the right target into a warm conversation',
    where:
      'Warm intros pairs your own background on the left with ranked founders and fund partners, while the side panel shows connection evidence and two editable outreach drafts.',
    action:
      'Click Add yourself to enter past employers, schools, known contacts, or your LinkedIn CSV (stored locally), then select a person you want to meet to start two-sided path research.',
    takeaway:
      'Treat path scores and Inferred / AI web — verify labels as leads, never proof that two people know each other. Confirm the shared link in the source, then personalize your ask.',
    targets: ['workspace-tabs', 'detail-aside'],
    tab: 'map',
    view: 'intros',
  },
]

export function clampSpotlightRect(
  box: RawBox,
  viewport: { width: number; height: number },
  headerBottom: number,
  pad = 8,
): SpotlightRect | null {
  if (box.width <= 0 || box.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return null
  }
  const x = Math.max(6, box.left - pad)
  const right = Math.min(viewport.width - 6, box.right + pad)
  const y = Math.max(headerBottom + 6, box.top - pad)
  const bottom = Math.min(viewport.height - 6, box.bottom + pad)
  const width = right - x
  const height = bottom - y
  if (width < 16 || height < 16) return null
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    rx: 18,
  }
}
