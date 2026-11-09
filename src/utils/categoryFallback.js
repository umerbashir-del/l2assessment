export function getCategories(item) {
  return [...new Set(item.categories?.length ? item.categories : [item.category || 'Needs Review'])]
}

export function categorizeLocally(message) {
  const categories = []
  const evidence = []
  const issues = []
  // Keep anaphoric resolutions attached to the preceding report, but separate
  // independent issues so one issue's resolution cannot hide another issue.
  const clauses = message.toLowerCase().replace(/’/g, "'")
    .replace(/\b(?:but|and)\s+(?:that|it|this)\s+(?:is|was|has been)\s+/g, ' which is ')
    .split(/[.!?;\n]|\b(?:and|but|however|while|although)\b/)
  const uncertain = clause => /\b(?:maybe|might|possibly|perhaps|not sure|i think|is there|could there)\b/.test(clause)
  const inactive = clause => {
    const withoutUnresolved = clause.replace(/\b(?:not|never)\s+(?:yet\s+)?(?:resolved|fixed|restored)\b/g, '')
        return /\b(?:resolved|fixed|restored|working again|works now|working now|no longer|not failed|not down|never failed|not locked out|not unable to)\b/.test(withoutUnresolved) ||
      /\b(?:did not|didn't|does not|doesn't|never)\s+(?:fail|decline|charge)\b|\b(?:not|never)\s+(?:being\s+|getting\s+)?(?:declined|charged|failing)\b/.test(withoutUnresolved)
  }
  let requiresReview = false
  const rules = [
    ['Billing Issue', /\b(?:payment|card|billing|charge|charged|refund)\b.{0,45}\b(?:failed|failing|declined|twice|duplicate|error|stuck|not working|won't go through|will not go through|doesn't work|does not work)\b|\b(?:charged (?:me )?twice|double charged|payment didn't go through)\b/],
    ['Access Problem', /\b(?:cannot|can't|unable to)\s+(?:access|open|reach|log\s?in(?:to)?)\b|\b(?:locked out|no access)\b|\b(?:login|sign-in) page\b.{0,30}\b(?:sending me back|bouncing me back)\b|\b(?:won't|will not|doesn't|does not) let me (?:in|into|access)\b/],
    ['Technical Problem', /\b(?:server|database|website|dashboard|page|app)\b.{0,35}\b(?:down|unavailable|broken|crashing|not working|loading forever|won't load|doesn't load)\b|\b(?:error message|connection lost)\b/],
    ['Feature Request', /\b(?:please add|could you add|would like to see|feature request|i wish|add dark mode)\b/],
  ]
  for (const [category, pattern] of rules) {
    const candidates = clauses.filter(c => !inactive(c) && pattern.test(c))
    if (candidates.some(uncertain)) requiresReview = true
    const match = candidates.filter(c => !uncertain(c)).map(c => c.match(pattern)?.[0]).find(Boolean)
    if (match) { categories.push(category); issues.push({ category, evidence: match }); evidence.push(`${category}: “${match}”`) }
  }
  if (requiresReview) { categories.push('Needs Review'); evidence.push('An uncertain issue needs human review.') }
  if (!categories.length) categories.push(/\?|\b(?:how|what|where|when|thank|thanks)\b/i.test(message) ? 'General Inquiry' : 'Needs Review')
  if (requiresReview) issues.push({ category: 'Needs Review', evidence: 'Uncertain report' })
  if (!issues.length) issues.push({ category: categories[0], evidence: message })
  return { issues, categories, category: categories[0], source: 'local', reasoning: evidence.length ? evidence.join('\n\n') : 'No active issue matched. ' + (categories[0] === 'Needs Review' ? 'Human review is needed.' : 'This appears to be an information request or acknowledgment.') }
}




