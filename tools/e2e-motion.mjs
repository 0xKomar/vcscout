// Exercise the animated landing page without live research calls.
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(join(
  process.env.PLAYWRIGHT_NODE_PATH ?? '/Users/komar/.npm/_npx/e41f203b7505f1fb/node_modules',
  'x.js',
))
const { chromium } = require('playwright')
const base = process.env.VCSCOUT_BASE_URL ?? 'http://127.0.0.1:8767'

async function run(browser, width, reducedMotion) {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 900 },
    reducedMotion,
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.route('**/api/*', async (route) => {
    const request = route.request()
    if (request.method() !== 'GET' || new URL(request.url()).pathname !== '/api/examples')
      errors.push(`Unexpected API request: ${request.method()} ${request.url()}`)
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"names":["Harbor AI"]}' })
  })
  try {
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.waitForTimeout(750)
    const dimensions = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }))
    if (dimensions.content > dimensions.viewport)
      throw new Error(`horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`)

    const rays = page.locator('.atlas-light-rays')
    const sample = () => rays.evaluate((element) => {
      const style = getComputedStyle(element)
      return `${style.opacity}|${style.transform}`
    })
    const before = await sample()
    await page.waitForTimeout(850)
    const after = await sample()
    if (reducedMotion === 'reduce' ? before !== after : before === after)
      throw new Error(`ambient animation did not respect ${reducedMotion}: ${before} -> ${after}`)

    if (width === 320) {
      const overlaps = await page.locator('.atlas-node').evaluateAll((nodes) => {
        const boxes = nodes.map((node) => node.getBoundingClientRect())
        return boxes.some((a, index) => boxes.slice(index + 1).some((b) =>
          a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top))
      })
      if (overlaps) throw new Error('illustrative nodes overlap on the narrowest screen')
    }

    await page.getByRole('button', { name: 'Find your way in' }).click()
    const idea = page.getByPlaceholder(/Describe what you're building/)
    if (!(await idea.evaluate((element) => document.activeElement === element)))
      throw new Error('hero CTA did not focus the search')
    await page.getByRole('button', { name: 'Details', exact: true }).click()
    await page.getByLabel('Market', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Details', exact: true }).click()

    const choose = page.getByRole('button', { name: /Choose who to meet/ })
    await choose.click()
    await page.getByText('Choose who matters and explore from both ends.').waitFor()
    if (await choose.getAttribute('aria-pressed') !== 'true')
      throw new Error('feature selection is not communicated accessibly')
    await page.getByRole('button', { name: /Find a way in/, exact: false }).last().click()
    await page.getByText('Find a thoughtful reason to start a conversation.').waitFor()
    if (errors.length) throw new Error(errors.join(' | '))
    console.log(`PASS  ${width}px ${reducedMotion}: animation, search and interactive journey`)
  } finally {
    await context.close()
  }
}

const browser = await chromium.launch()
try {
  await run(browser, 1440, 'no-preference')
  await run(browser, 390, 'no-preference')
  await run(browser, 320, 'reduce')
  console.log('PASS  landing checks used only mocked API requests')
} finally {
  await browser.close()
}
