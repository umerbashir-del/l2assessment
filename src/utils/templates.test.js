import test from 'node:test'
import assert from 'node:assert/strict'
import { getRecommendedAction, shouldEscalate } from './templates.js'
import { validateResult } from '../../server/classifier.js'
import { categorizeLocally } from './categoryFallback.js'
test('validated AI issues drive actions even with unfamiliar wording', () => {
  const message = 'The checkout spun endlessly and the sign-in screen keeps bouncing me away.'
  const result = validateResult({issues:[{category:'Billing Issue',evidence:'checkout spun endlessly'},{category:'Access Problem',evidence:'sign-in screen keeps bouncing me away'}]}, message)
  const action = getRecommendedAction(result.issues, 'Medium')
  assert.match(action, /billing support/)
  assert.match(action, /alternative way/)
  assert.match(action, /restore.*access/)
  assert.doesNotMatch(action, /check billing portal/)
})
test('local classification uses the same recommendation contract', () => {
  const result = categorizeLocally('My payment failed and I cannot access the portal.')
  assert.equal(result.issues.length, 2)
  assert.match(getRecommendedAction(result.issues,'Medium'), /restore.*access/)
})
test('all issues receive actions without duplicates', () => {
  const action = getRecommendedAction([{category:'Feature Request'},{category:'Access Problem'},{category:'Feature Request'}], 'High')
  assert.match(action,/Escalate immediately/)
  assert.match(action,/product team/)
  assert.equal(action.split('product team').length,2)
})
test('unknown impact requests clarification', () => assert.match(getRecommendedAction([{category:'Billing Issue'}], 'Needs Review'),/confirm the missing impact/))
test('resolved problems do not reappear through a second matcher', () => {
  const result=categorizeLocally('My payment failed but that was resolved. How do I get invoices?')
  assert.doesNotMatch(getRecommendedAction(result.issues,'Low'),/billing support/)
})
test('unknown categories require review', () => assert.match(getRecommendedAction([{category:'invalid'}],'Low'),/human review/))
test('escalation follows classified issues and impact', () => {
  assert.equal(shouldEscalate([{category:'Access Problem'}],'Medium'),true)
  assert.equal(shouldEscalate([{category:'General Inquiry'}],'Low'),false)
})
