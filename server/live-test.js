import process from 'node:process'
import { loadEnv } from 'vite'
import { requestClassification } from './classifier.js'
const env = loadEnv('development', process.cwd(), 'GROQ_')
for (const message of ['My payment failed and I cannot access the billing portal.', 'How do I update my payment method?', 'The server is not down. Please add dark mode.']) {
  try { console.log(JSON.stringify({ message, result: await requestClassification(message, env.GROQ_API_KEY) })) }
  catch (error) { console.log(JSON.stringify({ message, error: error.message })); process.exitCode = 1 }
}

