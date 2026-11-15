// Mocked browser test: going beyond depth three requires explicit approval.
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
const profile = {
  name: 'Marta Example', linkedin_url: '', contacts: [], hidden: [],
  employers: [{ organization: 'Root Company', start: '', end: '' }], schools: [],
  facts: [{ kind: 'role', organization: 'Root Company', role: '', start: null, end: null,
    source_url: 'self-reported', certainty: 'fact' }],
}
const colleague = (name, organization) => ({
  name, role: 'Engineer', organization, via: organization, via_type: 'company',
  relationship: 'colleague', context: 'Worked together', date: null,
  source_url: 'https://example.com/team',
})
const connections = {
  'Marta Example': [colleague('Alice Bridge', 'Root Company')],
  'Alice Bridge': [colleague('Bob Bridge', 'Root Company')],
  'Bob Bridge': [colleague('Charlie Bridge', 'Stage Two')],
  'Charlie Bridge': [colleague('Dana Bridge', 'Stage Three')],
}

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.addInitScript((value) => {
    localStorage.setItem('vcscout:me', JSON.stringify(value))
    localStorage.setItem('vcscout:skip-walkthrough', '1')
  }, profile)
  await page.route('**/api/*', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') return route.continue()
    const path = new URL(request.url()).pathname
    const body = request.postDataJSON() ?? {}
    calls.push({ path, body })
    let data
    switch (path) {
      case '/api/similar':
        data = { matches: [{ company: 'Target Company', description: 'Software',
          similarity_reason: 'Same market', source_url: 'https://example.com' }] }
        break
      case '/api/search': data = { company: body.name, rounds: [], cached: true }; break
      case '/api/founders':
        data = { founders: [{ name: 'Target Founder', role: 'Founder',
          source_url: 'https://example.com/founder' }], origin: 'cache' }
        break
      case '/api/network':
        data = body.kind === 'org'
          ? { kind: 'org', name: body.name, entity: null, people: [], origin: 'cache', failed: [] }
          : { kind: 'person', name: body.name, entity: null,
            connections: connections[body.name] ?? [], facts: [], origin: 'cache', failed: [] }
        break
      case '/api/rank': data = { order: [], origin: 'cache' }; break
      case '/api/linkedin': data = { url: null, evidence: null, photo: null, origin: 'cache' }; break
      case '/api/risks': data = { risks: [] }; break
      case '/api/partners': data = { partners: [], origin: 'cache' }; break
      case '/api/me': data = { facts: [], origin: 'cache' }; break
      case '/api/fund-paths': data = { companies: [], origin: 'cache' }; break
      case '/api/person-investments': data = { investments: [], origin: 'cache' }; break
      case '/api/dossier': data = { name: body.name, fund: body.fund, facts: [], origin: 'cache' }; break
      default: throw new Error(`Unexpected API call: ${path}`)
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  const searched = () => calls.filter((entry) => entry.path === '/api/network').map((entry) => entry.body.name)
  const waitUntil = async (predicate, description) => {
    const end = Date.now() + 15000
    while (Date.now() < end) {
      if (predicate()) return
      await page.waitForTimeout(100)
    }
    throw new Error(`${description}; searched: ${searched().join(', ')}`)
  }

  try {
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.getByPlaceholder(/Describe what you're building/).fill('Software for a focused market.')
    await page.getByPlaceholder(/Describe what you're building/).press('Enter')
    try {
      await page.locator('button:has-text("Warm intros")').click({ timeout: 15000 })
    } catch (error) {
      console.log('Calls:', calls.map((item) => item.path).join(', '))
      console.log('Page:', (await page.locator('body').innerText()).slice(0, 1500))
      throw error
    }
    await page.getByRole('button', { name: /Target Founder/ }).first().click()
    await waitUntil(() => searched().includes('Bob Bridge'), 'Depth-two person was not searched')
    const approve = page.getByRole('button', { name: /Search deeper \(allow depth 4\)/ })
    await approve.waitFor({ timeout: 15000 })
    if (searched().includes('Charlie Bridge')) throw new Error('Depth four started without approval')
    console.log('PASS  no expansion beyond depth three without approval')
    await approve.click()
    await waitUntil(() => searched().includes('Charlie Bridge'), 'Approved fourth level did not start')
    const nextApprove = page.getByRole('button', { name: /Search deeper \(allow depth 5\)/ })
    await nextApprove.waitFor({ timeout: 15000 })
    if (searched().includes('Dana Bridge')) throw new Error('Depth five started without separate approval')
    console.log('PASS  depth four approval does not authorize depth five')
    if (errors.length) throw new Error(errors.join(' | '))
    console.log('PASS  no browser errors or live API calls')
  } finally {
    await browser.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
