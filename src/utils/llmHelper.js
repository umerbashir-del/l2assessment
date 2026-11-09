import { categorizeLocally } from './categoryFallback.js'
import { fallbackDescription, fallbackReasons } from './fallbackReasons.js'
export async function categorizeMessage(message, fetcher = globalThis.fetch) {
 let fallbackCode = 'backend_unavailable'
 try {
  const response = await fetcher('/api/classify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }), signal: AbortSignal.timeout(25000) })
  if (!response.ok) {
   fallbackCode = response.status >= 400 && response.status < 500 ? 'request_rejected' : 'backend_unavailable'
   const body = await response.json().catch(() => ({}))
   if (Object.hasOwn(fallbackReasons, body.code)) fallbackCode = body.code
   throw new Error('AI unavailable')
  }
  fallbackCode = 'invalid_result'
  const result = await response.json()
  if (result.source !== 'ai' || !Array.isArray(result.categories) || !result.categories.length || !Array.isArray(result.issues) || typeof result.reasoning !== 'string') throw new Error('Invalid response')
  return result
 } catch (error) {
  if (error.name === 'TimeoutError' || error.name === 'AbortError') fallbackCode = 'timeout'
  return { ...categorizeLocally(message), fallbackCode, fallbackReason: fallbackDescription(fallbackCode) }
 }
}
