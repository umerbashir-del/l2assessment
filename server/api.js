import { requestClassification } from './classifier.js'
import { failureCodes, validationReasons } from './diagnostics.js'

export function logFailure(error, code, logger = console) {
  logger.error('AI classification fallback', {
    code: failureCodes.includes(code) ? code : 'provider_unavailable',
    finishReason: ['length', 'stop', 'content_filter'].includes(error?.finishReason) ? error.finishReason : undefined,
    status: Number.isInteger(error?.status) ? error.status : undefined,
    requestId: typeof error?.requestId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(error.requestId) ? error.requestId : undefined,
    validationReason: validationReasons.includes(error?.validationReason) ? error.validationReason : undefined,
  })
}

export function createClassifyHandler(env, classify = requestClassification, logger = console, now = Date.now) {
  const hits = new Map()
  let active = 0
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    const send = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)) }
    const close = (status, value) => {
      res.setHeader('Connection', 'close')
      if (res.once) res.once('finish', () => req.destroy())
      send(status, value)
      if (!res.once) req.destroy()
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return close(405, { error: 'POST required' }) }
    const host = req.headers.host || ''
    if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host)) return close(403, { error: 'Host rejected' })
    if (req.headers.origin && req.headers.origin !== `http://${host}`) return close(403, { error: 'Origin rejected' })
    if (req.headers['content-type'] && req.headers['content-type'].split(';')[0].trim().toLowerCase() !== 'application/json') return close(415, { error: 'JSON required' })
    if (!env.GROQ_API_KEY?.trim()) {
      logFailure(null, 'missing_configuration', logger)
      return close(503, { code: 'missing_configuration' })
    }
    const time = now()
    for (const [ip, entry] of hits) if (time - entry.start >= 60000) hits.delete(ip)
    const ip = req.socket?.remoteAddress || 'local'
    let entry = hits.get(ip)
    if (!entry) {
      if (hits.size >= 256) return close(429, { code: 'rate_limited' })
      entry = { start: time, count: 0 }; hits.set(ip, entry)
    }
    if (++entry.count > 20 || active >= 3) {
      res.setHeader('Retry-After', '60')
      return close(429, { code: entry.count > 20 ? 'rate_limited' : 'busy' })
    }
    if (req.headers['content-length'] && (!/^\d+$/.test(req.headers['content-length']) || Number(req.headers['content-length']) > 24000)) return close(413, { error: 'Message too large' })
    active++
    try {
      let bytes = 0
      const chunks = []
      try {
        for await (const chunk of req) {
          const data = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk
          bytes += data.byteLength
          if (bytes > 24000) return close(413, { error: 'Message too large' })
          chunks.push(data)
        }
      } catch {
        if (!res.destroyed && !res.writableEnded) close(400, { error: 'Request body could not be read' })
        return
      }
      const combined = new Uint8Array(bytes)
      let offset = 0
      for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength }
      let body
      try { body = JSON.parse(new TextDecoder().decode(combined)) }
      catch { return send(400, { error: 'Invalid JSON' }) }
      if (!body || Object.keys(body).join() !== 'message' || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 10000) return send(400, { error: 'Invalid message' })
      try {
        send(200, await classify(body.message, env.GROQ_API_KEY, env.GROQ_MODEL || 'openai/gpt-oss-20b'))
      } catch (error) {
        const code = error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : failureCodes.includes(error?.code) ? error.code : 'provider_unavailable'
        logFailure(error, code, logger)
        send(503, { code })
      }
    } finally { active-- }
  }
}

export function localApi(env) {
  return { name: 'local-triage-api', configureServer(server) {
    server.middlewares.use('/api/classify', createClassifyHandler(env))
  } }
}
