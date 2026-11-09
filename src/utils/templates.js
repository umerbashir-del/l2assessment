/** Recommendations use classified issues; they never reinterpret the message. */
const actionTemplates = {
  'Access Problem': 'Have support investigate and restore account or portal access. Contact the customer through an accessible channel.',
  'Billing Issue': 'Have billing support investigate the reported payment or billing problem and offer an alternative way to resolve it if the usual route is unavailable.',
  'Technical Problem': 'Investigate the reported failure and gather diagnostic details.',
  'General Inquiry': 'Answer the specific question or share a relevant help article.',
  'Feature Request': 'Acknowledge the suggestion and record it for the product team.',
  'Needs Review': 'Send this message for human review.',
}
function issueCategories(issues) {
  return [...new Set((Array.isArray(issues) ? issues : [issues]).map(issue => typeof issue === 'string' ? issue : issue?.category))]
}
export function getRecommendedAction(issues, urgency) {
  const actions = []
  if (urgency === 'High') actions.push('Escalate immediately to support to address the reported high impact.')
  if (urgency === 'Needs Review') actions.push('Have support confirm the missing impact details before assigning priority.')
  for (const category of issueCategories(issues)) actions.push(actionTemplates[category] || actionTemplates['Needs Review'])
  return [...new Set(actions)].join(' ')
}
export function getAvailableCategories() { return Object.keys(actionTemplates) }
export function shouldEscalate(issues, urgency) {
  return urgency === 'High' || urgency === 'Needs Review' || issueCategories(issues).includes('Access Problem')
}
