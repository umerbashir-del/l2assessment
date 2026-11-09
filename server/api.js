import { requestClassification } from './classifier.js'
export function localApi(env) {
  return { name: 'local-triage-api', configureServer(server) {
    server.middlewares.use('/api/classify', async (req, res) => {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      const send = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)) }
      if (req.method !== 'POST') return send(405, { error: 'POST required' })
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(403, { error: 'Origin rejected' })
      try {
        let body = ''
        for await (const chunk of req) { body += chunk; if (body.length > 24000) return send(413, { error: 'Message too large' }) }
        const { message } = JSON.parse(body)
        if (typeof message !== 'string' || !message.trim() || message.length > 10000) return send(400, { error: 'Invalid message' })
        if (!env.GROQ_API_KEY) return send(503, { code: 'missing_configuration' })
        send(200, await requestClassification(message, env.GROQ_API_KEY, env.GROQ_MODEL || 'openai/gpt-oss-20b'))
      } catch (error) {
        const code = error.name === 'TimeoutError' || error.name === 'AbortError' ? 'timeout' : ['authentication', 'model_unavailable', 'rate_limit', 'provider_unavailable', 'invalid_result'].includes(error.code) ? error.code : 'provider_unavailable'
        send(503, { code })
      }
    })
  } }
}

