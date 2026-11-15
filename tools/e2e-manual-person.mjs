// Manual LinkedIn profiles and research flow; every API is intercepted.
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(join(
  process.env.PLAYWRIGHT_NODE_PATH ?? '/Users/komar/.npm/_npx/e41f203b7505f1fb/node_modules',
  'x.js',
))
const { chromium } = require('playwright')
const base = process.env.VCSCOUT_BASE_URL ?? 'http://127.0.0.1:8767'
const url = 'https://www.linkedin.com/in/jordan-north'

async function exercise(browser, viewport, label, noMatches = false) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const calls = []
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.addInitScript(() => {
    localStorage.setItem('vcscout:skip-walkthrough', '1')
    if (!localStorage.getItem('vcscout:me')) localStorage.setItem('vcscout:me', JSON.stringify({
      name: 'Alex Morgan', linkedin_url: 'https://www.linkedin.com/in/alex-morgan',
      employers: [], schools: [], contacts: [], facts: [], hidden: [],
    }))
  })
  await page.route('**/api/*', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'GET') {
      if (path !== '/api/examples') errors.push(`Unexpected GET ${path}`)
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"names":[]}' })
    }
    const body = request.postDataJSON() ?? {}
    calls.push({ path, body })
    let result
    switch (path) {
      case '/api/similar':
        result = { matches: noMatches ? [] : [{ company: 'Harbor AI', description: 'AI tools',
          similarity_reason: 'Same market', source_url: 'https://example.com/harbor' }] }
        break
      case '/api/search': result = { company: body.name, cached: true, rounds: [] }; break
      case '/api/founders':
        result = { founders: [{ name: 'Sam Cruz', role: 'CEO', source_url: 'https://example.com/founder' }], origin: 'cache' }
        break
      case '/api/network':
        result = body.kind === 'org'
          ? { kind: 'org', name: body.name, entity: null, people: [], origin: 'cache', failed: [] }
          : { kind: 'person', name: body.name, entity: null, connections: [], facts: [], origin: 'openai', failed: [] }
        break
      case '/api/me': result = { facts: [], origin: 'cache' }; break
      case '/api/partners': result = { partners: [], origin: 'cache' }; break
      case '/api/linkedin': result = { url: null, evidence: null, photo: null, origin: 'cache' }; break
      case '/api/risks': result = { risks: [] }; break
      case '/api/rank': result = { order: [], origin: 'cache' }; break
      case '/api/dossier': result = { name: body.name, fund: body.fund, facts: [], origin: 'cache' }; break
      default: errors.push(`Unmocked API call: ${path}`); result = { error: 'unmocked' }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) })
  })
  const start = async () => {
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.getByPlaceholder(/Describe what you're building/).fill('AI for procurement')
    await page.getByPlaceholder(/Describe what you're building/).press('Enter')
    await page.getByRole('button', { name: 'Add person', exact: true }).waitFor({ timeout: 15000 })
  }
  const getDetail = async (name) => {
    await page.locator('.react-flow__node').filter({ hasText: name }).click()
    if (viewport.width < 1280) {
      return page.getByRole('dialog')
    }
    return page.locator('aside')
  }
  try {
    await start()
    await page.getByRole('button', { name: 'Add person', exact: true }).click()
    let form = page.getByRole('dialog')
    await form.getByLabel('LinkedIn profile URL').fill('https://linkedin.com.evil.example/in/jordan')
    await form.getByRole('button', { name: 'Add to map' }).click()
    await form.getByRole('alert').getByText(/Enter a LinkedIn person profile/).waitFor()
    await form.getByLabel('LinkedIn profile URL').fill('linkedin.com/in/jordan-north/?trk=share')
    if (process.env.VCSCOUT_SCREENSHOTS)
      await page.screenshot({ path: `/tmp/vcscout-manual-${label}.png` })
    await form.getByRole('button', { name: 'Add to map' }).click()
    await page.locator('.react-flow__node').filter({ hasText: 'LinkedIn: jordan-north' }).waitFor()
    if (calls.some((entry) => entry.path === '/api/network'))
      throw new Error(`${label}: adding a profile started research before target selection`)
    let detail = await getDetail('LinkedIn: jordan-north')
    await detail.getByText('Add their name to research this profile.').waitFor()
    if (await detail.getByText('Known contact').count())
      throw new Error(`${label}: the pasted link incorrectly became a known contact`)
    await detail.getByRole('button', { name: 'I know this person' }).click()
    await detail.getByText('Known contact').waitFor()
    if (calls.some((entry) => entry.path === '/api/network'))
      throw new Error(`${label}: confirming an unnamed profile started research`)
    await detail.getByRole('button', { name: 'Add name' }).click()
    form = page.getByRole('dialog')
    await form.getByLabel('Full name').fill('Jordan North')
    await form.getByLabel('This is someone I want to reach').check()
    await form.getByRole('button', { name: 'Save person' }).click()
    await page.locator('.react-flow__node').filter({ hasText: 'Jordan North' }).waitFor()
    if (calls.some((entry) => entry.path === '/api/network'))
      throw new Error(`${label}: target was researched before the user selected them`)
    if (viewport.width < 1024) await page.locator('button').filter({ hasText: /^List$/ }).click()
    const target = page.locator('[data-testid=warmest-list]').getByRole('button', { name: /Jordan North/ })
    const targetRequest = page.waitForRequest((request) =>
      new URL(request.url()).pathname === '/api/network' &&
      request.postDataJSON()?.name === 'Jordan North', { timeout: 15000 })
    await target.click()
    const root = (await targetRequest).postDataJSON()
    if (root.profile_url !== url || !root.enhance)
      throw new Error(`${label}: target search did not use the selected LinkedIn URL: ${JSON.stringify(root)}`)
    detail = viewport.width < 1280 ? page.getByRole('dialog') : page.locator('aside')
    await detail.getByText('Person to meet').waitFor()
    if (await detail.getByText('Founder', { exact: true }).count())
      throw new Error(`${label}: a role was invented for the manual target`)
    await detail.getByText('Known contact').waitFor()
    await detail.getByText(/100\s*\/\s*100/).waitFor()
    if (viewport.width < 1280) await detail.getByRole('button', { name: 'Close' }).click()
    await page.getByRole('button', { name: 'Add person', exact: true }).click()
    form = page.getByRole('dialog')
    await form.getByLabel('LinkedIn profile URL').fill('https://www.linkedin.com/in/taylor-voss')
    await form.getByLabel('Full name').fill('Taylor Voss')
    await form.getByRole('button', { name: 'Add to map' }).click()
    await page.locator('.react-flow__node').filter({ hasText: 'Taylor Voss' }).waitFor()
    detail = await getDetail('Taylor Voss')
    if (await detail.getByText('Known contact').count())
      throw new Error(`${label}: the second profile was incorrectly marked as known`)
    const deepRequest = page.waitForRequest((request) =>
      new URL(request.url()).pathname === '/api/network' &&
      request.postDataJSON()?.name === 'Taylor Voss' && request.postDataJSON()?.deep, { timeout: 15000 })
    await detail.getByRole('button', { name: 'Search connections' }).click()
    const deep = (await deepRequest).postDataJSON()
    if (deep.profile_url !== 'https://www.linkedin.com/in/taylor-voss' || !deep.include_adjacent)
      throw new Error(`${label}: manual research did not pass the profile and adjacent-search option`)
    if (viewport.width < 1280) await detail.getByRole('button', { name: 'Close' }).click()
    await page.getByRole('button', { name: 'Add person', exact: true }).click()
    form = page.getByRole('dialog')
    await form.getByLabel('LinkedIn profile URL').fill('https://linkedin.com/in/jordan-north')
    await form.getByRole('button', { name: 'Add to map' }).click()
    await form.getByRole('alert').getByText('This profile is already added to your map.').waitFor()
    await form.getByRole('button', { name: 'Close' }).click()
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vcscout:me')).manual_people)
    if (stored.length !== 2 || !stored.some((person) => person.profile_url === url && person.name === 'Jordan North'))
      throw new Error(`${label}: added profile was not stored locally`)
    await start()
    if (viewport.width < 1024) await page.locator('button').filter({ hasText: /^Graph$/ }).click()
    await page.locator('.react-flow__node').filter({ hasText: 'Jordan North' }).waitFor()
    detail = await getDetail('Jordan North')
    await detail.getByRole('button', { name: 'Edit or remove' }).click()
    form = page.getByRole('dialog')
    await form.getByRole('button', { name: 'Remove added person' }).click()
    await form.getByRole('button', { name: 'Yes, remove person' }).click()
    await page.locator('.react-flow__node').filter({ hasText: 'Jordan North' }).waitFor({ state: 'detached' })
    const remaining = await page.evaluate(() => JSON.parse(localStorage.getItem('vcscout:me')))
    if (remaining.contacts.length || remaining.manual_people.length !== 1)
      throw new Error(`${label}: removal left the manual confirmation behind`)
    if (errors.length) throw new Error(`${label}: ${errors.join(' | ')}`)
    console.log(`PASS  ${label}: URL-only node, identity safety, manual target, research and persistence`)
  } finally {
    await context.close()
  }
}

const browser = await chromium.launch()
try {
  await exercise(browser, { width: 1440, height: 900 }, 'desktop')
  await exercise(browser, { width: 390, height: 844 }, 'mobile')
  await exercise(browser, { width: 390, height: 844 }, 'no-matches', true)
  console.log('PASS  all research requests were mocked')
} finally {
  await browser.close()
}
