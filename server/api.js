import { requestClassification } from './classifier.js'

export function logFailure(error, code, logger = console) {
  // Log diagnosis, never the request text, credentials, response body, or stack.
  logger.error('AI classification fallback', {
    code,
    finishReason: ['length', 'stop', 'content_filter'].includes(error?.finishReason) ? error.finishReason : undefined,
    status: Number.isInteger(error?.status) ? error.status : undefined,
    requestId: typeof error?.requestId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(error.requestId) ? error.requestId : undefined,
    validationReason: ['Invalid issues', 'Invalid category or ungrounded evidence', 'Conflicting categories', 'Incomplete or refused result', 'malformed_response_json', 'malformed_model_json', 'truncated_response', 'incomplete_or_refused_response', 'invalid_issues', 'invalid_category_or_evidence', 'conflicting_categories', 'invalid_schema'].includes(error?.validationReason) ? error.validationReason : undefined,
  })
}

export function createClassifyHandler(env, classify = requestClassification, logger = console) {
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    const send = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)) }
    if (req.method !== 'POST') return send(405, { error: 'POST required' })
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(403, { error: 'Origin rejected' })
    try {
      let bytes = 0
      const chunks = []
      for await (const chunk of req) {
        const data = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk
        bytes += data.byteLength
        if (bytes > 24000) return send(413, { error: 'Message too large' })
        chunks.push(data)
      }
      const combined = new Uint8Array(bytes)
      let offset = 0
      for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength }
      let body
      try { body = JSON.parse(new TextDecoder().decode(combined)) }
      catch { return send(400, { error: 'Invalid JSON' }) }
      if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 10000) return send(400, { error: 'Invalid message' })
      if (!env.GROQ_API_KEY) {
        logFailure(null, 'missing_configuration', logger)
        return send(503, { code: 'missing_configuration' })
      }
      send(200, await classify(body.message, env.GROQ_API_KEY, env.GROQ_MODEL || 'openai/gpt-oss-20b'))
    } catch (error) {
      const code = error.name === 'TimeoutError' || error.name === 'AbortError' ? 'timeout' : ['authentication', 'model_unavailable', 'rate_limit', 'provider_unavailable', 'invalid_result', 'network', 'timeout'].includes(error.code) ? error.code : 'provider_unavailable'
      logFailure(error, code, logger)
      send(503, { code })
    }
  }
}

export function localApi(env) {
  return { name: 'local-triage-api', configureServer(server) {
    server.middlewares.use('/api/classify', createClassifyHandler(env))
  } }
}

