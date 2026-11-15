import { SELF_REPORTED } from '@/lib/intro'
import { bestPathIds, pathsFromMe, type NetNode, type NetPath, type Network } from '@/lib/network'
import type { MeProfile } from '@/lib/types'

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
  dockSide?: 'right' | 'left'
  previewIntro?: boolean
  interactiveSpotlight?: boolean
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
      'Watch the research steps complete in the background (about a minute for a fresh query). Once you unlock exploration, click Edit here anytime to refine your product, market, or stage.',
    takeaway:
      'Everything downstream depends on comparable startups. Specific product and customer descriptions surface far more relevant investors than broad buzzwords.',
    targets: ['query-and-progress'],
    tab: 'map',
    view: 'intros',
    dockSide: 'right',
  },
  {
    id: 'similar',
    number: '02',
    location: 'Tab · Similar startups',
    title: 'Inspect comparable startups and round leads',
    where:
      'The Similar startups tab lists matched companies alongside their chronological Pre-seed, Seed, and Series A+ rounds, lead investors, participants, and source links.',
    action:
      'Compare how each peer startup raised, focus on Lead investors at your stage, and select a lead badge to inspect associated partners and primary sources.',
    takeaway:
      'Pay closest attention to lead investors rather than passive participants — leads price rounds and drive conviction. Always open the cited round source to verify dates and stage fit.',
    targets: ['workspace-tabs'],
    tab: 'companies',
    view: 'intros',
    dockSide: 'right',
  },
  {
    id: 'paths',
    number: '03',
    location: 'People & paths · Paths',
    title: 'Avoid dead-end funds with small networks',
    where:
      'Under Paths, investors at your stage sit in the middle column and investors who led later rounds for those exact same startups sit on the right.',
    action:
      'Use Paths only to isolate multi-round bridges, click a fund to trace its follow-on links, and load other portfolio startups to see whether that progression repeats.',
    takeaway:
      'Taking a check from an isolated fund with a tiny network and zero follow-on bridges can trap you in a dead end before Series A. Favor funds whose startups repeatedly graduate to strong downstream leads.',
    targets: ['workspace-tabs'],
    tab: 'map',
    view: 'paths',
    dockSide: 'right',
  },
  {
    id: 'graph',
    number: '04',
    location: 'People & paths · Relationship graph',
    title: 'Navigate the multi-stage ecosystem graph',
    where:
      'Relationship graph maps your startup, comparable companies, founders, and funds from earlier stages on the left to later stages on the right, color-coded by startup family.',
    action:
      'Drag to pan, zoom with the controls, click Fit graph to re-center, filter with Path only or colored startup chips, search in the toolbar, and click See more on a fund or partner to expand their deals.',
    takeaway:
      'Use hub density to measure reach: funds and partners connected across multiple peer startups and later-stage leads bring warm doors for future rounds; isolated islands signal narrow networks.',
    targets: ['workspace-tabs'],
    tab: 'map',
    view: 'graph',
    dockSide: 'right',
  },
  {
    id: 'risks',
    number: '05',
    location: 'Tab · Potential conflicts',
    title: 'Screen out competitor conflicts early',
    where:
      'Potential conflicts checks up to six early-stage funds on your map for documented links to competing companies, pairing every warning with its source URL.',
    action:
      'Open Check source on any flagged fund to see whether the portfolio company directly competes, and use Show on map to weigh that risk against its funding trajectory.',
    takeaway:
      'A fund that looks ideal on paper may already back a direct rival. Even if zero flags appear here, review a fund’s current portfolio before sharing confidential metrics.',
    targets: ['workspace-tabs'],
    tab: 'risks',
    view: 'intros',
    dockSide: 'right',
  },
  {
    id: 'intros-graph',
    number: '06',
    location: 'Warm intros · Connection graph',
    title: 'Learn to use the Warm Intros connection graph',
    where:
      'This interactive example graph shows how VCScout connects You (left), people you know, shared companies or events, and a target founder or partner (right).',
    action:
      'Try it right now inside the lit-up graph: toggle Paths only vs Whole network, open Legend, search a name, and click nodes. Solid blue lines are documented facts; dashed amber lines are inferred leads to verify.',
    takeaway:
      'On your real map, research starts only after you pick a target. You can click Search connections or Search deeper to expand another hop, or click I know this person to turn someone into a direct bridge.',
    targets: ['intros-graph'],
    tab: 'map',
    view: 'intros',
    dockSide: 'right',
    previewIntro: true,
    interactiveSpotlight: true,
  },
  {
    id: 'evidence',
    number: '07',
    location: 'Details panel · How you connect',
    title: 'Verify connection confirmations and linked sources',
    where:
      'In How you connect, every step on your route carries a certainty badge (You said so, Documented, or Inferred), date-overlap checks, and clickable links showing exactly where each fact came from.',
    action:
      'Inspect the source label on every hop (Cala, Cala graph, or AI web — verify) and click the linked domain (↗) to open the original team page, announcement, or article.',
    takeaway:
      'Never ask for an intro on an unverified assumption. Rely on Documented links with confirmed sources and overlapping years; treat Inferred or AI web — verify links strictly as clues until checked.',
    targets: ['connection-evidence'],
    tab: 'map',
    view: 'intros',
    dockSide: 'left',
    previewIntro: true,
  },
  {
    id: 'drafts',
    number: '08',
    location: 'Details panel · Message drafts',
    title: 'Edit and copy generated outreach messages',
    where:
      'Below the verified links, VCScout generates two editable drafts tailored to your startup: an intro ask to your bridge contact (or direct note) and a Forwardable blurb for them to pass along.',
    action:
      'Try editing the text boxes right here and test Copy — drafts stay locally in your browser and nothing is ever sent automatically. Click Start exploring below to unlock the app and add yourself!',
    takeaway:
      'Warm intros succeed when you make forwarding effortless: reference one verified shared connection, keep the ask low-pressure, and attach a concise blurb tied to the investor’s real track record.',
    targets: ['message-drafts'],
    tab: 'map',
    view: 'intros',
    dockSide: 'left',
    previewIntro: true,
    interactiveSpotlight: true,
  },
]

const PREVIEW_NETWORK: Network = {
  nodes: [
    {
      id: 'me',
      kind: 'me',
      label: 'You (example)',
      sublabel: 'Your profile & contacts',
    },
    {
      id: 'p:maya',
      kind: 'person',
      label: 'Maya Lin',
      sublabel: 'Product Lead · Common Studio',
      known: 'contact',
    },
    {
      id: 'p:jonas',
      kind: 'person',
      label: 'Jonas Berg',
      sublabel: 'VP Engineering · Common Studio',
    },
    {
      id: 'o:studio',
      kind: 'org',
      orgType: 'company',
      label: 'Common Studio',
      sublabel: 'Shared workplace',
    },
    {
      id: 'p:clara',
      kind: 'person',
      label: 'Clara Lindqvist',
      sublabel: 'General Partner · Northbridge Seed',
      target: 'partner',
      fund: 'Northbridge Seed',
    },
    {
      id: 'o:fund',
      kind: 'org',
      orgType: 'fund',
      label: 'Northbridge Seed',
      sublabel: 'Seed → Series A bridge fund',
    },
    {
      id: 'o:summit',
      kind: 'org',
      orgType: 'event',
      label: 'Nordic AI Summit',
      sublabel: 'Conference panel',
    },
    {
      id: 'p:liam',
      kind: 'person',
      label: 'Liam Novak',
      sublabel: 'Co-founder · PeerFlow',
      target: 'founder',
      company: 'PeerFlow',
    },
  ],
  edges: [
    {
      id: 'preview:me-maya',
      source: 'me',
      target: 'p:maya',
      relation: 'knows',
      label: 'you know them',
      cost: 1,
      certainty: 'fact',
      source_url: SELF_REPORTED,
    },
    {
      id: 'preview:maya-jonas',
      source: 'p:maya',
      target: 'p:jonas',
      relation: 'colleague',
      label: 'colleague at Common Studio',
      cost: 2,
      certainty: 'fact',
      origin: 'cala',
      start: '2021',
      end: '2023',
      source_url: 'https://commonstudio.example.com/team',
    },
    {
      id: 'preview:jonas-studio',
      source: 'p:jonas',
      target: 'o:studio',
      relation: 'works',
      label: 'VP Engineering',
      cost: 1.25,
      certainty: 'fact',
      origin: 'cala-graph',
      start: '2020',
      end: '2023',
      source_url: 'https://commonstudio.example.com/leadership',
    },
    {
      id: 'preview:studio-clara',
      source: 'o:studio',
      target: 'p:clara',
      relation: 'board-seat',
      label: 'Seed board observer',
      cost: 1.25,
      certainty: 'inferred',
      origin: 'openai',
      start: '2021',
      end: '2024',
      source_url: 'https://techbrief.example.com/common-studio-seed',
      sources: [
        { origin: 'cala-graph', url: 'https://northbridge.example.com/portfolio' },
        { origin: 'openai', url: 'https://techbrief.example.com/common-studio-seed' },
      ],
    },
    {
      id: 'preview:clara-fund',
      source: 'p:clara',
      target: 'o:fund',
      relation: 'member',
      label: 'General Partner',
      cost: 1,
      certainty: 'fact',
      origin: 'cala',
      source_url: 'https://northbridge.example.com/team',
    },
    {
      id: 'preview:maya-summit',
      source: 'p:maya',
      target: 'o:summit',
      relation: 'took-part',
      label: 'panelist',
      cost: 2,
      certainty: 'inferred',
      origin: 'openai',
      source_url: 'https://nordicsummit.example.com/speakers',
    },
    {
      id: 'preview:summit-liam',
      source: 'o:summit',
      target: 'p:liam',
      relation: 'took-part',
      label: 'speaker',
      cost: 2,
      certainty: 'inferred',
      origin: 'openai',
      source_url: 'https://nordicsummit.example.com/speakers',
    },
  ],
}

const PREVIEW_PATHS = pathsFromMe(PREVIEW_NETWORK)
const PREVIEW_TARGET_ID = 'p:clara'
const PREVIEW_TARGET_NODE = PREVIEW_NETWORK.nodes.find((node) => node.id === PREVIEW_TARGET_ID) as NetNode
const PREVIEW_TARGET_PATH = PREVIEW_PATHS.get(PREVIEW_TARGET_ID) as NetPath
const PREVIEW_PATH_IDS = bestPathIds([{ node: PREVIEW_TARGET_NODE, path: PREVIEW_TARGET_PATH }])

const PREVIEW_ME: MeProfile = {
  name: 'Alex Founder',
  linkedin_url: '',
  employers: [],
  schools: [],
  contacts: [{ name: 'Maya Lin', organization: 'Common Studio' }],
  facts: [],
  hidden: [],
}

export const TUTORIAL_PREVIEW = {
  network: PREVIEW_NETWORK,
  paths: PREVIEW_PATHS,
  targetId: PREVIEW_TARGET_ID,
  targetNode: PREVIEW_TARGET_NODE,
  targetPath: PREVIEW_TARGET_PATH,
  pathIds: PREVIEW_PATH_IDS,
  me: PREVIEW_ME,
}

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
