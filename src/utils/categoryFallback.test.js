import test from 'node:test'
import assert from 'node:assert/strict'
import { categorizeLocally } from './categoryFallback.js'
import seedRules from '../data/categoryRules.json' with { type: 'json' }

const examples = [
  ['My payment failed.', 'Billing Issue'],
  ['I was charged twice for this month.', 'Billing Issue'],
  ['My card was declined.', 'Billing Issue'],
  ["The payment didn't go through.", 'Billing Issue'],
  ['The server is down now.', 'Technical Problem'],
  ['Database connection lost.', 'Technical Problem'],
  ["I can't access my account.", 'Technical Problem'],
  ["The Atlas workspace won't load.", 'Technical Problem'],
  ["The Atlas workspace doesn't load.", 'Technical Problem'],
  ['Could you please add dark mode?', 'Feature Request'],
  ['How do I update my payment method?', 'General Inquiry'],
  ['Where can I find my invoices?', 'General Inquiry'],
  ['What are your business hours?', 'General Inquiry'],
  ["My payment failed and now I can't access the dashboard.", 'Needs Review'],
  ['The server is down and my payment failed.', 'Needs Review'],
  ['AAA history check.', 'Needs Review'],
  ['No server is down.', 'Needs Review'],
  ['No outage is happening.', 'Needs Review'],
  ['The outage has been resolved.', 'Needs Review'],
  ['The outage is not resolved.', 'Technical Problem'],
  ['The server is no longer down.', 'Needs Review'],
  ['Is the server down?', 'Needs Review'],
  ['No outage, but my payment failed.', 'Billing Issue'],
]

for (const [message, expected] of examples) {
  test(`${JSON.stringify(message)} -> ${expected}`, () => {
    const first = categorizeLocally(message)
    assert.equal(first.category, expected)
    assert.equal(first.source, 'local')
    assert.equal(typeof first.reasoning, 'string')
    assert.deepEqual(categorizeLocally(message), first)
  })
}

test('company phrases can change through data without changing the classifier', () => {
  const custom = structuredClone(seedRules)
  custom.categories[0].phrases.push('payment bounced')
  custom.subjectStateGroups[0].subjects.push('Orion dashboard')
  custom.subjectStateGroups[0].states.push('is frozen')

  assert.equal(categorizeLocally('My payment bounced.').category, 'Needs Review')
  assert.equal(categorizeLocally('My payment bounced.', custom).category, 'Billing Issue')
  assert.equal(categorizeLocally('The Orion dashboard is frozen.').category, 'Needs Review')
  assert.equal(categorizeLocally('The Orion dashboard is frozen.', custom).category, 'Technical Problem')
})
