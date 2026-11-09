import process from 'node:process'
import { loadEnv } from 'vite'
const env = loadEnv('development', process.cwd(), 'GROQ_')
const response = await fetch('https://api.groq.com/openai/v1/models', {headers:{Authorization:`Bearer ${env.GROQ_API_KEY}`},signal:AbortSignal.timeout(15000)})
if (!response.ok) throw new Error(`Model lookup returned HTTP ${response.status}`)
const data=await response.json()
console.log('Configured model listed for account:', data.data.some(model=>model.id===(env.GROQ_MODEL || 'openai/gpt-oss-20b')))

