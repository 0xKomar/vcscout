// People-first UI flow, mocked end to end so no research credits are consumed.
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(join(
  process.env.PLAYWRIGHT_NODE_PATH ?? '/Users/komar/.npm/_npx/e41f203b7505f1fb/node_modules',
  'x.js',
))
const { chromium } = require('playwright')
const base = process.env.VCSCOUT_BASE_URL ?? 'http://127.0.0.1:8767'
const screenshots = process.env.VCSCOUT_SCREENSHOTS

async function exercise(browser, viewport, label) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const calls = []
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.route('**/api/*', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() !== 'POST') {
      if (path !== '/api/examples') errors.push(`Unexpected ${request.method()} ${path}`)
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"names":["Harbor AI"]}' })
    }
    const body = request.postDataJSON() ?? {}
    calls.push({ path, body })
    let result
    switch (path) {
      case '/api/similar':
        result = { matches: [{ company: 'Harbor AI', description: 'AI tools for procurement',
          similarity_reason: 'Same market', source_url: 'https://example.com/harbor' }] }
        break
      case '/api/search': result = { company: body.name, cached: true, rounds: [] }; break
      case '/api/founders':
        result = { founders: [{ name: 'Sam Cruz', role: 'CEO',
          source_url: 'https://example.com/founder' }], origin: 'cache' }
        break
      case '/api/me': result = { facts: [], origin: 'cache' }; break
      case '/api/network':
        result = body.kind === 'org'
          ? { kind: 'org', name: body.name, entity: null, people: [], origin: 'cache', failed: [] }
          : { kind: 'person', name: body.name, entity: null, connections: [], origin: 'openai', failed: [],
            facts: body.name === 'Sam Cruz' ? [{
              kind: 'role', organization: 'Common Studio', role: 'Engineer', start: '2020', end: '2022',
              source_url: 'https://example.com/team', origin: 'openai', certainty: 'inferred',
            }] : [] }
        break
      case '/api/partners': result = { partners: [], origin: 'cache' }; break
      case '/api/linkedin': result = { url: null, evidence: null, photo: null, origin: 'cache' }; break
      case '/api/risks': result = { risks: [] }; break
      case '/api/rank': result = { order: [], origin: 'cache' }; break
      case '/api/dossier': result = { name: body.name, fund: body.fund, facts: [], origin: 'cache' }; break
      case '/api/fund-paths': result = { companies: [], origin: 'cache' }; break
      case '/api/person-investments': result = { investments: [], origin: 'cache' }; break
      default:
        errors.push(`Unmocked API call: ${path}`)
        result = { error: 'unmocked' }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) })
  })

  const assertNoOverflow = async () => {
    const dimensions = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth, viewport: innerWidth,
    }))
    if (dimensions.content > dimensions.viewport)
      throw new Error(`${label}: horizontal overflow ${JSON.stringify(dimensions)}`)
  }
  try {
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: /The right people are closer than you think/ }).waitFor()
    await page.getByRole('heading', { name: /Don't let your first check become a dead end/ }).waitFor()
    if (await page.getByText('I know a startup').count())
      throw new Error(`${label}: startup-by-name tab should not exist`)
    if (await page.locator('#saved').count())
      throw new Error(`${label}: saved startup examples section should not exist`)
    await page.getByRole('img', { name: /possible path from you/ }).waitFor()
    await assertNoOverflow()
    await page.getByRole('button', { name: 'Find your way in' }).click()
    const idea = page.getByPlaceholder(/Describe what you're building/)
    if (!(await idea.evaluate((element) => document.activeElement === element)))
      throw new Error(`${label}: hero CTA did not focus the search`)
    if (screenshots) await page.screenshot({ path: `/tmp/vcscout-landing-${label}.png`, fullPage: true })
    await idea.fill('AI software for public procurement teams.')
    await page.getByRole('button', { name: 'Search', exact: true }).click()

    const tutorial = page.getByTestId('results-tutorial')
    const spotlight = page.getByTestId('tutorial-spotlight')
    const blocker = page.getByTestId('tutorial-blocker')
    await tutorial.waitFor({ timeout: 15000 })
    await spotlight.waitFor({ timeout: 15000 })
    await blocker.waitFor({ timeout: 15000 })
    if (await tutorial.getByRole('button', { name: /Skip|Close/ }).count())
      throw new Error(`${label}: initial walkthrough must not allow skipping before completion`)
    const maskCutouts = await spotlight.locator('mask rect[fill="black"]').count()
    if (maskCutouts < 1)
      throw new Error(`${label}: spotlight mask did not cut out active tutorial target`)
    await tutorial.getByText('01 / 08').waitFor()
    await tutorial.getByText('Finish walkthrough to explore').waitFor()
    if (screenshots) {
      await page.waitForTimeout(200)
      await page.screenshot({ path: `/tmp/vcscout-tutorial-step1-${label}.png` })
    }
    await tutorial.getByRole('button', { name: 'Next' }).click()
    await tutorial.getByText('02 / 08').waitFor()
    await page.getByText('Similar to your idea').waitFor({ timeout: 15000 })
    await tutorial.getByRole('button', { name: 'Next' }).click()
    await tutorial.getByText('03 / 08').waitFor()
    await tutorial.getByText(/Avoid dead-end funds with small networks/).waitFor()
    await tutorial.getByRole('button', { name: 'Next' }).click()
    await tutorial.getByText('04 / 08').waitFor()
    await tutorial.getByRole('button', { name: 'Next' }).click()
    await tutorial.getByText('05 / 08').waitFor()
    await tutorial.getByRole('button', { name: 'Next' }).click()
    await tutorial.getByText('06 / 08').waitFor()
    await page.locator('[data-tutorial="intros-graph"] .react-flow').waitFor({ timeout: 15000 })
    await page.locator('[data-tutorial="intros-graph"]').getByRole('radio', { name: 'Paths only' }).click()
    await page.locator('[data-tutorial="intros-graph"]').getByRole('radio', { name: 'Whole network' }).click()
    if (screenshots) {
      await page.waitForTimeout(250)
      await page.screenshot({ path: `/tmp/vcscout-tutorial-step6-${label}.png` })
    }
    await tutorial.getByRole('button', { name: 'Next' }).click()
    await tutorial.getByText('07 / 08').waitFor()
    const evidence = page.locator('[data-tutorial="connection-evidence"]').first()
    await evidence.getByText('Documented', { exact: true }).waitFor({ timeout: 15000 })
    await evidence.getByText('Inferred', { exact: true }).waitFor({ timeout: 15000 })
    await evidence.getByText('commonstudio.example.com').first().waitFor({ timeout: 15000 })
    await evidence.getByText('techbrief.example.com').waitFor({ timeout: 15000 })
    if (screenshots) {
      await page.waitForTimeout(250)
      await page.screenshot({ path: `/tmp/vcscout-tutorial-step7-${label}.png` })
    }
    await tutorial.getByRole('button', { name: 'Next' }).click()
    await tutorial.getByText('08 / 08').waitFor()
    const drafts = page.locator('[data-tutorial="message-drafts"]').first()
    await drafts.getByText('Ask Maya for an intro').waitFor({ timeout: 15000 })
    await drafts.getByText('Forwardable blurb').waitFor({ timeout: 15000 })
    if (await drafts.locator('textarea').count() !== 2)
      throw new Error(`${label}: expected two generated message drafts in tutorial step 8`)
    if (screenshots) {
      await page.waitForTimeout(250)
      await page.screenshot({ path: `/tmp/vcscout-tutorial-step8-${label}.png` })
    }
    if (calls.some((entry) => entry.path === '/api/network'))
      throw new Error(`${label}: tutorial preview unexpectedly called /api/network`)
    await tutorial.getByRole('button', { name: 'Start exploring' }).click()
    if (await spotlight.count() || await blocker.count())
      throw new Error(`${label}: spotlight or blocker remained visible after finishing tutorial`)

    await page.getByRole('button', { name: 'Walkthrough' }).click()
    await tutorial.waitFor()
    await tutorial.getByRole('button', { name: 'Close walkthrough' }).click()
    if (await spotlight.count())
      throw new Error(`${label}: spotlight remained visible after closing reopened walkthrough`)

    await page.getByText('Every introduction starts with you.').waitFor({ timeout: 15000 })
    if (calls.some((entry) => entry.path === '/api/network'))
      throw new Error(`${label}: intro research started before a target was selected`)
    await page.getByRole('button', { name: 'Add yourself' }).first().click()
    const profile = page.getByRole('dialog')
    await profile.getByLabel('Full name').fill('Alex Morgan')
    await profile.getByRole('button', { name: 'Add person' }).click()
    await profile.getByPlaceholder('Full name').fill('Maya Chen')
    await profile.getByPlaceholder('Company or organization').fill('Common Studio')
    await profile.locator('input[type=file]').setInputFiles({
      name: 'Connections.csv', mimeType: 'text/csv',
      buffer: Buffer.from('First Name,Last Name,URL,Email Address,Company,Position,Connected On\nLee,Park,https://www.linkedin.com/in/lee-park,,Acme,Designer,01 Jan 2025\n'),
    })
    await profile.getByText('1 connection imported').waitFor()
    if (screenshots) await page.screenshot({ path: `/tmp/vcscout-profile-${label}.png` })
    await profile.getByRole('button', { name: 'Save profile' }).click()

    if (viewport.width >= 1024)
      await page.getByText('Your path starts with a person.').waitFor({ timeout: 15000 })
    else
      await page.getByText('Who would you like to meet?').waitFor({ timeout: 15000 })
    const target = page.getByRole('button', { name: /Sam Cruz/ }).first()
    await target.waitFor({ timeout: 15000 })
    if (calls.some((entry) => entry.path === '/api/network'))
      throw new Error(`${label}: intro research started before target selection`)
    if (await page.locator('.react-flow').count())
      throw new Error(`${label}: a full graph is shown before picking a person`)
    await target.click()
    const detail = viewport.width < 1280 ? page.getByRole('dialog') : page.locator('aside')
    await detail.getByText('How you connect').waitFor({ timeout: 15000 })
    await detail.getByText('Common Studio', { exact: false }).first().waitFor({ timeout: 15000 })
    await detail.getByText('AI web — verify', { exact: false }).first().waitFor({ timeout: 15000 })
    if (await detail.locator('textarea').count() !== 2)
      throw new Error(`${label}: expected two editable intro drafts`)
    if (screenshots) {
      await page.waitForTimeout(300)
      await page.screenshot({ path: `/tmp/vcscout-detail-${label}.png` })
    }
    if (viewport.width < 1280) {
      await detail.getByRole('button', { name: 'Close' }).click()
      await page.locator('button').filter({ hasText: /^Graph$/ }).click()
    }
    await page.locator('.react-flow').waitFor({ timeout: 15000 })
    if (viewport.width < 640) {
      await page.locator('.react-flow__node').filter({ hasText: 'Sam Cruz' }).waitFor({ timeout: 15000 })
      await page.waitForTimeout(350)
      const start = await page.locator('.react-flow__node').filter({ hasText: 'Alex Morgan' }).boundingBox()
      const end = await page.locator('.react-flow__node').filter({ hasText: 'Sam Cruz' }).boundingBox()
      if (!start || !end || end.y < start.y + 120)
        throw new Error(`${label}: selected path is not readable vertically`)
    }
    await assertNoOverflow()
    if (screenshots) await page.screenshot({ path: `/tmp/vcscout-results-${label}.png`, fullPage: true })
    await page.getByRole('button', { name: 'VCScout home' }).click()
    await page.getByRole('heading', { name: /The right people are closer than you think/ }).waitFor()
    if (errors.length) throw new Error(`${label}: ${errors.join(' | ')}`)
    console.log(`PASS  ${label}: landing, dead-end guidance, spotlight tutorial, profile/import, target-first path and drafts`)
  } finally {
    await context.close()
  }
}

const browser = await chromium.launch()
try {
  await exercise(browser, { width: 1440, height: 900 }, 'desktop')
  await exercise(browser, { width: 390, height: 844 }, 'mobile')
  console.log('PASS  all API requests were mocked')
} finally {
  await browser.close()
}
