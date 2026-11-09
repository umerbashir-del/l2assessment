export const fallbackReasons = {
 missing_configuration: 'AI is not configured on the local backend.',
 network: 'The local backend could not complete its connection to Groq.',
 timeout: 'The AI request timed out.',
 invalid_result: 'The AI response failed validation or was incomplete.',
 authentication: 'Groq rejected the API credentials.',
 model_unavailable: 'The configured AI model is unavailable to this account.',
 rate_limit: 'Groq is temporarily limiting requests. Try again later.',
 provider_unavailable: 'Groq is temporarily unavailable.',
 backend_unavailable: 'The local AI backend could not be reached.',
 request_rejected: 'The AI backend rejected this request.',
}
export function fallbackDescription(code) { return fallbackReasons[code] || 'AI could not be used for this analysis.' }

