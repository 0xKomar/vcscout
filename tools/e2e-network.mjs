// Mocked end-to-end check of the Warm intros network view.
// Usage: NODE_PATH=<npx cache node_modules> node tools/e2e-network.mjs
// Every POST /api/* is intercepted — no live Cala or OpenAI calls.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE_URL = process.env.VCSCOUT_BASE_URL ?? 'http://127.0.0.1:8765'
const require = createRequire(
  join(process.env.PLAYWRIGHT_NODE_PATH ?? '/Users/komar/.npm/_npx/e41f203b7505f1fb/node_modules', 'x.js'),
)
const { chromium } = require('playwright')

const fixture = (name) =>
  JSON.parse(readFileSync(join(ROOT, 'research/cala-runs', name + '.json'), 'utf8')).result.data
    .results

const clip = (v, n = 150) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const dateText = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 10) : null)
const validSource = (v) => typeof v === 'string' && /^https?:\/\//.test(v)

const RELATIONSHIPS = new Set([
  'co-founder', 'colleague', 'investor', 'portfolio-founder', 'board', 'classmate',
  'teammate', 'co-author', 'co-appearance', 'advisor', 'other',
])
const VIA_TYPES = new Set(['company', 'fund', 'school', 'event', 'media', 'other'])

function connections(rows) {
  return rows
    .filter((r) => r && validSource(r.source_url) && r.connected_person)
    .map((r) => ({
      name: clip(r.connected_person),
      role: clip(r.connected_person_role),
      organization: clip(r.connected_person_organization, 120),
      via: clip(r.organization, 120),
      via_type: VIA_TYPES.has(clip(r.organization_type).toLowerCase())
        ? clip(r.organization_type).toLowerCase()
        : 'other',
      relationship: RELATIONSHIPS.has(clip(r.relationship).toLowerCase())
        ? clip(r.relationship).toLowerCase()
        : 'other',
      context: clip(r.context, 300),
      date: dateText(r.date),
      source_url: r.source_url,
    }))
}

function people(rows) {
  const ORG_REL = new Set([
    'founder', 'executive', 'employee', 'investor', 'board', 'advisor', 'organizer',
    'jury', 'mentor', 'speaker', 'participant', 'alumni', 'other',
  ])
  return rows
    .filter((r) => r && validSource(r.source_url) && r.person)
    .map((r) => ({
      name: clip(r.person),
      role: clip(r.role),
      relationship: ORG_REL.has(clip(r.relationship).toLowerCase())
        ? clip(r.relationship).toLowerCase()
        : 'other',
      affiliation: clip(r.affiliation, 120),
      start: dateText(r.start_date),
      end: dateText(r.end_date),
      source_url: r.source_url,
    }))
}

function facts(rows) {
  const out = []
  for (const r of rows) {
    const category = clip(r.category).toLowerCase()
    let kind, role
    if (category === 'founder') {
      kind = 'role'
      role = clip(r.role)
      if (!role.toLowerCase().includes('found')) role = 'Founder' + (role ? ', ' + role : '')
    } else if (['role', 'education', 'board', 'angel', 'program'].includes(category)) {
      kind = category
      role = clip(r.role)
    } else continue
    if (!clip(r.organization) || !validSource(r.source_url)) continue
    out.push({
      kind,
      organization: clip(r.organization),
      role,
      start: dateText(r.start_date),
      end: dateText(r.end_date),
      source_url: r.source_url,
    })
  }
  return out
}

const EXPANSIONS = {
  'person|igor komar': {
    connections: connections(fixture('network-probe-3/r2-conn-komar')),
    facts: [],
  },
  'person|wiktor gaweł': {
    connections: connections(fixture('network-probe-3/r1-conn-gawel')),
    facts: facts(fixture('network-probe-2/q5-background-gawel')),
  },
  'person|piotr gerke': {
    connections: connections(fixture('network-probe-3/r8-conn-gerke')),
    facts: facts(fixture('network-probe-3/r6-bg-gerke')),
  },
  'person|maciej stoiński': {
    connections: connections(fixture('network-probe-2/q8-person-stoinski')),
    facts: [],
  },
  'person|briehan burke': {
    connections: connections(fixture('network-probe-3/r3-conn-burke')),
    facts: facts(fixture('network-probe-3/r7-bg-burke')),
  },
  'org|minerva': { people: people(fixture('network-probe-3/r4-org-minerva')) },
  'org|keen venture partners': { people: people(fixture('network-probe-3/r5-org-keen')) },
  'org|open ocean': { people: people(fixture('network-probe-2/q7-org-openocean')) },
  'org|put start iii': { people: people(fixture('network-probe-2/q4-org-putstart')) },
  'org|zdajto!': { people: people(fixture('network-probe-2/q3-org-zdajto')) },
}

const partner = (name, role, fund, company) => ({
  name,
  role,
  connection: `${role} at ${fund}; backed ${company}`,
  source_url: `https://example.com/${encodeURIComponent(name.toLowerCase().replace(/ /g, '-'))}`,
})
const founder = (name, role, company) => ({
  name,
  role,
  source_url: `https://example.com/${encodeURIComponent(company.toLowerCase())}-team`,
})
const round = (type, date, lead, investors, company) => ({
  round_type: type,
  announcement_date: date,
  lead_investors: lead,
  investors: investors ?? lead,
  source_urls: `https://example.com/${company.toLowerCase()}-round`,
  raised_amount: '',
})

const SIMILAR = {
  matches: [
    { company: 'Minerva', description: 'AI for public procurement', similarity_reason: 'same buyer', source_url: 'https://minerva.ai' },
    { company: 'Tenderlake', description: 'procurement intelligence', similarity_reason: 'adjacent', source_url: 'https://tenderlake.example.com' },
    { company: 'Bidwell', description: 'bid automation', similarity_reason: 'adjacent', source_url: 'https://bidwell.example.com' },
    { company: 'Contora', description: 'contract analytics', similarity_reason: 'adjacent', source_url: 'https://contora.example.com' },
  ],
}

const SEARCH = {
  minerva: { company: 'Minerva', cached: true, rounds: [
    round('Seed', '2025-03-01', 'Open Ocean', 'Open Ocean, Keen Venture Partners', 'Minerva'),
    round('Pre-seed', '2024-06-01', 'Keen Venture Partners', 'Keen Venture Partners', 'Minerva'),
  ] },
  tenderlake: { company: 'Tenderlake', cached: true, rounds: [
    round('Seed', '2024-05-01', 'Cato', 'Cato, Sunfish Partners', 'Tenderlake'),
  ] },
  bidwell: { company: 'Bidwell', cached: true, rounds: [
    round('Seed', '2024-08-01', 'Sunfish Partners', 'Sunfish Partners', 'Bidwell'),
  ] },
  contora: { company: 'Contora', cached: true, rounds: [
    round('Seed', '2023-11-01', 'Cato', 'Cato', 'Contora'),
  ] },
}

const PARTNERS = {
  'minerva|open ocean': [partner('Patrik Backman', 'Managing Partner', 'Open Ocean', 'Minerva')],
  'minerva|keen venture partners': [
    partner('Briehan Burke', 'General Partner', 'Keen Venture Partners', 'Minerva'),
    partner('Robert Verwaayen', 'Co-Founder & General Partner', 'Keen Venture Partners', 'Minerva'),
  ],
  'tenderlake|cato': [partner('Aleksander Dobosz', 'Partner', 'Cato', 'Tenderlake')],
  'tenderlake|sunfish partners': [partner('Julia Kramer', 'Partner', 'Sunfish Partners', 'Tenderlake')],
  'bidwell|sunfish partners': [partner('Julia Kramer', 'Partner', 'Sunfish Partners', 'Bidwell')],
  'contora|cato': [partner('Aleksander Dobosz', 'Partner', 'Cato', 'Contora')],
}

const FOUNDERS = {
  minerva: [
    founder('Wiktor Gaweł', 'CEO & Co-founder', 'Minerva'),
    founder('Piotr Gerke', 'Co-founder & CTO', 'Minerva'),
    founder('Maciej Stoiński', 'Co-founder & COO', 'Minerva'),
  ],
  tenderlake: [founder('Anna Lis', 'Co-founder & CEO', 'Tenderlake')],
  bidwell: [founder('Tom Nowak', 'Founder & CEO', 'Bidwell')],
  contora: [founder('Marta Zielińska', 'Founder & CEO', 'Contora')],
}

const PROFILE = {
  name: 'Igor Komar',
  linkedin_url: '',
  employers: [{ organization: 'ZdajTo!', start: '2018', end: '' }],
  schools: ['Politechnika Poznańska'],
  contacts: [{ name: 'Jan Kowalski', organization: 'Minerva' }],
  hidden: [],
  facts: [
    { kind: 'role', organization: 'ZdajTo!', role: '', start: '2018', end: 'present', source_url: 'self-reported', certainty: 'fact' },
    { kind: 'education', organization: 'Politechnika Poznańska', role: '', start: null, end: null, source_url: 'self-reported', certainty: 'fact' },
  ],
}

const apiLog = []
const consoleErrors = []

async function mockApi(page) {
  await page.route('**/api/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() !== 'POST') return route.continue()
    const body = request.postDataJSON() ?? {}
    const key = `${url.pathname} ${JSON.stringify(body)}`
    apiLog.push({ path: url.pathname, name: body.name ?? body.company ?? body.idea?.slice(0, 30) ?? '', body })
    const respond = (data) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    switch (url.pathname) {
      case '/api/similar':
        return respond(SIMILAR)
      case '/api/search':
        return respond(SEARCH[(body.name ?? '').toLowerCase()] ?? { company: body.name, rounds: [], cached: true })
      case '/api/partners':
        return respond({ partners: PARTNERS[`${(body.company ?? '').toLowerCase()}|${(body.fund ?? '').toLowerCase()}`] ?? [], origin: 'cache' })
      case '/api/founders':
        return respond({ founders: FOUNDERS[(body.company ?? '').toLowerCase()] ?? [], origin: 'cache' })
      case '/api/me':
        return respond({ facts: [], origin: 'cache' })
      case '/api/dossier':
        return respond({ name: body.name, fund: body.fund, facts: [], origin: 'cache', failed: [] })
      case '/api/linkedin':
        return respond({ url: null, evidence: null, photo: null, origin: 'cache' })
      case '/api/risks':
        return respond({ risks: [] })
      case '/api/fund-paths':
        return respond({ companies: [], origin: 'cache' })
      case '/api/person-investments':
        return respond({ investments: [], origin: 'cache' })
      case '/api/rank':
        return respond({ order: [], origin: 'openai' })
      case '/api/network': {
        const hit = EXPANSIONS[`${body.kind}|${(body.name ?? '').toLowerCase()}`]
        if (body.kind === 'org') {
          return respond({ kind: 'org', name: body.name, entity: null, people: hit?.people ?? [], origin: 'cache', failed: [] })
        }
        return respond({
          kind: 'person',
          name: body.name,
          entity: null,
          connections: hit?.connections ?? [],
          facts: body.background === false ? [] : (hit?.facts ?? []),
          origin: 'cache',
          failed: [],
        })
      }
      default:
        apiLog.push({ path: url.pathname, unmocked: true })
        return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"unmocked"}' })
    }
  })
}

const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`)
}

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(String(error)))
  await mockApi(page)
  await page.addInitScript((profile) => {
    localStorage.setItem('vcscout:me', JSON.stringify(profile))
    localStorage.setItem('vcscout:skip-walkthrough', '1')
  }, PROFILE)

  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.getByPlaceholder(/Describe what you're building/).fill(
    'AI copilot for public procurement teams that drafts tender responses and checks compliance.',
  )
  await page.getByPlaceholder(/Describe what you're building/).press('Enter')

  // wait for results and open the Warm intros view
  try {
    await page.locator('button:has-text("Warm intros")').waitFor({ timeout: 15000 })
  } catch (error) {
    console.log('apiLog:', JSON.stringify(apiLog.slice(0, 20)))
    console.log('consoleErrors:', consoleErrors.slice(0, 5))
    console.log('body:', (await page.locator('body').innerText()).slice(0, 1500))
    throw error
  }
  await page.locator('button:has-text("Warm intros")').click()
  await page.waitForTimeout(300)
  check('no warm-intro search before target selection',
    apiLog.filter((entry) => entry.path === '/api/network').length === 0)

  // the crawl starts only after a target is picked — click the first ranked row
  const firstRow = page.locator('[data-testid="warmest-list"] li button').first()
  const firstText = await firstRow.innerText()
  check(
    'first ranked entry is a Minerva founder through Jan Kowalski',
    /Minerva/.test(firstText) && /Jan Kowalski/.test(firstText),
    firstText.replace(/\n/g, ' | ').slice(0, 120),
  )
  await firstRow.click()
  await page.waitForTimeout(1000)
  const rootCalls = apiLog.filter((entry) => entry.path === '/api/network')
  check('researches only the user and selected target when a path is already available',
    rootCalls.length === 2 && rootCalls.some((entry) => entry.name === 'Igor Komar') &&
    rootCalls.some((entry) => entry.name === 'Maciej Stoiński'),
    rootCalls.map((entry) => entry.name).join(', '))
  check('enriches both endpoints with opposite-side context',
    rootCalls.length === 2 && rootCalls.every((entry) => entry.body.enhance && entry.body.background &&
      entry.body.counterpart?.name && entry.body.focus?.length > 0))

  // picking a target defaults to the paths-only view — the whole network is one click away
  const pathsViewCount = await page.locator('.react-flow__node').count()
  check(
    'paths-only view shows just the route to the picked target',
    pathsViewCount > 0 && pathsViewCount < 15,
    `${pathsViewCount} nodes`,
  )
  await page.locator('button:has-text("Whole network")').click()

  // The optional whole-network view contains the existing seed, not an unbounded crawl.
  await page.waitForTimeout(500)
  const nodeCount = await page.locator('.react-flow__node').count()
  check('whole-network view contains the seed', nodeCount > pathsViewCount, `${nodeCount} nodes`)

  // a target person node carries the brand border
  const targetHtml = await page
    .locator('.react-flow__node:has-text("Maciej Stoiński")')
    .first()
    .innerHTML()
    .catch(() => '')
  check(
    'target person node has the brand border',
    targetHtml.includes('border-brand'),
    targetHtml.slice(0, 80),
  )

  await page.locator('button:has-text("Fit graph")').click()
  await page.waitForTimeout(600)

  // paths only shows fewer nodes
  await page.locator('button:has-text("Paths only")').click()
  await page.waitForTimeout(800)
  const pathCount = await page.locator('.react-flow__node').count()
  check('paths only shows fewer nodes', pathCount > 0 && pathCount < nodeCount, `${pathCount} nodes`)
  await page.locator('button:has-text("Whole network")').click()
  await page.waitForTimeout(600)

  // select Wiktor Gaweł — three hops and two drafts
  await page.getByPlaceholder('Search the network…').fill('Wiktor')
  await page.getByRole('button', { name: /Wiktor Gaweł/ }).first().click()
  await page.waitForTimeout(400)
  const detailText = await page.locator('aside, [data-testid="detail"], main .xl\\:w-\\[370px\\], main > div > div:last-child').last().innerText().catch(() => '')
  const hopsOk = /Jan Kowalski/.test(detailText) && /Minerva/.test(detailText) && /Wiktor/.test(detailText)
  const draftCount = await page.locator('aside textarea').count()
  check('Wiktor Gaweł detail shows the three-hop path', hopsOk, detailText.slice(0, 100).replace(/\n/g, ' | '))
  check('two message drafts for a target', draftCount === 2, `${draftCount} drafts`)

  // drafts are editable and Copy exists
  const draftBox = page.locator('aside textarea').first()
  await draftBox.fill('EDITED — typed by the e2e check')
  check(
    'draft textarea accepts typing',
    (await draftBox.inputValue()) === 'EDITED — typed by the e2e check',
  )
  check(
    'Copy button exists for drafts',
    await page.getByRole('button', { name: 'Copy' }).first().isVisible(),
  )

  // Connections rows are buttons — clicking one changes the selection
  const connRows = page
    .locator('aside section')
    .filter({ hasText: 'Connections (' })
    .getByRole('button')
  const connCount = await connRows.count()
  let connOk = false
  let connExtra = `${connCount} rows`
  if (connCount > 0) {
    const neighbour = (await connRows.first().innerText()).split('—')[0].trim()
    await connRows.first().click()
    await page.waitForTimeout(400)
    const header = await page
      .locator('aside p.font-semibold')
      .first()
      .innerText()
      .catch(() => '')
    connOk = header.includes(neighbour.split(' ')[0]) && neighbour.length > 0
    connExtra = `${connCount} rows → "${neighbour}" → header "${header}"`
  }
  check('Connections rows are buttons and change the selection', connOk, connExtra)

  // profile form — selecting the "me" node opens MeProfileForm
  await page.getByPlaceholder('Search the network…').fill('Igor Komar')
  await page.getByRole('button', { name: /Igor Komar/ }).first().click()
  await page.waitForTimeout(400)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // stop / search deeper toggle — "Stopped" must not appear before Stop is clicked
  const introsStepText = await page
    .locator('li')
    .filter({ hasText: 'Warm intros' })
    .first()
    .innerText()
    .catch(() => '')
  check(
    'progress shows Stopped only after Stop is clicked',
    !/Stopped/.test(introsStepText),
    introsStepText.replace(/\n/g, ' | ').slice(0, 100),
  )
  const stopButton = page.getByRole('button', { name: 'Stop' }).first()
  const deeperButton = page.getByRole('button', { name: /Search deeper/ })
  if (await stopButton.isVisible().catch(() => false)) {
    await stopButton.click().catch(() => {})
  }
  const deeperVisible = await deeperButton
    .waitFor({ timeout: 30000 })
    .then(() => true)
    .catch(() => false)
  if (!deeperVisible) {
    const state = await page.evaluate(() => {
      const loadingNodes = [...document.querySelectorAll('.react-flow__node')]
        .filter((n) => n.querySelector('.animate-spin'))
        .map((n) => n.dataset.id)
      const buttons = [...document.querySelectorAll('button')].map((b) => b.textContent.trim())
      const progress = [...document.querySelectorAll('li')]
        .filter((li) => li.textContent.includes('Warm intros'))
        .map((li) => li.textContent.trim())
        .join(' / ')
      return { loadingNodes, hasStop: buttons.includes('Stop'), progress }
    })
    console.log('   DEBUG state:', JSON.stringify(state))
    console.log(
      '   DEBUG network calls:',
      apiLog.filter((e) => e.path === '/api/network').map((e) => e.name).join(', '),
    )
  }
  check('Search deeper appears after stop/budget', deeperVisible)
  if (deeperVisible) {
    const networkCallsBefore = apiLog.filter((e) => e.path === '/api/network').length
    await deeperButton.click()
    await page.waitForTimeout(2000)
    const networkCallsAfter = apiLog.filter((e) => e.path === '/api/network').length
    check(
      'Search deeper resumes the crawl (new /api/network calls)',
      networkCallsAfter > networkCallsBefore,
      `${networkCallsBefore} → ${networkCallsAfter}`,
    )
  }

  // "I know this person" → path score 100
  await page.getByPlaceholder('Search the network…').fill('Briehan')
  await page.getByRole('button', { name: /Briehan Burke/ }).first().click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'I know this person' }).click()
  await page.waitForTimeout(600)
  const score = await page.getByText('/ 100').first().innerText().catch(() => '')
  const scoreBlock = await page.locator('section').filter({ hasText: 'How you connect' }).innerText()
  check('I know this person → path score 100', /(^|\n)100/.test(scoreBlock), scoreBlock.slice(0, 60).replace(/\n/g, ' | '))

  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
  const unmocked = apiLog.filter((entry) => entry.unmocked)
  check('no unmocked POST /api/*', unmocked.length === 0, unmocked.map((e) => e.path).join(','))

  // mobile pass
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const mpage = await mobile.newPage()
  await mockApi(mpage)
  await mpage.addInitScript((profile) => {
    localStorage.setItem('vcscout:me', JSON.stringify(profile))
    localStorage.setItem('vcscout:skip-walkthrough', '1')
  }, PROFILE)
  await mpage.goto(BASE_URL, { waitUntil: 'networkidle' })
  await mpage.getByPlaceholder(/Describe what you're building/).fill(
    'AI copilot for public procurement teams that drafts tender responses and checks compliance.',
  )
  await mpage.getByPlaceholder(/Describe what you're building/).press('Enter')
  await mpage.locator('button:has-text("Warm intros")').waitFor({ timeout: 15000 })
  await mpage.locator('button:has-text("Warm intros")').click()
  await mpage.waitForFunction(
    () => document.querySelectorAll('[data-testid="warmest-list"] li button').length >= 3,
    { timeout: 30000 },
  )
  await mpage.waitForTimeout(500)

  console.log(`\nPOSTs intercepted: ${apiLog.length}`)
  const counts = {}
  for (const entry of apiLog) counts[entry.path] = (counts[entry.path] ?? 0) + 1
  console.log(JSON.stringify(counts, null, 1))

  await browser.close()
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} assertions passed`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
