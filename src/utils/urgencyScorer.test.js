import test from 'node:test'
import assert from 'node:assert/strict'
import rules from '../data/urgencyRules.json' with { type: 'json' }
import { assessUrgency, calculateUrgency } from './urgencyScorer.js'

const cases = [
  ['Server down now', 'High'],
  ['Database connection lost', 'High'],
  ['SERVER DOWN NOW', 'High'],
  ['Database is offline', 'High'],
  ['Prod is unavailable', 'High'],
  ["My payment failed and now I can't access the dashboard.", 'High'],
  ['The dashboard is loading very slowly.', 'Medium'],
  ['I was charged twice for my subscription.', 'Medium'],
  ['Could you add an export to CSV feature?', 'Low'],
  ['Hi! I love the new design! Everything looks great!', 'Low'],
  ["Hi! I was just browsing through your website and noticed you have a really nice design! I especially like the color scheme and the way you've organized the navigation menu! Everything looks so professional and clean! Just wanted to share my positive feedback!", 'Low'],
  ['I love the app, but it keeps crashing.', 'Medium'],
  ['What are your business hours?', 'Low'],
  ['hi', 'Low'],
  ['Please help with this request.', 'Medium'],
]

for (const [message, expected] of cases) {
  test(`urgency for ${JSON.stringify(message)}`, () => {
    assert.equal(calculateUrgency(message), expected)
  })
}

const contextCases = [
  ['No outage is happening.', 'Low', 'negated'],
  ['The outage has been resolved.', 'Low', 'resolved'],
  ['Is there an outage?', 'Medium', 'uncertain'],
  ['Maybe the server is down.', 'Medium', 'uncertain'],
  ['The outage is not resolved.', 'High', 'active'],
  ['No outage, but payments are failing.', 'Medium', 'negated'],
  ['No outage, but the server is down.', 'High', 'negated'],
  ['I have no access to my account.', 'High', 'active'],
  ['No outage and no access to the dashboard.', 'High', 'negated'],
  ['No outage, server down now.', 'High', 'negated'],
  ['I have not received my refund.', 'Medium', 'active'],
  ['The outage, now resolved, is over.', 'Low', 'resolved'],
  ['The server is not down.', 'Low', null],
  ['There is no problem with the app.', 'Low', 'negated']
]

for (const [message, expectedLevel, expectedStatus] of contextCases) {
  test(`context for ${JSON.stringify(message)}`, () => {
    const result = assessUrgency(message)
    assert.equal(result.level, expectedLevel)
    if (expectedStatus) assert.ok(result.evidence.some(item => item.status === expectedStatus))
  })
}

test('score starts at zero and repeated mentions of one signal score once', () => {
  assert.deepEqual(assessUrgency(''), { level: 'Low', score: 0, evidence: [] })
  assert.equal(assessUrgency('Please help with this request.').score, 0)
  assert.equal(assessUrgency('Error, error, error.').score, 1)
})

test('company phrases can change through data without changing the scoring logic', () => {
  const companyRules = {
    ...rules,
    signals: [...rules.signals, { id: 'widget_pipeline', points: 3, phrases: ['widget pipeline stopped'] }]
  }
  assert.equal(calculateUrgency('Our widget pipeline stopped.', companyRules), 'High')
  assert.equal(calculateUrgency('Our widget pipeline stopped.', rules), 'Medium')
})
