import test from 'node:test'
import assert from 'node:assert/strict'
import { getRecommendedAction, shouldEscalate } from './templates.js'

test('account access problem does not send the customer to a portal', () => {
  const message = "My payment failed and I can't access my account."
  const action = getRecommendedAction('Billing Issue', 'High', message)
  assert.match(action, /escalate.*account access/i)
  assert.match(action, /without asking.*portal/i)
  assert.equal(shouldEscalate('Billing Issue', 'High', message), true)
})

test('critical technical problem reaches incident response', () => {
  const action = getRecommendedAction('Technical Problem', 'High', 'Server down now')
  assert.match(action, /incident response/i)
  assert.equal(shouldEscalate('Technical Problem', 'High', 'Server down now'), true)
})

test('unknown high urgency message still reaches a person', () => {
  assert.match(getRecommendedAction('General Inquiry', 'High', 'Database connection lost'), /human review/i)
})

test('routine requests receive category-specific actions', () => {
  assert.match(getRecommendedAction('Feature Request', 'Low'), /product team/i)
  assert.match(getRecommendedAction('General Inquiry', 'Low'), /answer the question/i)
  assert.match(getRecommendedAction('Billing Issue', 'Medium'), /billing support/i)
  assert.equal(shouldEscalate('General Inquiry', 'Low', 'A long routine message '.repeat(20)), false)
})

test('uncertain categories stay in human review even with an access issue', () => {
  assert.match(getRecommendedAction('Needs Review', 'High', "My payment failed and I can't access the dashboard"), /immediate human review/i)
  assert.match(getRecommendedAction('Needs Review', 'Medium', 'Unclear message'), /manual review/i)
})
