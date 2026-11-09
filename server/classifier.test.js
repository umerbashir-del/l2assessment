import test from 'node:test'
import assert from 'node:assert/strict'
import { validateResult } from './classifier.js'
test('accepts grounded multiple issues', () => assert.equal(validateResult({ issues: [{category:'Billing Issue',evidence:'payment failed'},{category:'Access Problem',evidence:'cannot access'}] }, 'My payment failed and I cannot access the portal.').source, 'ai'))
for (const [name, value] of Object.entries({ unknown: {issues:[{category:'Made up',evidence:'hello'}]}, duplicate: {issues:[{category:'General Inquiry',evidence:'hello'},{category:'General Inquiry',evidence:'hello'}]}, invented: {issues:[{category:'Billing Issue',evidence:'payment failed'}]}, empty: {issues:[]}, extra: {issues:[{category:'General Inquiry',evidence:'hello'}], urgency:'High'} })) {
  test(`rejects ${name}`, () => assert.throws(() => validateResult(value, 'hello')))
}

import { requestClassification } from './classifier.js'
const validResponse = {choices:[{finish_reason:'stop',message:{content:JSON.stringify({issues:[{category:'General Inquiry',evidence:'hello'}]})}}]}
const transportFailure = name => Object.assign(new Error('private customer text'),{name})
const reply = body => async()=>({ok:true,text:async()=>JSON.stringify(body)})
const failureCases = [
 ['fetch timeout', async()=>{throw transportFailure('TimeoutError')}, 'timeout'],
 ['body timeout', async()=>({ok:true,text:async()=>{throw transportFailure('TimeoutError')}}), 'timeout'],
 ['body abort', async()=>({ok:true,text:async()=>{throw transportFailure('AbortError')}}), 'timeout'],
 ['fetch disconnect', async()=>{throw transportFailure('TypeError')}, 'network'],
 ['body disconnect', async()=>({ok:true,text:async()=>{throw transportFailure('TypeError')}}), 'network'],
 ['malformed envelope', async()=>({ok:true,text:async()=>'{private customer text'}), 'invalid_result','malformed_response_json'],
 ['malformed model JSON', reply({choices:[{finish_reason:'stop',message:{content:'{private customer text'}}]}), 'invalid_result','malformed_model_json'],
 ['truncated model response', reply({choices:[{finish_reason:'length',message:{content:'{private customer text'}}]}), 'invalid_result','truncated_response'],
]
for(const [name,fetcher,code,reason] of failureCases) {
 test(`classification failure: ${name}`,async()=>{
  await assert.rejects(()=>requestClassification('hello','test-key','test-model',fetcher),error=>{
   assert.equal(error.code,code); assert.equal(error.validationReason,reason)
   if(reason==='truncated_response')assert.equal(error.finishReason,'length')
   assert.doesNotMatch(JSON.stringify(error),/private customer text|test-key/)
   return true
  })
 })
}
test('complete valid response still succeeds',async()=>assert.equal((await requestClassification('hello','test-key','test-model',reply(validResponse))).source,'ai'))
