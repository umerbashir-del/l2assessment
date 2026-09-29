import Groq from 'groq-sdk'
import { categorizeLocally } from './categoryFallback'

/** Categorize with Groq when configured, otherwise use transparent local rules. */
export async function categorizeMessage(message) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) return categorizeLocally(message)

  try {
    const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true })
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: `Categorize this customer support message: ${message}` }],
      temperature: 0.7,
    })

    const content = response.choices[0].message.content
    const lower = content.toLowerCase()
    let category = 'Unknown'
    if (lower.includes('billing')) category = 'Billing Issue'
    else if (lower.includes('technical') || lower.includes('bug')) category = 'Technical Problem'
    else if (lower.includes('feature')) category = 'Feature Request'
    else if (lower.includes('inquiry') || lower.includes('question')) category = 'General Inquiry'

    return { category, reasoning: content, source: 'ai' }
  } catch (error) {
    console.warn('Groq API failed; using local categorization:', error.message)
    return categorizeLocally(message)
  }
}
