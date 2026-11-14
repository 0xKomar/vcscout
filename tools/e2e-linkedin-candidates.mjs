// Mocked flow: screen a large LinkedIn export, research targeted contacts, and keep depth bounded.
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(join(
  process.env.PLAYWRIGHT_NODE_PATH ?? '/Users/komar/.npm/_npx/e41f203b7505f1fb/node_modules',
  'x.js',
))
const { chromium } = require('playwright')
const base = process.env.VCSCOUT_BASE_URL ?? 'http://127.0.0.1:8765'
const calls = []
const errors = []
const contacts = Array.from({ length: 823 }, (_, index) => ({
  name: index === 800 ? 'Ava Engineer' : `Contact ${index}`,
  company: index === 800 ? 'Google' : `Other Company ${index}`,
  position: index === 800 ? 'AI Engineer' : 'Chef',
  url: `https://www.linkedin.com/in/contact-${index}`,
}))
const profile = {
  name: 'Test Person', linkedin_url: '', employers: [], schools: [], contacts: [], hidden: [], facts: [],
}
const fact = (role) => ({
  kind: 'role', organization: 'BridgeWorks', role, start: '2020', end: '2022',
  source_url: 'https://example.com/team', origin: 'openai',
})

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.addInitScript(({ me, linkedin }) => {
    localStorage.setItem('vcscout:me', JSON.stringify(me))
    localStorage.setItem('vcscout:linkedin-connections', JSON.stringify({
      fileName: 'connections.csv', importedAt: '2025-01-01', connections: linkedin,
    }))
  }, { me: profile, linkedin: contacts })
  await page.route('**/api/*', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() !== 'POST') {
      if (path !== '/api/examples') errors.push(`Unexpected ${request.method()} ${path}`)
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"names":[]}' })
    }
    const body = request.postDataJSON() ?? {}
    calls.push({ path, body })
    let result
    switch (path) {
      case '/api/similar':
        result = { matches: [{ company: 'Forgent AI', description: 'AI procurement',
          similarity_reason: 'Same market', source_url: 'https://example.com' }] }
        break
      case '/api/search': result = { company: body.name, cached: true, rounds: [] }; break
      case '/api/founders':
        result = { founders: [{ name: 'Target Founder', role: 'CEO',
          source_url: 'https://example.com/founder' }], origin: 'cache' }
        break
      case '/api/network':
        result = body.kind === 'org'
          ? { kind: 'org', name: body.name, entity: null, people: [], origin: 'cache', failed: [] }
          : { kind: 'person', name: body.name, entity: null,
            connections: body.name === 'Ava Engineer' ? [{
              name: 'Dana Peer', role: 'Engineer', organization: 'Other Lab', via: 'Conference',
              via_type: 'event', relationship: 'co-appearance',
              context: 'Both appeared at the same event.', date: null,
              source_url: 'https://example.com/event', origin: 'openai', certainty: 'inferred',
            }] : [], origin: 'openai', failed: [],
            facts: body.name === 'Ava Engineer' ? [fact('Engineer')]
              : body.name === 'Target Founder' ? [fact('Director')] : [] }
        break
      case '/api/partners': result = { partners: [], origin: 'cache' }; break
      case '/api/linkedin': result = { url: null, evidence: null, photo: null, origin: 'cache' }; break
      case '/api/risks': result = { risks: [] }; break
      case '/api/rank': result = { order: [], origin: 'cache' }; break
      case '/api/me': result = { facts: [], origin: 'cache' }; break
      case '/api/dossier': result = { name: body.name, fund: body.fund, facts: [], origin: 'cache' }; break
      case '/api/fund-paths': result = { companies: [], origin: 'cache' }; break
      case '/api/person-investments': result = { investments: [], origin: 'cache' }; break
      default:
        errors.push(`Unmocked API call: ${path}`)
        result = { error: 'unmocked' }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) })
  })
  const networkCalls = () => calls.filter((entry) => entry.path === '/api/network')
  const waitForCall = async (name) => {
    const end = Date.now() + 15000
    while (Date.now() < end) {
      const entry = networkCalls().find((item) => item.body.name === name)
      if (entry) return entry.body
      await page.waitForTimeout(100)
    }
    throw new Error(`${name} was not researched: ${JSON.stringify(networkCalls().map((c) => c.body.name))}`)
  }

  try {
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.getByPlaceholder(/Describe what you're building/).fill('AI software for public procurement.')
    await page.getByPlaceholder(/Describe what you're building/).press('Enter')
    await page.locator('button:has-text("Warm intros")').click({ timeout: 15000 })
    const target = page.getByRole('button', { name: /Target Founder/ }).first()
    await target.waitFor({ timeout: 15000 })
    if (networkCalls().length) throw new Error('Research started before a target was selected')
    if (!(await page.getByText('Select a target to assess 823 LinkedIn contacts.').isVisible()))
      throw new Error('Contact screening hint is missing')
    await target.click()
    const ava = await waitForCall('Ava Engineer')
    if (!ava.enhance || !ava.include_adjacent || ava.profile_url !== contacts[800].url ||
      !ava.identity_orgs.includes('Google') || ava.counterpart.name !== 'Target Founder')
      throw new Error(`Candidate request lacks web research or identity context: ${JSON.stringify(ava)}`)
    await page.getByText(/823 LinkedIn contacts screened locally/).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: /Target Founder/ }).first()
      .getByText(/Ava Engineer/).waitFor({ timeout: 15000 })
    await page.locator('button:has-text("Whole network")').click()
    await page.getByText('Dana Peer', { exact: true }).first().waitFor({ timeout: 15000 })
    const graph = await page.locator('.react-flow').innerText()
    if (graph.includes('Contact 701')) throw new Error('Unselected contacts flooded the graph')
    console.log('PASS  screens 823 contacts locally and researches the relevant candidate after target selection')
    console.log('PASS  sourced background links the chosen contact to the target')

    await page.getByText(/Browse \d+ waiting contacts/).click()
    await page.getByLabel('Search LinkedIn contacts').fill('Contact 701')
    await page.getByRole('button', { name: 'Research Contact 701' }).click()
    const manual = await waitForCall('Contact 701')
    if (!manual.enhance || manual.profile_url !== contacts[701].url)
      throw new Error('Manually selected contact did not receive web research')
    console.log('PASS  a specific contact can be found and researched explicitly')

    await page.getByRole('button', { name: 'Research next 3 contacts' }).click()
    await Promise.all(['Contact 0', 'Contact 1', 'Contact 10'].map(waitForCall))
    if (!(await page.getByText(/depth 3/).first().isVisible()))
      throw new Error('Reviewing contacts unexpectedly changed the depth limit')
    if (errors.length) throw new Error(errors.join(' | '))
    console.log('PASS  another batch is researched without approving deeper graph traversal')
    console.log('PASS  browser flow used only mocked APIs')
  } finally {
    await browser.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
