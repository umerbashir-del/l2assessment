import test from 'node:test'
import assert from 'node:assert/strict'
import { categorizeLocally, getCategories } from './categoryFallback.js'
for (const message of ['My payment failed and I cannot access the portal.', 'I cannot access the portal and my payment failed.']) {
  test(message, () => assert.deepEqual(categorizeLocally(message).categories, ['Billing Issue', 'Access Problem']))
}
test('three distinct issues are collected', () => assert.deepEqual(categorizeLocally('My payment failed. I cannot access the portal. Please add dark mode.').categories, ['Billing Issue', 'Access Problem', 'Feature Request']))
test('routine payment question is not a billing failure', () => assert.deepEqual(categorizeLocally('How do I update my payment method?').categories, ['General Inquiry']))
test('denied and resolved problems do not trigger categories', () => {
  assert.equal(categorizeLocally('The server is not down.').categories.includes('Technical Problem'), false)
  assert.equal(categorizeLocally('My payment failed but that was resolved.').categories.includes('Billing Issue'), false)
  assert.equal(categorizeLocally('I can access the portal.').categories.includes('Access Problem'), false)
})
test('old single-category records remain readable', () => assert.deepEqual(getCategories({ category: 'Billing Issue' }), ['Billing Issue']))


test('resolved billing cannot hide active access in the same sentence', () => {
 assert.deepEqual(categorizeLocally('The payment problem is resolved and I cannot access the portal.').categories, ['Access Problem'])
 assert.deepEqual(categorizeLocally('I cannot access the portal and the payment problem is resolved.').categories, ['Access Problem'])
})
test('active billing remains when access was restored', () => assert.deepEqual(categorizeLocally('Portal access was restored but my payment failed.').categories,['Billing Issue']))
test('negated resolution remains an active problem', () => assert.ok(categorizeLocally('My payment failed and is not resolved.').categories.includes('Billing Issue')))
test('uncertain outage requires review rather than a confirmed incident', () => assert.deepEqual(categorizeLocally('Maybe the server is down.').categories,['Needs Review']))
test('active and uncertain issues both survive', () => assert.deepEqual(categorizeLocally('My payment failed and maybe the server is down.').categories,['Billing Issue','Needs Review']))

const wordingCases = [
 ['Payment is not working.', ['Billing Issue']],
 ['My card keeps getting declined.', ['Billing Issue']],
 ['The payment won’t go through.', ['Billing Issue']],
 ['The payment will not go through.', ['Billing Issue']],
 ['You charged me twice.', ['Billing Issue']],
 ['The login page keeps sending me back.', ['Access Problem']],
 ['It won’t let me into my account.', ['Access Problem']],
 ['I cannot access the portal and payment is not working.', ['Billing Issue', 'Access Problem']],
 ['Payment is not working and I cannot access the portal.', ['Billing Issue', 'Access Problem']],
 ['Payment works now, but I’m still locked out.', ['Access Problem']],
 ['My payment did not fail.', ['Needs Review']],
 ['My payment didn’t fail.', ['Needs Review']],
 ['My card is not getting declined.', ['Needs Review']],
 ['How do I make a payment?', ['General Inquiry']],
 ['I think my payment might have failed.', ['Needs Review']],
 ['My payment might have failed and I cannot access the portal.', ['Access Problem', 'Needs Review']],
 ['My payment did not fail and I cannot access the portal.', ['Access Problem']],
 ['I cannot access the portal and my payment did not fail.', ['Access Problem']],
 ['My payment failed but it is resolved and the server is down.', ['Technical Problem']],
 ['My payment failed and is not yet resolved.', ['Billing Issue']],
]
for (const [message, expected] of wordingCases) {
 test(`wording regression: ${message}`, () => {
  const result = categorizeLocally(message)
  assert.deepEqual(result.categories, expected)
  assert.deepEqual(result.issues.map(issue => issue.category), expected)
  assert.equal(result.source, 'local')
 })
}

for(const [message,expected] of [
 ["My payment failed but it's working again.", ['Needs Review']],
 ["I can't log in. It's fixed now.", ['Needs Review']],
 ["I can't log in", ['Access Problem']],
 ['The app no longer loads.', ['Technical Problem']],
 ['Payment works now, but I am still locked out.', ['Access Problem']],
 ['My payment failed. Portal access is restored.', ['Billing Issue']],
]) {
 test(`fallback sentence context: ${message}`,()=>assert.deepEqual(categorizeLocally(message).categories,expected))
}
