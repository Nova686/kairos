const antiBotMarkers: { reason: string; pattern: RegExp }[] = [
  { reason: 'datadome', pattern: /captcha-delivery\.com/i },
  { reason: 'cloudflare-challenge', pattern: /cf-chl|<title>Just a moment\.\.\.<\/title>|challenge-platform/i },
  { reason: 'captcha', pattern: /class="[^"]*\b(g-recaptcha|h-captcha|cf-turnstile)\b|pas un robot|not a robot/i },
]

export const detectAntiBotPage = (httpStatus: number, html: string): string | null => {
  if (httpStatus === 403 || httpStatus === 429) {
    return `http-${httpStatus}`
  }
  const matchedMarker = antiBotMarkers.find((marker) => marker.pattern.test(html))
  return matchedMarker?.reason ?? null
}
