/** Urgency uses explicitly reported impact, independent of message wording or time. */
export const impactQuestions = [
  ['essentialService', 'Is an essential service unavailable?'],
  ['manyCustomers', 'Are many customers affected?'],
  ['financialLoss', 'Is there immediate financial loss?'],
  ['criticalDeadline', 'Is a critical deadline at risk?'],
  ['brokenFunction', 'Is a function currently broken?'],
]

export function assessUrgency(impact = {}, issues = []) {
  const failures = issues.filter(issue =>
    ['Access Problem', 'Technical Problem'].includes(issue.category) ||
    (issue.category === 'Billing Issue' && /\b(?:failed|failing|declined|not working|won't go through|will not go through|didn't go through|stuck|loading forever)\b/i.test(issue.evidence || ''))
  )
  const conflict = impact.brokenFunction === 'no' && failures.length > 0
  const clarification = conflict
    ? `Detected ${[...new Set(failures.map(issue => issue.category))].join(' and ')}, but you answered that no function is broken. Is the reported problem currently active? Confirm whether a function is broken, or clarify the message if the problem is resolved or denied.`
    : ''
  const highReasons = impactQuestions.slice(0, 4)
    .filter(([key]) => impact[key] === 'yes').map(([, question]) => question)
  if (highReasons.length) return { urgency: 'High', clarification, explanation: 'High impact reported: ' + highReasons.join(' ') + (conflict ? ' Impact answers also need clarification.' : '') }
  if (conflict) return { urgency: 'Needs Review', clarification, explanation: 'The detected problem conflicts with your impact answers. Clarify the conflict before assigning priority.' }
  if (impactQuestions.some(([key]) => !['yes', 'no'].includes(impact[key]))) {
    return { urgency: 'Needs Review', explanation: 'Impact is unknown. Confirm the unanswered impact questions before assigning urgency.' }
  }
  if (impact.brokenFunction === 'yes') return { urgency: 'Medium', explanation: 'A function is broken, with no high impact conditions reported.' }
  return { urgency: 'Low', explanation: 'No active functional failure or high impact conditions reported.' }
}

export function calculateUrgency(impact = {}, issues = []) {
  return assessUrgency(impact, issues).urgency
}

