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
 const {logs}=await request('{"message":"hello"}',{classify:async()=>{throw Object.assign(new Error(),{code:'invalid_result',validationReason:'conflicting_categories'})}})
 assert.equal(logs[0][1].validationReason,'conflicting_categories')
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



function testRequest(handler, {host='127.0.0.1:5175',origin,raw='{"message":"hello"}',chunks,headers={}}={}) {
 const req=chunks || Readable.from([new TextEncoder().encode(raw)])
 req.method='POST';req.headers={host,...headers,...(origin?{origin}:{})}
 const res={headers:{},setHeader(k,v){this.headers[k]=v},end(value){this.body=JSON.parse(value)}}
 return handler(req,res).then(()=>({req,res}))
}
test('matching malicious host and origin is rejected',async()=>{
 const handler=createClassifyHandler({GROQ_API_KEY:'key'})
 assert.equal((await testRequest(handler,{host:'evil.example:5175',origin:'http://evil.example:5175'})).res.statusCode,403)
})
test('21st request is limited and window expires',async()=>{
 let time=0,calls=0
 const handler=createClassifyHandler({GROQ_API_KEY:'key'},async()=>{calls++;return {}},console,()=>time)
 for(let i=0;i<20;i++)assert.equal((await testRequest(handler)).res.statusCode,200)
 assert.equal((await testRequest(handler)).res.statusCode,429)
 assert.equal(calls,20);time=60000
 assert.equal((await testRequest(handler)).res.statusCode,200)
})
test('concurrency cap rejects fourth request and releases slots',async()=>{
 const finish=[]
 const handler=createClassifyHandler({GROQ_API_KEY:'key'},()=>new Promise(resolve=>finish.push(resolve)))
 const running=[testRequest(handler),testRequest(handler),testRequest(handler)]
 // The slots are acquired before asynchronous body reading.
 assert.equal((await testRequest(handler)).res.body.code,'busy')
 while(finish.length<3)await new Promise(resolve=>setTimeout(resolve,0))
 finish.forEach(resolve=>resolve({}));await Promise.all(running)
})
test('oversized chunked upload is closed',async()=>{
 const handler=createClassifyHandler({GROQ_API_KEY:'key'})
 const stream=Readable.from([new Uint8Array(16000),new Uint8Array(16000)])
 const {req,res}=await testRequest(handler,{chunks:stream})
 assert.equal(res.statusCode,413);assert.equal(res.headers.Connection,'close');assert.equal(req.destroyed,true)
})
test('oversized content length is rejected before reading',async()=>{
 const handler=createClassifyHandler({GROQ_API_KEY:'key'})
 assert.equal((await testRequest(handler,{headers:{'content-length':'24001'}})).res.statusCode,413)
})
test('upload abort is not logged as a provider failure',async()=>{
 const logs=[]
 const handler=createClassifyHandler({GROQ_API_KEY:'key'},async()=>{assert.fail('No provider call')},{error(...args){logs.push(args)}})
 const stream=Readable.from((async function*(){yield 'abc';throw new Error('client aborted')})())
 const {res}=await testRequest(handler,{chunks:stream})
 assert.equal(res.statusCode,400);assert.equal(logs.length,0)
})
for(const code of ['bad_request','payload_too_large']) {
 test(`route preserves ${code}`,async()=>assert.equal((await request('{"message":"hello"}',{classify:async()=>{throw Object.assign(new Error(),{code})}})).res.body.code,code))
}
