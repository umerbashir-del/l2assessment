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

const aiIssue = (category,evidence) => ({issues:[{category,evidence}]})
test('normalizes curly apostrophes and whitespace for grounded evidence',()=>{
 assert.equal(validateResult(aiIssue('Access Problem', 'I can’t log in'), "I can't\nlog   in").category,'Access Problem')
})
for(const evidence of ['a','it','x'.repeat(301)]) {
 test(`rejects evidence length ${evidence.length}`,()=>assert.throws(()=>validateResult(aiIssue('General Inquiry',evidence),evidence),{validationReason:'ungrounded_evidence'}))
}
for(const [message,category,evidence] of [
 ['I have no billing issue.','Billing Issue','billing issue'],
 ['The server is not down.','Technical Problem','server'],
 ['My payment failed but it is resolved.','Billing Issue','payment failed'],
 ['Portal access is restored.','Access Problem','Portal access'],
 ['Maybe payment failed.','Billing Issue','payment failed'],
]) {
 test(`rejects inactive or uncertain AI claim: ${message}`,()=>assert.throws(()=>validateResult(aiIssue(category,evidence),message),{validationReason:'inactive_or_uncertain_evidence'}))
}
for(const [message,category] of [["I can't log in",'Access Problem'],['Payment is not working','Billing Issue'],['Access is not restored','Access Problem']]) {
 test(`preserves active negative wording: ${message}`,()=>assert.equal(validateResult(aiIssue(category,message),message).category,category))
}
test('a denied issue cannot hide an independently active issue',()=>{
 assert.equal(validateResult(aiIssue('Access Problem','cannot access'), 'I have no billing issue and I cannot access the portal.').category,'Access Problem')
})
test('category ordering is deterministic',()=>{
 const issues=[{category:'Billing Issue',evidence:'payment failed'},{category:'Access Problem',evidence:'cannot access'}]
 const message='My payment failed and I cannot access the portal.'
 assert.deepEqual(validateResult({issues},message),validateResult({issues:[...issues].reverse()},message))
})
test('duplicates report a distinct fixed reason',()=>assert.throws(()=>validateResult({issues:[{category:'General Inquiry',evidence:'hello'},{category:'General Inquiry',evidence:'hello'}]},'hello'),{validationReason:'duplicate_category'}))
for(const [status,code] of [[400,'bad_request'],[422,'bad_request'],[413,'payload_too_large'],[500,'provider_unavailable']]) {
 test(`provider status ${status} maps to ${code} and cancels body`,async()=>{
  let cancelled=false
  await assert.rejects(()=>requestClassification('hello','key','model',async()=>({ok:false,status,headers:new Headers(),body:{cancel:async()=>{cancelled=true}}})),{code})
  assert.equal(cancelled,true)
 })
}
test('missing classifier key never sends a request',async()=>{
 await assert.rejects(()=>requestClassification('hello',undefined,'model',async()=>{assert.fail('Must not fetch')}),{code:'missing_configuration'})
})
test('large streamed response is cancelled before buffering everything',async()=>{
 let cancelled=false
 const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(65537))},cancel(){cancelled=true}})
 await assert.rejects(()=>requestClassification('hello','key','model',async()=>({ok:true,body})),{validationReason:'response_too_large'})
 assert.equal(cancelled,true)
})
test('content filter finish reason is preserved',async()=>{
 await assert.rejects(()=>requestClassification('hello','key','model',reply({choices:[{finish_reason:'content_filter',message:{content:''}}]})),{validationReason:'incomplete_or_refused_response',finishReason:'content_filter'})
})
