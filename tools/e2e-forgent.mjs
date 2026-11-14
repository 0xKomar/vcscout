// Reproduce the misleading Forgent route without calling Cala or OpenAI.
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(join(
  process.env.PLAYWRIGHT_NODE_PATH ?? '/Users/komar/.npm/_npx/e41f203b7505f1fb/node_modules',
  'x.js',
))
const { chromium } = require('playwright')
const base = process.env.VCSCOUT_BASE_URL ?? 'http://127.0.0.1:8765'

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.addInitScript(() => {
    localStorage.setItem('vcscout:me', JSON.stringify({
      name: 'Test Person', linkedin_url: '', employers: [], schools: [], contacts: [], hidden: [], facts: [],
    }))
    localStorage.setItem('vcscout:linkedin-connections', JSON.stringify({
      fileName: 'test.csv', importedAt: '', connections: [{
        name: 'Tilman Resch', company: 'OpenAI', position: 'Member of GTM Staff',
        url: 'https://www.linkedin.com/in/tilman-resch',
      }],
    }))
  })
  await page.route('**/api/*', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') return route.continue()
    const path = new URL(request.url()).pathname
    const body = request.postDataJSON() ?? {}
    calls.push({ path, body })
    let result
    switch (path) {
      case '/api/similar':
        result = { matches: [{ company: 'Forgent AI', description: 'AI procurement',
          similarity_reason: 'Same market', source_url: 'https://example.com' }] }
        break
      case '/api/search':
        result = { company: 'Forgent AI', cached: true, rounds: [{
          round_type: 'Pre-Seed', announcement_date: '2025-09-23',
          lead_investors: 'Cherry Ventures',
          investors: 'Cherry Ventures, Mehdi Ghissassi, and leading experts from OpenAI, Anthropic, and DeepMind',
          source_urls: 'https://example.com/funding',
        }] }
        break
      case '/api/founders':
        result = { founders: [{ name: 'Erik Heinelt', role: 'Co-founder and CEO',
          source_url: 'https://example.com/team' }], origin: 'cache' }
        break
      case '/api/network':
        result = body.kind === 'org'
          ? { kind: 'org', name: body.name, entity: null, people: [], origin: 'cache', failed: [] }
          : { kind: 'person', name: body.name, entity: null, connections: [], facts: [], origin: 'cache', failed: [] }
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

  try {
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.getByPlaceholder(/Describe what you're building/).fill('AI software for public procurement.')
    await page.getByPlaceholder(/Describe what you're building/).press('Enter')
    await page.locator('button:has-text("Warm intros")').click({ timeout: 15000 })
    const target = page.getByRole('button', { name: /Erik Heinelt/ }).first()
    await target.waitFor({ timeout: 15000 })
    const targetText = await target.innerText()
    if (!targetText.includes('No connection found yet') || targetText.includes('Tilman'))
      throw new Error(`Incorrect initial route: ${targetText}`)
    await target.click()
    await page.locator('button:has-text("Whole network")').click()
    await page.waitForTimeout(1200)
    const graph = await page.locator('.react-flow').innerText()
    if (/leading experts|Anthropic|DeepMind/i.test(graph))
      throw new Error(`A collective or employer was rendered as an investor: ${graph}`)
    if (calls.some(({ body }) => /leading experts|Anthropic|DeepMind/i.test(body.name ?? body.fund ?? '')))
      throw new Error('A collective or employer was used for a research request')
    if (errors.length) throw new Error(errors.join(' | '))
    console.log('PASS  no invented Tilman-to-Forgent introduction')
    console.log('PASS  collective descriptions do not become investor nodes or research targets')
    console.log('PASS  browser flow used only mocked APIs')
  } finally {
    await browser.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
