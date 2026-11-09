import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createClassifyHandler } from './api.js'
async function request(raw, {method='POST',origin,env={GROQ_API_KEY:'test-secret'},classify=async()=>({source:'ai'})}={}) {
 const req=Readable.from([new TextEncoder().encode(raw)])
 req.method=method; req.headers={host:'127.0.0.1:5175',...(origin?{origin}:{})}
 const logs=[]; const res={headers:{},setHeader(k,v){this.headers[k]=v},end(value){this.body=JSON.parse(value)}}
 await createClassifyHandler(env,classify,{error(...values){logs.push(values)}})(req,res)
 return {res,logs}
}
test('rejects empty and invalid input without calling provider',async()=>{
 for(const raw of ['bad JSON','null','{}','{"message":"   "}',JSON.stringify({message:'a'.repeat(10001)})]) {
  const {res}=await request(raw,{classify:()=>{throw Error('must not call')}});assert.equal(res.statusCode,400)
 }
})
test('request body limit counts UTF-8 bytes',async()=>{
 const {res}=await request(JSON.stringify({message:'界'.repeat(9000)}));assert.equal(res.statusCode,413)
})
test('rejects cross-origin and wrong method',async()=>{
 assert.equal((await request('{}',{origin:'https://untrusted.example'})).res.statusCode,403)
 assert.equal((await request('{}',{method:'GET'})).res.statusCode,405)
})
test('missing configuration is reported and logged',async()=>{
 const {res,logs}=await request('{"message":"hello"}',{env:{}});assert.equal(res.body.code,'missing_configuration');assert.equal(logs.length,1)
})
test('provider errors log diagnosis but never secrets or customer text',async()=>{
 const {res,logs}=await request('{"message":"private customer message"}',{classify:async()=>{throw Object.assign(new Error('test-secret private customer message'),{code:'authentication',status:401,requestId:'req_test'})}})
 assert.deepEqual(res.body,{code:'authentication'});assert.equal(logs[0][1].status,401)
 assert.doesNotMatch(JSON.stringify({res,logs}),/test-secret|private customer message/)
})
test('invalid output logs safe validation diagnosis',async()=>{
 const {logs}=await request('{"message":"hello"}',{classify:async()=>{throw Object.assign(new Error(),{code:'invalid_result',validationReason:'Conflicting categories'})}})
 assert.equal(logs[0][1].validationReason,'Conflicting categories')
})

import { requestClassification } from './classifier.js'
for (const phase of ['fetch','body']) {
 test(`route reports ${phase} timeout accurately`,async()=>{
  const fetcher=async()=>{
   const fail=()=>{throw Object.assign(new Error('SECRET-CUSTOMER-TEXT-123'),{name:'TimeoutError'})}
   if(phase==='fetch')fail()
   return {ok:true,text:async()=>fail()}
  }
  const {res,logs}=await request(JSON.stringify({message:'SECRET-CUSTOMER-TEXT-123'}),{classify:(message,key,model)=>requestClassification(message,key,model,fetcher)})
  assert.equal(res.statusCode,503);assert.equal(res.body.code,'timeout');assert.equal(logs[0][1].code,'timeout')
  assert.doesNotMatch(JSON.stringify({res,logs}),/SECRET-CUSTOMER-TEXT-123|test-secret/)
 })
}
for(const [name,body,reason] of [
 ['invalid envelope','{SECRET-CUSTOMER-TEXT-123','malformed_response_json'],
 ['invalid model JSON',JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{SECRET-CUSTOMER-TEXT-123'}}]}),'malformed_model_json'],
 ['truncated response',JSON.stringify({choices:[{finish_reason:'length',message:{content:'{SECRET-CUSTOMER-TEXT-123'}}]}),'truncated_response'],
]) {
 test(`route safely reports ${name}`,async()=>{
  const fetcher=async()=>({ok:true,text:async()=>body})
  const {res,logs}=await request(JSON.stringify({message:'SECRET-CUSTOMER-TEXT-123'}),{classify:(message,key,model)=>requestClassification(message,key,model,fetcher)})
  assert.equal(res.body.code,'invalid_result');assert.equal(logs[0][1].validationReason,reason)
  if(reason==='truncated_response')assert.equal(logs[0][1].finishReason,'length')
  assert.doesNotMatch(JSON.stringify({res,logs}),/SECRET-CUSTOMER-TEXT-123|test-secret/)
 })
}
test('route preserves network failure classification',async()=>{
 const {res,logs}=await request('{"message":"hello"}',{classify:async()=>{throw Object.assign(new Error(),{code:'network'})}})
 assert.equal(res.body.code,'network');assert.equal(logs[0][1].code,'network')
})

