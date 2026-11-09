import test from 'node:test'
import assert from 'node:assert/strict'
import { assessUrgency, impactQuestions } from './urgencyScorer.js'
const noImpact = Object.fromEntries(impactQuestions.map(([key]) => [key, 'no']))
for (const [key] of impactQuestions.slice(0, 4)) {
  test(`${key} alone triggers High even with other unknown answers`, () => {
    assert.equal(assessUrgency({ [key]: 'yes' }).urgency, 'High')
  })
}
test('unknown impact requires review', () => assert.equal(assessUrgency().urgency, 'Needs Review'))
test('confirmed limited failure is Medium', () => assert.equal(assessUrgency({ ...noImpact, brokenFunction: 'yes' }).urgency, 'Medium'))
test('all impact denied is Low', () => assert.equal(assessUrgency(noImpact).urgency, 'Low'))

for (const category of ['Access Problem', 'Technical Problem', 'Billing Issue']) {
 test(`${category} conflicts with denying a broken function`, () => {
  const result=assessUrgency(noImpact,[{category,evidence:'payment failed'}])
  assert.equal(result.urgency,'Needs Review')
  assert.match(result.clarification,/Is the reported problem currently active/)
 })
}
test('confirming the failure resolves conflict',()=>{
 const result=assessUrgency({...noImpact,brokenFunction:'yes'},[{category:'Access Problem'}])
 assert.equal(result.urgency,'Medium'); assert.equal(result.clarification,undefined)
})
test('routine questions and feature requests do not cause conflicts',()=>{
 assert.equal(assessUrgency(noImpact,[{category:'General Inquiry'},{category:'Feature Request'}]).urgency,'Low')
})
test('duplicate charge does not necessarily mean broken functionality',()=>assert.equal(assessUrgency(noImpact,[{category:'Billing Issue',evidence:'charged me twice'}]).urgency,'Low'))
test('explicit high impact retains escalation while asking for clarification',()=>{
 const result=assessUrgency({...noImpact,essentialService:'yes'},[{category:'Access Problem'}])
 assert.equal(result.urgency,'High'); assert.ok(result.clarification)
})
