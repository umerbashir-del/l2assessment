/**
 * Recommendation Templates - Maps categories to recommended actions
 */

const actionTemplates = {
  "Billing Issue": "Have billing support review the payment and account status, then contact the customer directly.",
  "Technical Problem": "Investigate the reported problem and gather diagnostic details.",
  "General Inquiry": "Answer the question directly or share a relevant help article.",
  "Feature Request": "Acknowledge the suggestion and record it for the product team.",
  "Unknown": "Send this message for manual review.",
  "Needs Review": "Send this message for manual review before routing it to a team."
}

const accessIssuePattern = /\b(?:can't|cannot|unable to)\s+(?:access|log\s?in(?:to)?)\b|\blocked out\b/i

/**
 * Get recommended action for a given category
 * 
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @param {string} message - The original customer message
 * @returns {string} - Recommended next step
 */
export function getRecommendedAction(category, urgency, message = '') {
  if (category === 'Needs Review') {
    return urgency === 'High'
      ? 'Send for immediate human review before routing. Check every reported issue.'
      : 'Send for manual review before routing. Check every reported issue.'
  }

  if (accessIssuePattern.test(message)) {
    return "Escalate the account access problem to support. Verify payment and access status without asking the customer to use a portal they cannot reach."
  }

  if (urgency === 'High') {
    return category === 'Technical Problem'
      ? 'Escalate immediately to the incident response team and investigate service availability.'
      : 'Escalate immediately for human review and investigate the reported issue.'
  }

  return actionTemplates[category] || "No recommendation available."
}

/**
 * Get all available categories
 * 
 * @returns {string[]} - List of categories
 */
export function getAvailableCategories() {
  return Object.keys(actionTemplates)
}

/**
 * Determines if message should be escalated
 * 
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @param {string} message - The original message
 * @returns {boolean} - Whether to escalate
 */
export function shouldEscalate(category, urgency, message) {
  return urgency === 'High' || accessIssuePattern.test(message)
}
