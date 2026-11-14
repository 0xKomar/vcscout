export const HERO_QUERY_ID = 'hero-query'

export function focusHeroQuery(): void {
  const element = document.getElementById(HERO_QUERY_ID)
  if (!element) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' })
  element.focus({ preventScroll: true })
}
