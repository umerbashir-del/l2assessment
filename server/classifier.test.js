import test from 'node:test'
import assert from 'node:assert/strict'
import { validateResult } from './classifier.js'
test('accepts grounded multiple issues', () => assert.equal(validateResult({ issues: [{category:'Billing Issue',evidence:'payment failed'},{category:'Access Problem',evidence:'cannot access'}] }, 'My payment failed and I cannot access the portal.').source, 'ai'))
for (const [name, value] of Object.entries({ unknown: {issues:[{category:'Made up',evidence:'hello'}]}, duplicate: {issues:[{category:'General Inquiry',evidence:'hello'},{category:'General Inquiry',evidence:'hello'}]}, invented: {issues:[{category:'Billing Issue',evidence:'payment failed'}]}, empty: {issues:[]}, extra: {issues:[{category:'General Inquiry',evidence:'hello'}], urgency:'High'} })) {
  test(`rejects ${name}`, () => assert.throws(() => validateResult(value, 'hello')))
}
